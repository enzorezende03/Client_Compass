import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Search, Filter, Copy, ArrowRight, CheckCircle2, Clock, AlertTriangle, User, Loader2, FileText, FileBarChart, Eye, FileBadge2, ArrowRightCircle, Mail, Trash2 } from 'lucide-react';
import { OnboardingHandoffDialog } from '@/components/OnboardingHandoffDialog';
import { OnboardingMonthlyReportDialog, ReportRow, STATUS_BADGE } from '@/components/OnboardingMonthlyReportDialog';
import { ConvertToNewCompanyDialog } from '@/components/ConvertToNewCompanyDialog';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  STAGES_EXISTING, STAGES_NOVA, STAGES_VMK, STAGE_LABELS, STAGE_SHORT, OnboardingStage, OnboardingType,
  ChecklistItem, MESSAGE_TEMPLATES, ONBOARDING_TYPE_LABELS, ONBOARDING_TYPE_BADGE, stagesForType,
  slaTone, aggregateSlaTone, advanceStage, toggleChecklistItem, updateProgressNotes,
  applyTemplateVars, MessageTemplate, cancelOnboarding, moveClientToStage,
} from '@/lib/onboarding';

interface ClientRow {
  id: string;
  name: string;
  cs_responsible: string;
  onboarding_status: string;
  onboarding_stage: string | null;
  onboarding_started_at: string | null;
  onboarding_type: OnboardingType | null;
  document?: string | null;
  segment?: string | null;
  parceria?: string | null;
}

interface ProgressFull {
  id: string;
  client_id: string;
  checklist_item_id: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  item: ChecklistItem;
}

const SLA_FILTERS = [
  { value: 'all', label: 'Todos os SLAs' },
  { value: 'green', label: 'No prazo' },
  { value: 'orange', label: 'SLA próximo' },
  { value: 'red', label: 'SLA estourado' },
];

const SLA_BADGE: Record<'green' | 'orange' | 'red', string> = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  red: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
};

const SLA_LABEL: Record<'green' | 'orange' | 'red', string> = {
  green: 'No prazo',
  orange: 'SLA próximo',
  red: 'SLA estourado',
};

function daysSince(iso?: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
}

