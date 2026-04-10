
CREATE OR REPLACE FUNCTION public.link_auth_user()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.internal_users
  SET auth_user_id = auth.uid()
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND auth_user_id IS NULL;
$$;
