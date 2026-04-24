-- Add archive fields to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS archived_by TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_clients_archived ON public.clients(archived);

-- Function: when a client with gclick_id is deleted, add it to gclick_ignored_clients
CREATE OR REPLACE FUNCTION public.ignore_gclick_on_client_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.gclick_id IS NOT NULL AND OLD.gclick_id <> '' THEN
    INSERT INTO public.gclick_ignored_clients (gclick_id, nome, inscricao, ignored_by)
    VALUES (OLD.gclick_id, OLD.name, OLD.document, 'auto: cliente excluído do CSHUB')
    ON CONFLICT (gclick_id) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ignore_gclick_on_client_delete ON public.clients;
CREATE TRIGGER trg_ignore_gclick_on_client_delete
BEFORE DELETE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.ignore_gclick_on_client_delete();

-- Function: when a client is archived, add it to gclick_ignored_clients
CREATE OR REPLACE FUNCTION public.ignore_gclick_on_client_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived = true AND (OLD.archived IS DISTINCT FROM NEW.archived)
     AND NEW.gclick_id IS NOT NULL AND NEW.gclick_id <> '' THEN
    INSERT INTO public.gclick_ignored_clients (gclick_id, nome, inscricao, ignored_by)
    VALUES (NEW.gclick_id, NEW.name, NEW.document, 'auto: cliente arquivado no CSHUB')
    ON CONFLICT (gclick_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ignore_gclick_on_client_archive ON public.clients;
CREATE TRIGGER trg_ignore_gclick_on_client_archive
AFTER UPDATE OF archived ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.ignore_gclick_on_client_archive();