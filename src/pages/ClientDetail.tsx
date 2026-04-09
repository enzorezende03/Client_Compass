import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import {
  ArrowLeft, Plus, Brain, Clock, AlertTriangle, CheckSquare, Edit3, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { mockClients, mockTimeline, mockTasks } from '@/data/mockClients';
import { HealthScoreBadge } from '@/components/HealthScoreBadge';
import { ClientStatusBadge, FinancialStatusBadge } from '@/components/StatusBadges';
import { Timeline } from '@/components/Timeline';
import { QuickInteractionModal } from '@/components/QuickInteractionModal';
import {
  COMPLEXITY_LABELS, PROFILE_LABELS, RISK_TYPE_LABELS,
  TimelineEntry, Task
} from '@/types/client';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const client = mockClients.find(c => c.id === id);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(mockTimeline);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [strategicOpen, setStrategicOpen] = useState(true);

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
                <HealthScoreBadge score={client.healthScore} size="lg" />
                <ClientStatusBadge status={client.status} />
                <FinancialStatusBadge status={client.financialStatus} />
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="font-mono">{client.document}</span>
                <span>•</span>
                <span>{client.segment}</span>
                <span>•</span>
                <span>Complexidade: {COMPLEXITY_LABELS[client.complexity]}</span>
                <span>•</span>
                <span>Perfil: {PROFILE_LABELS[client.profile]}</span>
                <span>•</span>
                <span>CS: <strong>{client.csResponsible}</strong></span>
                <span>•</span>
                <span>Desde: {new Date(client.contractStartDate).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <Button onClick={() => setInteractionOpen(true)} className="gap-2">
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
              <StrategicCard title="Principais Dores" content={client.painPoints} />
              <StrategicCard title="Expectativas" content={client.expectations} />
              <StrategicCard title="Pontos de Atenção" content={client.attentionPoints} />
              <StrategicCard title="Problemas Recorrentes" content={client.recurringIssues || 'Nenhum identificado'} />
              <StrategicCard title="Perfil Comportamental" content={client.behavioralProfile} />
              <StrategicCard title="Notas Estratégicas" content={client.strategicNotes} highlight />
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
                  </p>
                </div>
              </div>
            ))}
            {clientTasks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa.</div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <QuickInteractionModal
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        clientId={client.id}
        onSubmit={handleNewInteraction}
      />
    </div>
  );
}

function StrategicCard({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'} shadow-card`}>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-sm text-foreground leading-relaxed">{content}</p>
    </div>
  );
}
