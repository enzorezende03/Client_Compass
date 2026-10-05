import { useEffect, useState } from 'react';
import { Loader2, Save, Pencil, FileText, Send } from 'lucide-react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDocument } from '@/lib/document';

const db = supabase as any;
export const TAX_REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'];
export const NF_OPTIONS = ['Não emite', 'NFS-e', 'NF-e', 'CT-e', 'Outro'];
const ORG_LEGEND: Record<number, string> = {
  1: 'Muito desorganizado', 2: 'Desorganizado', 3: 'Regular', 4: 'Organizado', 5: 'Muito organizado',
};

const schema = z.object({
  legal_name: z.string().trim().min(2, 'Informe a razão social').max(200),
  cnpj: z.string().trim().min(11, 'Informe o CNPJ').max(20),
  activity: z.string().trim().min(2, 'Informe o segmento/atividade').max(200),
  tax_regime: z.string().min(1, 'Selecione o regime tributário'),
  start_competency: z.string().trim().regex(/^\d{2}\/\d{4}$/, 'Use o formato MM/AAAA'),
  contact_name: z.string().trim().min(2, 'Informe o contato principal').max(120),
  received_docs: z.string().trim().min(2, 'Descreva a documentação recebida').max(3000),
  organization_level: z.number().int().min(1).max(5),
  next_steps: z.string().trim().min(2, 'Descreva os próximos passos').max(3000),
});

export interface HandoffForm {
  legal_name: string; cnpj: string; activity: string; tax_regime: string; start_competency: string;
  contact_name: string; contact_phone: string; contact_email: string; financial_contact: string;
  received_docs: string; pending_docs: string; fiscal_issues: string; organization_level: number;
  notes: string; has_employees: boolean; employee_count: number | null; worker_risk_programs: boolean | null;
  nf_types: string; rented_hq: string; next_steps: string; profit_distribution_minutes: boolean | null;
}

const empty: HandoffForm = {
  legal_name: '', cnpj: '', activity: '', tax_regime: '', start_competency: '',
  contact_name: '', contact_phone: '', contact_email: '', financial_contact: '',
  received_docs: '', pending_docs: '', fiscal_issues: '', organization_level: 3, notes: '',
  has_employees: false, employee_count: null, worker_risk_programs: null,
  nf_types: '', rented_hq: '', next_steps: '', profit_distribution_minutes: null,
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  onSaved?: () => void;
  readOnly?: boolean;
}

function YesNo({ value, onChange, disabled, third }: { value: string; onChange: (v: string) => void; disabled?: boolean; third?: string }) {
  const opts = ['Sim', 'Não', ...(third ? [third] : [])];
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {opts.map(o => (
        <Button key={o} type="button" size="sm" disabled={disabled} variant={value === o ? 'default' : 'outline'} className="h-8" onClick={() => onChange(o)}>{o}</Button>
      ))}
    </div>
  );
}
const b2s = (b: boolean | null) => b === null ? '' : b ? 'Sim' : 'Não';
const s2b = (s: string) => s === 'Sim' ? true : s === 'Não' ? false : null;

