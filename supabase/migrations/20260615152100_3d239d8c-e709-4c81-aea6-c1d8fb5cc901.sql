-- 1. Link tasks to checklist items
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist_item_id uuid
  REFERENCES public.onboarding_checklist_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_checklist_item ON public.tasks(checklist_item_id);

-- Backfill existing onboarding tasks
UPDATE public.tasks t SET checklist_item_id = i.id
FROM public.onboarding_checklist_items i
WHERE t.category = 'onboarding' AND t.checklist_item_id IS NULL
  AND t.onboarding_stage = i.stage
  AND t.title = '[Onboarding] ' || i.title;

-- Remove obsolete auto-advance function (was never wired to a trigger and only handled empresa_nova)
DROP FUNCTION IF EXISTS public.auto_advance_onboarding_stage() CASCADE;

-- 2. Stage sequence helper
CREATE OR REPLACE FUNCTION public.onboarding_stage_sequence(p_type text)
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_type
    WHEN 'empresa_nova'    THEN ARRAY['constituicao','etapa_1_nova','etapa_2_nova','etapa_3_nova','concluido']
    WHEN 'em_constituicao' THEN ARRAY['constituicao','etapa_1_nova','etapa_2_nova','etapa_3_nova','concluido']
    WHEN 'vmk_parceria'    THEN ARRAY['constituicao','vmk_ativacao','concluido']
    ELSE ARRAY['etapa_1','etapa_2','etapa_3','etapa_4','concluido']
  END;
$$;

CREATE OR REPLACE FUNCTION public.onboarding_next_stage(p_stage text, p_type text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE seq text[]; idx int;
BEGIN
  seq := public.onboarding_stage_sequence(p_type);
  idx := array_position(seq, p_stage);
  IF idx IS NULL OR idx >= array_length(seq,1) THEN RETURN NULL; END IF;
  RETURN seq[idx+1];
END;
$$;

-- 3. Seed a stage's checklist progress rows + tasks (idempotent)
CREATE OR REPLACE FUNCTION public.seed_onboarding_stage(p_client_id uuid, p_stage text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_onboarding_progress (client_id, checklist_item_id, status)
  SELECT p_client_id, i.id, 'pendente'
  FROM public.onboarding_checklist_items i
  WHERE i.stage = p_stage
  ON CONFLICT (client_id, checklist_item_id) DO NOTHING;

  INSERT INTO public.tasks
    (client_id, title, description, responsible, due_date, internal_due_date,
     status, category, onboarding_stage, checklist_item_id)
  SELECT p_client_id,
         '[Onboarding] ' || i.title,
         'Item de onboarding (' || p_stage || ') — SLA: ' || COALESCE(i.sla_hours,48) || 'h',
         'Sistema',
         (CURRENT_DATE + GREATEST(1, CEIL(COALESCE(i.sla_hours,48)/24.0))::int),
         (CURRENT_DATE + GREATEST(1, CEIL(COALESCE(i.sla_hours,48)/24.0))::int),
         'pending', 'onboarding', p_stage, i.id
  FROM public.onboarding_checklist_items i
  WHERE i.stage = p_stage
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.client_id = p_client_id AND t.checklist_item_id = i.id
    );
END;
$$;

-- 4. Sync task status -> checklist progress
CREATE OR REPLACE FUNCTION public.sync_task_to_progress()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target text;
BEGIN
  IF NEW.checklist_item_id IS NULL THEN RETURN NEW; END IF;
  v_target := CASE WHEN NEW.status = 'completed' THEN 'concluido' ELSE 'pendente' END;
  UPDATE public.client_onboarding_progress p
     SET status = v_target,
         completed_at = CASE WHEN v_target = 'concluido' THEN COALESCE(p.completed_at, now()) ELSE NULL END
   WHERE p.client_id = NEW.client_id
     AND p.checklist_item_id = NEW.checklist_item_id
     AND p.status IS DISTINCT FROM v_target;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_task_to_progress
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_task_to_progress();

-- 5. Sync checklist progress status -> task
CREATE OR REPLACE FUNCTION public.sync_progress_to_task()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target text;
BEGIN
  v_target := CASE WHEN NEW.status = 'concluido' THEN 'completed' ELSE 'pending' END;
  UPDATE public.tasks t
     SET status = v_target
   WHERE t.client_id = NEW.client_id
     AND t.checklist_item_id = NEW.checklist_item_id
     AND t.status IS DISTINCT FROM v_target;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_progress_to_task
AFTER UPDATE OF status ON public.client_onboarding_progress
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_progress_to_task();

-- 6. Auto-advance when all required items of the current stage are done
CREATE OR REPLACE FUNCTION public.advance_onboarding_on_progress()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client RECORD; v_stage text; v_type text; v_remaining int; v_next text;
BEGIN
  IF NEW.status <> 'concluido' THEN RETURN NEW; END IF;

  SELECT id, onboarding_stage, onboarding_type, onboarding_status
    INTO v_client FROM public.clients WHERE id = NEW.client_id;
  IF v_client.id IS NULL OR v_client.onboarding_status = 'completed' THEN RETURN NEW; END IF;

  v_stage := v_client.onboarding_stage;
  v_type  := COALESCE(v_client.onboarding_type, 'empresa_existente');
  IF v_stage IS NULL OR v_stage = 'concluido' THEN RETURN NEW; END IF;
  -- constituição requires manual CNPJ conversion, never auto-advances
  IF v_stage = 'constituicao' THEN RETURN NEW; END IF;
  -- only react to items belonging to the current stage
  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_checklist_items i
    WHERE i.id = NEW.checklist_item_id AND i.stage = v_stage
  ) THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_remaining
  FROM public.client_onboarding_progress p
  JOIN public.onboarding_checklist_items i ON i.id = p.checklist_item_id
  WHERE p.client_id = NEW.client_id AND i.stage = v_stage
    AND i.is_required = true AND p.status <> 'concluido';
  IF v_remaining > 0 THEN RETURN NEW; END IF;

  v_next := public.onboarding_next_stage(v_stage, v_type);
  IF v_next IS NULL THEN RETURN NEW; END IF;

  IF v_next = 'concluido' THEN
    UPDATE public.clients
       SET onboarding_status = 'completed', onboarding_stage = 'concluido',
           onboarding_completed_at = now()
     WHERE id = NEW.client_id;
  ELSE
    UPDATE public.clients SET onboarding_stage = v_next WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_advance_onboarding_on_progress
