ALTER TABLE public.timeline_entries ADD COLUMN IF NOT EXISTS is_occurrence boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_timeline_is_occurrence ON public.timeline_entries(is_occurrence) WHERE is_occurrence;

UPDATE public.timeline_entries SET is_occurrence = true
WHERE origin <> 'system'
  AND description NOT LIKE '[%'
  AND description NOT LIKE 'Pedido de distrato%'
  AND description NOT LIKE 'Distrato revertido%'
  AND description NOT LIKE 'Tarefa concluída:%'
  AND (type IN ('complaint','request','critical_issue') OR responsibility_origin IS NOT NULL);

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
     is_relevant_event, relevant_event_type, responsibility_origin, severity, occurred_at, date, is_occurrence)
  VALUES
    (p_client_id, p_type, p_sector, p_origin, p_demand_status, p_description, p_responsible,
     COALESCE(p_is_relevant,false), p_relevant_type, p_responsibility_origin, p_severity, v_at, v_at, true)
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

CREATE OR REPLACE FUNCTION public.rework_metrics(p_start date, p_end date, p_sector text DEFAULT NULL, p_responsible uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH base AS (
  SELECT e.*, (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS d
  FROM timeline_entries e
  WHERE e.is_occurrence
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