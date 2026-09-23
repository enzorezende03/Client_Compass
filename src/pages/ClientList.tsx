import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, ArchiveRestore, ArrowRight, Building2, Download, HeartPulse,
  Search, ShieldAlert, Stethoscope, TrendingDown, TrendingUp, Users,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { currentMonthKey, fetchChurnMetrics, formatBRL } from '@/lib/churn';
import { useToast } from '@/hooks/use-toast';
import {
  Client, ClientStatus, ComplexityLevel, HealthScore, STATUS_LABELS,
  COMPLEXITY_LABELS, HEALTH_LABELS, PROFILE_LABELS,
} from '@/types/client';
import { cn } from '@/lib/utils';
import { formatDocument } from '@/lib/document';

interface ClientWithArchive extends Client {
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  archivedBy?: string;
}

type PortfolioView = 'total' | 'healthy' | 'attention' | 'critical' | 'treatment' | 'suspended' | 'archived';

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
  archived: 'Clientes arquivados',
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
  const [unarchiveTarget, setUnarchiveTarget] = useState<ClientWithArchive | null>(null);

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

  const loadClients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-health-counts'] });
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      setClients((data || []).map(mapRow));
      setLoading(false);
    });
  }, [queryClient]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const treatmentIds = useMemo(() => new Set(counts?.treatment_ids ?? []), [counts?.treatment_ids]);
  const archivedCount = clients.filter(client => client.archived).length;
  const percent = (value: number) => counts?.total ? `${Math.round((value / counts.total) * 100)}%` : '0%';

  const matchesView = useCallback((client: ClientWithArchive, view: PortfolioView) => {
    if (view === 'archived') return !!client.archived;
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
    return clients.filter(client => matchesView(client, selectedView)).filter(client => (
      !normalized || client.name.toLocaleLowerCase('pt-BR').includes(normalized) || client.document.includes(normalized)
    ));
  }, [clients, matchesView, search, selectedView]);

  const chartData = [
    { key: 'healthy', name: 'Saudáveis', value: counts?.healthy ?? 0 },
    { key: 'attention', name: 'Em atenção', value: counts?.attention ?? 0 },
    { key: 'critical', name: 'Críticos', value: counts?.critical ?? 0 },
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
      Status: STATUS_LABELS[client.status as ClientStatus] || client.status,
      'CS Responsável': client.csResponsible,
      Complexidade: COMPLEXITY_LABELS[client.complexity as ComplexityLevel] || client.complexity,
      Tier: PROFILE_LABELS[client.profile] || client.profile,
      'Health Score': HEALTH_LABELS[client.healthScore as HealthScore] || client.healthScore,
      'Início do contrato': client.contractStartDate,
      ...(selectedView === 'archived' ? {
        'Justificativa arquivamento': client.archivedReason,
        'Arquivado em': client.archivedAt ? new Date(client.archivedAt).toLocaleDateString('pt-BR') : '',
        'Arquivado por': client.archivedBy,
      } : {}),
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

  const handleUnarchive = async () => {
    if (!unarchiveTarget) return;
    try {
      const { error } = await supabase.from('clients').update({
        archived: false, archived_at: null, archived_reason: '', archived_by: '',
      }).eq('id', unarchiveTarget.id);
      if (error) throw error;
      toast({ title: 'Cliente desarquivado', description: `${unarchiveTarget.name} voltou para a carteira ativa.` });
      setUnarchiveTarget(null);
      loadClients();
    } catch (error: any) {
      toast({ title: 'Erro ao desarquivar', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 lg:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary shadow-sm sm:flex">
              <HeartPulse className="h-6 w-6" />
            </span>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-primary">Visão geral da carteira</p>
              <h1 className="font-heading text-2xl font-bold text-foreground">Saúde dos clientes</h1>
              <p className="mt-1 text-sm text-muted-foreground">Clique em uma situação para consultar os clientes.</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2 self-start" onClick={() => openView('archived')}>
            <Archive className="h-4 w-4" /> Arquivados ({archivedCount})
          </Button>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <StatCard className="xl:col-span-4" icon={Building2} label="Total de clientes" value={counts?.total ?? 0} onClick={() => openView('total')} footer={counts?.unclassified ? `${counts.unclassified} sem classificação` : 'Carteira ativa'} />
          <StatCard className="xl:col-span-4" icon={HeartPulse} label="Saudáveis" value={counts?.healthy ?? 0} percent={percent(counts?.healthy ?? 0)} tone="healthy" onClick={() => openView('healthy')} footer="Carteira estável" />
          <StatCard className="xl:col-span-4" icon={ShieldAlert} label="Críticos" value={counts?.critical ?? 0} percent={percent(counts?.critical ?? 0)} tone="critical" emphasis onClick={() => openView('critical')} footer="Exigem atenção imediata" />
          <StatCard className="xl:col-span-4" icon={AlertTriangle} label="Em atenção" value={counts?.attention ?? 0} percent={percent(counts?.attention ?? 0)} tone="attention" onClick={() => openView('attention')} />
          <StatCard className="xl:col-span-4" icon={Stethoscope} label="Em tratamento" value={counts?.treatment ?? 0} percent={percent(counts?.treatment ?? 0)} onClick={() => openView('treatment')} footer="Com plano de ação ou acompanhamento" />
          <StatCard className="xl:col-span-4" icon={TrendingUp} label="Financeiro suspenso" value={counts?.suspended ?? 0} percent={percent(counts?.suspended ?? 0)} tone="attention" onClick={() => openView('suspended')} />
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

          <button type="button" onClick={() => navigate('/onboarding')} className="group rounded-lg border border-primary/20 bg-primary p-5 text-left text-primary-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="flex h-full min-h-56 flex-col">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground"><TrendingDown className="h-5 w-5" /></span>
                <ArrowRight className="h-4 w-4 text-primary-foreground/60 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-7 text-sm font-medium text-primary-foreground/70">Churn do mês</p>
              <div className="mt-2 flex items-end gap-2">
                <strong className={cn('text-4xl font-bold', (churn?.distratos_periodo ?? 0) > 0 ? 'text-destructive-foreground' : 'text-primary-foreground')}>
                  {(churn?.taxa_churn ?? 0).toString().replace('.', ',')}%
                </strong>
                <span className="pb-1 text-xs text-primary-foreground/60">{churn?.distratos_periodo ?? 0} distrato{(churn?.distratos_periodo ?? 0) === 1 ? '' : 's'}</span>
              </div>
              <p className="mt-auto pt-5 text-xs text-primary-foreground/60">{formatBRL(churn?.receita_mensal_perdida)} de mensalidade perdida</p>
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <HealthScoreBadge score={client.healthScore} />
                    <FinancialStatusBadge status={client.financialStatus} />
                  </div>
                </button>
                <div className="mt-3 border-t pt-3 text-right">
                  {client.archived ? (
                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => setUnarchiveTarget(client)}><ArchiveRestore className="h-4 w-4" /> Desarquivar</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setArchiveTarget(client)}><Archive className="h-4 w-4" /> Arquivar</Button>
                  )}
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

      <AlertDialog open={!!unarchiveTarget} onOpenChange={open => { if (!open) setUnarchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Desarquivar cliente?</AlertDialogTitle><AlertDialogDescription>{unarchiveTarget?.name} voltará para a carteira ativa.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleUnarchive}>Desarquivar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
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
      'group min-h-32 rounded-lg border border-l-4 bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover',
      tone === 'healthy' && 'border-l-health-healthy',
      tone === 'attention' && 'border-l-health-attention',
      tone === 'critical' && 'border-l-destructive',
      !tone && 'border-l-primary',
      emphasis && 'bg-destructive/5 hover:border-destructive/60',
      className,
    )}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-secondary', toneClass)}><Icon className="h-4 w-4" /></span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2"><strong className={cn('text-2xl font-bold', toneClass)}>{value}</strong>{percent && <span className="text-xs text-muted-foreground">{percent} da carteira</span>}</div>
      {footer && <p className="mt-1.5 text-xs text-muted-foreground">{footer}</p>}
    </button>
  );
}