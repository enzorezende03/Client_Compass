import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Search, Filter, Copy, ArrowRight, CheckCircle2, Clock, AlertTriangle, User, Loader2, FileText } from 'lucide-react';
import { OnboardingHandoffDialog } from '@/components/OnboardingHandoffDialog';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  STAGES, STAGE_LABELS, STAGE_SHORT, OnboardingStage, ChecklistItem, MESSAGE_TEMPLATES,
  slaTone, aggregateSlaTone, advanceStage, toggleChecklistItem, updateProgressNotes,
} from '@/lib/onboarding';

interface ClientRow {
  id: string;
  name: string;
  cs_responsible: string;
  onboarding_status: string;
  onboarding_stage: string | null;
  onboarding_started_at: string | null;
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
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState<ProgressFull[]>([]);
  const [timelineByClient, setTimelineByClient] = useState<Record<string, any[]>>({});
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [clientsRes, itemsRes, progRes] = await Promise.all([
      supabase.from('clients').select('id,name,cs_responsible,onboarding_status,onboarding_stage,onboarding_started_at').eq('onboarding_status', 'em_andamento'),
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
      .select('id,name,cs_responsible,onboarding_status,onboarding_stage,onboarding_started_at')
      .eq('onboarding_status', 'concluido');
    setClients([...cls, ...((doneRes || []) as ClientRow[])]);
    setItems(its);
    setProgress(prog);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load timeline lazily per selected client
  useEffect(() => {
    if (!selectedClient) return;
    supabase.from('timeline_entries').select('*').eq('client_id', selectedClient.id)
      .order('date', { ascending: false }).limit(5)
      .then(({ data }) => setTimelineByClient(prev => ({ ...prev, [selectedClient.id]: data || [] })));
  }, [selectedClient]);

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
    if (slaFilter !== 'all' && sla !== slaFilter && client.onboarding_status !== 'concluido') return false;
    if (search && !client.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [enriched, responsibleFilter, slaFilter, search]);

  const byStage = useMemo(() => {
    const map: Record<OnboardingStage, typeof enriched> = {
      etapa_1: [], etapa_2: [], etapa_3: [], etapa_4: [], concluido: [],
    };
    for (const e of visible) {
      const s = (e.client.onboarding_status === 'concluido' ? 'concluido' : e.stage) as OnboardingStage;
      map[s].push(e);
    }
    return map;
  }, [visible]);

  const totalActive = clients.filter(c => c.onboarding_status === 'em_andamento').length;

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
      await advanceStage(selectedData.client.id, selectedData.stage, selectedData.client.name);
      const isFinal = selectedData.stage === 'etapa_4';
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
          </div>
        </div>

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
            {STAGES.map(stage => {
              const list = byStage[stage];
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
                      const isDone = client.onboarding_status === 'concluido';
                      const pct = total ? Math.round((completed / total) * 100) : 0;
                      return (
                        <motion.button
                          key={client.id}
                          layout
                          whileHover={{ y: -2 }}
                          onClick={() => setSelectedClient(client)}
                          className="w-full text-left bg-card hover:bg-card/80 border border-border rounded-lg p-3 shadow-sm transition-all"
                        >
                          <div className="font-semibold text-sm text-foreground line-clamp-2">{client.name}</div>
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

              {/* Templates */}
              {MESSAGE_TEMPLATES[selectedData.stage]?.length > 0 && (
                <section className="mt-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Templates de mensagem</h3>
                  <div className="space-y-2">
                    {MESSAGE_TEMPLATES[selectedData.stage].map((tpl, i) => (
                      <div key={i} className="border border-border rounded-lg p-3 bg-card">
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
              )}

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
                  disabled={!selectedData.requiredDone || advancing || selectedData.client.onboarding_status === 'concluido'}
                  className="w-full gap-2"
                  size="lg"
                >
                  {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    selectedData.stage === 'etapa_4' ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  {selectedData.client.onboarding_status === 'concluido'
                    ? 'Onboarding concluído'
                    : selectedData.stage === 'etapa_4'
                      ? 'Concluir Onboarding'
                      : 'Avançar para próxima etapa'}
                </Button>
                {!selectedData.requiredDone && selectedData.client.onboarding_status !== 'concluido' && (
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    Complete todos os itens obrigatórios (*) para avançar.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
