-- Restore EXECUTE on helper functions used by RLS policies.
-- Without this, authenticated users cannot evaluate is_internal_user()/is_admin()
-- and every RLS-protected table returns zero rows.
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;