import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ActionPlan, ActionPlanStatus, ActionPlanPriority, ActionPlanCategory,
} from '@/types/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, AlertTriangle, Clock, CheckCircle2, Pause, X, Filter, Edit2, Trash2 } from 'lucide-react';

const STATUS_LABELS: Record<ActionPlanStatus, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', waiting_client: 'Aguardando cliente',
  completed: 'Concluído', cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<ActionPlanStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  waiting_client: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};
const PRIORITY_LABELS: Record<ActionPlanPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};
const PRIORITY_COLORS: Record<ActionPlanPriority, string> = {
  low: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  medium: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  high: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  urgent: 'bg-red-500/10 text-red-700 border-red-500/20',
};
const CATEGORY_LABELS: Record<ActionPlanCategory, string> = {
  tributario: 'Tributário', financeiro: 'Financeiro', documental: 'Documental',
  societario: 'Societário', comercial: 'Comercial / Expansão', relacionamento: 'Relacionamento',
  regularizacao: 'Regularização', planejamento: 'Planejamento', outro: 'Outro',
};

function mapActionPlan(r: any): ActionPlan {
  return {
    id: r.id, clientId: r.client_id, title: r.title, description: r.description,
    objective: r.objective, category: r.category, priority: r.priority,
    responsible: r.responsible, dueDate: r.due_date, status: r.status,
    expectedResult: r.expected_result, observations: r.observations,
    nextStep: r.next_step, completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const emptyForm = {
  title: '', description: '', objective: '', category: 'outro' as ActionPlanCategory,
  priority: 'medium' as ActionPlanPriority, responsible: '', due_date: '',
  status: 'pending' as ActionPlanStatus, expected_result: '', observations: '',
  next_step: '',
};

export function ActionPlanTab({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase
      .from('action_plans')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date');
    setPlans((data || []).map(mapActionPlan));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (p: ActionPlan) => {
    setEditingId(p.id);
    setForm({
      title: p.title, description: p.description, objective: p.objective,
      category: p.category, priority: p.priority, responsible: p.responsible,
      due_date: p.dueDate, status: p.status, expected_result: p.expectedResult,
      observations: p.observations, next_step: p.nextStep,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: 'Título obrigatório', variant: 'destructive' }); return; }
    const payload: any = {
      client_id: clientId, title: form.title, description: form.description,
      objective: form.objective, category: form.category, priority: form.priority,
      responsible: form.responsible, due_date: form.due_date || new Date().toISOString().slice(0, 10),
      status: form.status, expected_result: form.expected_result,
      observations: form.observations, next_step: form.next_step,
      completed_at: form.status === 'completed' ? new Date().toISOString() : null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('action_plans').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('action_plans').insert(payload));
    }
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingId ? 'Ação atualizada' : 'Ação criada' });
    setModalOpen(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta ação?')) return;
    await supabase.from('action_plans').delete().eq('id', id);
    fetchPlans();
  };

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (p: ActionPlan) => p.dueDate < today && !['completed', 'cancelled'].includes(p.status);

  const filtered = useMemo(() => {
    return plans
      .filter(p => filterStatus === 'all' || p.status === filterStatus)
      .filter(p => filterPriority === 'all' || p.priority === filterPriority)
      .filter(p => filterCategory === 'all' || p.category === filterCategory);
  }, [plans, filterStatus, filterPriority, filterCategory]);

  const counts = useMemo(() => ({
    open: plans.filter(p => !['completed', 'cancelled'].includes(p.status)).length,
    completed: plans.filter(p => p.status === 'completed').length,
    overdue: plans.filter(p => isOverdue(p)).length,
    waiting: plans.filter(p => p.status === 'waiting_client').length,
  }), [plans]);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CounterCard icon={<Clock className="h-4 w-4" />} label="Em aberto" value={counts.open} color="text-blue-600" />
        <CounterCard icon={<CheckCircle2 className="h-4 w-4" />} label="Concluídas" value={counts.completed} color="text-emerald-600" />
        <CounterCard icon={<AlertTriangle className="h-4 w-4" />} label="Atrasadas" value={counts.overdue} color="text-red-600" />
        <CounterCard icon={<Pause className="h-4 w-4" />} label="Aguardando cliente" value={counts.waiting} color="text-orange-600" />
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Ação</Button>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </Button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-card">
          <div className="min-w-[150px]">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Label className="text-xs">Prioridade</Label>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Label className="text-xs">Categoria</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma ação encontrada.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className={`rounded-lg border bg-card p-4 shadow-sm transition-all ${isOverdue(p) ? 'border-red-500/40 bg-red-500/5' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-foreground">{p.title}</h4>
                    {isOverdue(p) && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Atrasada</Badge>}
                  </div>
                  {p.objective && <p className="text-sm text-muted-foreground mb-2">{p.objective}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    <Badge variant="outline" className={PRIORITY_COLORS[p.priority]}>{PRIORITY_LABELS[p.priority]}</Badge>
                    <Badge variant="outline">{CATEGORY_LABELS[p.category]}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {p.responsible && <span>Resp: <strong>{p.responsible}</strong></span>}
                    <span>Prazo: <strong>{new Date(p.dueDate).toLocaleDateString('pt-BR')}</strong></span>
                    {p.completedAt && <span>Concluído: {new Date(p.completedAt).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {p.nextStep && (
                    <p className="mt-2 text-xs text-primary font-medium">→ Próximo passo: {p.nextStep}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Ação' : 'Nova Ação'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Título da ação *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Objetivo</Label>
                <Textarea value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label>Resultado esperado</Label>
                <Textarea value={form.expected_result} onChange={e => setForm(f => ({ ...f, expected_result: e.target.value }))} rows={2} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as ActionPlanCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as ActionPlanPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ActionPlanStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
            </div>
            <div>
              <Label>Próximo passo</Label>
              <Input value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingId ? 'Salvar' : 'Criar Ação'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CounterCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
