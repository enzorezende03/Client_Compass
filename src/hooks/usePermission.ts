import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GranularPermission =
  | 'occurrences.view' | 'occurrences.create' | 'occurrences.edit' | 'occurrences.cancel'
  | 'clients.view' | 'clients.create' | 'clients.edit' | 'clients.archive'
  | 'tasks.view' | 'tasks.create' | 'tasks.edit' | 'tasks.reschedule' | 'tasks.delete'
  | 'onboarding.view' | 'onboarding.complete' | 'onboarding.move_stage' | 'onboarding.edit_procedure';
export type AppPermission = 'manage_occurrences' | 'manage_sla_catalog' | 'manage_onboarding_procedures' | GranularPermission;

const ALIAS: Record<string, string> = { manage_occurrences: 'occurrences.edit', manage_onboarding_procedures: 'onboarding.edit_procedure' };

export function useMyPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_permissions' as any);
      if (error) return [] as string[];
      return (data as string[]) ?? [];
    },
  });
  const set = new Set(data ?? []);
  return { can: (p: AppPermission) => set.has(ALIAS[p] ?? p), isLoading };
}
export type AccessProfile = 'admin' | 'cs' | 'operacional' | 'viewer';

export function usePermission(permission: AppPermission) {
  const { can, isLoading } = useMyPermissions();
  return { allowed: can(permission), isLoading };
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
