import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TimelineEntry, INTERACTION_LABELS } from '@/types/client';

interface Props {
  entry: TimelineEntry | null;
  clientName?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface InternalUser { id: string; name: string }

export function GenerateTaskFromEntryDialog({ entry, clientName, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [responsibleId, setResponsibleId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [clientDue, setClientDue] = useState('');
  const [internalDue, setInternalDue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setResponsibleId(''); setTime(''); setClientDue(''); setInternalDue('');
    setDate(new Date().toISOString().split('T')[0]);
    supabase.from('internal_users').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setUsers((data as InternalUser[]) || []));
  }, [entry]);

  if (!entry) return null;

  const title = `[${clientName || 'Cliente'}] ${INTERACTION_LABELS[entry.type]} – ${entry.description.trim().slice(0, 60)}`;

  const handleCreate = async () => {
    setSaving(true);
    const { error } = await supabase.from('tasks').insert({
      client_id: entry.clientId,
      title,
      description: entry.description,
      responsible: users.find(u => u.id === responsibleId)?.name || entry.responsible || 'Sistema',
      responsible_id: responsibleId || null,
      due_date: date,
      client_due_date: clientDue || null,
      internal_due_date: internalDue || null,
      scheduled_time: time || null,
      status: 'pending',
      category: 'regular',
      source_timeline_entry_id: entry.id,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao gerar tarefa', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tarefa criada' });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar tarefa a partir do registro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Título</Label>
            <p className="text-sm break-words">{title}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
              <Select value={responsibleId} onValueChange={setResponsibleId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Horário (opcional)</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Prazo cliente</Label>
              <Input type="date" value={clientDue} onChange={(e) => setClientDue(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Prazo interno</Label>
              <Input type="date" value={internalDue} onChange={(e) => setInternalDue(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving || !date}>{saving ? 'Criando...' : 'Criar tarefa'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
