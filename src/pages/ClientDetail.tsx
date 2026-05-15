import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import {
  ArrowLeft, Plus, Brain, Clock, AlertTriangle, CheckSquare, ChevronDown, ChevronUp, FileText, Target, Pencil, Rocket
} from 'lucide-react';
import { startOnboarding } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { HealthScoreBadge } from '@/components/HealthScoreBadge';
import { FinancialStatusBadge } from '@/components/StatusBadges';
import { Timeline } from '@/components/Timeline';
import { QuickInteractionModal } from '@/components/QuickInteractionModal';
import { EditableStrategicCard } from '@/components/EditableStrategicCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuditLog } from '@/components/AuditLog';
import { ActionPlanTab } from '@/components/ActionPlanTab';
import {
  COMPLEXITY_LABELS, PROFILE_LABELS, PROFILE_COLORS, PROFILE_ICONS, RISK_TYPE_LABELS, TAXATION_LABELS,
  TimelineEntry, Task, ClientProfile, TaxationType, Client
} from '@/types/client';

const STRATEGIC_FIELD_MAP: Record<string, string> = {
  painPoints: 'pain_points',
  expectations: 'expectations',
  attentionPoints: 'attention_points',
  recurringIssues: 'recurring_issues',
  behavioralProfile: 'behavioral_profile',
  strategicNotes: 'strategic_notes',
};

function mapClient(r: any): Client {
  return {
    id: r.id, name: r.name, document: r.document, segment: r.segment,
    contractStartDate: r.contract_start_date, csResponsible: r.cs_responsible,
    complexity: r.complexity, status: r.status, profile: r.profile,
    financialStatus: r.financial_status, healthScore: r.health_score,
    painPoints: r.pain_points, expectations: r.expectations,
    attentionPoints: r.attention_points, recurringIssues: r.recurring_issues,
    behavioralProfile: r.behavioral_profile, strategicNotes: r.strategic_notes,
    riskReason: r.risk_reason ?? undefined, riskType: r.risk_type ?? undefined,
    riskIdentifiedDate: r.risk_identified_date ?? undefined,
    actionPlan: r.action_plan ?? undefined, taxation: r.taxation ?? undefined,
  };
}

function mapTimeline(r: any): TimelineEntry {
  return {
    id: r.id, clientId: r.client_id, date: r.date, type: r.type,
    description: r.description, responsible: r.responsible, sector: r.sector,
    origin: r.origin, demandStatus: r.demand_status,
    isRelevantEvent: r.is_relevant_event, relevantEventType: r.relevant_event_type,
  };
}

