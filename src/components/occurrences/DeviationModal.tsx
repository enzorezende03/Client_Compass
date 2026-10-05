import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDocument } from '@/lib/document';
import { Sector, Severity, SECTOR_LABELS, SEVERITY_LABELS } from '@/types/client';

interface Opt { id: string; name: string; document?: string }
interface Props { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string; clientName?: string; onSaved?: () => void }

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function DeviationModal({ open, onOpenChange, clientId, clientName, onSaved }: Props) {
  const { toast } = useToast();
  const locked = !!clientId;
  const [clients, setClients] = useState<Opt[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Opt | null>(null);
  const [description, setDescription] = useState('');
  const [sector, setSector] = useState<Sector>('fiscal');
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [missing, setMissing] = useState('');
  const [charged, setCharged] = useState<'nao' | 'sim'>('nao');
  const [chargedAt, setChargedAt] = useState('');
  const [severity, setSeverity] = useState<Severity>('media');
  const [createTask, setCreateTask] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || locked) return;
    supabase.from('clients').select('id, name, document').eq('archived', false).order('name')
      .then(({ data }) => setClients((data as Opt[]) || []));
  }, [open, locked]);

  const client = locked ? { id: clientId!, name: clientName || 'Cliente' } : sel;
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase(); if (!t) return [];
    const dg = t.replace(/\D/g, '');
    return clients.filter(c => c.name.toLowerCase().includes(t) || (dg.length >= 3 && (c.document || '').replace(/\D/g, '').includes(dg))).slice(0, 8);
  }, [clients, q]);

  const reset = () => { setSel(null); setQ(''); setDescription(''); setSector('fiscal'); setOccurredAt(nowLocal()); setMissing(''); setCharged('nao'); setChargedAt(''); setSeverity('media'); setCreateTask(true); };

  const submit = async () => {
    if (!client || !description.trim()) return;
    if (charged === 'sim' && !chargedAt) { toast({ title: 'Informe a data da cobrança', variant: 'destructive' }); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('register_operational_deviation', {
      p_client_id: client.id, p_description: description.trim(), p_sector: sector,
      p_occurred_at: new Date(occurredAt).toISOString(), p_missing_info: missing,
      p_client_charged: charged === 'sim', p_client_charged_at: charged === 'sim' ? chargedAt : null,
      p_severity: severity, p_create_task: createTask,
    });
    setSaving(false);
    if (error) { toast({ title: 'Nada foi salvo', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Desvio registrado', description: data?.assigned_cs_name ? `Encaminhado para ${data.assigned_cs_name}.` : 'Nenhum CS encontrado para encaminhar.' });
    reset(); onOpenChange(false); onSaved?.();
  };

  const L = ({ children }: { children: React.ReactNode }) => <Label className="mb-1 block text-xs text-muted-foreground">{children}</Label>;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar desvio operacional</DialogTitle>
          <DialogDescription>Fato causado pelo cliente. Vai direto para o CS responsável pelo cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div>
            <L>Cliente <span className="text-destructive">*</span></L>
            {client ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{client.name}{(client as Opt).document ? <span className="ml-2 whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDocument((client as Opt).document!)}</span> : null}</span>
                {!locked && <Button variant="ghost" size="sm" className="h-7" onClick={() => setSel(null)}>Trocar</Button>}
              </div>
            ) : (
              <div className="relative">
                <Input placeholder="Buscar por nome ou CNPJ" value={q} onChange={e => setQ(e.target.value)} />
                {matches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {matches.map(c => (
                      <button key={c.id} type="button" onClick={() => { setSel(c); setQ(''); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent">
                        <span>{c.name}</span><span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDocument(c.document || '')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <L>O que aconteceu <span className="text-destructive">*</span></L>
            <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <L>Setor impactado</L>
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
            <div className="col-span-2">
              <L>Data do fato</L>
              <Input type="datetime-local" value={occurredAt} max={nowLocal()} onChange={e => setOccurredAt(e.target.value)} />
            </div>
          </div>
          <div>
            <L>Documento ou informação que falta</L>
            <Input value={missing} onChange={e => setMissing(e.target.value)} />
          </div>
          <div className="rounded-lg border p-3">
            <L>Já houve cobrança direta ao cliente?</L>
            <RadioGroup value={charged} onValueChange={v => setCharged(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="dv-n" /><Label htmlFor="dv-n" className="font-normal">Não</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="dv-s" /><Label htmlFor="dv-s" className="font-normal">Sim</Label></div>
            </RadioGroup>
            {charged === 'sim' && <Input type="date" className="mt-2 w-48" value={chargedAt} onChange={e => setChargedAt(e.target.value)} />}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="dv-task" checked={createTask} onCheckedChange={v => setCreateTask(!!v)} />
            <Label htmlFor="dv-task" className="text-sm font-normal">Criar tarefa para o CS (prazo de 2 dias úteis)</Label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !client || !description.trim()}>{saving ? 'Salvando...' : 'Registrar desvio'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
