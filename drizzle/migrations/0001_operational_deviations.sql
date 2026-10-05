ALTER TABLE public.timeline_entries
  ADD COLUMN occurrence_category text CHECK (occurrence_category IS NULL OR occurrence_category IN ('desvio_operacional','atendimento','reclamacao','solicitacao','problema_critico','feedback','oportunidade','outro')),
  ADD COLUMN raised_by_area text CHECK (raised_by_area IS NULL OR raised_by_area IN ('cs','operacional','fiscal','contabil','dp','societario','comercial')),
  ADD COLUMN assigned_cs_id uuid REFERENCES public.internal_users(id),
  ADD COLUMN resolution_status text NOT NULL DEFAULT 'aberta' CHECK (resolution_status IN ('aberta','em_tratativa','resolvida','cancelada')),
  ADD COLUMN cancel_reason text,
  ADD COLUMN cancelled_by uuid REFERENCES public.internal_users(id),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN missing_info text,
  ADD COLUMN client_charged boolean,
  ADD COLUMN client_charged_at date,
  ADD COLUMN initial_followup boolean NOT NULL DEFAULT false,
  ADD COLUMN assumed_at timestamptz,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolution_outcome text;

UPDATE public.timeline_entries SET resolution_status = CASE WHEN demand_status='resolved' THEN 'resolvida' WHEN demand_status='open' THEN 'aberta' ELSE 'em_tratativa' END,
  occurrence_category = CASE type WHEN 'complaint' THEN 'reclamacao' WHEN 'request' THEN 'solicitacao' WHEN 'critical_issue' THEN 'problema_critico' WHEN 'feedback' THEN 'feedback' WHEN 'opportunity' THEN 'oportunidade' WHEN 'service' THEN 'atendimento' ELSE 'outro' END
WHERE is_occurrence;

CREATE INDEX IF NOT EXISTS idx_timeline_assigned_cs ON public.timeline_entries(assigned_cs_id);

ALTER TABLE public.audit_logs ADD COLUMN record_id uuid;
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(record_id);

CREATE TABLE public.occurrence_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.timeline_entries(id),
  kind text NOT NULL CHECK (kind IN ('registro','assumir','tratativa','resolucao','cancelamento')),
  content text NOT NULL DEFAULT '',
  author_id uuid REFERENCES public.internal_users(id),
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.occurrence_treatments TO authenticated;
GRANT ALL ON public.occurrence_treatments TO service_role;
ALTER TABLE public.occurrence_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal read treatments" ON public.occurrence_treatments FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE INDEX idx_occ_treat_entry ON public.occurrence_treatments(entry_id);

-- Policies
DROP POLICY IF EXISTS "Writers insert timeline" ON public.timeline_entries;
CREATE POLICY "Writers insert timeline" ON public.timeline_entries FOR INSERT TO authenticated
WITH CHECK (public.can_write_clients() OR (public.is_operacional() AND is_occurrence = true
  AND occurrence_category = 'desvio_operacional' AND responsibility_origin = 'cliente'));
DROP POLICY IF EXISTS "Writers delete timeline" ON public.timeline_entries;
CREATE POLICY "Writers delete timeline" ON public.timeline_entries FOR DELETE TO authenticated
USING (NOT is_occurrence AND public.can_write_clients());

-- Audit trigger (generic, with reason + record id)
CREATE OR REPLACE FUNCTION public.log_timeline_description_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_reason text := NULLIF(current_setting('cshub.edit_reason', true), '');
  f text; o text; n text;
  labels jsonb := '{"description":"Ocorrência (descrição)","responsibility_origin":"Ocorrência (classificação)","occurrence_category":"Ocorrência (categoria)","sector":"Ocorrência (setor)","severity":"Ocorrência (gravidade)"}';
