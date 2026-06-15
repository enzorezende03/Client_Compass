import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarClock, CheckSquare, Clock, Filter, Plus, Search, User, Building2, AlertTriangle, GripVertical, Check, ChevronsUpDown, History, CalendarPlus, Lock, Unlock
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
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
import { STAGE_LABELS as ONBOARDING_STAGE_LABELS, forceUnlockByChecklistItem } from '@/lib/onboarding';

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
  category?: string;
  onboarding_stage?: string | null;
  checklist_item_id?: string | null;
  locked?: boolean;
  unlocked_at?: string | null;
  force_unlocked_by?: string | null;
  force_unlock_reason?: string | null;
  reschedule_count?: number;
  last_reschedule_reason?: string | null;
  last_rescheduled_at?: string | null;
  internal_due_date?: string | null;
  client_due_date?: string | null;
}

interface RescheduleRow {
  id: string;
  task_id: string;
  client_id: string;
  previous_due_date: string;
  new_due_date: string;
  reason: string;
  rescheduled_by_name: string;
  created_at: string;
  task_title?: string;
  client_name?: string;
}

// Unified stage labels shared with the Onboarding Kanban for visual consistency.
const STAGE_LABEL: Record<string, string> = ONBOARDING_STAGE_LABELS as Record<string, string>;


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
  internal_due_date: '',
  client_due_date: '',
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
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [deadlineView, setDeadlineView] = useState<'client' | 'internal'>('client');
  const [activeTab, setActiveTab] = useState<'regular' | 'onboarding'>('regular');

  // Reschedule
  const [rescheduleTask, setRescheduleTask] = useState<TaskRow | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleNewDate, setRescheduleNewDate] = useState('');
  const [rescheduleField, setRescheduleField] = useState<'client' | 'internal'>('client');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reschedules, setReschedules] = useState<RescheduleRow[]>([]);

  // Sequential unlocking
  const [showBlocked, setShowBlocked] = useState(false);
  const [forceTask, setForceTask] = useState<TaskRow | null>(null);
  const [forceReason, setForceReason] = useState('');
  const [forcing, setForcing] = useState(false);

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    const [tasksRes, clientsRes, usersRes] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('id, name').eq('archived', false),
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

  // Realtime: keep tasks in sync with the Onboarding panel (checklist toggles,
  // stage auto-advance/manual moves) and other logged-in users.
  useEffect(() => {
    const channel = supabase
      .channel('tasks-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        const oldLocked = (payload.old as any)?.locked;
        const newLocked = (payload.new as any)?.locked;
        if (oldLocked === true && newLocked === false) {
          toast({ title: '🔓 Etapa desbloqueada', description: 'SLA iniciado agora.' });
        }
        fetchData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_onboarding_progress' }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);



  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const cat = (t.category || 'regular') === 'onboarding' ? 'onboarding' : 'regular';
      if (cat !== activeTab) return false;
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.client_name || '').toLowerCase().includes(search.toLowerCase());
      const matchResp = filterResponsible === 'all' || t.responsible_id === filterResponsible || t.responsible === filterResponsible;
      return matchSearch && matchResp;
    });
  }, [tasks, search, filterResponsible, activeTab]);

  const today = new Date().toISOString().split('T')[0];


  const getDeadline = (t: TaskRow) => {
    if (deadlineView === 'internal') {
      return (t as any).internal_due_date || (t as any).client_due_date || t.due_date;
    }
    return (t as any).client_due_date || (t as any).internal_due_date || t.due_date;
  };

  const overdueTasks = filtered.filter(t => t.status === 'pending' && getDeadline(t) < today);
  const todayTasks = filtered.filter(t => t.status === 'pending' && getDeadline(t) === today);
  const upcomingTasks = filtered.filter(t => t.status === 'pending' && getDeadline(t) > today);
  const completedTasks = filtered.filter(t => t.status === 'completed');

  const openNew = () => { setForm(emptyForm); setEditId(null); setDialogOpen(true); };
  const openEdit = (task: TaskRow) => {
    setForm({
      client_id: task.client_id,
      title: task.title,
      description: task.description,
      responsible_id: task.responsible_id || '',
      due_date: task.due_date,
      internal_due_date: (task as any).internal_due_date || '',
      client_due_date: (task as any).client_due_date || '',
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
      due_date: form.client_due_date || form.internal_due_date || form.due_date,
      internal_due_date: form.internal_due_date || null,
      client_due_date: form.client_due_date || null,
      scheduled_time: form.scheduled_time || null,
      status: form.status,
      reminder_minutes: form.reminder_minutes && form.reminder_minutes !== 'none' ? parseInt(form.reminder_minutes) : null,
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

  const openReschedule = (task: TaskRow) => {
    setRescheduleTask(task);
    setRescheduleReason('');
    const hasClient = !!task.client_due_date;
    const hasInternal = !!task.internal_due_date;
    setRescheduleField(hasClient ? 'client' : hasInternal ? 'internal' : 'client');
    const today = new Date();
    today.setDate(today.getDate() + 1);
    setRescheduleNewDate(today.toISOString().split('T')[0]);
  };

  const submitReschedule = async () => {
    if (!rescheduleTask) return;
    if (!rescheduleReason.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' });
      return;
    }
    if (!rescheduleNewDate) {
      toast({ title: 'Selecione a nova data', variant: 'destructive' });
      return;
    }
    const previous = getDeadline(rescheduleTask);
    // Identify current user
    const { data: authData } = await supabase.auth.getUser();
    const me = internalUsers.find(u => u.email === authData.user?.email);
    const updates: any = {
      reschedule_count: (rescheduleTask.reschedule_count || 0) + 1,
      last_reschedule_reason: rescheduleReason.trim(),
      last_rescheduled_at: new Date().toISOString(),
    };
    if (rescheduleField === 'client') {
      updates.client_due_date = rescheduleNewDate;
    } else {
      updates.internal_due_date = rescheduleNewDate;
    }
    // Always sync due_date to the chosen new date as well so kanban reflects
    updates.due_date = rescheduleNewDate;

    const { error: upErr } = await supabase.from('tasks').update(updates).eq('id', rescheduleTask.id);
    if (upErr) { toast({ title: 'Erro ao remanejar', description: upErr.message, variant: 'destructive' }); return; }

    const { error: insErr } = await supabase.from('task_reschedules').insert({
      task_id: rescheduleTask.id,
      client_id: rescheduleTask.client_id,
      previous_due_date: previous,
      new_due_date: rescheduleNewDate,
      reason: rescheduleReason.trim(),
      rescheduled_by: me?.id || null,
      rescheduled_by_name: me?.name || authData.user?.email || 'Desconhecido',
    });
    if (insErr) { toast({ title: 'Erro ao registrar histórico', description: insErr.message, variant: 'destructive' }); return; }

    toast({ title: 'Tarefa remanejada', description: `Nova data: ${new Date(rescheduleNewDate + 'T12:00:00').toLocaleDateString('pt-BR')}` });
    setRescheduleTask(null);
    fetchData();
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    const { data, error } = await supabase
      .from('task_reschedules')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { toast({ title: 'Erro ao carregar histórico', description: error.message, variant: 'destructive' }); return; }
    const taskMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));
    const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));
    setReschedules((data || []).map((r: any) => ({
      ...r,
      task_title: taskMap[r.task_id] || '—',
      client_name: clientMap[r.client_id] || '—',
    })));
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

  const KanbanCard = ({ task, compact }: { task: TaskRow; compact?: boolean }) => {
    const isOverdue = task.status === 'pending' && getDeadline(task) < today;
    if (compact) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          draggable
          onDragStart={() => handleDragStart(task.id)}
          className="rounded-md border p-2 bg-card shadow-sm cursor-grab active:cursor-grabbing hover:shadow transition-all flex items-center gap-2"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
          <button
            onClick={() => navigate(`/client/${task.client_id}`)}
            className="text-xs font-medium text-primary hover:underline truncate flex-1 text-left"
            title={`${task.client_name} — ${task.title}`}
          >
            {task.client_name}
          </button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(task)} className="h-5 px-1.5 text-[10px]">Editar</Button>
        </motion.div>
      );
    }
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
          <div className="flex-1">
            <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.title}
            </p>
            {task.category === 'onboarding' && task.onboarding_stage && (
              <Badge variant="outline" className="mt-1 text-[10px] border-primary/40 text-primary">
                {STAGE_LABEL[task.onboarding_stage] || task.onboarding_stage}
              </Badge>
            )}
          </div>
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
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            {(task as any).internal_due_date && (
              <span className={`inline-flex items-center gap-1 text-xs ${deadlineView === 'internal' && isOverdue ? 'text-destructive font-medium' : deadlineView === 'internal' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                <CalendarClock className="h-3 w-3" />
                <span className="font-medium">Interno:</span>
                {new Date((task as any).internal_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            )}
            {(task as any).client_due_date && (
              <span className={`inline-flex items-center gap-1 text-xs ${deadlineView === 'client' && isOverdue ? 'text-destructive font-medium' : deadlineView === 'client' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                <CalendarClock className="h-3 w-3" />
                <span className="font-medium">Cliente:</span>
                {new Date((task as any).client_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                {task.scheduled_time && ` às ${task.scheduled_time.slice(0, 5)}`}
              </span>
            )}
            {!(task as any).internal_due_date && !(task as any).client_due_date && (
              <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                <CalendarClock className="h-3 w-3" />
                {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                {task.scheduled_time && ` às ${task.scheduled_time.slice(0, 5)}`}
              </span>
            )}
          </div>
        </div>
        {(task.reschedule_count || 0) > 0 && (
          <div className="ml-6 mt-2 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
            <History className="h-3 w-3" />
            Remanejada {task.reschedule_count}× — última: {task.last_reschedule_reason || '—'}
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 ml-6 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => openEdit(task)} className="h-6 px-2 text-xs">Editar</Button>
          <Button variant="outline" size="sm" onClick={() => openReschedule(task)} className="h-6 px-2 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10">
            <CalendarPlus className="h-3 w-3" /> Remanejar
          </Button>
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
          {colTasks.map(t => <KanbanCard key={t.id} task={t} compact={dropStatus === 'completed'} />)}
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openHistory} className="gap-2">
              <History className="h-4 w-4" />
              Remanejamentos
            </Button>
            {activeTab === 'regular' && (
              <Button onClick={openNew} className="gap-2 shadow-md">
                <Plus className="h-4 w-4" />
                Nova Tarefa
              </Button>
            )}
          </div>
        </div>

        <div className="inline-flex rounded-md border bg-muted p-1 mb-4">
          <button
            onClick={() => setActiveTab('regular')}
            className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${activeTab === 'regular' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Tarefas do dia a dia
          </button>
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors ${activeTab === 'onboarding' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Tarefas de Onboarding
          </button>
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
          <div className="inline-flex rounded-md border bg-muted p-1">
            <button
              onClick={() => setDeadlineView('client')}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${deadlineView === 'client' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Prazo Cliente
            </button>
            <button
              onClick={() => setDeadlineView('internal')}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${deadlineView === 'internal' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Prazo Interno
            </button>
          </div>
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
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {form.client_id
                      ? clients.find(c => c.id === form.client_id)?.name
                      : 'Selecione o cliente'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const client = clients.find(c => c.id === value);
                      if (!client) return 0;
                      return normalize(client.name).includes(normalize(search)) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clients.map(c => (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            onSelect={(v) => {
                              setForm(f => ({ ...f, client_id: v }));
                              setClientPopoverOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', form.client_id === c.id ? 'opacity-100' : 'opacity-0')} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                <Label>Prazo Interno (Time CS)</Label>
                <Input
                  type="date"
                  value={form.internal_due_date}
                  onChange={e => setForm(f => ({ ...f, internal_due_date: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Controle interno do time</p>
              </div>
              <div>
                <Label>Prazo com o Cliente</Label>
                <Input
                  type="date"
                  value={form.client_due_date}
                  onChange={e => setForm(f => ({ ...f, client_due_date: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Acordado com o cliente</p>
              </div>
            </div>
            <div>
              <Label>Horário</Label>
              <Input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />
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

      <Dialog open={!!rescheduleTask} onOpenChange={(o) => !o && setRescheduleTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remanejar tarefa</DialogTitle>
            <DialogDescription>
              {rescheduleTask?.title} — {rescheduleTask?.client_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              Prazo atual: {rescheduleTask ? new Date(getDeadline(rescheduleTask) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
              {(rescheduleTask?.reschedule_count || 0) > 0 && (
                <div className="mt-1 text-amber-700 dark:text-amber-400">
                  Já remanejada {rescheduleTask?.reschedule_count}× anteriormente
                </div>
              )}
            </div>
            <div>
              <Label>Aplicar em</Label>
              <Select value={rescheduleField} onValueChange={(v: 'client' | 'internal') => setRescheduleField(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Prazo com o Cliente</SelectItem>
                  <SelectItem value="internal">Prazo Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nova data de acompanhamento *</Label>
              <Input type="date" value={rescheduleNewDate} onChange={e => setRescheduleNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Justificativa *</Label>
              <Textarea
                rows={3}
                value={rescheduleReason}
                onChange={e => setRescheduleReason(e.target.value)}
                placeholder="Por que a tarefa precisa ser remanejada?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTask(null)}>Cancelar</Button>
            <Button onClick={submitReschedule}>Remanejar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Controle de Remanejamentos</DialogTitle>
            <DialogDescription>Histórico de tarefas remanejadas (últimos 200 registros)</DialogDescription>
          </DialogHeader>
          {reschedules.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhum remanejamento registrado.</div>
          ) : (
            <div className="space-y-2">
              {reschedules.map(r => (
                <div key={r.id} className="rounded-lg border p-3 bg-card">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => { setHistoryOpen(false); navigate(`/client/${r.client_id}`); }}
                        className="text-sm font-medium text-primary hover:underline text-left"
                      >
                        {r.task_title}
                      </button>
                      <div className="text-xs text-muted-foreground">{r.client_name}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(r.created_at).toLocaleString('pt-BR')}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground line-through">
                      {new Date(r.previous_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span>→</span>
                    <span className="font-medium">
                      {new Date(r.new_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-muted-foreground ml-auto">por {r.rescheduled_by_name}</span>
                  </div>
                  {r.reason && (
                    <p className="mt-2 text-xs text-foreground bg-muted/40 rounded p-2">{r.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
