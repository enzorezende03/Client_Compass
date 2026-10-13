ALTER TABLE public.internal_user_permissions ADD COLUMN granted boolean NOT NULL DEFAULT true;
ALTER TABLE public.internal_user_permissions DROP CONSTRAINT IF EXISTS internal_user_permissions_permission_check;
ALTER TABLE public.internal_user_permissions ADD CONSTRAINT internal_user_permissions_permission_check CHECK (permission IN (
 'manage_occurrences','manage_sla_catalog','manage_onboarding_procedures',
 'occurrences.view','occurrences.create','occurrences.edit','occurrences.cancel',
 'clients.view','clients.create','clients.edit','clients.archive',
 'tasks.view','tasks.create','tasks.edit','tasks.reschedule','tasks.delete',
 'onboarding.view','onboarding.complete','onboarding.move_stage','onboarding.edit_procedure'));

INSERT INTO public.internal_user_permissions(internal_user_id, permission, granted_by, granted)
SELECT internal_user_id, x.p, granted_by, true FROM public.internal_user_permissions u
CROSS JOIN LATERAL (VALUES ('occurrences.edit'),('occurrences.cancel')) x(p)
WHERE u.permission='manage_occurrences' ON CONFLICT DO NOTHING;
INSERT INTO public.internal_user_permissions(internal_user_id, permission, granted_by, granted)
SELECT internal_user_id, 'onboarding.edit_procedure', granted_by, true FROM public.internal_user_permissions
WHERE permission='manage_onboarding_procedures' ON CONFLICT DO NOTHING;
COMMENT ON TABLE public.internal_user_permissions IS 'Per-user overrides of profile defaults (granted=true adds, false removes). manage_occurrences/manage_onboarding_procedures rows are DEPRECATED aliases.';

