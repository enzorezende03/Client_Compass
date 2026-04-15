
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'outro',
  priority TEXT NOT NULL DEFAULT 'medium',
  responsible TEXT NOT NULL DEFAULT '',
  due_date DATE NOT NULL DEFAULT (now() + '7 days'::interval),
  status TEXT NOT NULL DEFAULT 'pending',
  expected_result TEXT NOT NULL DEFAULT '',
  observations TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated internal users can read action_plans"
ON public.action_plans FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can insert action_plans"
ON public.action_plans FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

CREATE POLICY "Authenticated internal users can update action_plans"
ON public.action_plans FOR UPDATE TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can delete action_plans"
ON public.action_plans FOR DELETE TO authenticated
USING (public.is_internal_user());

CREATE TRIGGER update_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
