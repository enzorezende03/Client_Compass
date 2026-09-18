CREATE TABLE public.internal_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_user_id uuid NOT NULL REFERENCES public.internal_users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('manage_sla_catalog','manage_onboarding_procedures')),
  granted_by uuid REFERENCES public.internal_users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (internal_user_id, permission)
);

GRANT SELECT, INSERT, DELETE ON public.internal_user_permissions TO authenticated;
GRANT ALL ON public.internal_user_permissions TO service_role;

ALTER TABLE public.internal_user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_read_permissions" ON public.internal_user_permissions
  FOR SELECT TO authenticated USING (public.is_internal_user());

CREATE POLICY "admin_insert_permissions" ON public.internal_user_permissions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_permissions" ON public.internal_user_permissions
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.has_permission(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.internal_user_permissions p
    JOIN public.internal_users u ON u.id = p.internal_user_id
    WHERE u.auth_user_id = auth.uid()
      AND u.active = true
      AND p.permission = _permission
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;