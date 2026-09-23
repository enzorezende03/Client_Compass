import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDocument } from '@/lib/document';
import { CLASSIFICATION_REQUIRED, getCurrentInternalUser } from '@/lib/occurrences';
import {
  InteractionType, Sector, DemandStatus, ResponsibilityOrigin, Severity,
  INTERACTION_LABELS, SECTOR_LABELS, DEMAND_STATUS_LABELS, RESPONSIBILITY_ORIGIN_LABELS, SEVERITY_LABELS,
} from '@/types/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  clientName?: string;
  onSaved?: () => void;
  showClientLink?: boolean;
}

interface Opt { id: string; name: string; document?: string }

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const today = () => new Date().toISOString().split('T')[0];

export function OccurrenceModal({ open, onOpenChange, clientId, clientName, onSaved, showClientLink }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const locked = !!clientId;
  const [clients, setClients] = useState<Opt[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selClient, setSelClient] = useState<Opt | null>(null);
  const [type, setType] = useState<InteractionType>('complaint');
  const [classification, setClassification] = useState<ResponsibilityOrigin | 'none'>('none');
  const [description, setDescription] = useState('');
  const [sector, setSector] = useState<Sector>('fiscal');
  const [severity, setSeverity] = useState<Severity>('media');
  const [status, setStatus] = useState<DemandStatus>('open');
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Opt[]>([]);
  const [me, setMe] = useState<Opt | null>(null);
  const [createTask, setCreateTask] = useState(false);
  const [taskResponsibleId, setTaskResponsibleId] = useState('');
  const [taskDate, setTaskDate] = useState(today());
  const [taskTime, setTaskTime] = useState('');
  const [taskClientDue, setTaskClientDue] = useState('');
  const [taskInternalDue, setTaskInternalDue] = useState('');

  useEffect(() => {
    if (!open) return;
    supabase.from('internal_users').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setUsers((data as Opt[]) || []));
    getCurrentInternalUser().then(setMe);
    if (!locked) {
      supabase.from('clients').select('id, name, document').eq('archived', false).order('name')
        .then(({ data }) => setClients((data as Opt[]) || []));
    }
  }, [open, locked]);

  const client: Opt | null = locked ? { id: clientId!, name: clientName || 'Cliente' } : selClient;

  const matches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return clients.filter(c => c.name.toLowerCase().includes(q) ||
      (digits.length >= 3 && (c.document || '').replace(/\D/g, '').includes(digits))).slice(0, 8);
  }, [clients, clientSearch]);

  const required = CLASSIFICATION_REQUIRED.includes(type);
  const classMissing = required && classification === 'none';
  const suggestedTitle = `[${client?.name || 'Cliente'}] ${INTERACTION_LABELS[type]} — ${description.trim().slice(0, 60)}`;

  const reset = () => {
    setSelClient(null); setClientSearch(''); setType('complaint'); setClassification('none'); setDescription('');
    setSector('fiscal'); setSeverity('media'); setStatus('open'); setOccurredAt(nowLocal());
    setCreateTask(false); setTaskResponsibleId(''); setTaskDate(today()); setTaskTime('');
    setTaskClientDue(''); setTaskInternalDue('');
  };

  const submit = async () => {
    if (!client) { toast({ title: 'Selecione o cliente', variant: 'destructive' }); return; }
    if (!description.trim()) { toast({ title: 'Descreva a ocorrência', variant: 'destructive' }); return; }
    if (classMissing) { toast({ title: 'Classificação obrigatória', description: 'Obrigatória para reclamação, solicitação e problema crítico.', variant: 'destructive' }); return; }
    if (createTask && (!taskDate || !taskResponsibleId)) { toast({ title: 'Informe responsável e data da tarefa', variant: 'destructive' }); return; }
    setSaving(true);
    const taskUser = users.find(u => u.id === taskResponsibleId);
    const { error } = await (supabase as any).rpc('create_interaction_with_task', {
      p_client_id: client.id, p_type: type, p_sector: sector, p_origin: 'client', p_demand_status: status,
      p_description: description.trim(), p_responsible: me?.name || 'Equipe CS',
      p_responsibility_origin: classification === 'none' ? null : classification,
      p_is_relevant: false, p_relevant_type: null,
      p_create_task: createTask, p_task_title: createTask ? suggestedTitle : null,
      p_task_responsible_id: createTask ? taskResponsibleId : null,
      p_task_responsible: createTask ? taskUser?.name ?? null : null,
      p_task_due_date: createTask ? taskDate : null,
      p_task_client_due_date: createTask && taskClientDue ? taskClientDue : null,
      p_task_internal_due_date: createTask && taskInternalDue ? taskInternalDue : null,
      p_task_time: createTask && taskTime ? taskTime : null,
      p_severity: severity, p_occurred_at: new Date(occurredAt).toISOString(),
    });
    setSaving(false);
    if (error) { toast({ title: 'Nada foi salvo', description: error.message, variant: 'destructive' }); return; }
    const target = client;
    toast({
      title: showClientLink ? `Registrado na ficha de ${target.name}` : (createTask ? 'Ocorrência e tarefa registradas' : 'Ocorrência registrada'),
      action: showClientLink
        ? <ToastAction altText="Abrir ficha" onClick={() => navigate(`/client/${target.id}?tab=ocorrencias`)}>Abrir ficha</ToastAction>
        : undefined,
    });
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  const L = ({ children }: { children: React.ReactNode }) => <Label className="mb-1 block text-xs text-muted-foreground">{children}</Label>;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova ocorrência</DialogTitle>
          <DialogDescription>O registro aparece no menu Ocorrências e na ficha do cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div>
            <L>Cliente <span className="text-destructive">*</span></L>
            {client ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{client.name}{client.document ? <span className="ml-2 font-mono text-xs text-muted-foreground">{formatDocument(client.document)}</span> : null}</span>
                {!locked && <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelClient(null)}>Trocar</Button>}
              </div>
            ) : (
              <div className="relative">
                <Input placeholder="Buscar por nome ou CNPJ" value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                {matches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {matches.map(c => (
                      <button key={c.id} type="button" onClick={() => { setSelClient(c); setClientSearch(''); }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent">
                        <span>{c.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{formatDocument(c.document || '')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <L>Tipo</L>
              <Select value={type} onValueChange={v => setType(v as InteractionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INTERACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <L>Setor responsável</L>
              <Select value={sector} onValueChange={v => setSector(v as Sector)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SECTOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <L>Gravidade</L>
              <Select value={severity} onValueChange={v => setSeverity(v as Severity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SEVERITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <L>Status</L>
              <Select value={status} onValueChange={v => setStatus(v as DemandStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DEMAND_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <L>Data e hora do fato</L>
              <Input type="datetime-local" value={occurredAt} max={nowLocal()} onChange={e => setOccurredAt(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <L>Classificação {required && <span className="text-destructive">*</span>}</L>
            <RadioGroup value={classification} onValueChange={v => setClassification(v as any)} className="gap-2">
              {(['escritorio', 'cliente', 'neutro'] as ResponsibilityOrigin[]).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem value={k} id={`oc-${k}`} />
                  <Label htmlFor={`oc-${k}`} className="text-sm font-normal">{RESPONSIBILITY_ORIGIN_LABELS[k]}</Label>
                </div>
              ))}
              {!required && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="none" id="oc-none" />
                  <Label htmlFor="oc-none" className="text-sm font-normal text-muted-foreground">Classificar depois</Label>
                </div>
              )}
            </RadioGroup>
            {classMissing && <p className="mt-2 text-xs text-destructive">Obrigatória para reclamação, solicitação e problema crítico.</p>}
          </div>

          <div>
            <L>Descrição <span className="text-destructive">*</span></L>
            <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="O que aconteceu?" />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="oc-task" checked={createTask} onCheckedChange={v => setCreateTask(!!v)} />
              <Label htmlFor="oc-task" className="text-sm">Gerar tarefa a partir desta ocorrência</Label>
            </div>
            {createTask && (
              <div className="space-y-3">
                <p className="break-words text-sm text-foreground"><span className="text-xs text-muted-foreground">Título: </span>{suggestedTitle}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <L>Responsável</L>
                    <Select value={taskResponsibleId} onValueChange={setTaskResponsibleId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><L>Data</L><Input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} /></div>
                  <div><L>Horário (opcional)</L><Input type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)} /></div>
                  <div><L>Prazo cliente</L><Input type="date" value={taskClientDue} onChange={e => setTaskClientDue(e.target.value)} /></div>
                  <div><L>Prazo interno</L><Input type="date" value={taskInternalDue} onChange={e => setTaskInternalDue(e.target.value)} /></div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !client || !description.trim() || classMissing}>
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
