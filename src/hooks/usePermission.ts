import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppPermission = 'manage_occurrences' | 'manage_sla_catalog' | 'manage_onboarding_procedures';
export type AccessProfile = 'admin' | 'cs' | 'operacional' | 'viewer';

export function usePermission(permission: AppPermission) {
  const { data, isLoading } = useQuery({
    queryKey: ['permission', permission],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_permission' as any, { _permission: permission });
      if (error) return false;
      return Boolean(data);
    },
  });
  return { allowed: Boolean(data), isLoading };
}

export function useAccessProfile() {
  const { data, isLoading } = useQuery({
    queryKey: ['access-profile'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_access_profile' as any);
      if (error) return null;
      return (data as AccessProfile | null) ?? null;
    },
  });
  const profile = data ?? null;
  return {
    profile,
    isLoading,
    isAdmin: profile === 'admin',
    isViewer: profile === 'viewer',
    isOperacional: profile === 'operacional',
    canWriteClients: profile === 'admin' || profile === 'cs',
  };
}

export function useIsAdmin() {
  const { isAdmin, isLoading } = useAccessProfile();
  return { isAdmin, isLoading };
}
