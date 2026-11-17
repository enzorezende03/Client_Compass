import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_FILTERS, DashboardFilterClient, matchesDashboardFilters,
} from '@/lib/dashboardFilters';

const client: DashboardFilterClient = {
  company: '2m_contabilidade',
  profile: 'vip',
  healthScore: 'healthy',
  status: 'active',
  financialStatus: 'active_financial',
  taxation: 'lucro_real',
};

describe('filtros do dashboard', () => {
  it('separa 2M Saúde de 2M Contabilidade e combina o tier', () => {
    const filters = { ...DEFAULT_DASHBOARD_FILTERS, company: '2m_contabilidade' as const, profile: 'vip' as const };
    expect(matchesDashboardFilters(client, filters)).toBe(true);
    expect(matchesDashboardFilters({ ...client, company: '2m_saude' }, filters)).toBe(false);
    expect(matchesDashboardFilters({ ...client, profile: 'basic' }, filters)).toBe(false);
  });

  it('combina saúde, status, financeiro e tributação na mesma seleção', () => {
    const filters = {
      ...DEFAULT_DASHBOARD_FILTERS,
      health: 'critical' as const,
      status: 'at_risk' as const,
      financial: 'suspended' as const,
      taxation: 'lucro_real' as const,
    };
    const matching = { ...client, healthScore: 'critical', status: 'at_risk', financialStatus: 'suspended' };
    expect(matchesDashboardFilters(matching, filters)).toBe(true);
    expect(matchesDashboardFilters({ ...matching, taxation: 'simples_nacional' }, filters)).toBe(false);
  });

  it('reconhece clientes sem saúde classificada e sem tributação', () => {
    const filters = { ...DEFAULT_DASHBOARD_FILTERS, health: 'unclassified' as const, taxation: 'none' as const };
    expect(matchesDashboardFilters({ ...client, healthScore: '', taxation: '' }, filters)).toBe(true);
    expect(matchesDashboardFilters({ ...client, healthScore: 'healthy', taxation: '' }, filters)).toBe(false);
    expect(matchesDashboardFilters({ ...client, healthScore: '', taxation: 'lucro_real' }, filters)).toBe(false);
  });

  it('mantém arquivados e distratos fora da carteira ativa do dashboard', () => {
    expect(matchesDashboardFilters({ ...client, archived: true }, DEFAULT_DASHBOARD_FILTERS)).toBe(false);
    expect(matchesDashboardFilters({ ...client, status: 'cancelled' }, DEFAULT_DASHBOARD_FILTERS)).toBe(false);
  });
});
