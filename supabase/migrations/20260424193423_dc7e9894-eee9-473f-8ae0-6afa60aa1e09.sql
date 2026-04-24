CREATE TABLE public.gclick_ignored_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gclick_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  inscricao TEXT NOT NULL DEFAULT '',
  ignored_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gclick_ignored_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated internal users can read gclick_ignored_clients"
ON public.gclick_ignored_clients
FOR SELECT
TO authenticated
USING (is_internal_user());

CREATE POLICY "Authenticated internal users can insert gclick_ignored_clients"
ON public.gclick_ignored_clients
FOR INSERT
TO authenticated
WITH CHECK (is_internal_user());

CREATE POLICY "Authenticated internal users can delete gclick_ignored_clients"
ON public.gclick_ignored_clients
FOR DELETE
TO authenticated
USING (is_internal_user());

CREATE INDEX idx_gclick_ignored_clients_gclick_id ON public.gclick_ignored_clients(gclick_id);