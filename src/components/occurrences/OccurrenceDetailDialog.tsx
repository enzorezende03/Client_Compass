import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Occurrence, OccurrenceTask, formatDateTime, CATEGORY_LABELS, AREA_LABELS, RESOLUTION_LABELS, RESOLUTION_CLASSES,
} from '@/lib/occurrences';
import { SECTOR_LABELS, SEVERITY_LABELS, RESPONSIBILITY_ORIGIN_LABELS, INTERACTION_LABELS } from '@/types/client';

interface Props {
  occurrence: Occurrence | null; task?: OccurrenceTask; me: string | null;
  canManage: boolean; canWrite: boolean; showClientLink: boolean;
  onClose: () => void; onChanged: () => void;
}
interface Treat { id: string; kind: string; content: string; author_name: string; created_at: string }
interface Audit { id: string; field_name: string; old_value: string; new_value: string; changed_by: string; created_at: string }

const KIND_LABELS: Record<string, string> = { registro: 'Registro', assumir: 'Assumiu', tratativa: 'Tratativa', resolucao: 'Resolvida', cancelamento: 'Cancelada' };

export function OccurrenceDetailDialog({ occurrence: o, task, me, canManage, canWrite, showClientLink, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [treats, setTreats] = useState<Treat[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [mode, setMode] = useState<'none' | 'tratativa' | 'resolver' | 'editar' | 'cancelar'>('none');
  const [text, setText] = useState('');
  const [form, setForm] = useState({ description: '', origin: '', category: '', sector: '', severity: '' });
  const [busy, setBusy] = useState(false);

  const loadExtra = async (id: string) => {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from('occurrence_treatments' as any).select('*').eq('entry_id', id).order('created_at'),
      (supabase as any).from('audit_logs').select('*').eq('record_id', id).order('created_at', { ascending: false }),
    ]);
    setTreats((t as any) || []); setAudits((a as any) || []);
  };

  useEffect(() => {
    if (!o) return;
    setMode('none'); setText('');
    setForm({ description: o.description, origin: o.responsibilityOrigin ?? '', category: o.category ?? '', sector: o.sector, severity: o.severity ?? '' });
    loadExtra(o.id);
  }, [o?.id]);

  if (!o) return null;
  const closed = o.resolutionStatus === 'resolvida' || o.resolutionStatus === 'cancelada';
  const canTreat = !closed && (canWrite || (!!me && o.assignedCsId === me));

  const run = async (fn: () => PromiseLike<{ error: any }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast({ title: 'Não foi possível concluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: ok }); setMode('none'); setText(''); onChanged(); loadExtra(o.id);
  };
  const rpc = (name: string, args: any) => () => (supabase as any).rpc(name, args);

  const confirm = () => {
    if (mode === 'tratativa') return run(rpc('occurrence_action', { p_entry_id: o.id, p_action: 'tratativa', p_text: text }), 'Tratativa registrada');
    if (mode === 'resolver') return run(rpc('occurrence_action', { p_entry_id: o.id, p_action: 'resolver', p_text: text }), 'Ocorrência resolvida');
    if (mode === 'cancelar') return run(rpc('cancel_occurrence', { p_entry_id: o.id, p_reason: text }), 'Ocorrência cancelada');
    if (mode === 'editar') return run(rpc('edit_occurrence', {
      p_entry_id: o.id, p_reason: text, p_description: form.description,
      p_responsibility_origin: form.origin || null, p_category: form.category || null, p_sector: form.sector, p_severity: form.severity || null,
    }), 'Alteração salva no histórico');
  };

  const Chip = ({ children, className }: { children: React.ReactNode; className?: string }) =>
    <span className={cn('whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs', className)}>{children}</span>;
  const sel = (key: keyof typeof form, opts: Record<string, string>) => (
    <Select value={form[key]} onValueChange={v => setForm(f => ({ ...f, [key]: v }))}>
      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>{Object.entries(opts).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{o.category ? CATEGORY_LABELS[o.category] : INTERACTION_LABELS[o.type]} — {o.clientName}</DialogTitle></DialogHeader>

        {o.resolutionStatus === 'cancelada' && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Cancelada por {o.cancelledByName ?? '—'} em {o.cancelledAt ? formatDateTime(o.cancelledAt) : '—'} — {o.cancelReason}
          </div>
        )}

        <Tabs defaultValue="detalhe">
          <TabsList>
            <TabsTrigger value="detalhe">Detalhe</TabsTrigger>
            <TabsTrigger value="tratativa">Tratativa ({treats.length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico de alterações ({audits.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhe" className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Chip className={RESOLUTION_CLASSES[o.resolutionStatus]}>{RESOLUTION_LABELS[o.resolutionStatus]}</Chip>
              {o.responsibilityOrigin && <Chip>{RESPONSIBILITY_ORIGIN_LABELS[o.responsibilityOrigin]}</Chip>}
              <Chip>Setor: {SECTOR_LABELS[o.sector] ?? o.sector}</Chip>
              {o.severity && <Chip>Gravidade {SEVERITY_LABELS[o.severity]}</Chip>}
              {o.raisedByArea && <Chip>Registrado por: {AREA_LABELS[o.raisedByArea]}</Chip>}
              {o.initialFollowup && <Chip className="bg-primary/10 text-primary">Durante acompanhamento inicial</Chip>}
            </div>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3">{o.description}</p>
            {o.missingInfo && <p><span className="text-muted-foreground">Falta: </span>{o.missingInfo}</p>}
            {o.clientCharged != null && <p><span className="text-muted-foreground">Cobrança direta ao cliente: </span>{o.clientCharged ? `Sim${o.clientChargedAt ? ` em ${new Date(o.clientChargedAt + 'T12:00').toLocaleDateString('pt-BR')}` : ''}` : 'Não'}</p>}
            <p><span className="text-muted-foreground">CS responsável: </span>{o.assignedCsName ?? '—'}</p>
            {o.resolutionOutcome && <p><span className="text-muted-foreground">Desfecho: </span>{o.resolutionOutcome}</p>}
            <p className="text-xs text-muted-foreground">Registrado por {o.createdByName ?? 'Sistema'} em {formatDateTime(o.createdAt)} · Data do fato: {formatDateTime(o.occurredAt)}</p>
            {task && <p className="text-xs">Tarefa vinculada: <strong>{task.title}</strong> ({task.status === 'completed' ? 'Concluída' : task.status === 'cancelled' ? 'Cancelada' : 'Pendente'})</p>}

            {mode === 'editar' && (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Classificação</Label>{sel('origin', RESPONSIBILITY_ORIGIN_LABELS)}</div>
                  <div><Label className="text-xs">Categoria</Label>{sel('category', CATEGORY_LABELS)}</div>
                  <div><Label className="text-xs">Setor</Label>{sel('sector', SECTOR_LABELS)}</div>
                  <div><Label className="text-xs">Gravidade</Label>{sel('severity', SEVERITY_LABELS)}</div>
                </div>
                <div><Label className="text-xs">Descrição</Label><Textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tratativa" className="space-y-2">
            {treats.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Sem registros de tratativa.</p> : treats.map(t => (
              <div key={t.id} className="rounded-md border p-3 text-sm">
                <p className="text-xs text-muted-foreground"><strong className="text-foreground">{KIND_LABELS[t.kind] ?? t.kind}</strong> · {t.author_name || 'Sistema'} · {formatDateTime(t.created_at)}</p>
                {t.content && <p className="mt-1 whitespace-pre-wrap">{t.content}</p>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="historico" className="space-y-2">
            {audits.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</p> : audits.map(a => (
              <div key={a.id} className="rounded-md border p-3 text-sm">
                <p className="text-xs text-muted-foreground"><strong className="text-foreground">{a.field_name}</strong> · {a.changed_by} · {formatDateTime(a.created_at)}</p>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  <p className="whitespace-pre-wrap rounded bg-destructive/5 p-2 text-xs">{a.old_value || '(vazio)'}</p>
                  <p className="whitespace-pre-wrap rounded bg-primary/5 p-2 text-xs">{a.new_value || '(vazio)'}</p>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {mode !== 'none' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {mode === 'tratativa' ? 'O que foi feito' : mode === 'resolver' ? 'Desfecho (obrigatório)' : mode === 'editar' ? 'Justificativa da alteração (obrigatória)' : 'Motivo do cancelamento (obrigatório)'}
            </Label>
            <Textarea rows={3} value={text} onChange={e => setText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setMode('none'); setText(''); }}>Voltar</Button>
              <Button size="sm" variant={mode === 'cancelar' ? 'destructive' : 'default'} disabled={busy || !text.trim()} onClick={confirm}>Confirmar</Button>
            </div>
          </div>
        )}

        {mode === 'none' && (
          <div className="flex flex-wrap justify-end gap-2">
            {showClientLink && <Button variant="outline" size="sm" onClick={() => navigate(`/client/${o.clientId}?tab=ocorrencias`)}>Abrir ficha</Button>}
            {canTreat && o.resolutionStatus === 'aberta' && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(rpc('occurrence_action', { p_entry_id: o.id, p_action: 'assumir' }), 'Você assumiu a tratativa')}>Assumir</Button>}
            {canTreat && <Button variant="outline" size="sm" onClick={() => setMode('tratativa')}>Registrar tratativa</Button>}
            {canTreat && <Button size="sm" onClick={() => setMode('resolver')}>Resolver</Button>}
            {canManage && o.resolutionStatus !== 'cancelada' && <Button variant="outline" size="sm" onClick={() => setMode('editar')}>Editar</Button>}
            {canManage && o.resolutionStatus !== 'cancelada' && <Button variant="destructive" size="sm" onClick={() => setMode('cancelar')}>Cancelar ocorrência</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