export default function Onboarding() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState<ProgressFull[]>([]);
  const [timelineByClient, setTimelineByClient] = useState<Record<string, any[]>>({});
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | OnboardingType>('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportsByClient, setReportsByClient] = useState<Record<string, ReportRow[]>>({});
  const [viewReport, setViewReport] = useState<ReportRow | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [constInfoOpen, setConstInfoOpen] = useState(false);
  const [dbTemplates, setDbTemplates] = useState<MessageTemplate[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [clientsRes, itemsRes, progRes] = await Promise.all([
      supabase.from('clients').select('id,name,cs_responsible,onboarding_status,onboarding_stage,onboarding_started_at,onboarding_type,document,segment,parceria').eq('onboarding_status', 'active'),
      supabase.from('onboarding_checklist_items').select('*').order('order_index'),
      supabase.from('client_onboarding_progress').select('*'),
    ]);
    const cls = (clientsRes.data || []) as ClientRow[];
    const its = (itemsRes.data || []) as ChecklistItem[];
    const itemsById = new Map(its.map(i => [i.id, i]));
    const prog: ProgressFull[] = (progRes.data || []).map((p: any) => ({
      ...p, item: itemsById.get(p.checklist_item_id) as ChecklistItem,
    })).filter(p => p.item);

    // also fetch concluded (last 30 days) for the "Concluído" column
    const { data: doneRes } = await supabase
      .from('clients')
      .select('id,name,cs_responsible,onboarding_status,onboarding_stage,onboarding_started_at,onboarding_type,document,segment,parceria')
      .eq('onboarding_status', 'completed');
    setClients([...cls, ...((doneRes || []) as ClientRow[])]);
    setItems(its);
    setProgress(prog);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load all message templates once
  useEffect(() => {
    supabase.from('message_templates' as any).select('*').then(({ data }) => {
      setDbTemplates((data || []) as unknown as MessageTemplate[]);
    });
  }, []);

  // Load timeline lazily per selected client
  useEffect(() => {
    if (!selectedClient) return;
    supabase.from('timeline_entries').select('*').eq('client_id', selectedClient.id)
      .order('date', { ascending: false }).limit(5)
      .then(({ data }) => setTimelineByClient(prev => ({ ...prev, [selectedClient.id]: data || [] })));
  }, [selectedClient]);

  const loadReports = useCallback(async (clientId: string) => {
    const { data } = await supabase
      .from('operational_monthly_reports')
      .select('*').eq('client_id', clientId)
      .order('submitted_at', { ascending: false });
    setReportsByClient(prev => ({ ...prev, [clientId]: (data || []) as ReportRow[] }));
  }, []);

  // Load monthly reports when opening a client on Etapa 4
  useEffect(() => {
    if (!selectedClient) return;
    if (selectedClient.onboarding_stage === 'etapa_4' || selectedClient.onboarding_status === 'completed') {
      loadReports(selectedClient.id);
    }
  }, [selectedClient, loadReports]);

  const responsibles = useMemo(() => {
    const set = new Set(clients.map(c => c.cs_responsible).filter(Boolean));
    return Array.from(set);
  }, [clients]);

  const enriched = useMemo(() => clients.map(c => {
    const stage = (c.onboarding_stage || 'etapa_1') as OnboardingStage;
    const stageItems = items.filter(i => i.stage === stage);
    const stageProg = progress.filter(p => p.client_id === c.id && p.item.stage === stage);
    const completed = stageProg.filter(p => p.status === 'concluido').length;
    const sla = aggregateSlaTone(stageProg.map(p => ({
      created_at: p.created_at, completed_at: p.completed_at, sla_hours: p.item.sla_hours,
    })));
    return { client: c, stage, total: stageItems.length, completed, sla, stageProg };
  }), [clients, items, progress]);

  const visible = useMemo(() => enriched.filter(({ client, sla }) => {
    if (responsibleFilter !== 'all' && client.cs_responsible !== responsibleFilter) return false;
    if (slaFilter !== 'all' && sla !== slaFilter && client.onboarding_status !== 'completed') return false;
    if (search && !client.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all') {
      const t = (client.onboarding_type || 'empresa_existente') as OnboardingType;
      if (t !== typeFilter) return false;
    }
    return true;
  }), [enriched, responsibleFilter, slaFilter, search, typeFilter]);

  // Choose columns based on the active type filter
  const activeStages: OnboardingStage[] = useMemo(() => {
    if (typeFilter === 'empresa_nova' || typeFilter === 'em_constituicao') return STAGES_NOVA;
    if (typeFilter === 'vmk_parceria') return STAGES_VMK;
    if (typeFilter === 'empresa_existente') return STAGES_EXISTING;
    // 'all' → use the existing-company columns and bucket new-flow stages into the closest match
    return STAGES_EXISTING;
  }, [typeFilter]);

  const byStage = useMemo(() => {
    const map = {} as Record<OnboardingStage, typeof enriched>;
    for (const s of activeStages) map[s] = [];
    const novaToExisting: Partial<Record<OnboardingStage, OnboardingStage>> = {
      constituicao: 'etapa_1', etapa_1_nova: 'etapa_1', etapa_2_nova: 'etapa_2', etapa_3_nova: 'etapa_3',
      vmk_ativacao: 'etapa_1',
    };
    for (const e of visible) {
      let s: OnboardingStage = e.client.onboarding_status === 'completed' ? 'concluido' : e.stage;
      if (!map[s]) {
        // unify new-flow stages into existing columns when "Todos" is selected
        const fallback = novaToExisting[s];
        if (fallback && map[fallback]) s = fallback;
        else continue;
      }
      map[s].push(e);
    }
    return map;
  }, [visible, activeStages]);

  const totalActive = clients.filter(c => c.onboarding_status === 'active').length;

  const selectedData = useMemo(() => {
    if (!selectedClient) return null;
    const e = enriched.find(x => x.client.id === selectedClient.id);
    if (!e) return null;
    const requiredDone = e.stageProg.filter(p => p.item.is_required).every(p => p.status === 'concluido');
    return { ...e, requiredDone };
  }, [enriched, selectedClient]);

  const handleToggle = async (p: ProgressFull, checked: boolean) => {
    await toggleChecklistItem(p.id, p.client_id, p.item.title, checked);
    await fetchAll();
  };

  const handleNotes = async (p: ProgressFull, notes: string) => {
    setProgress(prev => prev.map(x => x.id === p.id ? { ...x, notes } : x));
    await updateProgressNotes(p.id, notes);
  };

  const handleAdvance = async () => {
    if (!selectedData) return;
    setAdvancing(true);
    try {
      const cType = (selectedData.client.onboarding_type || 'empresa_existente') as OnboardingType;
      await advanceStage(selectedData.client.id, selectedData.stage, selectedData.client.name, cType);
      const isFinal = selectedData.stage === 'etapa_4' || selectedData.stage === 'etapa_3_nova';
      toast({
        title: isFinal ? 'Onboarding concluído!' : 'Etapa avançada',
        description: isFinal
          ? `${selectedData.client.name} migrado para atendimento regular`
          : `Avançou para a próxima etapa`,
      });
      setSelectedClient(null);
      await fetchAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setAdvancing(false);
    }
  };

  const handleCancelOnboarding = async () => {
    if (!selectedData) return;
    setCancelling(true);
    try {
      await cancelOnboarding(selectedData.client.id, selectedData.client.name);
      toast({
        title: 'Onboarding excluído',
        description: `O onboarding de ${selectedData.client.name} foi removido. Você pode iniciá-lo novamente com o tipo correto.`,
      });
      setCancelOpen(false);
      setSelectedClient(null);
      await fetchAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const copyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Template copiado para a área de transferência.' });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" /> Onboarding de Clientes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pipeline visual do processo de entrada — acompanhe SLAs e itens pendentes por etapa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm py-1.5 px-3 gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {totalActive} em andamento
            </Badge>
            <Button
              onClick={() => setConstInfoOpen(true)}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
              size="sm"
            >
              <FileBadge2 className="h-4 w-4" />
              Iniciar Acompanhamento de Constituição
            </Button>
          </div>
        </div>

        {/* Type tabs */}
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="empresa_existente">Empresa Existente</TabsTrigger>
            <TabsTrigger value="empresa_nova">Empresa Nova</TabsTrigger>
            <TabsTrigger value="em_constituicao">Em Constituição</TabsTrigger>
            <TabsTrigger value="vmk_parceria">Parceria VMk</TabsTrigger>
          </TabsList>
        </Tabs>


        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8" />
          </div>
          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="CS Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={slaFilter} onValueChange={setSlaFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SLA_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {activeStages.map(stage => {
              const list = byStage[stage] || [];
              return (
                <div key={stage} className="bg-muted/40 rounded-lg border border-border/60 flex flex-col min-h-[400px]">
                  <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between sticky top-0 bg-muted/60 backdrop-blur rounded-t-lg">
                    <span className="text-sm font-semibold text-foreground">{STAGE_LABELS[stage]}</span>
                    <Badge variant="outline" className="text-xs">{list.length}</Badge>
                  </div>
                  <div className="p-2 space-y-2 flex-1">
                    {list.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Nenhum cliente</p>
                    )}
                    {list.map(({ client, total, completed, sla }) => {
                      const days = daysSince(client.onboarding_started_at);
                      const isDone = client.onboarding_status === 'completed';
                      const pct = total ? Math.round((completed / total) * 100) : 0;
                      const cType = (client.onboarding_type || 'empresa_existente') as OnboardingType;
                      return (
                        <motion.button
                          key={client.id}
                          layout
                          whileHover={{ y: -2 }}
                          onClick={() => setSelectedClient(client)}
                          className="w-full text-left bg-card hover:bg-card/80 border border-border rounded-lg p-3 shadow-sm transition-all relative"
                        >
                          <Badge variant="outline" className={cn('absolute top-2 right-2 text-[9px] px-1.5 py-0', ONBOARDING_TYPE_BADGE[cType])}>
                            {ONBOARDING_TYPE_LABELS[cType]}
                          </Badge>
                          <div className="font-semibold text-sm text-foreground line-clamp-2 pr-24">{client.name}</div>
                          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{days}d na etapa</span>
                            {!isDone && (
                              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1', SLA_BADGE[sla])}>
                                {sla === 'red' && <AlertTriangle className="h-2.5 w-2.5" />}
                                {SLA_LABEL[sla]}
                              </Badge>
                            )}
                            {isDone && (
                              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1', SLA_BADGE.green)}>
                                <CheckCircle2 className="h-2.5 w-2.5" /> Concluído
                              </Badge>
                            )}
                          </div>
                          {!isDone && (
                            <>
                              <div className="mt-2.5">
                                <Progress value={pct} className="h-1.5" />
                                <div className="text-[11px] text-muted-foreground mt-1">{completed} de {total} itens</div>
                              </div>
                              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span className="truncate">{client.cs_responsible || 'Sem responsável'}</span>
                              </div>
                            </>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lateral panel */}
      <Sheet open={!!selectedClient} onOpenChange={o => !o && setSelectedClient(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedData && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{selectedData.client.name}</SheetTitle>
                <SheetDescription>
                  {STAGE_LABELS[selectedData.stage]} • {selectedData.completed} de {selectedData.total} itens concluídos
                </SheetDescription>
              </SheetHeader>

              {/* Checklist */}
              <section className="mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Checklist da etapa</h3>
                <div className="space-y-2">
                  {selectedData.stageProg.map(p => {
                    const t = slaTone(p.created_at, p.item.sla_hours, p.completed_at);
                    return (
                      <div key={p.id} className="border border-border rounded-lg p-3 bg-card">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={p.status === 'concluido'}
                            onCheckedChange={(v) => handleToggle(p, !!v)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className={cn('text-sm font-medium', p.status === 'concluido' && 'line-through text-muted-foreground')}>
                                {p.item.title}
                                {p.item.is_required && <span className="text-red-500 ml-0.5">*</span>}
                              </span>
                              <Badge variant="outline" className={cn('text-[10px] gap-1 shrink-0', SLA_BADGE[t.tone])}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', t.color)} />
                                {t.label}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">SLA: {p.item.sla_hours}h</div>
                            <Textarea
                              value={p.notes ?? ''}
                              onChange={e => handleNotes(p, e.target.value)}
                              placeholder="Observação opcional..."
                              className="mt-2 min-h-[40px] text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {selectedData.stageProg.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum item para esta etapa.</p>
                  )}
                </div>
              </section>

              {/* Convert constituição → empresa nova */}
              {selectedData.client.onboarding_type === 'em_constituicao' && (() => {
                const cnpjItem = selectedData.stageProg.find(p => /CNPJ/i.test(p.item.title) && /receb/i.test(p.item.title));
                const ready = cnpjItem?.status === 'concluido';
                return (
                  <section className="mt-6">
                    <div className={cn(
                      'border-2 rounded-lg p-4 transition-colors',
                      ready ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-dashed border-border bg-muted/30'
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <ArrowRightCircle className="h-4 w-4 text-emerald-600" />
                            Conversão para Empresa Nova
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ready
                              ? 'CNPJ recebido. Confirme para iniciar o onboarding de Empresa Nova.'
                              : 'Marque o item "Registrar recebimento de CNPJ" para liberar a conversão.'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!ready}
                          onClick={() => setConvertOpen(true)}
                          className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-0 disabled:bg-muted disabled:text-muted-foreground"
                        >
                          <ArrowRightCircle className="h-3.5 w-3.5" />
                          Converter para Empresa Nova
                        </Button>
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* VMk — Dedicated orientation email button (no meeting scheduling) */}
              {selectedData.client.onboarding_type === 'vmk_parceria' && (() => {
                const tpl = dbTemplates.find(t => t.onboarding_type === 'vmk_parceria' && t.stage === 'vmk_ativacao');
                if (!tpl) return null;
                const c = selectedData.client;
                const isSaude = /sa[uú]de|cl[íi]nic|m[ée]dic|odont|hospital|farm[áa]c/i
                  .test(`${c.segment || ''} ${c.name}`);
                const vars: Record<string, string> = {
                  NOME_CLIENTE: c.name,
                  NOME_CS: c.cs_responsible || '',
                  'SAUDE/CONTABILIDADE': isSaude ? 'Saúde' : 'Contabilidade',
                  CNPJ_EMPRESA: c.document || '',
                };
                const filled = applyTemplateVars(tpl.content, vars);
                return (
                  <section className="mt-6">
                    <div className="border-2 border-violet-500/40 bg-violet-500/5 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4 text-violet-600" />
                            E-mail de orientação pós-constituição
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cliente em parceria VMk. Copie o e-mail com os dados já preenchidos e envie ao cliente.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => copyTemplate(filled)}
                          className="gap-1.5 shrink-0 bg-violet-600 hover:bg-violet-700 text-white border-0"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar e-mail de orientação
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-3 border-t border-violet-500/20 pt-3">
                        {filled}
                      </p>
                    </div>
                  </section>
                );
              })()}



              {/* Handoff form (only on Etapa 2) */}
              {selectedData.stage === 'etapa_2' && (() => {
                const handoffProg = selectedData.stageProg.find(p => /repasse/i.test(p.item.title));
                const handoffDone = handoffProg?.status === 'concluido';
                return (
                  <section className="mt-6">
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Formulário de Repasse CS → Operacional
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {handoffDone
                              ? 'Repasse já registrado. Você pode visualizar ou editar.'
                              : 'Preencha os dados de repasse para liberar o avanço da etapa.'}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => setHandoffOpen(true)} className="gap-1.5 shrink-0">
                          <FileText className="h-3.5 w-3.5" />
                          {handoffDone ? 'Ver Formulário' : 'Preencher Formulário'}
                        </Button>
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Monthly Reports (only on Etapa 4 / concluido) */}
              {(selectedData.stage === 'etapa_4' || selectedData.client.onboarding_status === 'completed') && (
                <section className="mt-6">
                  <div className="border border-border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <FileBarChart className="h-4 w-4 text-primary" />
                          Relatórios Mensais Recebidos
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Relatórios enviados pelo Operacional / Coordenador.
                        </p>
                      </div>
                      <Button size="sm" onClick={() => setReportOpen(true)} className="gap-1.5 shrink-0">
                        <FileBarChart className="h-3.5 w-3.5" /> Enviar Relatório Mensal
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {(reportsByClient[selectedData.client.id] || []).map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-2 border border-border/60 rounded-md px-3 py-2 bg-background">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-medium text-foreground">{r.reference_month}</span>
                            <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[r.overall_status as keyof typeof STATUS_BADGE])}>
                              {r.overall_status}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {new Date(r.submitted_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setViewReport(r)}>
                            <Eye className="h-3 w-3" /> Ver
                          </Button>
                        </div>
                      ))}
                      {!reportsByClient[selectedData.client.id]?.length && (
                        <p className="text-xs text-muted-foreground text-center py-3">Nenhum relatório enviado ainda.</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Templates — DB-backed, filtered by onboarding_type + stage */}
              {(() => {
                const cType = (selectedData.client.onboarding_type || 'empresa_existente') as OnboardingType;
                const stageTpls = dbTemplates.filter(t => t.onboarding_type === cType && t.stage === selectedData.stage
                  // VMk orientation email is shown via its dedicated card above
                  && !(cType === 'vmk_parceria' && t.stage === 'vmk_ativacao'));
                const legacy = MESSAGE_TEMPLATES[selectedData.stage] || [];
                if (stageTpls.length === 0 && legacy.length === 0) return null;

                // Determine "2M Saúde" or "2M Contabilidade" from segment hints (fallback Saúde)
                const isSaude = /sa[uú]de|cl[íi]nic|m[ée]dic|odont|hospital|farm[áa]c/i
                  .test(`${(selectedData.client as any).segment || ''} ${selectedData.client.name}`);
                const vars: Record<string, string> = {
                  NOME_CLIENTE: selectedData.client.name,
                  NOME_CS: selectedData.client.cs_responsible || '',
                  'SAUDE/CONTABILIDADE': isSaude ? 'Saúde' : 'Contabilidade',
                  CNPJ_EMPRESA: '',
                  STATUS_CONSTITUICAO: '',
                  DESCRICAO_STATUS: '',
                  PRAZO_ESTIMADO: '',
                };

                return (
                  <section className="mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Templates de mensagem</h3>
                    <div className="space-y-2">
                      {stageTpls.map(tpl => {
                        const filled = applyTemplateVars(tpl.content, vars);
                        return (
                          <div key={tpl.id} className="border border-border rounded-lg p-3 bg-card">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-foreground">{tpl.title}</span>
                              <Button size="sm" variant="ghost" onClick={() => copyTemplate(filled)} className="h-7 gap-1.5 text-xs">
                                <Copy className="h-3 w-3" /> Copiar mensagem
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{filled}</p>
                          </div>
                        );
                      })}
                      {legacy.map((tpl, i) => (
                        <div key={`legacy-${i}`} className="border border-border rounded-lg p-3 bg-card">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-foreground">{tpl.title}</span>
                            <Button size="sm" variant="ghost" onClick={() => copyTemplate(tpl.text)} className="h-7 gap-1.5 text-xs">
                              <Copy className="h-3 w-3" /> Copiar
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{tpl.text}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()}

              {/* Timeline */}
              <section className="mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Últimas interações</h3>
                <div className="space-y-2">
                  {(timelineByClient[selectedData.client.id] || []).map((t: any) => (
                    <div key={t.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                      <div className="text-muted-foreground">{new Date(t.date).toLocaleString('pt-BR')}</div>
                      <div className="text-foreground">{t.description}</div>
                    </div>
                  ))}
                  {!(timelineByClient[selectedData.client.id]?.length) && (
                    <p className="text-xs text-muted-foreground">Sem interações recentes.</p>
                  )}
                </div>
              </section>

              {/* Footer action */}
              <div className="mt-8 pt-4 border-t border-border sticky bottom-0 bg-background pb-2">
                <Button
                  onClick={handleAdvance}
                  disabled={!selectedData.requiredDone || advancing || selectedData.client.onboarding_status === 'completed'}
                  className="w-full gap-2"
                  size="lg"
                >
                  {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    selectedData.stage === 'etapa_4' ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  {selectedData.client.onboarding_status === 'completed'
                    ? 'Onboarding concluído'
                    : selectedData.stage === 'etapa_4'
                      ? 'Concluir Onboarding'
                      : 'Avançar para próxima etapa'}
                </Button>
                {!selectedData.requiredDone && selectedData.client.onboarding_status !== 'completed' && (
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    Complete todos os itens obrigatórios (*) para avançar.
                  </p>
                )}
                {selectedData.client.onboarding_status !== 'completed' && (
                  <Button
                    variant="ghost"
                    onClick={() => setCancelOpen(true)}
                    className="w-full gap-2 mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir onboarding
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover o checklist, as tarefas geradas e zerar o onboarding de{' '}
              <span className="font-medium text-foreground">{selectedData?.client.name}</span>.
              O cliente volta a ficar disponível para iniciar um novo onboarding (ex.: Parceria VMk).
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancelOnboarding(); }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir onboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {selectedClient && (
        <OnboardingHandoffDialog
          open={handoffOpen}
          onOpenChange={setHandoffOpen}
          clientId={selectedClient.id}
          handoffProgressId={
            progress.find(p => p.client_id === selectedClient.id && /repasse/i.test(p.item.title))?.id
          }
          onSaved={fetchAll}
        />
      )}

      {selectedClient && (
        <OnboardingMonthlyReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          csResponsibleName={selectedClient.cs_responsible}
          monthlyProgressId={
            progress.find(p =>
              p.client_id === selectedClient.id
              && p.item.stage === 'etapa_4'
              && p.status !== 'concluido'
              && /relat[óo]rio|mensal|fechamento/i.test(p.item.title)
            )?.id
          }
          onSaved={() => { loadReports(selectedClient.id); fetchAll(); }}
        />
      )}

      <OnboardingMonthlyReportDialog
        open={!!viewReport}
        onOpenChange={(o) => !o && setViewReport(null)}
        clientId={viewReport?.client_id || ''}
        clientName={selectedClient?.name || ''}
        viewReport={viewReport}
      />

      {selectedClient && (
        <ConvertToNewCompanyDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          onConverted={() => { setSelectedClient(null); fetchAll(); }}
        />
      )}

      {/* Constituição info dialog */}
      <Dialog open={constInfoOpen} onOpenChange={setConstInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBadge2 className="h-5 w-5 text-amber-500" />
              Acompanhamento de Constituição
            </DialogTitle>
            <DialogDescription>
              Para iniciar o acompanhamento de uma empresa em constituição, primeiro cadastre o cliente
              com o <strong>CPF do sócio principal</strong> (CNPJ ainda não emitido). Em seguida, ao
              clicar em <strong>Iniciar Onboarding</strong> no cadastro, escolha a opção
              <span className="mx-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-medium">
                Em Constituição
              </span>.
              <br /><br />
              Quando o CNPJ for emitido, o cliente poderá ser <strong>convertido</strong> automaticamente
              para o fluxo de Empresa Nova diretamente no painel lateral.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConstInfoOpen(false)}>Fechar</Button>
            <Button onClick={() => { setConstInfoOpen(false); navigate('/cadastro/clientes/novo'); }} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0">
              <FileBadge2 className="h-4 w-4" /> Cadastrar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
