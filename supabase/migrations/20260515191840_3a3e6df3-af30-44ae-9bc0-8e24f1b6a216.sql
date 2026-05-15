
-- 1) Migrate clients.onboarding_status to new lifecycle values
ALTER TABLE public.clients ALTER COLUMN onboarding_status DROP DEFAULT;

UPDATE public.clients SET onboarding_status = 'pending_handoff' WHERE onboarding_status = 'pendente';
UPDATE public.clients SET onboarding_status = 'active' WHERE onboarding_status = 'em_andamento';
UPDATE public.clients SET onboarding_status = 'completed' WHERE onboarding_status = 'concluido';

ALTER TABLE public.clients ALTER COLUMN onboarding_status SET DEFAULT 'pending_handoff';

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_onboarding_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_onboarding_status_check
  CHECK (onboarding_status IN ('pending_handoff','pending_onboarding','active','completed','paused'));

-- 2) commercial_handoff table
CREATE TABLE IF NOT EXISTS public.commercial_handoff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_value NUMERIC(10,2),
  payment_method TEXT CHECK (payment_method IN ('boleto','cartao','debito')),
  payment_due_day INTEGER CHECK (payment_due_day BETWEEN 1 AND 31),
  deal_closed_at DATE,
  salesperson TEXT,
  commercial_notes TEXT,
  filled_by UUID REFERENCES public.internal_users(id),
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

ALTER TABLE public.commercial_handoff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users read commercial_handoff"
  ON public.commercial_handoff FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Internal users insert commercial_handoff"
  ON public.commercial_handoff FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user());

CREATE POLICY "Internal users update commercial_handoff"
  ON public.commercial_handoff FOR UPDATE TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Internal users delete commercial_handoff"
  ON public.commercial_handoff FOR DELETE TO authenticated
  USING (public.is_internal_user());

CREATE TRIGGER trg_commercial_handoff_updated_at
  BEFORE UPDATE ON public.commercial_handoff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) client_contacts: add role check + is_whatsapp
-- 'role' column already exists as free text. Add is_whatsapp; we keep role free-text (no CHECK)
-- so existing values are preserved, but normalize empty to 'outro' and offer the new domain in UI.
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS is_whatsapp BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.client_contacts SET role = 'outro' WHERE role IS NULL OR role = '';
