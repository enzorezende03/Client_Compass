import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, ArrowRight, Building2, Download, FilterX, HeartPulse,
  Search, ShieldAlert, SlidersHorizontal, Stethoscope, TrendingDown, TrendingUp, Users,
  AlertTriangle,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { AppLayout } from '@/components/AppLayout';
import { HealthScoreBadge } from '@/components/HealthScoreBadge';
import { FinancialStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { currentMonthKey, fetchChurnMetrics, fetchChurnYearToDate, formatBRL } from '@/lib/churn';
import { useToast } from '@/hooks/use-toast';
import {
  Client, ClientStatus, ComplexityLevel, HealthScore, STATUS_LABELS,
  COMPLEXITY_LABELS, HEALTH_LABELS, PROFILE_COLORS, PROFILE_ICONS, PROFILE_LABELS, TAXATION_LABELS,
} from '@/types/client';
import { cn } from '@/lib/utils';
import { formatDocument } from '@/lib/document';
import { getTaxationLabel } from '@/lib/taxation';
import { COMPANY_LABELS, Company, getCompanyLabel, normalizeCompany } from '@/lib/company';
import {
  DashboardFilters, DEFAULT_DASHBOARD_FILTERS, DashboardHealthFilter,
  DashboardStatusFilter, DashboardTaxationFilter, matchesDashboardFilters,
} from '@/lib/dashboardFilters';

interface ClientWithArchive extends Client {
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  archivedBy?: string;
}

type PortfolioView = 'total' | 'healthy' | 'attention' | 'critical' | 'treatment' | 'suspended';

interface HealthCounts {
  total: number;
  healthy: number;
  attention: number;
  critical: number;
  unclassified: number;
  suspended: number;
  treatment: number;
  treatment_ids: string[];
}

const VIEW_LABELS: Record<PortfolioView, string> = {
  total: 'Total de clientes',
  healthy: 'Clientes saudáveis',
  attention: 'Clientes em atenção',
  critical: 'Clientes críticos',
  treatment: 'Clientes em tratamento',
  suspended: 'Financeiro suspenso',
};

const CHART_COLORS = {
  healthy: 'hsl(var(--health-healthy))',
  attention: 'hsl(var(--health-attention))',
  critical: 'hsl(var(--health-critical))',
};

function mapRow(row: any): ClientWithArchive {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    segment: row.segment,
    contractStartDate: row.contract_start_date,
    csResponsible: row.cs_responsible,
    complexity: row.complexity,
    status: row.status,
    profile: row.profile,
    financialStatus: row.financial_status,
    healthScore: row.health_score,
    painPoints: row.pain_points,
    expectations: row.expectations,
    attentionPoints: row.attention_points,
    recurringIssues: row.recurring_issues,
    behavioralProfile: row.behavioral_profile,
    strategicNotes: row.strategic_notes,
    riskReason: row.risk_reason ?? undefined,
    riskType: row.risk_type ?? undefined,
    riskIdentifiedDate: row.risk_identified_date ?? undefined,
    actionPlan: row.action_plan ?? undefined,
    taxation: row.taxation ?? undefined,
    company: normalizeCompany(row.company),
    archived: row.archived ?? false,
    archivedAt: row.archived_at ?? undefined,
    archivedReason: row.archived_reason ?? '',
    archivedBy: row.archived_by ?? '',
  };
}

