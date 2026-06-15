CREATE OR REPLACE FUNCTION public.sync_progress_lock_to_task()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sla int; v_due date;
BEGIN
  IF NEW.checklist_item_id IS NULL THEN RETURN NEW; END IF;

  -- When unlocking, restart the SLA clock: due dates = unlock date + SLA.
  IF NEW.locked = false AND NEW.unlocked_at IS NOT NULL
     AND (OLD.locked IS DISTINCT FROM NEW.locked OR OLD.unlocked_at IS DISTINCT FROM NEW.unlocked_at) THEN
    SELECT COALESCE(sla_hours, 48) INTO v_sla
    FROM public.onboarding_checklist_items WHERE id = NEW.checklist_item_id;
    v_due := (NEW.unlocked_at AT TIME ZONE 'UTC')::date + GREATEST(1, CEIL(v_sla / 24.0))::int;
    UPDATE public.tasks t
       SET locked = NEW.locked,
           unlocked_at = NEW.unlocked_at,
           force_unlocked_by = NEW.force_unlocked_by,
           force_unlock_reason = NEW.force_unlock_reason,
           due_date = v_due,
           internal_due_date = v_due
     WHERE t.client_id = NEW.client_id
       AND t.checklist_item_id = NEW.checklist_item_id;
  ELSE
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
  END IF;
  RETURN NEW;
END;
$$;