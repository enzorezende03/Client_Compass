ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS responsibility_origin text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.internal_users(id);

ALTER TABLE public.timeline_entries
  DROP CONSTRAINT IF EXISTS timeline_entries_responsibility_origin_check;
ALTER TABLE public.timeline_entries
  ADD CONSTRAINT timeline_entries_responsibility_origin_check
  CHECK (responsibility_origin IS NULL OR responsibility_origin IN ('escritorio','cliente'));

CREATE OR REPLACE FUNCTION public.set_timeline_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := (
    SELECT u.id FROM public.internal_users u
    WHERE u.auth_user_id = auth.uid() AND u.active = true
    LIMIT 1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeline_created_by ON public.timeline_entries;
CREATE TRIGGER trg_timeline_created_by
BEFORE INSERT ON public.timeline_entries
FOR EACH ROW EXECUTE FUNCTION public.set_timeline_created_by();

CREATE OR REPLACE FUNCTION public.prevent_timeline_created_by_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_timeline_created_by_immutable ON public.timeline_entries;
CREATE TRIGGER trg_timeline_created_by_immutable
BEFORE UPDATE ON public.timeline_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_timeline_created_by_change();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_timeline_entry_id uuid REFERENCES public.timeline_entries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_source_timeline_entry_id
  ON public.tasks (source_timeline_entry_id);

CREATE OR REPLACE FUNCTION public.resolve_timeline_on_task_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sector text; v_origin text; v_resp_origin text;
BEGIN
  IF NEW.source_timeline_entry_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT sector, origin, responsibility_origin
    INTO v_sector, v_origin, v_resp_origin
  FROM public.timeline_entries WHERE id = NEW.source_timeline_entry_id;

  UPDATE public.timeline_entries
     SET demand_status = 'resolved'
   WHERE id = NEW.source_timeline_entry_id
     AND demand_status <> 'resolved';

  INSERT INTO public.timeline_entries
    (client_id, type, description, responsible, sector, origin, demand_status,
     is_relevant_event, responsibility_origin)
  VALUES
    (NEW.client_id, 'service', 'Tarefa concluída: ' || NEW.title,
     COALESCE(NULLIF(NEW.responsible, ''), 'Sistema'),
     COALESCE(v_sector, 'commercial'), COALESCE(v_origin, 'internal'), 'resolved',
     false, v_resp_origin);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_timeline_on_task_complete ON public.tasks;
CREATE TRIGGER trg_resolve_timeline_on_task_complete
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.resolve_timeline_on_task_complete();

CREATE OR REPLACE FUNCTION public.create_interaction_with_task(
  p_client_id uuid,
  p_type text,
  p_sector text,
  p_origin text,
  p_demand_status text,
  p_description text,
  p_responsible text,
  p_responsibility_origin text DEFAULT NULL,
  p_is_relevant boolean DEFAULT false,
  p_relevant_type text DEFAULT NULL,
  p_create_task boolean DEFAULT false,
  p_task_title text DEFAULT NULL,
  p_task_responsible_id uuid DEFAULT NULL,
  p_task_responsible text DEFAULT NULL,
  p_task_due_date date DEFAULT NULL,
  p_task_client_due_date date DEFAULT NULL,
  p_task_internal_due_date date DEFAULT NULL,
  p_task_time time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_entry_id uuid; v_task_id uuid;
BEGIN
  IF p_type IN ('complaint','request','critical_issue')
     AND (p_responsibility_origin IS NULL OR p_responsibility_origin NOT IN ('escritorio','cliente')) THEN
    RAISE EXCEPTION 'Classificação obrigatória para reclamação, solicitação ou problema crítico';
  END IF;

  INSERT INTO public.timeline_entries
    (client_id, type, sector, origin, demand_status, description, responsible,
     is_relevant_event, relevant_event_type, responsibility_origin)
  VALUES
    (p_client_id, p_type, p_sector, p_origin, p_demand_status, p_description, p_responsible,
     COALESCE(p_is_relevant,false), p_relevant_type, p_responsibility_origin)
  RETURNING id INTO v_entry_id;

  IF COALESCE(p_create_task,false) THEN
    IF p_task_title IS NULL OR btrim(p_task_title) = '' THEN
      RAISE EXCEPTION 'Título da tarefa é obrigatório';
    END IF;
    IF p_task_due_date IS NULL THEN
      RAISE EXCEPTION 'Data da tarefa é obrigatória';
    END IF;

    INSERT INTO public.tasks
      (client_id, title, description, responsible, responsible_id, due_date,
       client_due_date, internal_due_date, scheduled_time, status, category,
       source_timeline_entry_id)
    VALUES
      (p_client_id, p_task_title, COALESCE(p_description,''),
       COALESCE(NULLIF(p_task_responsible,''), 'Sistema'), p_task_responsible_id, p_task_due_date,
       p_task_client_due_date, p_task_internal_due_date, p_task_time, 'pending', 'regular',
       v_entry_id)
    RETURNING id INTO v_task_id;
  END IF;

  RETURN jsonb_build_object('timeline_entry_id', v_entry_id, 'task_id', v_task_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_interaction_with_task(uuid,text,text,text,text,text,text,text,boolean,text,boolean,text,uuid,text,date,date,date,time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_interaction_with_task(uuid,text,text,text,text,text,text,text,boolean,text,boolean,text,uuid,text,date,date,date,time) TO authenticated;