ALTER TABLE public.tasks
ADD COLUMN scheduled_time TIME DEFAULT NULL;

COMMENT ON COLUMN public.tasks.scheduled_time IS 'Horário agendado para retorno ao cliente';