import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import {
  ArrowLeft, Plus, Brain, Clock, AlertTriangle, CheckSquare, Edit3, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { mockClients, mockTimeline, mockTasks } from '@/data/mockClients';
import { HealthScoreBadge } from '@/components/HealthScoreBadge';
import { FinancialStatusBadge } from '@/components/StatusBadges';
import { Timeline } from '@/components/Timeline';
import { QuickInteractionModal } from '@/components/QuickInteractionModal';
import { EditableStrategicCard } from '@/components/EditableStrategicCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AuditLog } from '@/components/AuditLog';
import {
  COMPLEXITY_LABELS, PROFILE_LABELS, PROFILE_COLORS, PROFILE_ICONS, RISK_TYPE_LABELS, TAXATION_LABELS,
  TimelineEntry, Task, ClientProfile, TaxationType
} from '@/types/client';

// Map strategic field keys to DB column names
const STRATEGIC_FIELD_MAP: Record<string, string> = {
  painPoints: 'pain_points',
  expectations: 'expectations',
  attentionPoints: 'attention_points',
  recurringIssues: 'recurring_issues',
  behavioralProfile: 'behavioral_profile',
  strategicNotes: 'strategic_notes',
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const client = mockClients.find(c => c.id === id);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(mockTimeline);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [strategicOpen, setStrategicOpen] = useState(true);
  const [strategicOverrides, setStrategicOverrides] = useState<Record<string, string>>({});
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const getOldValue = (fieldKey: string): string => {
    if (!client) return '';
    const map: Record<string, string> = {
      painPoints: client.painPoints,
      expectations: client.expectations,
      attentionPoints: client.attentionPoints,
      recurringIssues: client.recurringIssues,
      behavioralProfile: client.behavioralProfile,
      strategicNotes: client.strategicNotes,
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
    const { error } = await supabase
      .from('clients')
      .update(updateData as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      setStrategicOverrides(prev => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    } else {
      // Log audit entry
      await supabase.from('audit_logs').insert({
        client_id: id,
        field_name: dbColumn,
        old_value: oldValue,
        new_value: newValue,
        changed_by: 'CS',
      } as any);
      setAuditRefreshKey(k => k + 1);
      toast({ title: 'Salvo com sucesso' });
    }
  }, [id, toast, client, strategicOverrides]);

  const clientTimeline = useMemo(() => timeline.filter(t => t.clientId === id), [timeline, id]);
  const clientTasks = useMemo(() => tasks.filter(t => t.clientId === id), [tasks, id]);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  const handleNewInteraction = (entry: Omit<TimelineEntry, 'id'>) => {
    setTimeline(prev => [...prev, { ...entry, id: `t${Date.now()}` }]);
  };

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t
    ));
  };

  return (
    <AppLayout>
      {/* Header */}
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
            <Button onClick={() => setInteractionOpen(true)} className="gap-2 shrink-0 shadow-md">
              <Plus className="h-4 w-4" />
              Nova Interação
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* Strategic Vision - Collapsible */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => setStrategicOpen(!strategicOpen)}
            className="flex items-center gap-2 w-full text-left mb-3"
          >
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

        {/* Risk section */}
        {client.riskReason && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 rounded-lg border border-health-critical/30 bg-health-critical/5 p-4"
          >
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
              <div>
                <p className="text-muted-foreground text-xs mb-1">Motivo do Risco</p>
                <p className="text-foreground">{client.riskReason}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Plano de Ação</p>
                <p className="text-foreground">{client.actionPlan || 'Não definido'}</p>
              </div>
              {client.riskIdentifiedDate && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Identificado em</p>
                  <p className="text-foreground">{new Date(client.riskIdentifiedDate).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="mt-4">
          <TabsList>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="h-4 w-4" />
              Histórico ({clientTimeline.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Tarefas ({clientTasks.filter(t => t.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            {clientTimeline.length > 0 ? (
              <Timeline entries={clientTimeline} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma interação registrada.
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-2">
            {clientTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-card"
              >
                <Checkbox
                  checked={task.status === 'completed'}
                  onCheckedChange={() => toggleTask(task.id)}
                />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {task.responsible} • Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                    {task.scheduledTime && ` às ${task.scheduledTime}`}
                  </p>
                </div>
              </div>
            ))}
            {clientTasks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa.</div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLog clientId={client.id} refreshKey={auditRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>

      <QuickInteractionModal
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        clientId={client.id}
        onSubmit={handleNewInteraction}
      />
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
