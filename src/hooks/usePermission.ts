import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppPermission = 'manage_sla_catalog' | 'manage_onboarding_procedures';

export function usePermission(permission: AppPermission) {
  const { data, isLoading } = useQuery({
    queryKey: ['permission', permission],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_permission' as any, {
        _permission: permission,
      });
      if (error) return false;
      return Boolean(data);
    },
  });

  return { allowed: Boolean(data), isLoading };
}

export function useIsAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['is-admin'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin' as any);
      if (error) return false;
      return Boolean(data);
    },
  });

  return { isAdmin: Boolean(data), isLoading };
}
