import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  InteractionType, Sector, DemandOrigin, DemandStatus, ResponsibilityOrigin,
  INTERACTION_LABELS, SECTOR_LABELS, ORIGIN_LABELS, DEMAND_STATUS_LABELS,
  RESPONSIBILITY_ORIGIN_LABELS,
} from '@/types/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
  onSaved: () => void;
}

const CLASSIFICATION_REQUIRED: InteractionType[] = ['complaint', 'request', 'critical_issue'];

interface InternalUser { id: string; name: string }

export function QuickInteractionModal({ open, onOpenChange, clientId, clientName, onSaved }: Props) {
  const { toast } = useToast();
  const [type, setType] = useState<InteractionType>('service');
  const [sector, setSector] = useState<Sector>('fiscal');
  const [origin, setOrigin] = useState<DemandOrigin>('client');
  const [demandStatus, setDemandStatus] = useState<DemandStatus>('open');
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState('');
  const [isRelevant, setIsRelevant] = useState(false);
  const [relevantType, setRelevantType] = useState('');
  const [classification, setClassification] = useState<ResponsibilityOrigin | 'none'>('none');
  const [saving, setSaving] = useState(false);

  // Task generation
  const [createTask, setCreateTask] = useState(false);
  const [taskResponsibleId, setTaskResponsibleId] = useState('');
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskTime, setTaskTime] = useState('');
  const [taskClientDue, setTaskClientDue] = useState('');
  const [taskInternalDue, setTaskInternalDue] = useState('');
  const [users, setUsers] = useState<InternalUser[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from('internal_users').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setUsers((data as InternalUser[]) || []));
  }, [open]);

  const classificationRequired = CLASSIFICATION_REQUIRED.includes(type);
  const classificationMissing = classificationRequired && classification === 'none';

  const suggestedTitle = `[${clientName || 'Cliente'}] ${INTERACTION_LABELS[type]} – ${description.trim().slice(0, 60)}`;

  const reset = () => {
    setDescription(''); setResponsible(''); setIsRelevant(false); setRelevantType('');
    setClassification('none'); setCreateTask(false); setTaskResponsibleId('');
    setTaskTime(''); setTaskClientDue(''); setTaskInternalDue('');
    setTaskDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !responsible.trim()) return;
    if (classificationMissing) {
      toast({
        title: 'Classificação obrigatória',
        description: 'Informe se o problema foi gerado pelo escritório ou pelo cliente.',
        variant: 'destructive',
      });
      return;
    }
    if (createTask && !taskDate) {
      toast({ title: 'Informe a data da tarefa', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc('create_interaction_with_task', {
      p_client_id: clientId,
      p_type: type,
      p_sector: sector,
      p_origin: origin,
      p_demand_status: demandStatus,
      p_description: description.trim(),
      p_responsible: responsible.trim(),
      p_responsibility_origin: classification === 'none' ? null : classification,
      p_is_relevant: isRelevant,
      p_relevant_type: isRelevant ? relevantType : null,
      p_create_task: createTask,
      p_task_title: createTask ? suggestedTitle : null,
      p_task_responsible_id: createTask && taskResponsibleId ? taskResponsibleId : null,
      p_task_responsible: createTask
        ? (users.find(u => u.id === taskResponsibleId)?.name || responsible.trim())
        : null,
      p_task_due_date: createTask ? taskDate : null,
      p_task_client_due_date: createTask && taskClientDue ? taskClientDue : null,
      p_task_internal_due_date: createTask && taskInternalDue ? taskInternalDue : null,
      p_task_time: createTask && taskTime ? taskTime : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Nada foi salvo', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: createTask ? 'Registro e tarefa criados' : 'Registro criado' });
    reset();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Nova Interação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INTERACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Setor</Label>
              <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Origem</Label>
              <Select value={origin} onValueChange={(v) => setOrigin(v as DemandOrigin)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={demandStatus} onValueChange={(v) => setDemandStatus(v as DemandStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEMAND_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Classificação {classificationRequired && <span className="text-destructive">*</span>}
            </Label>
            <RadioGroup value={classification} onValueChange={(v) => setClassification(v as any)} className="gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="escritorio" id="cls-escritorio" />
                <Label htmlFor="cls-escritorio" className="text-sm font-normal">{RESPONSIBILITY_ORIGIN_LABELS.escritorio}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cliente" id="cls-cliente" />
                <Label htmlFor="cls-cliente" className="text-sm font-normal">{RESPONSIBILITY_ORIGIN_LABELS.cliente}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="none" id="cls-none" disabled={classificationRequired} />
                <Label htmlFor="cls-none" className="text-sm font-normal">Não se aplica</Label>
              </div>
            </RadioGroup>
            {classificationMissing && (
              <p className="text-xs text-destructive mt-2">Obrigatória para reclamação, solicitação e problema crítico.</p>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
            <Input placeholder="Nome do responsável" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
            <Textarea placeholder="Descreva a interação..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isRelevant} onCheckedChange={setIsRelevant} />
            <Label className="text-sm">Evento relevante</Label>
            {isRelevant && (
              <Input placeholder="Tipo (ex: Quase cancelamento)" value={relevantType} onChange={(e) => setRelevantType(e.target.value)} className="flex-1" />
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="gen-task" checked={createTask} onCheckedChange={(v) => setCreateTask(!!v)} />
              <Label htmlFor="gen-task" className="text-sm">Gerar tarefa a partir deste registro</Label>
            </div>
            {createTask && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Título sugerido</Label>
                  <p className="text-sm text-foreground break-words">{suggestedTitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
                    <Select value={taskResponsibleId} onValueChange={setTaskResponsibleId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Data</Label>
                    <Input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Horário (opcional)</Label>
                    <Input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Prazo cliente</Label>
                    <Input type="date" value={taskClientDue} onChange={(e) => setTaskClientDue(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Prazo interno</Label>
                    <Input type="date" value={taskInternalDue} onChange={(e) => setTaskInternalDue(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !description.trim() || !responsible.trim() || classificationMissing}>
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
