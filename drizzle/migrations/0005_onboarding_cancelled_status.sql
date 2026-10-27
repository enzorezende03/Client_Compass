ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_onboarding_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_onboarding_status_check
  CHECK (onboarding_status IN ('pending_handoff','pending_onboarding','active','completed','paused','cancelled'));