import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarClock, CheckSquare, Clock, Filter, Plus, Search, User, Building2, AlertTriangle, GripVertical
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TaskRow {
  id: string;
  client_id: string;
  title: string;
  description: string;
  responsible: string;
  responsible_id: string | null;
  due_date: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
  client_name?: string;
}

interface ClientOption { id: string; name: string; }
interface InternalUser { id: string; name: string; email: string; active: boolean; }

const REMINDER_OPTIONS = [
  { value: '', label: 'Sem lembrete' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 dia antes' },
];

const emptyForm = {
  client_id: '',
  title: '',
  description: '',
  responsible_id: '',
  due_date: new Date().toISOString().split('T')[0],
  scheduled_time: '',
  status: 'pending',
  reminder_minutes: '60',
};

export default function TaskCenter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [tasksRes, clientsRes, usersRes] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('id, name'),
      supabase.from('internal_users').select('id, name, email, active').eq('active', true).order('name'),
    ]);
    if (usersRes.data) setInternalUsers(usersRes.data as InternalUser[]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (tasksRes.data && clientsRes.data) {
      const clientMap = Object.fromEntries(clientsRes.data.map(c => [c.id, c.name]));
      const userMap = usersRes.data ? Object.fromEntries((usersRes.data as InternalUser[]).map(u => [u.id, u.name])) : {};
      setTasks(tasksRes.data.map(t => ({
        ...t,
        description: (t as any).description || '',
        responsible_id: (t as any).responsible_id || null,
        client_name: clientMap[t.client_id] || 'Cliente desconhecido',
        responsible: (t as any).responsible_id ? (userMap[(t as any).responsible_id] || t.responsible) : t.responsible,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.client_name || '').toLowerCase().includes(search.toLowerCase());
      const matchResp = filterResponsible === 'all' || t.responsible_id === filterResponsible || t.responsible === filterResponsible;
      return matchSearch && matchResp;
    });
  }, [tasks, search, filterResponsible]);

  const today = new Date().toISOString().split('T')[0];

  const overdueTasks = filtered.filter(t => t.status === 'pending' && t.due_date < today);
  const todayTasks = filtered.filter(t => t.status === 'pending' && t.due_date === today);
  const upcomingTasks = filtered.filter(t => t.status === 'pending' && t.due_date > today);
  const completedTasks = filtered.filter(t => t.status === 'completed');

  const openNew = () => { setForm(emptyForm); setEditId(null); setDialogOpen(true); };
  const openEdit = (task: TaskRow) => {
    setForm({
      client_id: task.client_id,
      title: task.title,
      description: task.description,
      responsible_id: task.responsible_id || '',
      due_date: task.due_date,
      scheduled_time: task.scheduled_time || '',
      status: task.status,
      reminder_minutes: (task as any).reminder_minutes?.toString() || '',
    });
    setEditId(task.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.client_id) {
      toast({ title: 'Preencha título e cliente', variant: 'destructive' });
      return;
    }
    const selectedUser = internalUsers.find(u => u.id === form.responsible_id);
    const payload: any = {
      client_id: form.client_id,
      title: form.title,
      description: form.description,
      responsible: selectedUser?.name || '',
      responsible_id: form.responsible_id || null,
      due_date: form.due_date,
      scheduled_time: form.scheduled_time || null,
      status: form.status,
      reminder_minutes: form.reminder_minutes ? parseInt(form.reminder_minutes) : null,
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

  const moveToStatus = async (taskId: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    fetchData();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    toast({ title: 'Tarefa removida' });
    fetchData();
  };

  const handleDragStart = (taskId: string) => setDraggedTaskId(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    const task = tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== targetStatus) await moveToStatus(draggedTaskId, targetStatus);
    setDraggedTaskId(null);
  };

  const KanbanCard = ({ task }: { task: TaskRow }) => {
    const isOverdue = task.status === 'pending' && task.due_date < today;
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        draggable
        onDragStart={() => handleDragStart(task.id)}
        className={`rounded-lg border p-3 bg-card shadow-card cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${isOverdue ? 'border-destructive/40' : ''} ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-2 mb-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className={`text-sm font-medium flex-1 ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mb-2 ml-6 line-clamp-2">{task.description}</p>
        )}
        <div className="flex flex-col gap-1 ml-6">
          <button
            onClick={() => navigate(`/client/${task.client_id}`)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
          >
            <Building2 className="h-3 w-3" />
            {task.client_name}
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {task.responsible || 'Sem responsável'}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              <CalendarClock className="h-3 w-3" />
              {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              {task.scheduled_time && ` às ${task.scheduled_time.slice(0, 5)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 ml-6">
          <Button variant="ghost" size="sm" onClick={() => openEdit(task)} className="h-6 px-2 text-xs">Editar</Button>
          <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id)} className="h-6 px-2 text-xs text-destructive hover:text-destructive">Remover</Button>
        </div>
      </motion.div>
    );
  };

  const KanbanColumn = ({ title, icon, tasks: colTasks, variant, dropStatus }: {
    title: string; icon: React.ReactNode; tasks: TaskRow[];
    variant?: 'danger' | 'warning' | 'success' | 'default'; dropStatus: string;
  }) => {
    const headerColors: Record<string, string> = {
      danger: 'text-destructive border-destructive/30',
      warning: 'text-amber-700 dark:text-amber-400 border-amber-500/30',
      success: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      default: 'text-foreground border-border',
    };
    const bgColors: Record<string, string> = {
      danger: 'bg-destructive/5',
      warning: 'bg-amber-500/5',
      success: 'bg-emerald-500/5',
      default: 'bg-muted/30',
    };
    const v = variant || 'default';
    return (
      <div
        className={`flex flex-col rounded-xl border ${headerColors[v].split(' ').slice(1).join(' ')} ${bgColors[v]} min-h-[300px]`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, dropStatus)}
      >
        <div className={`flex items-center gap-2 p-3 border-b ${headerColors[v].split(' ').slice(1).join(' ')}`}>
          <span className={headerColors[v].split(' ')[0]}>{icon}</span>
          <h3 className={`text-sm font-semibold ${headerColors[v].split(' ')[0]}`}>{title}</h3>
          <Badge variant="secondary" className="text-xs ml-auto">{colTasks.length}</Badge>
        </div>
        <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
          {colTasks.map(t => <KanbanCard key={t.id} task={t} />)}
          {colTasks.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma tarefa</div>
          )}
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
            <p className="text-sm text-muted-foreground">Arraste as tarefas entre as colunas para atualizar o status</p>
          </div>
          <Button onClick={openNew} className="gap-2 shadow-md">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>

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
              {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KanbanColumn title="Atrasadas" icon={<AlertTriangle className="h-4 w-4" />} tasks={overdueTasks} variant="danger" dropStatus="pending" />
            <KanbanColumn title="Hoje" icon={<Clock className="h-4 w-4" />} tasks={todayTasks} variant="warning" dropStatus="pending" />
            <KanbanColumn title="Próximas" icon={<CalendarClock className="h-4 w-4" />} tasks={upcomingTasks} dropStatus="pending" />
            <KanbanColumn title="Concluídas" icon={<CheckSquare className="h-4 w-4" />} tasks={completedTasks} variant="success" dropStatus="completed" />
          </div>
        )}
      </div>

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
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Resumo da tarefa" />
            </div>
            <div>
              <Label>Detalhamento da Demanda</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva em detalhes o que precisa ser feito..."
                rows={3}
              />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsible_id} onValueChange={v => setForm(f => ({ ...f, responsible_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  {internalUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div>
              <Label>🔔 Lembrete</Label>
              <Select value={form.reminder_minutes} onValueChange={v => setForm(f => ({ ...f, reminder_minutes: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o lembrete" /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map(o => <SelectItem key={o.value || 'none'} value={o.value || 'none'}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