AFTER UPDATE OF status ON public.client_onboarding_progress
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.advance_onboarding_on_progress();

-- 7. React to stage changes (auto-advance OR manual Kanban move): seed new stage,
--    mark prior stages' items as done, log timeline.
CREATE OR REPLACE FUNCTION public.on_client_stage_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq text[]; idx int; v_type text; v_prior text[];
BEGIN
  IF NEW.onboarding_stage IS NOT DISTINCT FROM OLD.onboarding_stage THEN RETURN NEW; END IF;
  IF NEW.onboarding_stage IS NULL THEN RETURN NEW; END IF;

  v_type := COALESCE(NEW.onboarding_type, 'empresa_existente');
  seq := public.onboarding_stage_sequence(v_type);

  -- seed items/tasks for the new active stage
  IF NEW.onboarding_stage <> 'concluido' THEN
    PERFORM public.seed_onboarding_stage(NEW.id, NEW.onboarding_stage);
  END IF;

  -- mark items of prior stages as completed (do not reset current/future items)
  idx := array_position(seq, NEW.onboarding_stage);
  IF idx IS NOT NULL AND idx > 1 THEN
    v_prior := seq[1:idx-1];
    UPDATE public.client_onboarding_progress p
       SET status = 'concluido', completed_at = COALESCE(p.completed_at, now())
      FROM public.onboarding_checklist_items i
     WHERE p.checklist_item_id = i.id
       AND p.client_id = NEW.id
       AND i.stage = ANY(v_prior)
       AND p.status <> 'concluido';
  END IF;

  -- timeline (skip the initial null -> first stage transition done on start)
  IF OLD.onboarding_stage IS NOT NULL THEN
    INSERT INTO public.timeline_entries
      (client_id, type, description, responsible, sector, origin, demand_status, is_relevant_event, relevant_event_type)
    VALUES
      (NEW.id, 'service',
       '[Onboarding] Etapa alterada para ' || NEW.onboarding_stage,
       'Sistema', 'commercial', 'internal',
       CASE WHEN NEW.onboarding_stage = 'concluido' THEN 'resolved' ELSE 'in_progress' END,
       true, 'onboarding');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_client_stage_change
AFTER UPDATE OF onboarding_stage ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.on_client_stage_change();

-- 8. Realtime: full row images + add tables to publication
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.client_onboarding_progress REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='client_onboarding_progress') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_onboarding_progress;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;