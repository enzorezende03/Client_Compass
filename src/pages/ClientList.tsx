import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Users, AlertTriangle, TrendingUp, Building2, Download, Archive, ArchiveRestore, MoreVertical } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { HealthScoreBadge } from '@/components/HealthScoreBadge';
import { FinancialStatusBadge } from '@/components/StatusBadges';
import { Client, STATUS_LABELS, COMPLEXITY_LABELS, COMPLEXITY_EMOJIS, HEALTH_LABELS, PROFILE_LABELS, PROFILE_ICONS, ClientStatus, ComplexityLevel, HealthScore } from '@/types/client';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClientWithArchive extends Client {
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  archivedBy?: string;
}

function mapRow(r: any): ClientWithArchive {
  return {
    id: r.id,
    name: r.name,
    document: r.document,
    segment: r.segment,
    contractStartDate: r.contract_start_date,
    csResponsible: r.cs_responsible,
    complexity: r.complexity as any,
    status: r.status as any,
    profile: r.profile as any,
    financialStatus: r.financial_status as any,
    healthScore: r.health_score as any,
    painPoints: r.pain_points,
    expectations: r.expectations,
    attentionPoints: r.attention_points,
    recurringIssues: r.recurring_issues,
    behavioralProfile: r.behavioral_profile,
    strategicNotes: r.strategic_notes,
    riskReason: r.risk_reason ?? undefined,
    riskType: r.risk_type ?? undefined,
    riskIdentifiedDate: r.risk_identified_date ?? undefined,
    actionPlan: r.action_plan ?? undefined,
    taxation: r.taxation ?? undefined,
    archived: r.archived ?? false,
    archivedAt: r.archived_at ?? undefined,
    archivedReason: r.archived_reason ?? '',
    archivedBy: r.archived_by ?? '',
  };
}

