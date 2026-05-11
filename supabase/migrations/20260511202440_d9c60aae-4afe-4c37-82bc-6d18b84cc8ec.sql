ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS onboarding_stage text;

UPDATE public.tasks
   SET category = 'onboarding'
 WHERE category = 'regular' AND title LIKE '[Onboarding]%';

CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);