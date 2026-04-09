
-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '',
  segment TEXT NOT NULL DEFAULT '',
  contract_start_date DATE NOT NULL DEFAULT now(),
  cs_responsible TEXT NOT NULL DEFAULT '',
  complexity TEXT NOT NULL DEFAULT 'C',
  status TEXT NOT NULL DEFAULT 'active',
  profile TEXT NOT NULL DEFAULT 'other',
  financial_status TEXT NOT NULL DEFAULT 'current',
  health_score TEXT NOT NULL DEFAULT 'healthy',
  pain_points TEXT NOT NULL DEFAULT '',
  expectations TEXT NOT NULL DEFAULT '',
  attention_points TEXT NOT NULL DEFAULT '',
  recurring_issues TEXT NOT NULL DEFAULT '',
  behavioral_profile TEXT NOT NULL DEFAULT '',
  strategic_notes TEXT NOT NULL DEFAULT '',
  risk_reason TEXT,
  risk_type TEXT,
  risk_identified_date DATE,
  action_plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- Timeline entries
CREATE TABLE public.timeline_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL DEFAULT 'service',
  description TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT 'fiscal',
  origin TEXT NOT NULL DEFAULT 'client',
  demand_status TEXT NOT NULL DEFAULT 'open',
  is_relevant_event BOOLEAN NOT NULL DEFAULT false,
  relevant_event_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to timeline_entries" ON public.timeline_entries FOR ALL USING (true) WITH CHECK (true);

-- Tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  responsible TEXT NOT NULL DEFAULT '',
  due_date DATE NOT NULL DEFAULT (now() + interval '7 days'),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- DIGISAC complaints (imported)
CREATE TABLE public.digisac_complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  contact_name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  matched_client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.digisac_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to digisac_complaints" ON public.digisac_complaints FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