function mapTask(r: any): Task {
  return {
    id: r.id, clientId: r.client_id, title: r.title, responsible: r.responsible,
    dueDate: r.due_date, scheduledTime: r.scheduled_time, status: r.status,
    createdAt: r.created_at,
  };
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string>('pending_handoff');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoff, setHandoff] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [startingOnboarding, setStartingOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [strategicOpen, setStrategicOpen] = useState(true);
  const [strategicOverrides, setStrategicOverrides] = useState<Record<string, string>>({});
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const reloadHandoff = useCallback(async () => {
    if (!id) return;
    const [{ data: h }, { data: cts }] = await Promise.all([
      supabase.from('commercial_handoff' as any).select('*').eq('client_id', id).maybeSingle(),
      supabase.from('client_contacts').select('*').eq('client_id', id),
    ]);
    setHandoff(h);
    setContacts(cts || []);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('timeline_entries').select('*').eq('client_id', id).order('date', { ascending: false }),
      supabase.from('tasks').select('*').eq('client_id', id).order('due_date'),
    ]).then(([clientRes, timelineRes, tasksRes]) => {
      if (clientRes.data) {
        setClient(mapClient(clientRes.data));
        setOnboardingStatus((clientRes.data as any).onboarding_status || 'pending_handoff');
      }
      setTimeline((timelineRes.data || []).map(mapTimeline));
      setTasks((tasksRes.data || []).map(mapTask));
      setLoading(false);
    });
    reloadHandoff();
  }, [id, reloadHandoff]);

  const getOldValue = (fieldKey: string): string => {
    if (!client) return '';
    const map: Record<string, string> = {
      painPoints: client.painPoints, expectations: client.expectations,
      attentionPoints: client.attentionPoints, recurringIssues: client.recurringIssues,
      behavioralProfile: client.behavioralProfile, strategicNotes: client.strategicNotes,
    };
    return strategicOverrides[fieldKey] ?? map[fieldKey] ?? '';
  };

  const handleStrategicSave = useCallback(async (fieldKey: string, newValue: string) => {
    if (!id) return;
    const dbColumn = STRATEGIC_FIELD_MAP[fieldKey];
    if (!dbColumn) return;

    const oldValue = getOldValue(fieldKey);
    setStrategicOverrides(prev => ({ ...prev, [fieldKey]: newValue }));

    const updateData = { [dbColumn]: newValue } as Record<string, string>;
    const { error } = await supabase.from('clients').update(updateData as any).eq('id', id);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      setStrategicOverrides(prev => { const next = { ...prev }; delete next[fieldKey]; return next; });
    } else {
      await supabase.from('audit_logs').insert({
        client_id: id, field_name: dbColumn, old_value: oldValue, new_value: newValue, changed_by: 'CS',
      } as any);
      setAuditRefreshKey(k => k + 1);
      toast({ title: 'Salvo com sucesso' });
    }
  }, [id, toast, client, strategicOverrides]);

  const clientTasks = useMemo(() => tasks.filter(t => t.clientId === id), [tasks, id]);

  if (loading) {
    return <AppLayout><div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div></AppLayout>;
  }

  if (!client) {
    return <AppLayout><div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Cliente não encontrado.</p></div></AppLayout>;
  }

  const handleNewInteraction = (entry: Omit<TimelineEntry, 'id'>) => {
    setTimeline(prev => [{ ...entry, id: `t${Date.now()}` }, ...prev]);
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
  };

  return (
    <AppLayout>
      <header className="relative border-b bg-gradient-to-br from-primary/10 via-card to-accent/10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="container mx-auto px-6 py-6 relative z-10">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mt-1 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-md shrink-0">
                  {client.complexity}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">{client.name}</h1>
                  <p className="text-sm text-muted-foreground font-mono">{client.document}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <ServiceTierBadge profile={client.profile as ClientProfile} />
                <HealthScoreBadge score={client.healthScore} size="lg" />
                <FinancialStatusBadge status={client.financialStatus} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <ProfileInfoCard label="Segmento" value={client.segment} />
                <ProfileInfoCard label="Complexidade" value={COMPLEXITY_LABELS[client.complexity]} />
                <ProfileInfoCard label="CS Responsável" value={client.csResponsible} highlight />
                <ProfileInfoCard label="Cliente desde" value={new Date(client.contractStartDate).toLocaleDateString('pt-BR')} />
                <ProfileInfoCard label="Tributação" value={client.taxation ? TAXATION_LABELS[client.taxation as TaxationType] || client.taxation : 'Não definida'} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onboardingStatus === 'pendente' && (
                <Button
                  variant="default"
                  disabled={startingOnboarding}
                  onClick={async () => {
                    if (!client) return;
                    setStartingOnboarding(true);
                    try {
                      await startOnboarding(client.id, client.name);
                      toast({ title: 'Onboarding iniciado!', description: 'Redirecionando para o pipeline...' });
                      navigate('/onboarding');
                    } catch (e: any) {
                      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
                      setStartingOnboarding(false);
                    }
                  }}
                  className="gap-2 shadow-md"
                >
                  <Rocket className="h-4 w-4" /> Iniciar Onboarding
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(`/cadastro/clientes/${client.id}/editar`)} className="gap-2 shadow-sm">
                <Pencil className="h-4 w-4" /> Editar Cadastro
              </Button>
              <Button onClick={() => setInteractionOpen(true)} className="gap-2 shadow-md">
                <Plus className="h-4 w-4" /> Nova Interação
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={() => setStrategicOpen(!strategicOpen)} className="flex items-center gap-2 w-full text-left mb-3">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Visão Estratégica</h2>
            {strategicOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {strategicOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <EditableStrategicCard title="Principais Dores" content={strategicOverrides.painPoints ?? client.painPoints} onSave={(v) => handleStrategicSave('painPoints', v)} />
              <EditableStrategicCard title="Expectativas" content={strategicOverrides.expectations ?? client.expectations} onSave={(v) => handleStrategicSave('expectations', v)} />
              <EditableStrategicCard title="Pontos de Atenção" content={strategicOverrides.attentionPoints ?? client.attentionPoints} onSave={(v) => handleStrategicSave('attentionPoints', v)} />
              <EditableStrategicCard title="Problemas Recorrentes" content={(strategicOverrides.recurringIssues ?? client.recurringIssues) || 'Nenhum identificado'} onSave={(v) => handleStrategicSave('recurringIssues', v)} />
              <EditableStrategicCard title="Perfil Comportamental" content={strategicOverrides.behavioralProfile ?? client.behavioralProfile} onSave={(v) => handleStrategicSave('behavioralProfile', v)} />
              <EditableStrategicCard title="Notas Estratégicas" content={strategicOverrides.strategicNotes ?? client.strategicNotes} onSave={(v) => handleStrategicSave('strategicNotes', v)} highlight />
            </div>
          )}
        </motion.div>

        {client.riskReason && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 rounded-lg border border-health-critical/30 bg-health-critical/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-health-critical" />
              <h3 className="font-semibold text-health-critical">Gestão de Risco</h3>
              {client.riskType && (
                <span className="inline-flex items-center rounded-full bg-health-critical/10 px-2.5 py-0.5 text-xs font-medium text-health-critical">
                  {RISK_TYPE_LABELS[client.riskType]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs mb-1">Motivo do Risco</p><p className="text-foreground">{client.riskReason}</p></div>
              <div><p className="text-muted-foreground text-xs mb-1">Plano de Ação</p><p className="text-foreground">{client.actionPlan || 'Não definido'}</p></div>
              {client.riskIdentifiedDate && (
                <div><p className="text-muted-foreground text-xs mb-1">Identificado em</p><p className="text-foreground">{new Date(client.riskIdentifiedDate).toLocaleDateString('pt-BR')}</p></div>
              )}
            </div>
          </motion.div>
        )}

        <Tabs defaultValue="timeline" className="mt-4">
          <TabsList>
            <TabsTrigger value="timeline" className="gap-2"><Clock className="h-4 w-4" /> Histórico ({timeline.length})</TabsTrigger>
            <TabsTrigger value="action-plan" className="gap-2"><Target className="h-4 w-4" /> Plano de Ação</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2"><CheckSquare className="h-4 w-4" /> Tarefas ({clientTasks.filter(t => t.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="audit" className="gap-2"><FileText className="h-4 w-4" /> Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            {timeline.length > 0 ? <Timeline entries={timeline} /> : <div className="text-center py-12 text-muted-foreground">Nenhuma interação registrada.</div>}
          </TabsContent>

          <TabsContent value="action-plan" className="mt-4">
            <ActionPlanTab clientId={client.id} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-2">
            {clientTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-card">
                <Checkbox checked={task.status === 'completed'} onCheckedChange={() => toggleTask(task.id)} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.responsible} • Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}{task.scheduledTime && ` às ${task.scheduledTime}`}</p>
                </div>
              </div>
            ))}
            {clientTasks.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa.</div>}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLog clientId={client.id} refreshKey={auditRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>

      <QuickInteractionModal open={interactionOpen} onOpenChange={setInteractionOpen} clientId={client.id} onSubmit={handleNewInteraction} />
    </AppLayout>
  );
}

function ProfileInfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-background/60'}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function ServiceTierBadge({ profile }: { profile: ClientProfile }) {
  const colors = PROFILE_COLORS[profile] || PROFILE_COLORS.standard;
  const icon = PROFILE_ICONS[profile] || '●';
  const label = PROFILE_LABELS[profile] || profile;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${colors.bg} ${colors.text} ${colors.border}`}>
      <span className="text-base leading-none">{icon}</span>
      {label}
    </span>
  );
}