export default function ClientList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clients, setClients] = useState<ClientWithArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<PortfolioView | null>(null);
  const [search, setSearch] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<ClientWithArchive | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({ ...DEFAULT_DASHBOARD_FILTERS });

  const { data: counts } = useQuery({
    queryKey: ['dashboard-health-counts'],
    queryFn: async (): Promise<HealthCounts> => {
      const { data, error } = await (supabase as any).rpc('dashboard_health_counts');
      if (error) throw error;
      return data as HealthCounts;
    },
  });
  const { data: churn } = useQuery({
    queryKey: ['churn-current-month'],
    queryFn: () => fetchChurnMetrics(currentMonthKey()),
  });
  const { data: churnYtd } = useQuery({
    queryKey: ['churn-year-to-date'],
    queryFn: fetchChurnYearToDate,
  });

  const loadClients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-health-counts'] });
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      setClients((data || []).map(mapRow));
      setLoading(false);
    });
  }, [queryClient]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const treatmentIds = useMemo(() => new Set(counts?.treatment_ids ?? []), [counts?.treatment_ids]);
  const filteredClients = useMemo(
    () => clients.filter(client => matchesDashboardFilters(client, filters)),
    [clients, filters],
  );
  const dashboardCounts = useMemo(() => ({
    total: filteredClients.length,
    healthy: filteredClients.filter(client => client.healthScore === 'healthy').length,
    attention: filteredClients.filter(client => client.healthScore === 'attention').length,
    critical: filteredClients.filter(client => client.healthScore === 'critical').length,
    unclassified: filteredClients.filter(client => !['healthy', 'attention', 'critical'].includes(client.healthScore)).length,
    suspended: filteredClients.filter(client => client.financialStatus === 'suspended').length,
    treatment: filteredClients.filter(client => treatmentIds.has(client.id) || client.status === 'recovery').length,
  }), [filteredClients, treatmentIds]);
  const activeFilterCount = Object.keys(filters).filter(key => (
    filters[key as keyof DashboardFilters] !== DEFAULT_DASHBOARD_FILTERS[key as keyof DashboardFilters]
  )).length;
  const updateFilter = <K extends keyof DashboardFilters,>(key: K, value: DashboardFilters[K]) => {
    setFilters(previous => ({ ...previous, [key]: value }));
  };
  const percent = (value: number) => dashboardCounts.total ? `${Math.round((value / dashboardCounts.total) * 100)}%` : '0%';

  const matchesView = useCallback((client: ClientWithArchive, view: PortfolioView) => {
    if (client.archived || client.status === 'cancelled') return false;
    if (view === 'total') return true;
    if (view === 'healthy') return client.healthScore === 'healthy';
    if (view === 'attention') return client.healthScore === 'attention';
    if (view === 'critical') return client.healthScore === 'critical';
    if (view === 'treatment') return treatmentIds.has(client.id) || client.status === 'recovery';
    return client.financialStatus === 'suspended';
  }, [treatmentIds]);

  const visibleClients = useMemo(() => {
    if (!selectedView) return [];
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return filteredClients.filter(client => matchesView(client, selectedView)).filter(client => (
      !normalized || client.name.toLocaleLowerCase('pt-BR').includes(normalized) || client.document.includes(normalized)
    ));
  }, [filteredClients, matchesView, search, selectedView]);

  const chartData = [
    { key: 'healthy', name: 'Saudáveis', value: dashboardCounts.healthy },
    { key: 'attention', name: 'Em atenção', value: dashboardCounts.attention },
    { key: 'critical', name: 'Críticos', value: dashboardCounts.critical },
  ];

  const openView = (view: PortfolioView) => {
    setSearch('');
    setSelectedView(view);
  };

  const exportClientsReport = () => {
    if (!selectedView) return;
    const rows = visibleClients.map(client => ({
      Nome: client.name,
      Documento: formatDocument(client.document),
      Segmento: client.segment,
      Empresa: getCompanyLabel(client.company),
      Status: STATUS_LABELS[client.status as ClientStatus] || client.status,
      'CS Responsável': client.csResponsible,
      Complexidade: COMPLEXITY_LABELS[client.complexity as ComplexityLevel] || client.complexity,
      Tier: PROFILE_LABELS[client.profile] || client.profile,
      'Health Score': HEALTH_LABELS[client.healthScore as HealthScore] || client.healthScore,
      Tributação: getTaxationLabel(client.taxation) || 'Não definida',
      'Início do contrato': client.contractStartDate,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Object.keys(rows[0] || {}).length }, () => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    XLSX.writeFile(workbook, `${VIEW_LABELS[selectedView].toLocaleLowerCase('pt-BR').replace(/ /g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Relatório baixado', description: `${rows.length} cliente(s) exportado(s).` });
  };

  const handleArchive = async () => {
    if (!archiveTarget || archiveReason.trim().length < 5) return;
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('clients').update({
        archived: true,
        archived_at: new Date().toISOString(),
        archived_reason: archiveReason.trim(),
        archived_by: user?.email || '',
      }).eq('id', archiveTarget.id);
      if (error) throw error;
      toast({ title: 'Cliente arquivado', description: `${archiveTarget.name} foi arquivado.` });
      setArchiveTarget(null);
      setArchiveReason('');
      loadClients();
    } catch (error: any) {
      toast({ title: 'Erro ao arquivar', description: error.message, variant: 'destructive' });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 lg:py-6">
        <div className="mb-5 flex items-center gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary shadow-sm sm:flex">
            <HeartPulse className="h-6 w-6" />
          </span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-primary">Visão geral da carteira</p>
            <h1 className="font-heading text-2xl font-bold text-foreground">Saúde dos clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Clique em uma situação para consultar os clientes.</p>
          </div>
        </div>

        <section aria-label="Filtros do dashboard" className="mb-4 rounded-lg border bg-card p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Filtrar carteira</h2>
                <p className="text-xs text-muted-foreground">{dashboardCounts.total} cliente{dashboardCounts.total === 1 ? '' : 's'} na seleção</p>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setFilters({ ...DEFAULT_DASHBOARD_FILTERS })}>
                <FilterX className="h-4 w-4" /> Limpar filtros ({activeFilterCount})
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <DashboardFilterSelect
              label="Empresa"
              value={filters.company}
              onChange={value => updateFilter('company', value as 'all' | Company)}
              options={[{ value: 'all', label: 'Todas as empresas' }, ...Object.entries(COMPANY_LABELS).map(([value, label]) => ({ value, label }))]}
            />
            <DashboardFilterSelect
              label="Tier"
              value={filters.profile}
              onChange={value => updateFilter('profile', value as DashboardFilters['profile'])}
              options={[{ value: 'all', label: 'Todos os tiers' }, ...Object.entries(PROFILE_LABELS).map(([value, label]) => ({ value, label }))]}
            />
            <DashboardFilterSelect
              label="Saúde"
              value={filters.health}
              onChange={value => updateFilter('health', value as DashboardHealthFilter)}
              options={[
                { value: 'all', label: 'Todas as saúdes' },
                { value: 'healthy', label: 'Saudável' },
                { value: 'attention', label: 'Atenção' },
                { value: 'critical', label: 'Crítico' },
                { value: 'unclassified', label: 'Sem classificação' },
              ]}
            />
            <DashboardFilterSelect
              label="Status"
              value={filters.status}
              onChange={value => updateFilter('status', value as DashboardStatusFilter)}
              options={[
                { value: 'all', label: 'Todos os status' },
                { value: 'active', label: 'Ativo' },
                { value: 'at_risk', label: 'Em Risco' },
                { value: 'recovery', label: 'Em Recuperação' },
              ]}
            />
            <DashboardFilterSelect
              label="Financeiro"
              value={filters.financial}
              onChange={value => updateFilter('financial', value as DashboardFilters['financial'])}
              options={[
                { value: 'all', label: 'Todas as situações' },
                { value: 'active_financial', label: 'Ativo' },
                { value: 'suspended', label: 'Suspenso' },
              ]}
            />
            <DashboardFilterSelect
              label="Tributação"
              value={filters.taxation}
              onChange={value => updateFilter('taxation', value as DashboardTaxationFilter)}
              options={[
                { value: 'all', label: 'Todas as tributações' },
                ...Object.entries(TAXATION_LABELS).map(([value, label]) => ({ value, label })),
                { value: 'none', label: 'Sem tributação' },
              ]}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <StatCard className="xl:col-span-4" icon={Building2} label="Total de clientes" value={dashboardCounts.total} onClick={() => openView('total')} footer={dashboardCounts.unclassified ? `${dashboardCounts.unclassified} sem classificação` : 'Carteira ativa'} />
          <StatCard className="xl:col-span-4" icon={HeartPulse} label="Saudáveis" value={dashboardCounts.healthy} percent={percent(dashboardCounts.healthy)} tone="healthy" onClick={() => openView('healthy')} footer="Carteira estável" />
          <StatCard className="xl:col-span-4" icon={ShieldAlert} label="Críticos" value={dashboardCounts.critical} percent={percent(dashboardCounts.critical)} tone="critical" emphasis onClick={() => openView('critical')} footer="Exigem atenção imediata" />
          <StatCard className="xl:col-span-4" icon={AlertTriangle} label="Em atenção" value={dashboardCounts.attention} percent={percent(dashboardCounts.attention)} tone="attention" onClick={() => openView('attention')} />
          <StatCard className="xl:col-span-4" icon={Stethoscope} label="Em tratamento" value={dashboardCounts.treatment} percent={percent(dashboardCounts.treatment)} onClick={() => openView('treatment')} footer="Com plano de ação ou acompanhamento" />
          <StatCard className="xl:col-span-4" icon={TrendingUp} label="Financeiro suspenso" value={dashboardCounts.suspended} percent={percent(dashboardCounts.suspended)} tone="attention" onClick={() => openView('suspended')} />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-foreground">Distribuição da saúde</h2>
                <p className="mt-1 text-xs text-muted-foreground">Clientes ativos por classificação</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 22, bottom: 0, left: 6 }}>
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={82} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={({ active, payload }) => active && payload?.length ? (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-card">
                      <span className="font-semibold">{payload[0].payload.name}:</span> {payload[0].value}
                    </div>
                  ) : null} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={24} onClick={(entry) => openView(entry.key)} className="cursor-pointer">
                    {chartData.map(item => <Cell key={item.key} fill={CHART_COLORS[item.key as keyof typeof CHART_COLORS]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <button type="button" onClick={() => navigate('/execucao?aba=onboarding')} className="group rounded-lg border border-primary/20 bg-primary p-5 text-left text-primary-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="flex h-full min-h-56 flex-col">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground"><TrendingDown className="h-5 w-5" /></span>
                <ArrowRight className="h-4 w-4 text-primary-foreground/60 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-7 text-sm font-medium text-primary-foreground/70">Churn acumulado do ano</p>
              <div className="mt-2 flex items-end gap-2">
                <strong className={cn('text-4xl font-bold', (churnYtd?.distratos_periodo ?? 0) > 0 ? 'text-destructive-foreground' : 'text-primary-foreground')}>
                  {(churnYtd?.taxa_churn ?? 0).toString().replace('.', ',')}%
                </strong>
                <span className="pb-1 text-xs text-primary-foreground/60">{churnYtd?.distratos_periodo ?? 0} distrato{(churnYtd?.distratos_periodo ?? 0) === 1 ? '' : 's'}</span>
              </div>
              <p className="mt-1 text-xs text-primary-foreground/60">{formatBRL(churnYtd?.receita_mensal_perdida)} de mensalidade perdida no ano</p>
              <p className="mt-auto pt-5 text-xs text-primary-foreground/60">Mês atual: {(churn?.taxa_churn ?? 0).toString().replace('.', ',')}% · {churn?.distratos_periodo ?? 0} distrato{(churn?.distratos_periodo ?? 0) === 1 ? '' : 's'}</p>
            </div>
          </button>
        </section>
      </main>

      <Sheet open={selectedView !== null} onOpenChange={open => { if (!open) setSelectedView(null); }}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <SheetTitle>{selectedView ? VIEW_LABELS[selectedView] : 'Clientes'}</SheetTitle>
                <SheetDescription className="mt-1">{visibleClients.length} cliente{visibleClients.length === 1 ? '' : 's'} encontrado{visibleClients.length === 1 ? '' : 's'}</SheetDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportClientsReport} disabled={!visibleClients.length}>
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          </SheetHeader>
          <div className="border-b px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou CPF/CNPJ" className="pl-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Carregando clientes...</p>
            ) : visibleClients.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhum cliente nesta situação.</p>
            ) : visibleClients.map(client => (
              <div key={client.id} className="group mb-2 rounded-md border bg-card p-4 transition-colors hover:bg-muted/40">
                <button type="button" className="w-full text-left" onClick={() => navigate(`/client/${client.id}`)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{client.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDocument(client.document)} · {client.segment}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">CS responsável: {client.csResponsible || 'Não definido'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{getCompanyLabel(client.company)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                     <span className={cn(
                       'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold',
                       PROFILE_COLORS[client.profile]?.bg,
                       PROFILE_COLORS[client.profile]?.text,
                       PROFILE_COLORS[client.profile]?.border,
                     )}>
                       <span className="text-sm leading-none">{PROFILE_ICONS[client.profile] || '●'}</span>
                       {PROFILE_LABELS[client.profile] || client.profile}
                     </span>
                    <HealthScoreBadge score={client.healthScore} />
                    <FinancialStatusBadge status={client.financialStatus} />
                  </div>
                </button>
                <div className="mt-3 border-t pt-3 text-right">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setArchiveTarget(client)}><Archive className="h-4 w-4" /> Arquivar</Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!archiveTarget} onOpenChange={open => { if (!open) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arquivar cliente</DialogTitle><DialogDescription>{archiveTarget?.name} deixará de aparecer na carteira ativa.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Justificativa <span className="text-destructive">*</span></label>
            <Textarea value={archiveReason} onChange={event => setArchiveReason(event.target.value)} rows={4} placeholder="Informe o motivo do arquivamento" />
            <p className="text-xs text-muted-foreground">Mínimo de 5 caracteres.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button><Button onClick={handleArchive} disabled={archiving || archiveReason.trim().length < 5}>{archiving ? 'Arquivando...' : 'Arquivar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}

function DashboardFilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full bg-background" aria-label={`Filtrar por ${label.toLocaleLowerCase('pt-BR')}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, percent, footer, tone, emphasis, onClick, className }: {
  icon: typeof Building2;
  label: string;
  value: number;
  percent?: string;
  footer?: string;
  tone?: 'healthy' | 'attention' | 'critical';
  emphasis?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const toneClass = tone === 'healthy' ? 'text-health-healthy' : tone === 'attention' ? 'text-health-attention' : tone === 'critical' ? 'text-destructive' : 'text-foreground';
  return (
    <button type="button" onClick={onClick} className={cn(
      'group rounded-lg border border-l-4 bg-card p-2.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover',
      tone === 'healthy' && 'border-l-health-healthy',
      tone === 'attention' && 'border-l-health-attention',
      tone === 'critical' && 'border-l-destructive',
      !tone && 'border-l-primary',
      emphasis && 'bg-destructive/5 hover:border-destructive/60',
      className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <span className={cn('mt-[1px] shrink-0', toneClass)}><Icon className="h-3.5 w-3.5" /></span>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5"><strong className={cn('text-xl font-bold leading-none', toneClass)}>{value}</strong>{percent && <span className="text-[10px] text-muted-foreground">{percent} da carteira</span>}</div>
      {footer && <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{footer}</p>}
    </button>
  );
}