GRANT UPDATE ON public.internal_user_permissions TO authenticated;
CREATE POLICY admin_update_permissions ON public.internal_user_permissions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.profile_default_permission(_profile text, _perm text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _profile
    WHEN 'admin' THEN true
    WHEN 'cs' THEN _perm NOT IN ('occurrences.edit','occurrences.cancel','onboarding.edit_procedure','manage_sla_catalog')
    WHEN 'operacional' THEN _perm IN ('clients.view','occurrences.view','occurrences.create','tasks.view','onboarding.view')
    WHEN 'viewer' THEN _perm LIKE '%.view'
    ELSE false END $$;

CREATE OR REPLACE FUNCTION public.has_permission(_permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; p text; o boolean;
BEGIN
  p := CASE _permission WHEN 'manage_occurrences' THEN 'occurrences.edit'
                        WHEN 'manage_onboarding_procedures' THEN 'onboarding.edit_procedure'
                        ELSE _permission END;
  SELECT id, access_profile INTO u FROM internal_users WHERE auth_user_id = auth.uid() AND active LIMIT 1;
  IF u.id IS NULL THEN RETURN false; END IF;
  IF u.access_profile = 'admin' THEN RETURN true; END IF;
  SELECT granted INTO o FROM internal_user_permissions WHERE internal_user_id = u.id AND permission = p;
  IF o IS NOT NULL THEN RETURN o; END IF;
  RETURN public.profile_default_permission(u.access_profile, p);
END $$;

-- clients
DROP POLICY "Authenticated internal users can insert clients" ON public.clients;
CREATE POLICY "Authenticated internal users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_permission('clients.create'));
DROP POLICY "Authenticated internal users can update clients" ON public.clients;
CREATE POLICY "Authenticated internal users can update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_permission('clients.edit') OR public.has_permission('clients.archive') OR public.has_permission('onboarding.move_stage') OR public.has_permission('onboarding.complete'))
  WITH CHECK (public.has_permission('clients.edit') OR public.has_permission('clients.archive') OR public.has_permission('onboarding.move_stage') OR public.has_permission('onboarding.complete'));
DROP POLICY "Authenticated internal users can delete clients" ON public.clients;
CREATE POLICY "Authenticated internal users can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_permission('clients.archive'));

CREATE OR REPLACE FUNCTION public.enforce_client_field_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n jsonb; o jsonb; k text; other boolean := false;
BEGIN
  IF pg_trigger_depth() > 1 OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (NEW.archived IS DISTINCT FROM OLD.archived) AND NOT public.has_permission('clients.archive') THEN
    RAISE EXCEPTION 'permission denied: arquivar cliente' USING ERRCODE='42501'; END IF;
  IF (NEW.onboarding_stage IS DISTINCT FROM OLD.onboarding_stage OR NEW.onboarding_status IS DISTINCT FROM OLD.onboarding_status)
     AND NOT (public.has_permission('onboarding.move_stage') OR public.has_permission('onboarding.complete')) THEN
    RAISE EXCEPTION 'permission denied: mover etapa' USING ERRCODE='42501'; END IF;
  n := to_jsonb(NEW) - ARRAY['archived','archived_at','archived_reason','archived_by','onboarding_stage','onboarding_status','onboarding_started_at','onboarding_completed_at','onboarding_type','updated_at'];
  o := to_jsonb(OLD) - ARRAY['archived','archived_at','archived_reason','archived_by','onboarding_stage','onboarding_status','onboarding_started_at','onboarding_completed_at','onboarding_type','updated_at'];
  IF n IS DISTINCT FROM o AND NOT public.has_permission('clients.edit') THEN
    RAISE EXCEPTION 'permission denied: editar cliente' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enforce_client_field_permissions BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.enforce_client_field_permissions();

-- tasks
DROP POLICY "Writers insert tasks" ON public.tasks;
CREATE POLICY "Writers insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('tasks.create') OR (public.is_operacional() AND source_timeline_entry_id IS NOT NULL));
DROP POLICY "Writers update tasks" ON public.tasks;
CREATE POLICY "Writers update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.has_permission('tasks.edit') OR public.has_permission('tasks.reschedule') OR public.has_permission('onboarding.complete') OR responsible_id = public.current_internal_user_id())
  WITH CHECK (public.has_permission('tasks.edit') OR public.has_permission('tasks.reschedule') OR public.has_permission('onboarding.complete') OR responsible_id = public.current_internal_user_id());
DROP POLICY "Writers delete tasks" ON public.tasks;
CREATE POLICY "Writers delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.has_permission('tasks.delete'));
DROP POLICY "Internal users insert task_reschedules" ON public.task_reschedules;
CREATE POLICY "Internal users insert task_reschedules" ON public.task_reschedules FOR INSERT TO authenticated WITH CHECK (public.has_permission('tasks.reschedule'));

-- onboarding progress
DROP POLICY "Internal users can insert client_onboarding_progress" ON public.client_onboarding_progress;
CREATE POLICY "Internal users can insert client_onboarding_progress" ON public.client_onboarding_progress FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('onboarding.complete') OR public.has_permission('onboarding.move_stage'));
DROP POLICY "Internal users can update client_onboarding_progress" ON public.client_onboarding_progress;
CREATE POLICY "Internal users can update client_onboarding_progress" ON public.client_onboarding_progress FOR UPDATE TO authenticated
  USING (public.has_permission('onboarding.complete') OR public.has_permission('onboarding.move_stage'))
  WITH CHECK (public.has_permission('onboarding.complete') OR public.has_permission('onboarding.move_stage'));

-- occurrences
DROP POLICY "Authenticated internal users can read timeline_entries" ON public.timeline_entries;
CREATE POLICY "Authenticated internal users can read timeline_entries" ON public.timeline_entries FOR SELECT TO authenticated
  USING (public.is_internal_user() AND (NOT is_occurrence OR public.has_permission('occurrences.view')));
DROP POLICY "Writers insert timeline" ON public.timeline_entries;
CREATE POLICY "Writers insert timeline" ON public.timeline_entries FOR INSERT TO authenticated WITH CHECK (
  CASE WHEN is_occurrence THEN public.has_permission('occurrences.create')
        AND (NOT public.is_operacional() OR (occurrence_category='desvio_operacional' AND responsibility_origin='cliente'))
       ELSE public.can_write_clients() END);
DROP POLICY "Writers update timeline" ON public.timeline_entries;
CREATE POLICY "Writers update timeline" ON public.timeline_entries FOR UPDATE TO authenticated
  USING (CASE WHEN is_occurrence THEN public.has_permission('occurrences.edit') ELSE public.can_write_clients() END)
  WITH CHECK (CASE WHEN is_occurrence THEN public.has_permission('occurrences.edit') ELSE public.can_write_clients() END);

CREATE OR REPLACE FUNCTION public.cancel_occurrence(p_entry_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me record; e record;
BEGIN
  IF NOT public.has_permission('occurrences.cancel') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT * INTO me FROM public.occ_me();
  SELECT * INTO e FROM timeline_entries WHERE id = p_entry_id AND is_occurrence;
  IF NOT FOUND OR e.resolution_status='cancelada' THEN RAISE EXCEPTION 'Ocorrência não encontrada ou já cancelada'; END IF;
  UPDATE timeline_entries SET resolution_status='cancelada', cancel_reason=trim(p_reason), cancelled_by=me.id, cancelled_at=now() WHERE id = p_entry_id;
  UPDATE tasks SET status='cancelled' WHERE source_timeline_entry_id = p_entry_id AND status <> 'completed';
  INSERT INTO audit_logs(client_id, record_id, field_name, old_value, new_value, changed_by)
  VALUES (e.client_id, e.id, 'Ocorrência (cancelamento)', e.resolution_status, 'cancelada' || E'\n\nMotivo: ' || trim(p_reason), COALESCE(me.name,'Sistema'));
  INSERT INTO occurrence_treatments(entry_id, kind, content, author_id, author_name) VALUES (p_entry_id,'cancelamento',trim(p_reason), me.id, COALESCE(me.name,''));
END $$;

CREATE OR REPLACE FUNCTION public.edit_occurrence(p_entry_id uuid, p_reason text, p_description text, p_responsibility_origin text,
  p_category text, p_sector text, p_severity text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission('occurrences.edit') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  PERFORM set_config('cshub.edit_reason', trim(p_reason), true);
  UPDATE timeline_entries SET description = trim(p_description), responsibility_origin = p_responsibility_origin,
    occurrence_category = p_category, sector = p_sector, severity = p_severity
  WHERE id = p_entry_id AND is_occurrence AND resolution_status <> 'cancelada';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência não encontrada ou cancelada'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(p) FILTER (WHERE public.has_permission(p)), '{}') FROM unnest(ARRAY[
   'manage_sla_catalog','occurrences.view','occurrences.create','occurrences.edit','occurrences.cancel',
   'clients.view','clients.create','clients.edit','clients.archive',
   'tasks.view','tasks.create','tasks.edit','tasks.reschedule','tasks.delete',
   'onboarding.view','onboarding.complete','onboarding.move_stage','onboarding.edit_procedure']) p $$;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;