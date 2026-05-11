-- 1. Add onboarding fields to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS onboarding_stage text,
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- 2. onboarding_checklist_items
CREATE TABLE public.onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  order_index integer NOT NULL,
  title text NOT NULL,
  sla_hours integer NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can read onboarding_checklist_items"
  ON public.onboarding_checklist_items FOR SELECT
  TO authenticated USING (is_internal_user());

-- 3. client_onboarding_progress
CREATE TABLE public.client_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.onboarding_checklist_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  completed_by uuid REFERENCES public.internal_users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, checklist_item_id)
);
ALTER TABLE public.client_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can read client_onboarding_progress"
  ON public.client_onboarding_progress FOR SELECT
  TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can insert client_onboarding_progress"
  ON public.client_onboarding_progress FOR INSERT
  TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update client_onboarding_progress"
  ON public.client_onboarding_progress FOR UPDATE
  TO authenticated USING (is_internal_user());

-- 4. onboarding_handoff_forms
CREATE TABLE public.onboarding_handoff_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.internal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  activity text NOT NULL DEFAULT '',
  tax_regime text NOT NULL DEFAULT '',
  start_competency text NOT NULL DEFAULT '',
  received_docs text NOT NULL DEFAULT '',
  pending_docs text NOT NULL DEFAULT '',
  fiscal_issues text NOT NULL DEFAULT '',
  organization_level integer,
  has_employees boolean NOT NULL DEFAULT false,
  employee_count integer,
  nf_types text NOT NULL DEFAULT '',
  has_fixed_assets text NOT NULL DEFAULT '',
  next_steps text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT ''
);
ALTER TABLE public.onboarding_handoff_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can read onboarding_handoff_forms"
  ON public.onboarding_handoff_forms FOR SELECT
  TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can insert onboarding_handoff_forms"
  ON public.onboarding_handoff_forms FOR INSERT
  TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update onboarding_handoff_forms"
  ON public.onboarding_handoff_forms FOR UPDATE
  TO authenticated USING (is_internal_user());

-- 5. operational_monthly_reports
CREATE TABLE public.operational_monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  submitted_by uuid REFERENCES public.internal_users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  overall_status text NOT NULL DEFAULT 'Regular',
  completed_obligations text NOT NULL DEFAULT '',
  pending_items text NOT NULL DEFAULT '',
  cs_attention_points text NOT NULL DEFAULT '',
  integration_progress text NOT NULL DEFAULT '',
  operational_difficulties text NOT NULL DEFAULT '',
  upcoming_milestones text NOT NULL DEFAULT ''
);
ALTER TABLE public.operational_monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can read operational_monthly_reports"
  ON public.operational_monthly_reports FOR SELECT
  TO authenticated USING (is_internal_user());
CREATE POLICY "Internal users can insert operational_monthly_reports"
  ON public.operational_monthly_reports FOR INSERT
  TO authenticated WITH CHECK (is_internal_user());
CREATE POLICY "Internal users can update operational_monthly_reports"
  ON public.operational_monthly_reports FOR UPDATE
  TO authenticated USING (is_internal_user());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_onboarding_progress_client ON public.client_onboarding_progress(client_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_handoff_forms_client ON public.onboarding_handoff_forms(client_id);
CREATE INDEX IF NOT EXISTS idx_operational_monthly_reports_client ON public.operational_monthly_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_items_stage ON public.onboarding_checklist_items(stage, order_index);