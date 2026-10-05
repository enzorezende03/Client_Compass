CREATE TABLE public.task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id),
  content text NOT NULL CHECK (length(trim(content)) > 0),
  author_id uuid REFERENCES public.internal_users(id) DEFAULT public.current_internal_user_id(),
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_updates_task ON public.task_updates(task_id, created_at DESC);
GRANT SELECT, INSERT ON public.task_updates TO authenticated;
GRANT ALL ON public.task_updates TO service_role;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal read task updates" ON public.task_updates FOR SELECT TO authenticated USING (public.is_internal_user());
CREATE POLICY "Writers add task updates" ON public.task_updates FOR INSERT TO authenticated
WITH CHECK (author_id = public.current_internal_user_id() AND (public.can_write_clients()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.responsible_id = public.current_internal_user_id())));

CREATE OR REPLACE FUNCTION public.set_task_update_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.author_id := public.current_internal_user_id();
  SELECT name INTO NEW.author_name FROM internal_users WHERE id = NEW.author_id;
  NEW.author_name := COALESCE(NEW.author_name, '');
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_task_update_author BEFORE INSERT ON public.task_updates FOR EACH ROW EXECUTE FUNCTION public.set_task_update_author();
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_updates;