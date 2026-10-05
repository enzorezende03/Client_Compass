import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Bell, User, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAccessProfile, usePermission } from '@/hooks/usePermission';
import { ChecklistItemRow } from '@/components/onboarding/ChecklistItemRow';
import { STAGE_LABELS, toggleChecklistItem } from '@/lib/onboarding';

const sb = supabase as any;
const fmtD = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
export const sinceLabel = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

interface Update { id: string; content: string; author_name: string; created_at: string }

/** Histórico de andamento de uma tarefa (texto + autor + data). */
export function TaskUpdates({ taskId }: { taskId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Update[]>([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const { data } = await sb.from('task_updates').select('id, content, author_name, created_at').eq('task_id', taskId).order('created_at', { ascending: false });
    setRows(data || []);
  }, [taskId]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`tu-${taskId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_updates', filter: `task_id=eq.${taskId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, taskId]);
  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const { error } = await sb.from('task_updates').insert({ task_id: taskId, content: text.trim() });
    setSaving(false);
    if (error) { toast({ title: 'Não foi possível registrar', description: error.message, variant: 'destructive' }); return; }
    setText(''); load();
  };
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atualizações</p>
      <div className="flex gap-2">
        <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Como está o andamento?" className="text-sm" />
        <Button size="sm" onClick={add} disabled={saving || !text.trim()} className="self-end">Registrar</Button>
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma atualização ainda.</p> : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="rounded-md border bg-muted/30 p-2 text-sm">
              <p className="whitespace-pre-wrap">{r.content}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{r.author_name || 'Sistema'} · {new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TaskInfo {
  id: string; title: string; responsible: string; due_date: string; internal_due_date: string | null; client_due_date: string | null;
  scheduled_time: string | null; reminder_minutes: number | null; status: string; locked: boolean;
}

/** Campos de tarefa (responsável, prazos, lembrete) + atualizações. Busca por id ou pelo item de checklist. */
export function TaskInfoPanel({ taskId, clientId, checklistItemId, onEdit }: { taskId?: string; clientId?: string; checklistItemId?: string; onEdit?: () => void }) {
  const [t, setT] = useState<TaskInfo | null | undefined>(undefined);
  const load = useCallback(async () => {
    let q = sb.from('tasks').select('id, title, responsible, due_date, internal_due_date, client_due_date, scheduled_time, reminder_minutes, status, locked');
    q = taskId ? q.eq('id', taskId) : q.eq('client_id', clientId).eq('checklist_item_id', checklistItemId);
    const { data } = await q.limit(1).maybeSingle();
    setT(data ?? null);
  }, [taskId, clientId, checklistItemId]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`ti-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  if (t === undefined) return null;
  if (t === null) return <p className="text-xs text-muted-foreground">Sem tarefa vinculada a este item.</p>;
  const reminder = t.reminder_minutes == null ? 'Sem lembrete' : t.reminder_minutes >= 1440 ? `${t.reminder_minutes / 1440} dia(s) antes` : t.reminder_minutes >= 60 ? `${t.reminder_minutes / 60} h antes` : `${t.reminder_minutes} min antes`;
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">Tarefa: {t.title}</p>
        {onEdit && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>Editar tarefa</Button>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {t.responsible || 'Sem responsável'}</span>
        <span className="inline-flex items-center gap-1"><Bell className="h-3 w-3" /> {reminder}</span>
        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Interno: {fmtD(t.internal_due_date || t.due_date)}</span>
        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Cliente: {fmtD(t.client_due_date || t.due_date)}{t.scheduled_time ? ` às ${t.scheduled_time.slice(0, 5)}` : ''}</span>
        <span>Situação: {t.status === 'completed' ? 'Concluída' : t.locked ? 'Bloqueada' : t.status === 'cancelled' ? 'Cancelada' : 'Pendente'}</span>
      </div>
      <TaskUpdates taskId={t.id} />
    </div>
  );
}

/** Checklist completo da etapa atual do cliente, com itens expansíveis e conclusão no próprio painel. */
export function StageChecklistPanel({ clientId }: { clientId: string }) {
  const { canWriteClients } = useAccessProfile();
  const { allowed: canEditContent } = usePermission('manage_onboarding_procedures');
  const [client, setClient] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    const { data: c } = await sb.from('clients').select('id, name, document, cs_responsible, segment, onboarding_stage, onboarding_type').eq('id', clientId).maybeSingle();
    setClient(c);
    if (!c?.onboarding_stage) { setRows([]); return; }
    const { data } = await sb.from('client_onboarding_progress').select('*, item:onboarding_checklist_items(*)').eq('client_id', clientId);
    const type = c.onboarding_type || 'empresa_existente';
    setRows(((data as any[]) || [])
      .filter(p => p.item?.stage === c.onboarding_stage && (!p.item.applies_to_types || p.item.applies_to_types.includes(type)))
      .sort((a, b) => Number(a.item.active === false) - Number(b.item.active === false) || a.item.order_index - b.item.order_index));
  }, [clientId]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`sc-${clientId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_onboarding_progress', filter: `client_id=eq.${clientId}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clients', filter: `id=eq.${clientId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, clientId]);
  if (!client) return null;
  if (!client.onboarding_stage) return <p className="text-xs text-muted-foreground">Cliente sem onboarding em andamento.</p>;
  const done = rows.filter(r => r.item.active !== false && r.status === 'concluido').length;
  const total = rows.filter(r => r.item.active !== false).length;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{(STAGE_LABELS as any)[client.onboarding_stage] ?? client.onboarding_stage} <span className="font-normal text-muted-foreground">· {done} de {total} concluídos</span></p>
      {rows.map(p => (
        <ChecklistItemRow key={p.id} p={p} client={client} open={open.has(p.id)}
          onOpenChange={v => setOpen(s => { const n = new Set(s); v ? n.add(p.id) : n.delete(p.id); return n; })}
          onToggle={async checked => { await toggleChecklistItem(p.id, clientId, p.item.title, checked); load(); }}
          canWrite={canWriteClients} canEditContent={canEditContent} onDefinitionSaved={load} />
      ))}
    </div>
  );
}

/** Painel unificado: tarefa + (se for de onboarding) checklist da etapa do cliente. */
export function ExecutionTaskSheet({ task, onClose, onEdit }: {
  task: { id: string; title: string; client_id: string; client_name?: string; category?: string } | null;
  onClose: () => void; onEdit?: () => void;
}) {
  const isOnb = task?.category === 'onboarding';
  return (
    <Sheet open={!!task} onOpenChange={o => !o && onClose()}>
      <SheetContent className={`w-full overflow-y-auto ${isOnb ? 'sm:max-w-5xl' : 'sm:max-w-xl'}`}>
        {task && (
          <>
            <SheetHeader>
              <SheetTitle>{task.client_name}</SheetTitle>
              <SheetDescription>{task.title}</SheetDescription>
            </SheetHeader>
            <div className={`mt-4 grid gap-4 ${isOnb ? 'lg:grid-cols-2' : ''}`}>
              <TaskInfoPanel taskId={task.id} onEdit={onEdit} />
              {isOnb && <div className="space-y-2"><p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MessageCircle className="h-3 w-3" /> Checklist da etapa</p><StageChecklistPanel clientId={task.client_id} /></div>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
