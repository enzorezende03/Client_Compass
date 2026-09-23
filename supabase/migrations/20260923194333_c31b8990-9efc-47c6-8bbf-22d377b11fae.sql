-- Ocorrências: colunas novas em timeline_entries
ALTER TABLE public.timeline_entries DROP CONSTRAINT IF EXISTS timeline_entries_responsibility_origin_check;
ALTER TABLE public.timeline_entries ADD CONSTRAINT timeline_entries_responsibility_origin_check
  CHECK (responsibility_origin IS NULL OR responsibility_origin IN ('escritorio','cliente','neutro'));
ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS severity text CHECK (severity IS NULL OR severity IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();
UPDATE public.timeline_entries SET occurred_at = date WHERE occurred_at IS DISTINCT FROM date;

CREATE INDEX IF NOT EXISTS idx_timeline_client ON public.timeline_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON public.timeline_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_resp_origin ON public.timeline_entries(responsibility_origin);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_task_id text;
CREATE INDEX IF NOT EXISTS idx_tasks_source_entry ON public.tasks(source_timeline_entry_id);

-- Auditoria de edição do texto
CREATE OR REPLACE FUNCTION public.log_timeline_description_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    SELECT name INTO v_name FROM internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
    INSERT INTO audit_logs(client_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.client_id, 'Ocorrência (descrição)', COALESCE(OLD.description,''), COALESCE(NEW.description,''), COALESCE(v_name,'Sistema'));
  END IF;
  IF NEW.responsibility_origin IS DISTINCT FROM OLD.responsibility_origin THEN
    SELECT name INTO v_name FROM internal_users WHERE auth_user_id = auth.uid() LIMIT 1;
    INSERT INTO audit_logs(client_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.client_id, 'Ocorrência (classificação)', COALESCE(OLD.responsibility_origin,''), COALESCE(NEW.responsibility_origin,''), COALESCE(v_name,'Sistema'));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_timeline_description ON public.timeline_entries;
CREATE TRIGGER trg_log_timeline_description AFTER UPDATE ON public.timeline_entries
FOR EACH ROW EXECUTE FUNCTION public.log_timeline_description_change();
REVOKE EXECUTE ON FUNCTION public.log_timeline_description_change() FROM PUBLIC, anon, authenticated;

-- Conclusão / reabertura de tarefa
CREATE OR REPLACE FUNCTION public.resolve_timeline_on_task_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sector text;
BEGIN
  IF NEW.source_timeline_entry_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT sector INTO v_sector FROM timeline_entries WHERE id = NEW.source_timeline_entry_id;
    UPDATE timeline_entries SET demand_status = 'resolved'
     WHERE id = NEW.source_timeline_entry_id AND demand_status <> 'resolved';
    INSERT INTO timeline_entries
      (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, responsibility_origin)
    VALUES
      (NEW.client_id, 'service', 'Tarefa concluída: ' || NEW.title,
       COALESCE(NULLIF(NEW.responsible,''),'Sistema'), COALESCE(v_sector,'commercial'), 'system', 'resolved', false, NULL);
  ELSIF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    UPDATE timeline_entries SET demand_status = 'in_progress' WHERE id = NEW.source_timeline_entry_id;
  END IF;
  RETURN NEW;
END $$;
UPDATE public.timeline_entries SET origin = 'system' WHERE description LIKE 'Tarefa concluída: %';

-- RPC atualizada
DROP FUNCTION IF EXISTS public.create_interaction_with_task(uuid,text,text,text,text,text,text,text,boolean,text,boolean,text,uuid,text,date,date,date,time);
CREATE OR REPLACE FUNCTION public.create_interaction_with_task(
  p_client_id uuid, p_type text, p_sector text, p_origin text, p_demand_status text, p_description text, p_responsible text,
  p_responsibility_origin text DEFAULT NULL, p_is_relevant boolean DEFAULT false, p_relevant_type text DEFAULT NULL,
  p_create_task boolean DEFAULT false, p_task_title text DEFAULT NULL, p_task_responsible_id uuid DEFAULT NULL,
  p_task_responsible text DEFAULT NULL, p_task_due_date date DEFAULT NULL, p_task_client_due_date date DEFAULT NULL,
  p_task_internal_due_date date DEFAULT NULL, p_task_time time DEFAULT NULL,
  p_severity text DEFAULT NULL, p_occurred_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_entry_id uuid; v_task_id uuid; v_at timestamptz := COALESCE(p_occurred_at, now());
BEGIN
  IF p_client_id IS NULL THEN RAISE EXCEPTION 'Cliente é obrigatório'; END IF;
  IF p_description IS NULL OR btrim(p_description) = '' THEN RAISE EXCEPTION 'Descrição é obrigatória'; END IF;
  IF p_type IN ('complaint','request','critical_issue')
     AND (p_responsibility_origin IS NULL OR p_responsibility_origin NOT IN ('escritorio','cliente','neutro')) THEN
    RAISE EXCEPTION 'Classificação obrigatória para reclamação, solicitação ou problema crítico';
  END IF;

  INSERT INTO timeline_entries
    (client_id, type, sector, origin, demand_status, description, responsible,
     is_relevant_event, relevant_event_type, responsibility_origin, severity, occurred_at, date)
  VALUES
    (p_client_id, p_type, p_sector, p_origin, p_demand_status, p_description, p_responsible,
     COALESCE(p_is_relevant,false), p_relevant_type, p_responsibility_origin, p_severity, v_at, v_at)
  RETURNING id INTO v_entry_id;

  IF COALESCE(p_create_task,false) THEN
    IF p_task_title IS NULL OR btrim(p_task_title) = '' THEN RAISE EXCEPTION 'Título da tarefa é obrigatório'; END IF;
    IF p_task_due_date IS NULL THEN RAISE EXCEPTION 'Data da tarefa é obrigatória'; END IF;
    INSERT INTO tasks
      (client_id, title, description, responsible, responsible_id, due_date, client_due_date, internal_due_date,
       scheduled_time, status, category, source_timeline_entry_id)
    VALUES
      (p_client_id, p_task_title, p_description, COALESCE(NULLIF(p_task_responsible,''),'Sistema'), p_task_responsible_id,
       p_task_due_date, p_task_client_due_date, p_task_internal_due_date, p_task_time, 'pending', 'regular', v_entry_id)
    RETURNING id INTO v_task_id;
  END IF;
  RETURN jsonb_build_object('timeline_entry_id', v_entry_id, 'task_id', v_task_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.create_interaction_with_task(uuid,text,text,text,text,text,text,text,boolean,text,boolean,text,uuid,text,date,date,date,time,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_interaction_with_task(uuid,text,text,text,text,text,text,text,boolean,text,boolean,text,uuid,text,date,date,date,time,text,timestamptz) TO authenticated;

-- Métricas de retrabalho
CREATE OR REPLACE FUNCTION public.rework_metrics(p_start date, p_end date, p_sector text DEFAULT NULL, p_responsible uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH base AS (
  SELECT e.*, (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
  FROM timeline_entries e
  WHERE e.origin <> 'system'
    AND (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    AND (p_sector IS NULL OR e.sector = p_sector)
    AND (p_responsible IS NULL OR e.created_by = p_responsible
         OR EXISTS (SELECT 1 FROM tasks t WHERE t.source_timeline_entry_id = e.id AND t.responsible_id = p_responsible))
),
cls AS (SELECT * FROM base WHERE responsibility_origin IS NOT NULL),
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
      GROUP BY c.client_id, cl.name HAVING count(*) >= 3) s), '[]'::jsonb)
);
$$;
REVOKE EXECUTE ON FUNCTION public.rework_metrics(date,date,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rework_metrics(date,date,text,uuid) TO authenticated;

-- Tempo real
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='timeline_entries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_entries;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;