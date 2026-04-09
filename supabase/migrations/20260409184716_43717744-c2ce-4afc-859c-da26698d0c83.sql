CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to audit_logs"
ON public.audit_logs
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_audit_logs_client_id ON public.audit_logs(client_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
