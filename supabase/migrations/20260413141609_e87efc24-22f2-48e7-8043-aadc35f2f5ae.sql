
CREATE TABLE public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated internal users can read client_contacts"
ON public.client_contacts FOR SELECT TO authenticated
USING (is_internal_user());

CREATE POLICY "Authenticated internal users can insert client_contacts"
ON public.client_contacts FOR INSERT TO authenticated
WITH CHECK (is_internal_user());

CREATE POLICY "Authenticated internal users can update client_contacts"
ON public.client_contacts FOR UPDATE TO authenticated
USING (is_internal_user());

CREATE POLICY "Authenticated internal users can delete client_contacts"
ON public.client_contacts FOR DELETE TO authenticated
USING (is_internal_user());
