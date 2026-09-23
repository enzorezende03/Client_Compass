ALTER TABLE public.client_terminations
  ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'cliente' CHECK (initiated_by IN ('cliente','escritorio')),
  ADD COLUMN IF NOT EXISTS was_error boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_sector text,
  ADD COLUMN IF NOT EXISTS improvement_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS archive_client boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.archive_on_termination()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.archive_client THEN
    SELECT name INTO v_name FROM internal_users WHERE id = NEW.registered_by;
    UPDATE clients SET archived = true, archived_at = now(),
      archived_reason = 'Distrato: ' || NEW.reason_category || COALESCE(' — ' || NULLIF(NEW.reason_detail,''), ''),
      archived_by = COALESCE(v_name, '')
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_archive_on_termination ON public.client_terminations;
CREATE TRIGGER trg_archive_on_termination AFTER INSERT ON public.client_terminations
FOR EACH ROW EXECUTE FUNCTION public.archive_on_termination();