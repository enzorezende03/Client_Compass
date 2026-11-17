ALTER TABLE public.clients
  ADD COLUMN company text NOT NULL DEFAULT '2m_saude';

ALTER TABLE public.clients
  ADD CONSTRAINT clients_company_check
  CHECK (company IN ('2m_saude', '2m_contabilidade'));

CREATE INDEX idx_clients_company ON public.clients(company);