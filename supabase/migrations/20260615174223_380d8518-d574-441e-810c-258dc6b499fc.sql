-- ============================================================
-- Sequential stage unlocking for onboarding
-- ============================================================

-- 1. Lock columns on the canonical progress table
ALTER TABLE public.client_onboarding_progress
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_unlocked_by uuid REFERENCES public.internal_users(id),
  ADD COLUMN IF NOT EXISTS force_unlock_reason text,
  ADD COLUMN IF NOT EXISTS force_unlocked_at timestamptz;

-- Mirror lock columns on tasks (for the Tasks panel)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_unlocked_by uuid REFERENCES public.internal_users(id),
  ADD COLUMN IF NOT EXISTS force_unlock_reason text;

-- 2. Audit table for forced unlocks
CREATE TABLE IF NOT EXISTS public.task_force_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid REFERENCES public.client_onboarding_progress(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage text,
  unlocked_by uuid REFERENCES public.internal_users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_force_unlocks TO authenticated;
GRANT ALL ON public.task_force_unlocks TO service_role;
ALTER TABLE public.task_force_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Internal users manage force unlocks" ON public.task_force_unlocks;
CREATE POLICY "Internal users manage force unlocks" ON public.task_force_unlocks
  FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- 3. Re-create seed_onboarding_stage with a lock parameter
DROP FUNCTION IF EXISTS public.seed_onboarding_stage(uuid, text);
CREATE OR REPLACE FUNCTION public.seed_onboarding_stage(
  p_client_id uuid, p_stage text, p_locked boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_onboarding_progress
    (client_id, checklist_item_id, status, locked, unlocked_at)
  SELECT p_client_id, i.id, 'pendente', p_locked,
         CASE WHEN p_locked THEN NULL ELSE now() END
  FROM public.onboarding_checklist_items i
  WHERE i.stage = p_stage
  ON CONFLICT (client_id, checklist_item_id) DO NOTHING;

  INSERT INTO public.tasks
    (client_id, title, description, responsible, due_date, internal_due_date,
     status, category, onboarding_stage, checklist_item_id, locked, unlocked_at)
  SELECT p_client_id,
         '[Onboarding] ' || i.title,
         'Item de onboarding (' || p_stage || ') — SLA: ' || COALESCE(i.sla_hours,48) || 'h',
         'Sistema',
         (CURRENT_DATE + GREATEST(1, CEIL(COALESCE(i.sla_hours,48)/24.0))::int),
         (CURRENT_DATE + GREATEST(1, CEIL(COALESCE(i.sla_hours,48)/24.0))::int),
         'pending', 'onboarding', p_stage, i.id, p_locked,
         CASE WHEN p_locked THEN NULL ELSE now() END
  FROM public.onboarding_checklist_items i
  WHERE i.stage = p_stage
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.client_id = p_client_id AND t.checklist_item_id = i.id
    );
END;
$$;

-- 4. Seed every stage of a client's flow, with proper lock state.
--    Used by startOnboarding, conversion, and backfill.
CREATE OR REPLACE FUNCTION public.bootstrap_onboarding_locks(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text; v_cur text; seq text[]; v_idx int; s text; s_idx int; v_locked boolean;
BEGIN
  SELECT COALESCE(onboarding_type,'empresa_existente'), onboarding_stage
    INTO v_type, v_cur FROM public.clients WHERE id = p_client_id;
  IF v_cur IS NULL THEN RETURN; END IF;
  seq := public.onboarding_stage_sequence(v_type);
  v_idx := array_position(seq, v_cur);
  IF v_idx IS NULL THEN v_idx := 1; END IF;

  FOREACH s IN ARRAY seq LOOP
    IF s = 'concluido' THEN CONTINUE; END IF;
    s_idx := array_position(seq, s);
    v_locked := (s_idx > v_idx);

    -- create rows/tasks for this stage if missing
    PERFORM public.seed_onboarding_stage(p_client_id, s, v_locked);

    -- enforce lock state on existing rows (skip manually force-unlocked items)
    UPDATE public.client_onboarding_progress p
       SET locked = v_locked,
           unlocked_at = CASE WHEN v_locked THEN NULL ELSE COALESCE(p.unlocked_at, now()) END
      FROM public.onboarding_checklist_items i
     WHERE p.checklist_item_id = i.id
       AND p.client_id = p_client_id
       AND i.stage = s
       AND p.force_unlocked_by IS NULL;

    -- past stages: mark items as completed
    IF s_idx < v_idx THEN
      UPDATE public.client_onboarding_progress p
         SET status = 'concluido', completed_at = COALESCE(p.completed_at, now())
        FROM public.onboarding_checklist_items i
       WHERE p.checklist_item_id = i.id
         AND p.client_id = p_client_id
         AND i.stage = s
         AND p.status <> 'concluido';
    END IF;
  END LOOP;
END;
$$;

-- 5. Mirror lock state from progress -> task
CREATE OR REPLACE FUNCTION public.sync_progress_lock_to_task()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.checklist_item_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.tasks t
     SET locked = NEW.locked,
         unlocked_at = NEW.unlocked_at,
         force_unlocked_by = NEW.force_unlocked_by,
         force_unlock_reason = NEW.force_unlock_reason
   WHERE t.client_id = NEW.client_id
     AND t.checklist_item_id = NEW.checklist_item_id
     AND (t.locked IS DISTINCT FROM NEW.locked
          OR t.unlocked_at IS DISTINCT FROM NEW.unlocked_at
          OR t.force_unlocked_by IS DISTINCT FROM NEW.force_unlocked_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_progress_lock_to_task ON public.client_onboarding_progress;
CREATE TRIGGER trg_sync_progress_lock_to_task
AFTER UPDATE OF locked, unlocked_at, force_unlocked_by ON public.client_onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION public.sync_progress_lock_to_task();

-- 6. On stage change: unlock the now-active stage (rows already exist), mark prior done
CREATE OR REPLACE FUNCTION public.on_client_stage_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq text[]; idx int; v_type text; v_prior text[];
BEGIN
  IF NEW.onboarding_stage IS NOT DISTINCT FROM OLD.onboarding_stage THEN RETURN NEW; END IF;
  IF NEW.onboarding_stage IS NULL THEN RETURN NEW; END IF;

  v_type := COALESCE(NEW.onboarding_type, 'empresa_existente');
  seq := public.onboarding_stage_sequence(v_type);

  IF NEW.onboarding_stage <> 'concluido' THEN
    -- ensure rows exist (idempotent), unlocked since this stage is now active
    PERFORM public.seed_onboarding_stage(NEW.id, NEW.onboarding_stage, false);
    -- unlock the active stage's items and start their SLA
    UPDATE public.client_onboarding_progress p
       SET locked = false, unlocked_at = COALESCE(p.unlocked_at, now())
      FROM public.onboarding_checklist_items i
     WHERE p.checklist_item_id = i.id
       AND p.client_id = NEW.id
       AND i.stage = NEW.onboarding_stage
       AND p.locked = true;
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

-- 7. Backfill: seed all stages + lock state for every in-progress client
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE onboarding_status = 'active' AND onboarding_stage IS NOT NULL LOOP
    PERFORM public.bootstrap_onboarding_locks(r.id);
  END LOOP;
END $$;