BEGIN
  SELECT name INTO v_name FROM internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
  FOR f IN SELECT jsonb_object_keys(labels) LOOP
    o := to_jsonb(OLD)->>f; n := to_jsonb(NEW)->>f;
    IF o IS DISTINCT FROM n THEN
      INSERT INTO audit_logs(client_id, record_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.client_id, NEW.id, labels->>f, COALESCE(o,''),
        COALESCE(n,'') || CASE WHEN v_reason IS NOT NULL THEN E'\n\nJustificativa: ' || v_reason ELSE '' END,
        COALESCE(v_name,'Sistema'));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.occ_me() RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name FROM internal_users WHERE auth_user_id = auth.uid() AND active LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.register_operational_deviation(
  p_client_id uuid, p_description text, p_sector text, p_occurred_at timestamptz,
  p_missing_info text, p_client_charged boolean, p_client_charged_at date, p_severity text, p_create_task boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me record; c record; v_cs uuid; v_cs_name text; v_initial boolean; v_id uuid; v_task uuid;
BEGIN
  IF NOT (public.is_operacional() OR public.can_write_clients()) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  IF COALESCE(trim(p_description),'') = '' THEN RAISE EXCEPTION 'Descreva o que aconteceu'; END IF;
  SELECT * INTO me FROM public.occ_me();
  SELECT * INTO c FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  SELECT u.id, u.name INTO v_cs, v_cs_name FROM internal_users u
    WHERE u.active AND lower(trim(u.name)) = lower(trim(c.cs_responsible)) LIMIT 1;
  IF v_cs IS NULL THEN
    SELECT u.id, u.name INTO v_cs, v_cs_name FROM internal_users u
      WHERE u.active AND (u.role ILIKE '%coord%' OR u.role ILIKE '%líder%' OR u.role ILIKE '%lider%') AND (u.sector ILIKE '%cs%' OR u.sector ILIKE '%sucesso%' OR u.access_profile='cs')
      ORDER BY u.created_at LIMIT 1;
  END IF;
  IF v_cs IS NULL THEN
    SELECT u.id, u.name INTO v_cs, v_cs_name FROM internal_users u
      WHERE u.active AND u.access_profile IN ('cs','admin') ORDER BY (u.access_profile='cs') DESC, u.created_at LIMIT 1;
  END IF;
  v_initial := c.onboarding_status = 'active' OR (c.onboarding_status='completed' AND c.onboarding_completed_at >= now() - interval '90 days');

  INSERT INTO timeline_entries(client_id, date, occurred_at, type, description, responsible, sector, origin, demand_status,
    is_relevant_event, is_occurrence, responsibility_origin, severity, occurrence_category, raised_by_area, assigned_cs_id,
    resolution_status, missing_info, client_charged, client_charged_at, initial_followup)
  VALUES (p_client_id, COALESCE(p_occurred_at, now()), COALESCE(p_occurred_at, now()), 'request', trim(p_description),
    COALESCE(v_cs_name, 'Equipe CS'), p_sector, 'client', 'open', false, true, 'cliente', p_severity, 'desvio_operacional',
    'operacional', v_cs, 'aberta', NULLIF(trim(p_missing_info),''), p_client_charged, CASE WHEN p_client_charged THEN p_client_charged_at END, v_initial)
  RETURNING id INTO v_id;

  INSERT INTO occurrence_treatments(entry_id, kind, content, author_id, author_name)
  VALUES (v_id, 'registro', 'Desvio operacional registrado', me.id, COALESCE(me.name,'Sistema'));

  IF p_create_task AND v_cs IS NOT NULL THEN
    INSERT INTO tasks(client_id, title, description, responsible, responsible_id, due_date, status, category, source_timeline_entry_id)
    VALUES (p_client_id, 'Tratar desvio operacional — ' || c.name, trim(p_description), v_cs_name, v_cs,
      (public.add_business_days(now(), 2) AT TIME ZONE 'America/Sao_Paulo')::date, 'pending', 'regular', v_id)
    RETURNING id INTO v_task;
  END IF;

  IF v_cs IS NOT NULL THEN
    INSERT INTO notifications(user_id, task_id, title, message, type)
    VALUES (v_cs, v_task, 'Novo desvio operacional — ' || c.name,
      COALESCE(me.name,'Operacional') || ' registrou: ' || left(trim(p_description), 140), 'occurrence');
  END IF;
  RETURN jsonb_build_object('id', v_id, 'assigned_cs_id', v_cs, 'assigned_cs_name', v_cs_name, 'task_id', v_task, 'initial_followup', v_initial);
END $$;

CREATE OR REPLACE FUNCTION public.occurrence_action(p_entry_id uuid, p_action text, p_text text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me record; e record;
BEGIN
  SELECT * INTO me FROM public.occ_me();
  SELECT * INTO e FROM timeline_entries WHERE id = p_entry_id AND is_occurrence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência não encontrada'; END IF;
  IF NOT (public.can_write_clients() OR (me.id IS NOT NULL AND e.assigned_cs_id = me.id)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  IF e.resolution_status IN ('cancelada','resolvida') THEN RAISE EXCEPTION 'Ocorrência já encerrada'; END IF;
  IF p_action = 'assumir' THEN
    UPDATE timeline_entries SET assigned_cs_id = COALESCE(me.id, assigned_cs_id), resolution_status='em_tratativa',
      demand_status='in_progress', assumed_at = COALESCE(assumed_at, now()), responsible = COALESCE(me.name, responsible) WHERE id = p_entry_id;
    INSERT INTO occurrence_treatments(entry_id, kind, content, author_id, author_name) VALUES (p_entry_id,'assumir','Assumiu a tratativa', me.id, COALESCE(me.name,''));
  ELSIF p_action = 'tratativa' THEN
    IF COALESCE(trim(p_text),'')='' THEN RAISE EXCEPTION 'Descreva a tratativa'; END IF;
    UPDATE timeline_entries SET resolution_status='em_tratativa', demand_status='in_progress', assumed_at = COALESCE(assumed_at, now()) WHERE id = p_entry_id;
    INSERT INTO occurrence_treatments(entry_id, kind, content, author_id, author_name) VALUES (p_entry_id,'tratativa',trim(p_text), me.id, COALESCE(me.name,''));
  ELSIF p_action = 'resolver' THEN
    IF COALESCE(trim(p_text),'')='' THEN RAISE EXCEPTION 'Descreva o desfecho'; END IF;
    UPDATE timeline_entries SET resolution_status='resolvida', demand_status='resolved', resolved_at=now(), resolution_outcome=trim(p_text) WHERE id = p_entry_id;
    INSERT INTO occurrence_treatments(entry_id, kind, content, author_id, author_name) VALUES (p_entry_id,'resolucao',trim(p_text), me.id, COALESCE(me.name,''));
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.edit_occurrence(p_entry_id uuid, p_reason text, p_description text, p_responsibility_origin text,
  p_category text, p_sector text, p_severity text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission('manage_occurrences') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  PERFORM set_config('cshub.edit_reason', trim(p_reason), true);
  UPDATE timeline_entries SET description = trim(p_description), responsibility_origin = p_responsibility_origin,
    occurrence_category = p_category, sector = p_sector, severity = p_severity
  WHERE id = p_entry_id AND is_occurrence AND resolution_status <> 'cancelada';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrência não encontrada ou cancelada'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_occurrence(p_entry_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me record; e record;
BEGIN
  IF NOT public.has_permission('manage_occurrences') THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
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

REVOKE EXECUTE ON FUNCTION public.register_operational_deviation(uuid,text,text,timestamptz,text,boolean,date,text,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.occurrence_action(uuid,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.edit_occurrence(uuid,text,text,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_occurrence(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_operational_deviation(uuid,text,text,timestamptz,text,boolean,date,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.occurrence_action(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_occurrence(uuid,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_occurrence(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rework_metrics(p_start date, p_end date, p_sector text DEFAULT NULL::text, p_responsible uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT e.*, (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
  FROM timeline_entries e
  WHERE e.is_occurrence AND e.resolution_status <> 'cancelada'
    AND (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    AND (p_sector IS NULL OR e.sector = p_sector)
    AND (p_responsible IS NULL OR e.created_by = p_responsible OR e.assigned_cs_id = p_responsible
         OR EXISTS (SELECT 1 FROM tasks t WHERE t.source_timeline_entry_id = e.id AND t.responsible_id = p_responsible))
),
cls AS (SELECT * FROM base WHERE responsibility_origin IS NOT NULL),
dev AS (SELECT * FROM base WHERE occurrence_category = 'desvio_operacional' AND raised_by_area = 'operacional'),
res AS (
  SELECT EXTRACT(EPOCH FROM (MIN(x.created_at) - c.created_at))/3600 AS h
  FROM cls c
  JOIN tasks t ON t.source_timeline_entry_id = c.id AND t.status = 'completed'
  JOIN timeline_entries x ON x.client_id = c.client_id AND x.origin = 'system'
       AND x.description = 'Tarefa concluída: ' || t.title AND x.created_at >= c.created_at
  GROUP BY c.id, c.created_at
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM cls),
  'escritorio', (SELECT count(*) FROM cls WHERE responsibility_origin='escritorio'),
  'cliente', (SELECT count(*) FROM cls WHERE responsibility_origin='cliente'),
  'neutro', (SELECT count(*) FROM cls WHERE responsibility_origin='neutro'),
  'unclassified', (SELECT count(*) FROM base WHERE responsibility_origin IS NULL),
  'open', (SELECT count(*) FROM cls WHERE demand_status <> 'resolved'),
  'avg_resolution_hours', (SELECT round(avg(h)::numeric,1) FROM res),
  'monthly', COALESCE((SELECT jsonb_agg(m ORDER BY m->>'month') FROM (
      SELECT jsonb_build_object('month', to_char(d,'YYYY-MM'),
        'escritorio', count(*) FILTER (WHERE responsibility_origin='escritorio'),
        'cliente', count(*) FILTER (WHERE responsibility_origin='cliente'),
        'neutro', count(*) FILTER (WHERE responsibility_origin='neutro')) m
      FROM cls GROUP BY to_char(d,'YYYY-MM')) s), '[]'::jsonb),
  'by_sector', COALESCE((SELECT jsonb_agg(r ORDER BY (r->>'total')::int DESC) FROM (
      SELECT jsonb_build_object('sector', sector,
        'escritorio', count(*) FILTER (WHERE responsibility_origin='escritorio'),
        'cliente', count(*) FILTER (WHERE responsibility_origin='cliente'),
        'neutro', count(*) FILTER (WHERE responsibility_origin='neutro'),
        'total', count(*)) r
      FROM cls GROUP BY sector) s), '[]'::jsonb),
  'recurrence', COALESCE((SELECT jsonb_agg(r ORDER BY (r->>'total')::int DESC) FROM (
      SELECT jsonb_build_object('client_id', c.client_id, 'client_name', cl.name, 'total', count(*),
        'escritorio', count(*) FILTER (WHERE c.responsibility_origin='escritorio'),
        'cliente', count(*) FILTER (WHERE c.responsibility_origin='cliente'),
        'neutro', count(*) FILTER (WHERE c.responsibility_origin='neutro')) r
      FROM cls c JOIN clients cl ON cl.id = c.client_id
      GROUP BY c.client_id, cl.name HAVING count(*) >= 3) s), '[]'::jsonb),
  'deviations', jsonb_build_object(
    'total', (SELECT count(*) FROM dev),
    'initial_followup', (SELECT count(*) FROM dev WHERE initial_followup),
    'open', (SELECT count(*) FROM dev WHERE resolution_status <> 'resolvida'),
    'avg_treatment_hours', (SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::numeric,1) FROM dev WHERE resolved_at IS NOT NULL),
    'top_clients', COALESCE((SELECT jsonb_agg(r ORDER BY (r->>'total')::int DESC) FROM (
        SELECT jsonb_build_object('client_id', d.client_id, 'client_name', cl.name, 'total', count(*)) r
        FROM dev d JOIN clients cl ON cl.id = d.client_id GROUP BY d.client_id, cl.name ORDER BY count(*) DESC LIMIT 5) s), '[]'::jsonb),
    'by_sector', COALESCE((SELECT jsonb_agg(r ORDER BY (r->>'total')::int DESC) FROM (
        SELECT jsonb_build_object('sector', sector, 'total', count(*), 'open', count(*) FILTER (WHERE resolution_status <> 'resolvida')) r
        FROM dev GROUP BY sector) s), '[]'::jsonb)
  )
);
$function$;