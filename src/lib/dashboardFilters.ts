import type {
  ClientProfile, ClientStatus, FinancialStatus, HealthScore, TaxationType,
} from '@/types/client';
import type { Company } from '@/lib/company';
import { normalizeTaxation } from '@/lib/taxation';

export type DashboardStatusFilter = 'all' | Exclude<ClientStatus, 'cancelled'>;
export type DashboardHealthFilter = 'all' | HealthScore | 'unclassified';
export type DashboardTaxationFilter = 'all' | 'none' | TaxationType;

export interface DashboardFilters {
  company: 'all' | Company;
  profile: 'all' | ClientProfile;
  health: DashboardHealthFilter;
  status: DashboardStatusFilter;
  financial: 'all' | FinancialStatus;
  taxation: DashboardTaxationFilter;
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  company: 'all',
  profile: 'all',
  health: 'all',
  status: 'all',
  financial: 'all',
  taxation: 'all',
};

export interface DashboardFilterClient {
  company?: string | null;
  profile?: string | null;
  healthScore?: string | null;
  status: string;
  financialStatus?: string | null;
  taxation?: string | null;
  archived?: boolean;
}

export function matchesDashboardFilters(client: DashboardFilterClient, filters: DashboardFilters): boolean {
  if (client.archived || client.status === 'cancelled') return false;
  if (filters.company !== 'all' && client.company !== filters.company) return false;
  if (filters.profile !== 'all' && client.profile !== filters.profile) return false;
  if (filters.status !== 'all' && client.status !== filters.status) return false;
  if (filters.financial !== 'all' && client.financialStatus !== filters.financial) return false;

  if (filters.health === 'unclassified') {
    if (client.healthScore === 'healthy' || client.healthScore === 'attention' || client.healthScore === 'critical') return false;
  } else if (filters.health !== 'all' && client.healthScore !== filters.health) {
    return false;
  }

  if (filters.taxation === 'none') {
    if (client.taxation?.trim()) return false;
  } else if (filters.taxation !== 'all' && normalizeTaxation(client.taxation) !== filters.taxation) {
    return false;
  }

  return true;
}