export default function ClientList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientWithArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Archive dialog state
  const [archiveTarget, setArchiveTarget] = useState<ClientWithArchive | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [unarchiveTarget, setUnarchiveTarget] = useState<ClientWithArchive | null>(null);

  const loadClients = useCallback(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      setClients((data || []).map(mapRow));
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const responsibles = [...new Set(clients.filter(c => !c.archived).map(c => c.csResponsible).filter(Boolean))];
  const archivedCount = clients.filter(c => c.archived).length;

  const filtered = clients.filter(c => {
    if (showArchived ? !c.archived : !!c.archived) return false;
    const matchSearch = search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document.includes(search);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchComplexity = complexityFilter === 'all' || c.complexity === complexityFilter;
    const matchHealth = healthFilter === 'all' || c.healthScore === healthFilter;
    const matchResp = responsibleFilter === 'all' || c.csResponsible === responsibleFilter;
    return matchSearch && matchStatus && matchComplexity && matchHealth && matchResp;
  });

  const activeClients = clients.filter(c => !c.archived);
  const stats = {
    total: activeClients.length,
    atRisk: activeClients.filter(c => c.status === 'at_risk' || c.status === 'recovery').length,
    critical: activeClients.filter(c => c.healthScore === 'critical').length,
    healthy: activeClients.filter(c => c.healthScore === 'healthy').length,
  };

  const exportClientsReport = () => {
    const rows = filtered.map(client => ({
      Nome: client.name,
      Documento: client.document,
      Segmento: client.segment,
      Status: STATUS_LABELS[client.status as ClientStatus] || client.status,
      'CS Responsável': client.csResponsible,
      Complexidade: COMPLEXITY_LABELS[client.complexity as ComplexityLevel] || client.complexity,
      Tier: PROFILE_LABELS[client.profile] || client.profile,
      'Health Score': HEALTH_LABELS[client.healthScore as HealthScore] || client.healthScore,
      'Início do contrato': client.contractStartDate,
      ...(showArchived ? {
        'Justificativa arquivamento': client.archivedReason,
        'Arquivado em': client.archivedAt ? new Date(client.archivedAt).toLocaleDateString('pt-BR') : '',
        'Arquivado por': client.archivedBy,
      } : {}),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 34 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 24 },
      { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      ...(showArchived ? [{ wch: 40 }, { wch: 16 }, { wch: 24 }] : []),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, showArchived ? 'Clientes arquivados' : 'Clientes');
    XLSX.writeFile(workbook, `relatorio-clientes${showArchived ? '-arquivados' : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Relatório baixado!', description: `${rows.length} cliente(s) exportado(s) para Excel.` });
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    if (archiveReason.trim().length < 5) {
      toast({ title: 'Justificativa obrigatória', description: 'Informe pelo menos 5 caracteres.', variant: 'destructive' });
      return;
    }
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('clients')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_reason: archiveReason.trim(),
          archived_by: user?.email || '',
        })
        .eq('id', archiveTarget.id);
      if (error) throw error;
      toast({ title: 'Cliente arquivado', description: `${archiveTarget.name} foi arquivado e não aparecerá mais nas próximas sincronizações com o G-Click.` });
      setArchiveTarget(null);
      setArchiveReason('');
      loadClients();
    } catch (err: any) {
      toast({ title: 'Erro ao arquivar', description: err.message, variant: 'destructive' });
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!unarchiveTarget) return;
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          archived: false,
          archived_at: null,
          archived_reason: '',
          archived_by: '',
        })
        .eq('id', unarchiveTarget.id);
      if (error) throw error;
      toast({ title: 'Cliente desarquivado', description: `${unarchiveTarget.name} voltou para a lista ativa.` });
      setUnarchiveTarget(null);
      loadClients();
    } catch (err: any) {
      toast({ title: 'Erro ao desarquivar', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">CS HUB</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestão estratégica da carteira de clientes</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Total de Clientes" value={stats.total} />
            <StatCard icon={AlertTriangle} label="Em Risco / Recuperação" value={stats.atRisk} variant="warning" />
            <StatCard icon={TrendingUp} label="Health Crítico" value={stats.critical} variant="danger" />
            <StatCard icon={Users} label="Saudáveis" value={stats.healthy} variant="success" />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF/CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showArchived ? 'default' : 'outline'}
            onClick={() => setShowArchived(v => !v)}
            className="gap-2"
            title={showArchived ? 'Voltar para clientes ativos' : 'Ver clientes arquivados'}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? `Arquivados (${archivedCount})` : `Arquivados (${archivedCount})`}
          </Button>
          <Button variant="outline" onClick={exportClientsReport} className="gap-2" disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4" /> Baixar Excel
          </Button>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Complexidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Health Score" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(HEALTH_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showArchived && (
          <div className="mb-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Archive className="h-4 w-4 inline mr-2" />
            Você está visualizando clientes arquivados. Eles não aparecem na busca do G-Click.
          </div>
        )}

        {/* Client cards */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client, i) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                onClick={() => navigate(`/client/${client.id}`)}
                className={`group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-card cursor-pointer transition-all hover:shadow-card-hover hover:border-primary/20 ${client.archived ? 'opacity-70' : ''}`}
              >
                <div
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0 leading-none"
                  title={`Complexidade ${COMPLEXITY_LABELS[client.complexity]}`}
                >
                  <span className="text-base" aria-hidden>{COMPLEXITY_EMOJIS[client.complexity]}</span>
                  <span className="mt-0.5">{client.complexity}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                    {client.archived && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Archive className="h-3 w-3" /> Arquivado
                      </Badge>
                    )}
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title={`Tier ${PROFILE_LABELS[client.profile]}`}
                    >
                      <span aria-hidden>{PROFILE_ICONS[client.profile]}</span>
                      <span className="hidden sm:inline">{PROFILE_LABELS[client.profile]}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{client.document}</span>
                    <span>•</span>
                    <span>{client.segment}</span>
                    <span>•</span>
                    <span>CS: {client.csResponsible}</span>
                  </div>
                  {client.archived && client.archivedReason && (
                    <p className="mt-1 text-xs text-muted-foreground italic truncate">
                      Motivo: {client.archivedReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <HealthScoreBadge score={client.healthScore} />
                  <FinancialStatusBadge status={client.financialStatus} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      {client.archived ? (
                        <DropdownMenuItem onClick={() => setUnarchiveTarget(client)} className="gap-2">
                          <ArchiveRestore className="h-4 w-4" /> Desarquivar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setArchiveTarget(client)} className="gap-2">
                          <Archive className="h-4 w-4" /> Arquivar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {showArchived
                  ? 'Nenhum cliente arquivado.'
                  : 'Nenhum cliente encontrado com os filtros selecionados.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive Dialog */}
      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" /> Arquivar cliente
            </DialogTitle>
            <DialogDescription>
              Você está prestes a arquivar <strong>{archiveTarget?.name}</strong>. O cliente será preservado no sistema mas não aparecerá nas listagens ativas nem em futuras sincronizações com o G-Click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Justificativa <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Ex.: Encerramento de contrato em 03/2025, cliente migrou para outro escritório..."
              value={archiveReason}
              onChange={e => setArchiveReason(e.target.value)}
              rows={4}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Mínimo 5 caracteres. Esta justificativa fica registrada.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setArchiveTarget(null); setArchiveReason(''); }}>
              Cancelar
            </Button>
            <Button onClick={handleArchive} disabled={archiving || archiveReason.trim().length < 5} className="gap-2">
              <Archive className="h-4 w-4" />
              {archiving ? 'Arquivando...' : 'Arquivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unarchive confirmation */}
      <AlertDialog open={!!unarchiveTarget} onOpenChange={(open) => !open && setUnarchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desarquivar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{unarchiveTarget?.name}</strong> voltará para a lista ativa. A justificativa de arquivamento será apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchive}>Desarquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, variant }: {
  icon: typeof Building2; label: string; value: number; variant?: 'warning' | 'danger' | 'success';
}) {
  const colors = {
    warning: 'text-health-attention',
    danger: 'text-health-critical',
    success: 'text-health-healthy',
  };
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${variant ? colors[variant] : 'text-muted-foreground'}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${variant ? colors[variant] : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
