import { useEffect, useState } from 'react';
import { Loader2, Save, Pencil, FileText } from 'lucide-react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TAX_REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Outro'];
const FIXED_ASSETS_OPTIONS = ['Sim', 'Não', 'Em verificação'];
const ORG_LEGEND: Record<number, string> = {
  1: 'Muito desorganizado', 2: 'Desorganizado', 3: 'Regular', 4: 'Organizado', 5: 'Muito organizado',
};

const schema = z.object({
  activity: z.string().trim().min(2, 'Informe o segmento/atividade').max(200),
  tax_regime: z.string().min(1, 'Selecione o regime tributário'),
  start_competency: z.string().trim().regex(/^\d{2}\/\d{4}$/, 'Use o formato MM/AAAA'),
  received_docs: z.string().trim().min(2, 'Descreva a documentação recebida').max(2000),
  organization_level: z.number().int().min(1).max(5),
  next_steps: z.string().trim().min(2, 'Descreva os próximos passos').max(2000),
  pending_docs: z.string().max(2000).optional(),
  fiscal_issues: z.string().max(2000).optional(),
  has_employees: z.boolean(),
  employee_count: z.number().int().min(0).nullable().optional(),
  nf_types: z.string().max(500).optional(),
  has_fixed_assets: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  /** id of the checklist item "Formulário de Repasse CS → Operacional preenchido" — to mark concluded */
  handoffProgressId?: string;
  onSaved?: () => void;
}

const empty = {
  activity: '', tax_regime: '', start_competency: '', received_docs: '',
  pending_docs: '', fiscal_issues: '', organization_level: 3, has_employees: false,
  employee_count: null as number | null, nf_types: '', has_fixed_assets: '',
  next_steps: '', notes: '',
};

export function OnboardingHandoffDialog({ open, onOpenChange, clientId, handoffProgressId, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('edit');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErrors({});
    supabase.from('onboarding_handoff_forms')
      .select('*').eq('client_id', clientId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            activity: data.activity || '', tax_regime: data.tax_regime || '',
            start_competency: data.start_competency || '', received_docs: data.received_docs || '',
            pending_docs: data.pending_docs || '', fiscal_issues: data.fiscal_issues || '',
            organization_level: data.organization_level || 3,
            has_employees: !!data.has_employees, employee_count: data.employee_count ?? null,
            nf_types: data.nf_types || '', has_fixed_assets: data.has_fixed_assets || '',
            next_steps: data.next_steps || '', notes: data.notes || '',
          });
          setExistingId(data.id);
          setMode('view');
        } else {
          setForm(empty); setExistingId(null); setMode('edit');
        }
        setLoading(false);
      });
  }, [open, clientId]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      toast({ title: 'Verifique os campos', description: 'Há campos obrigatórios pendentes.', variant: 'destructive' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data: me } = auth.user
        ? await supabase.from('internal_users').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
        : { data: null };

      const payload = {
        client_id: clientId,
        created_by: me?.id ?? null,
        activity: form.activity.trim(),
        tax_regime: form.tax_regime,
        start_competency: form.start_competency.trim(),
        received_docs: form.received_docs.trim(),
        pending_docs: form.pending_docs?.trim() || '',
        fiscal_issues: form.fiscal_issues?.trim() || '',
        organization_level: form.organization_level,
        has_employees: form.has_employees,
        employee_count: form.has_employees ? form.employee_count : null,
        nf_types: form.nf_types?.trim() || '',
        has_fixed_assets: form.has_fixed_assets || '',
        next_steps: form.next_steps.trim(),
        notes: form.notes?.trim() || '',
      };

      if (existingId) {
        const { error } = await supabase.from('onboarding_handoff_forms').update(payload).eq('id', existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('onboarding_handoff_forms').insert(payload).select('id').single();
        if (error) throw error;
        setExistingId(data.id);

        // Mark checklist progress complete
        if (handoffProgressId) {
          await supabase.from('client_onboarding_progress').update({
            status: 'concluido',
            completed_at: new Date().toISOString(),
            completed_by: me?.id ?? null,
          }).eq('id', handoffProgressId);
        }

        // Timeline entry
        await supabase.from('timeline_entries').insert({
          client_id: clientId,
          type: 'service',
          description: '[Onboarding] Formulário de Repasse CS → Operacional preenchido e enviado',
          responsible: 'CS',
          sector: 'commercial',
          origin: 'internal',
          demand_status: 'resolved',
          is_relevant_event: true,
          relevant_event_type: 'onboarding',
        });
      }

      toast({ title: 'Formulário de repasse salvo com sucesso' });
      setMode('view');
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isView = mode === 'view';

  const ErrText = ({ k }: { k: string }) => errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Formulário de Repasse CS → Operacional
          </DialogTitle>
          <DialogDescription>
            {isView ? 'Repasse já registrado. Você pode editar enquanto o cliente estiver na Etapa 2.'
                    : 'Preencha as informações para o time operacional assumir o cliente.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Activity + Regime */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Segmento / Atividade principal *</Label>
                <Input value={form.activity} disabled={isView} maxLength={200}
                  onChange={e => set('activity', e.target.value)}
                  className={cn(errors.activity && 'border-destructive')} />
                <ErrText k="activity" />
              </div>
              <div>
                <Label>Regime tributário *</Label>
                <Select value={form.tax_regime} disabled={isView} onValueChange={v => set('tax_regime', v)}>
                  <SelectTrigger className={cn(errors.tax_regime && 'border-destructive')}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ErrText k="tax_regime" />
              </div>
            </div>

            {/* Competency */}
            <div>
              <Label>Competência de início *</Label>
              <Input value={form.start_competency} disabled={isView} placeholder="06/2026" maxLength={7}
                onChange={e => set('start_competency', e.target.value)}
                className={cn(errors.start_competency && 'border-destructive')} />
              <ErrText k="start_competency" />
            </div>

            {/* Received docs */}
            <div>
              <Label>Documentação recebida *</Label>
              <Textarea value={form.received_docs} disabled={isView} maxLength={2000}
                onChange={e => set('received_docs', e.target.value)}
                className={cn('min-h-[70px]', errors.received_docs && 'border-destructive')} />
              <ErrText k="received_docs" />
            </div>

            {/* Pending docs + Fiscal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Documentação pendente</Label>
                <Textarea value={form.pending_docs} disabled={isView} maxLength={2000}
                  onChange={e => set('pending_docs', e.target.value)} className="min-h-[70px]" />
              </div>
              <div>
                <Label>Pendências fiscais identificadas</Label>
                <Textarea value={form.fiscal_issues} disabled={isView} maxLength={2000}
                  onChange={e => set('fiscal_issues', e.target.value)} className="min-h-[70px]" />
              </div>
            </div>

            {/* Organization level */}
            <div>
              <Label>Nível de organização do cliente *</Label>
              <RadioGroup
                value={String(form.organization_level)}
                onValueChange={v => set('organization_level', Number(v))}
                disabled={isView}
                className="flex flex-wrap gap-3 mt-2"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <label key={n} className={cn(
                    'flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors',
                    form.organization_level === n ? 'border-primary bg-primary/5' : 'border-border',
                    isView && 'cursor-default opacity-70',
                  )}>
                    <RadioGroupItem value={String(n)} id={`org-${n}`} />
                    <span className="text-sm font-medium">{n}</span>
                    <span className="text-xs text-muted-foreground">{ORG_LEGEND[n]}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Employees */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <Label className="cursor-pointer">Possui funcionários?</Label>
                  <p className="text-xs text-muted-foreground">{form.has_employees ? 'Sim' : 'Não'}</p>
                </div>
                <Switch checked={form.has_employees} disabled={isView}
                  onCheckedChange={v => { set('has_employees', v); if (!v) set('employee_count', null); }} />
              </div>
              {form.has_employees && (
                <div>
                  <Label>Quantidade de funcionários</Label>
                  <Input type="number" min={0} value={form.employee_count ?? ''} disabled={isView}
                    onChange={e => set('employee_count', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} />
                </div>
              )}
            </div>

            {/* NF types + Fixed assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipos de nota fiscal emitidos</Label>
                <Input value={form.nf_types} disabled={isView} maxLength={500}
                  placeholder="Ex: NFS-e, NF-e..." onChange={e => set('nf_types', e.target.value)} />
              </div>
              <div>
                <Label>Possui imobilizado relevante?</Label>
                <Select value={form.has_fixed_assets} disabled={isView} onValueChange={v => set('has_fixed_assets', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {FIXED_ASSETS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Next steps */}
            <div>
              <Label>Próximos passos acordados com o cliente *</Label>
              <Textarea value={form.next_steps} disabled={isView} maxLength={2000}
                onChange={e => set('next_steps', e.target.value)}
                className={cn('min-h-[70px]', errors.next_steps && 'border-destructive')} />
              <ErrText k="next_steps" />
            </div>

            {/* Notes */}
            <div>
              <Label>Observações gerais</Label>
              <Textarea value={form.notes} disabled={isView} maxLength={2000}
                onChange={e => set('notes', e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {isView ? (
            <Button onClick={() => setMode('edit')} className="gap-2">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar formulário
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
