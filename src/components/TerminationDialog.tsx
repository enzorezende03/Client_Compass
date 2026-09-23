import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TERMINATION_REASON_LABELS, TerminationReason } from '@/lib/churn';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  onDone: () => void;
  defaultArchive?: boolean;
}

export const ERROR_SECTORS = ['Fiscal', 'Contábil', 'DP', 'Societário', 'Comercial', 'Financeiro', 'CS'];

export function RegisterTerminationDialog({ open, onOpenChange, clientId, onDone, defaultArchive = false }: Props) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [requestDate, setRequestDate] = useState(today);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [category, setCategory] = useState<TerminationReason | ''>('');
  const [detail, setDetail] = useState('');
  const [initiatedBy, setInitiatedBy] = useState<'cliente' | 'escritorio'>('cliente');
  const [wasError, setWasError] = useState(false);
  const [errorSector, setErrorSector] = useState('');
  const [improvement, setImprovement] = useState('');
  const [archive, setArchive] = useState(defaultArchive);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!requestDate || !category) {
      toast({ title: 'Preencha a data do pedido e o motivo', variant: 'destructive' });
      return;
    }
    if (wasError && !errorSector) {
      toast({ title: 'Informe a área responsável pelo erro', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('client_terminations' as any).insert({
      client_id: clientId,
      request_date: requestDate,
      effective_date: effectiveDate || null,
      reason_category: category,
      reason_detail: detail,
      initiated_by: initiatedBy,
      was_error: wasError,
      error_sector: wasError ? errorSector : null,
      improvement_notes: improvement,
      archive_client: archive,
    } as any);
    setSaving(false);
    if (error) {
      const dup = error.message.includes('client_terminations_one_active');
      toast({
        title: dup ? 'Este cliente já possui um distrato ativo' : 'Erro ao registrar distrato',
        description: dup ? 'Reverta o distrato atual antes de registrar outro.' : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Distrato registrado', description: 'O cliente foi marcado como Cancelado.' });
    onOpenChange(false);
    setDetail(''); setCategory(''); setEffectiveDate('');
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar distrato</DialogTitle>
          <DialogDescription>
            O cliente passa a Cancelado e o pedido entra no cálculo de churn do período.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data do pedido</Label>
              <Input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Encerramento previsto</Label>
              <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={category} onValueChange={v => setCategory(v as TerminationReason)}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {Object.entries(TERMINATION_REASON_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Detalhamento</Label>
            <Textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3}
              placeholder="Contexto do pedido de distrato" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quem originou</Label>
              <Select value={initiatedBy} onValueChange={v => setInitiatedBy(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="escritorio">Contabilidade (escritório)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Houve erro nosso?</Label>
              <Select value={wasError ? 'sim' : 'nao'} onValueChange={v => setWasError(v === 'sim')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {wasError && (
            <div className="space-y-1.5">
              <Label>Área do erro</Label>
              <Select value={errorSector} onValueChange={setErrorSector}>
                <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent>
                  {ERROR_SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>O que podemos melhorar na entrega?</Label>
            <Textarea value={improvement} onChange={e => setImprovement(e.target.value)} rows={2}
              placeholder="Aprendizado para evitar novos distratos" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={archive} onChange={e => setArchive(e.target.checked)} />
            Arquivar (desativar) o cliente agora
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Registrando...' : 'Registrar distrato'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevertTerminationDialog({
  open, onOpenChange, terminationId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; terminationId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      toast({ title: 'Informe a justificativa da reversão', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('revert_termination' as any, {
      p_termination_id: terminationId, p_reason: reason,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao reverter', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Distrato revertido', description: 'Cliente movido para Em Recuperação.' });
    setReason('');
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverter distrato</DialogTitle>
          <DialogDescription>
            O histórico é preservado e o cliente volta para Em Recuperação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Justificativa da retenção</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Como o cliente foi retido?" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Revertendo...' : 'Reverter distrato'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
