
CREATE TABLE IF NOT EXISTS public.task_reschedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL,
  client_id uuid NOT NULL,
  previous_due_date date NOT NULL,
  new_due_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  rescheduled_by uuid,
  rescheduled_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_reschedules_task ON public.task_reschedules(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reschedules_client ON public.task_reschedules(client_id);
CREATE INDEX IF NOT EXISTS idx_task_reschedules_created ON public.task_reschedules(created_at DESC);

ALTER TABLE public.task_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users read task_reschedules"
  ON public.task_reschedules FOR SELECT TO authenticated
  USING (is_internal_user());

CREATE POLICY "Internal users insert task_reschedules"
  ON public.task_reschedules FOR INSERT TO authenticated
  WITH CHECK (is_internal_user());

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reschedule_reason text,
  ADD COLUMN IF NOT EXISTS last_rescheduled_at timestamptz;
