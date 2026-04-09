import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarClock, CheckSquare, Clock, Filter, Plus, Search, User, Building2, AlertTriangle, X
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TaskRow {
  id: string;
  client_id: string;
  title: string;
  responsible: string;
  due_date: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
  client_name?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

const emptyForm = {
  client_id: '',
  title: '',
  responsible: '',
  due_date: new Date().toISOString().split('T')[0],
  scheduled_time: '',
  status: 'pending',
};

export default function TaskCenter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [tasksRes, clientsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('id, name'),
    ]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (tasksRes.data && clientsRes.data) {
      const clientMap = Object.fromEntries(clientsRes.data.map(c => [c.id, c.name]));
      setTasks(tasksRes.data.map(t => ({ ...t, client_name: clientMap[t.client_id] || 'Cliente desconhecido' })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const responsibles = useMemo(() => {
    const set = new Set(tasks.map(t => t.responsible).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.client_name || '').toLowerCase().includes(search.toLowerCase());
      const matchResp = filterResponsible === 'all' || t.responsible === filterResponsible;
      return matchSearch && matchResp;
    });
  }, [tasks, search, filterResponsible]);

  const pendingTasks = filtered.filter(t => t.status === 'pending');
  const completedTasks = filtered.filter(t => t.status === 'completed');

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = pendingTasks.filter(t => t.due_date < today);
  const todayTasks = pendingTasks.filter(t => t.due_date === today);
  const upcomingTasks = pendingTasks.filter(t => t.due_date > today);

  const openNew = () => { setForm(emptyForm); setEditId(null); setDialogOpen(true); };
  const openEdit = (task: TaskRow) => {
    setForm({
      client_id: task.client_id,
      title: task.title,
      responsible: task.responsible,
      due_date: task.due_date,
      scheduled_time: task.scheduled_time || '',
      status: task.status,
    });
    setEditId(task.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.client_id) {
      toast({ title: 'Preencha título e cliente', variant: 'destructive' });
      return;
    }
    const payload = {
      client_id: form.client_id,
      title: form.title,
      responsible: form.responsible,
      due_date: form.due_date,
      scheduled_time: form.scheduled_time || null,
      status: form.status,
    };
    if (editId) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editId);
      if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Tarefa atualizada' });
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) { toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Tarefa criada' });
    }
    setDialogOpen(false);
    fetchData();
  };

  const toggleStatus = async (task: TaskRow) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    fetchData();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    toast({ title: 'Tarefa removida' });
    fetchData();
  };

  const TaskCard = ({ task }: { task: TaskRow }) => {
    const isOverdue = task.status === 'pending' && task.due_date < today;
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-3 rounded-lg border p-4 bg-card shadow-card transition-colors hover:bg-accent/5 ${isOverdue ? 'border-destructive/40' : ''}`}
      >
        <Checkbox
          checked={task.status === 'completed'}
          onCheckedChange={() => toggleStatus(task)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <button
              onClick={() => navigate(`/client/${task.client_id}`)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Building2 className="h-3 w-3" />
              {task.client_name}
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {task.responsible}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              <CalendarClock className="h-3 w-3" />
              {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              {task.scheduled_time && ` às ${task.scheduled_time.slice(0, 5)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => openEdit(task)} className="h-7 px-2 text-xs">Editar</Button>
          <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id)} className="h-7 px-2 text-xs text-destructive hover:text-destructive">×</Button>
        </div>
      </motion.div>
    );
  };

  const TaskSection = ({ title, icon, tasks: sectionTasks, variant }: { title: string; icon: React.ReactNode; tasks: TaskRow[]; variant?: 'danger' | 'warning' | 'default' }) => {
    if (sectionTasks.length === 0) return null;
    const headerColor = variant === 'danger' ? 'text-destructive' : variant === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={headerColor}>{icon}</span>
          <h3 className={`text-sm font-semibold ${headerColor}`}>{title}</h3>
          <Badge variant="secondary" className="text-xs">{sectionTasks.length}</Badge>
        </div>
        <div className="space-y-2">
          {sectionTasks.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Central de Tarefas</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de retornos e follow-ups com clientes</p>
          </div>
          <Button onClick={openNew} className="gap-2 shadow-md">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Atrasadas" value={overdueTasks.length} icon={<AlertTriangle className="h-4 w-4" />} variant="danger" />
          <SummaryCard label="Para Hoje" value={todayTasks.length} icon={<Clock className="h-4 w-4" />} variant="warning" />
          <SummaryCard label="Próximas" value={upcomingTasks.length} icon={<CalendarClock className="h-4 w-4" />} />
          <SummaryCard label="Concluídas" value={completedTasks.length} icon={<CheckSquare className="h-4 w-4" />} variant="success" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tarefa ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterResponsible} onValueChange={setFilterResponsible}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {responsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pendentes ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Concluídas ({completedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <TaskSection title="Atrasadas" icon={<AlertTriangle className="h-4 w-4" />} tasks={overdueTasks} variant="danger" />
              <TaskSection title="Hoje" icon={<Clock className="h-4 w-4" />} tasks={todayTasks} variant="warning" />
              <TaskSection title="Próximas" icon={<CalendarClock className="h-4 w-4" />} tasks={upcomingTasks} />
              {pendingTasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa pendente.</div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4 space-y-2">
              {completedTasks.map(t => <TaskCard key={t.id} task={t} />)}
              {completedTasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Nenhuma tarefa concluída.</div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>Agende um retorno ou follow-up com o cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Descrição da tarefa" />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do Retorno</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Horário</Label>
                <Input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editId ? 'Salvar' : 'Criar Tarefa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function SummaryCard({ label, value, icon, variant }: { label: string; value: number; icon: React.ReactNode; variant?: 'danger' | 'warning' | 'success' }) {
  const colors = variant === 'danger'
    ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : variant === 'warning'
    ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400'
    : variant === 'success'
    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
    : 'border-border bg-card text-foreground';
  return (
    <div className={`rounded-lg border p-4 ${colors}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
