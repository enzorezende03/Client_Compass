ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS internal_due_date date,
  ADD COLUMN IF NOT EXISTS client_due_date date;

UPDATE public.tasks SET client_due_date = due_date WHERE client_due_date IS NULL;