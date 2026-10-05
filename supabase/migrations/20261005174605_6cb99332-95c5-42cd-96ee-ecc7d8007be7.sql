ALTER TABLE public.internal_users DROP CONSTRAINT IF EXISTS internal_users_access_profile_check;
ALTER TABLE public.internal_users ADD CONSTRAINT internal_users_access_profile_check CHECK (access_profile IN ('admin','cs','operacional','viewer'));

ALTER TABLE public.internal_user_permissions DROP CONSTRAINT IF EXISTS internal_user_permissions_permission_check;
ALTER TABLE public.internal_user_permissions ADD CONSTRAINT internal_user_permissions_permission_check CHECK (permission IN ('manage_occurrences','manage_sla_catalog','manage_onboarding_procedures'));

CREATE OR REPLACE FUNCTION public.current_access_profile() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT access_profile FROM public.internal_users WHERE auth_user_id = auth.uid() AND active = true LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.current_internal_user_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.internal_users WHERE auth_user_id = auth.uid() AND active = true LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.is_viewer() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_access_profile() = 'viewer', false) $$;
CREATE OR REPLACE FUNCTION public.is_operacional() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_access_profile() = 'operacional', false) $$;
CREATE OR REPLACE FUNCTION public.can_write_clients() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_access_profile() IN ('admin','cs'), false) $$;
CREATE OR REPLACE FUNCTION public.is_writer() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_access_profile() IN ('admin','cs','operacional'), false) $$;

-- Generic: every write policy that only required is_internal_user() now requires can_write_clients()
DO $$
DECLARE r record; v_using text; v_check text;
BEGIN
  FOR r IN SELECT * FROM pg_policies WHERE schemaname='public' AND cmd <> 'SELECT'
    AND tablename NOT IN ('tasks','timeline_entries','audit_logs','notifications','internal_users','internal_user_permissions')
    AND (coalesce(qual,'') LIKE '%is_internal_user()%' OR coalesce(with_check,'') LIKE '%is_internal_user()%')
  LOOP
    v_using := replace(r.qual, 'is_internal_user()', 'can_write_clients()');
    v_check := replace(r.with_check, 'is_internal_user()', 'can_write_clients()');
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s', r.policyname, r.tablename, r.cmd,
      CASE WHEN v_using IS NOT NULL THEN 'USING ('||v_using||')' ELSE '' END,
      CASE WHEN v_check IS NOT NULL THEN 'WITH CHECK ('||v_check||')' ELSE '' END);
  END LOOP;
END $$;

-- Logs / notifications: any non-viewer
DROP POLICY IF EXISTS "Authenticated internal users can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated internal users can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_writer());
DROP POLICY IF EXISTS "Authenticated internal users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated internal users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_writer());

-- Sync log: only admin/cs can read
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gclick_sync_log' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.gclick_sync_log', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admin and CS read sync log" ON public.gclick_sync_log FOR SELECT TO authenticated USING (public.can_write_clients());

-- Tasks
DROP POLICY IF EXISTS "Authenticated internal users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated internal users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated internal users can delete tasks" ON public.tasks;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND cmd<>'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.tasks', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Writers insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_write_clients() OR (public.is_operacional() AND source_timeline_entry_id IS NOT NULL));
CREATE POLICY "Writers update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.can_write_clients() OR (public.is_operacional() AND responsible_id = public.current_internal_user_id()))
  WITH CHECK (public.can_write_clients() OR (public.is_operacional() AND responsible_id = public.current_internal_user_id()));
CREATE POLICY "Writers delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.can_write_clients());

-- Timeline entries / occurrences
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='timeline_entries' AND cmd<>'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.timeline_entries', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Writers insert timeline" ON public.timeline_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_write_clients() OR (public.is_operacional() AND is_occurrence = true));
CREATE POLICY "Writers update timeline" ON public.timeline_entries FOR UPDATE TO authenticated
  USING (CASE WHEN is_occurrence THEN public.has_permission('manage_occurrences') ELSE public.can_write_clients() END)
  WITH CHECK (CASE WHEN is_occurrence THEN public.has_permission('manage_occurrences') ELSE public.can_write_clients() END);
CREATE POLICY "Writers delete timeline" ON public.timeline_entries FOR DELETE TO authenticated
  USING (CASE WHEN is_occurrence THEN public.has_permission('manage_occurrences') ELSE public.can_write_clients() END);

GRANT EXECUTE ON FUNCTION public.current_access_profile(), public.current_internal_user_id(), public.is_viewer(), public.is_operacional(), public.can_write_clients(), public.is_writer() TO authenticated;