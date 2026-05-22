
-- Revoke execute from anon/authenticated/public for SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.is_internal_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_auth_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ignore_gclick_on_client_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ignore_gclick_on_client_archive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_advance_onboarding_stage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- link_auth_user must remain callable by signed-in users (used after login)
GRANT EXECUTE ON FUNCTION public.link_auth_user() TO authenticated;
