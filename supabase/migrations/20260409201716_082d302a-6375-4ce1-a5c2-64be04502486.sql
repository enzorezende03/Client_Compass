
-- Add G-Click reference fields to clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS gclick_id text,
ADD COLUMN IF NOT EXISTS gclick_carteira text DEFAULT '';

-- Create sync log table
CREATE TABLE public.gclick_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  details text DEFAULT '',
  records_synced integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gclick_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to gclick_sync_log"
ON public.gclick_sync_log
FOR ALL
TO public
USING (true)
WITH CHECK (true);