export function OnboardingHandoffDialog({ open, onOpenChange, clientId, onSaved, readOnly }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<HandoffForm>(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('edit');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErrors({});
    Promise.all([
      db.from('onboarding_handoff_forms').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('clients').select('name, document, segment, taxation').eq('id', clientId).maybeSingle(),
      supabase.from('client_contacts').select('name, phone, email, role').eq('client_id', clientId).order('created_at'),
    ]).then(([f, c, ct]: any[]) => {
      const data = f.data;
      if (data) {
        setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(k => [k, data[k] ?? (empty as any)[k]])) } as HandoffForm);
        setExistingId(data.id); setSentAt(data.sent_at); setMode('view');
      } else {
        const cl = c.data || {};
        const contacts = ct.data || [];
        const main = contacts[0];
        const fin = contacts.find((x: any) => /financ/i.test(x.role || ''));
        setForm({
          ...empty,
          legal_name: cl.name || '', cnpj: cl.document ? formatDocument(cl.document) : '',
          activity: cl.segment || '', tax_regime: TAX_REGIMES.find(r => r === cl.taxation) || '',
          contact_name: main?.name || '', contact_phone: main?.phone || '', contact_email: main?.email || '',
          financial_contact: fin && fin !== main ? `${fin.name} — ${fin.phone || fin.email || ''}` : '',
        });
        setExistingId(null); setSentAt(null); setMode(readOnly ? 'view' : 'edit');
      }
      setLoading(false);
    });
  }, [open, clientId, readOnly]);

  const set = <K extends keyof HandoffForm>(k: K, v: HandoffForm[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async (send: boolean) => {
    if (send) {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach(i => { errs[i.path[0] as string] = i.message; });
        setErrors(errs);
        toast({ title: 'Verifique os campos', description: 'Há campos obrigatórios pendentes.', variant: 'destructive' });
        return;
      }
    }
    setErrors({});
    setSaving(true);
    try {
      const { data: me } = await db.rpc('current_internal_user_id');
      const payload: any = {
        ...form,
        client_id: clientId,
        employee_count: form.has_employees ? form.employee_count : null,
        updated_at: new Date().toISOString(),
      };
      if (send && !sentAt) payload.sent_at = new Date().toISOString();
      if (existingId) {
        const { error } = await db.from('onboarding_handoff_forms').update(payload).eq('id', existingId);
        if (error) throw error;
      } else {
        payload.created_by = me ?? null;
        const { data, error } = await db.from('onboarding_handoff_forms').insert(payload).select('id').single();
        if (error) throw error;
        setExistingId(data.id);
      }
      if (payload.sent_at) setSentAt(payload.sent_at);
      toast({ title: send ? 'Formulário enviado ao Operacional' : 'Rascunho salvo' });
      setMode('view');
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isView = mode === 'view';
  const Err = ({ k }: { k: string }) => errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;
  const field = (k: keyof HandoffForm, label: string, opts: { area?: boolean; req?: boolean; ph?: string } = {}) => (
    <div>
      <Label>{label}{opts.req && ' *'}</Label>
      {opts.area ? (
        <Textarea value={form[k] as string} disabled={isView} maxLength={3000} placeholder={opts.ph}
          onChange={e => set(k, e.target.value as any)} className={cn('min-h-[70px]', errors[k] && 'border-destructive')} />
      ) : (
        <Input value={form[k] as string} disabled={isView} maxLength={200} placeholder={opts.ph}
          onChange={e => set(k, e.target.value as any)} className={cn(errors[k] && 'border-destructive')} />
      )}
      <Err k={k} />
    </div>
  );
  const nfSel = form.nf_types ? form.nf_types.split(',').map(s => s.trim()).filter(Boolean) : [];
  const toggleNf = (o: string) => {
    let next = nfSel.includes(o) ? nfSel.filter(x => x !== o) : [...nfSel, o];
    if (o === 'Não emite' && !nfSel.includes(o)) next = ['Não emite'];
    else next = next.filter(x => o === 'Não emite' || x !== 'Não emite');
    set('nf_types', next.join(', '));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Formulário de Repasse CS → Operacional
            {sentAt ? <Badge variant="secondary">Enviado em {new Date(sentAt).toLocaleDateString('pt-BR')}</Badge>
              : existingId ? <Badge variant="outline">Rascunho</Badge> : null}
          </DialogTitle>
          <DialogDescription>
            A Etapa 3 só é liberada depois que o formulário é salvo e enviado ao Operacional.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {field('legal_name', 'Razão social', { req: true })}
              {field('cnpj', 'CNPJ', { req: true })}
              {field('activity', 'Segmento / atividade principal', { req: true })}
              <div>
                <Label>Regime tributário *</Label>
                <Select value={form.tax_regime} disabled={isView} onValueChange={v => set('tax_regime', v)}>
                  <SelectTrigger className={cn(errors.tax_regime && 'border-destructive')}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{TAX_REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <Err k="tax_regime" />
              </div>
              {field('start_competency', 'Data de início da competência', { req: true, ph: 'MM/AAAA' })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {field('contact_name', 'Contato principal', { req: true })}
              {field('contact_phone', 'Telefone')}
              {field('contact_email', 'E-mail')}
            </div>
            {field('financial_contact', 'Responsável financeiro (se diferente)')}

            {field('received_docs', 'Documentação recebida', { area: true, req: true })}
            {field('pending_docs', 'Documentação pendente', { area: true })}
            {field('fiscal_issues', 'Pendências fiscais identificadas', { area: true })}

            <div>
              <Label>Nível de organização percebido *</Label>
              <RadioGroup value={String(form.organization_level)} onValueChange={v => set('organization_level', Number(v))} disabled={isView} className="flex flex-wrap gap-2 mt-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <label key={n} className={cn('flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer',
                    form.organization_level === n ? 'border-primary bg-primary/5' : 'border-border', isView && 'cursor-default opacity-70')}>
                    <RadioGroupItem value={String(n)} />
                    <span className="text-sm font-medium">{n}</span>
                    <span className="text-xs text-muted-foreground">{ORG_LEGEND[n]}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {field('notes', 'Observações e pontos de atenção', { area: true })}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Funcionários ativos?</Label>
                <YesNo value={b2s(form.has_employees)} disabled={isView} onChange={v => { set('has_employees', v === 'Sim'); if (v !== 'Sim') set('employee_count', null); }} />
                {form.has_employees && (
                  <Input type="number" min={0} className="mt-2" placeholder="Quantidade" value={form.employee_count ?? ''} disabled={isView}
                    onChange={e => set('employee_count', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} />
                )}
              </div>
              <div>
                <Label>Programas de risco do trabalhador?</Label>
                <YesNo value={b2s(form.worker_risk_programs)} disabled={isView} onChange={v => set('worker_risk_programs', s2b(v))} />
              </div>
              <div>
                <Label>Emite nota fiscal?</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {NF_OPTIONS.map(o => (
                    <Button key={o} type="button" size="sm" className="h-8" disabled={isView} variant={nfSel.includes(o) ? 'default' : 'outline'} onClick={() => toggleNf(o)}>{o}</Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Sede alugada?</Label>
                <YesNo value={form.rented_hq} disabled={isView} third="Em verificação" onChange={v => set('rented_hq', v)} />
              </div>
              <div>
                <Label>Possui ata de assembleia para distribuição de lucros?</Label>
                <YesNo value={b2s(form.profit_distribution_minutes)} disabled={isView} onChange={v => set('profit_distribution_minutes', s2b(v))} />
              </div>
            </div>

            {field('next_steps', 'Próximos passos acordados com o cliente', { area: true, req: true })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {readOnly ? null : isView ? (
            <Button onClick={() => setMode('edit')} className="gap-2"><Pencil className="h-4 w-4" /> Editar</Button>
          ) : (
            <>
              {!sentAt && (
                <Button variant="outline" onClick={() => save(false)} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> Salvar rascunho
                </Button>
              )}
              <Button onClick={() => save(true)} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sentAt ? 'Salvar alterações' : 'Salvar e enviar ao Operacional'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
