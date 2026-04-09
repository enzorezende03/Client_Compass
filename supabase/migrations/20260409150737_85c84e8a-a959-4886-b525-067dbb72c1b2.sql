
CREATE TABLE public.internal_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT 'fiscal',
  role TEXT NOT NULL DEFAULT '',
  access_profile TEXT NOT NULL DEFAULT 'cs',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to internal_users"
ON public.internal_users
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_internal_users_updated_at
BEFORE UPDATE ON public.internal_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
