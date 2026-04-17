import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Loader2, Save, Building2, Users, Sparkles, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { computeCompleteness, completenessTone } from '@/lib/clientCompleteness';
import { StepIdentification } from './ClientWizardSteps/StepIdentification';
import { StepContacts, ContactDraft } from './ClientWizardSteps/StepContacts';
import { StepStrategic } from './ClientWizardSteps/StepStrategic';
import { StepRisk } from './ClientWizardSteps/StepRisk';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  initialClient?: any;
  onSaved: () => void;
}

const emptyForm = {
  name: '', document: '', segment: '', contract_start_date: new Date().toISOString().split('T')[0],
  cs_responsible: '', complexity: 'C', status: 'active', profile: 'standard',
  financial_status: 'active_financial', health_score: 'healthy',
  pain_points: '', expectations: '', attention_points: '', recurring_issues: '',
  behavioral_profile: '', strategic_notes: '',
  risk_reason: '', risk_type: '', risk_identified_date: '', action_plan: '',
  taxation: '',
};

const STEPS = [
  { id: 0, label: 'Identificação', icon: Building2 },
  { id: 1, label: 'Contatos', icon: Users },
  { id: 2, label: 'Visão Estratégica', icon: Sparkles },
  { id: 3, label: 'Risco & Plano', icon: ShieldAlert },
] as const;

export function ClientWizardDialog({ open, onOpenChange, clientId, initialClient, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>(emptyForm);
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [removedContactIds, setRemovedContactIds] = useState<string[]>([]);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load form when opening
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setRemovedContactIds([]);
    if (clientId && initialClient) {
      setForm({
        name: initialClient.name ?? '', document: initialClient.document ?? '', segment: initialClient.segment ?? '',
        contract_start_date: initialClient.contract_start_date ?? '', cs_responsible: initialClient.cs_responsible ?? '',
        complexity: initialClient.complexity ?? 'C', status: initialClient.status ?? 'active',
        profile: initialClient.profile ?? 'standard', financial_status: initialClient.financial_status ?? 'active_financial',
        health_score: initialClient.health_score ?? 'healthy',
        pain_points: initialClient.pain_points ?? '', expectations: initialClient.expectations ?? '',
        attention_points: initialClient.attention_points ?? '', recurring_issues: initialClient.recurring_issues ?? '',
        behavioral_profile: initialClient.behavioral_profile ?? '', strategic_notes: initialClient.strategic_notes ?? '',
        risk_reason: initialClient.risk_reason ?? '', risk_type: initialClient.risk_type ?? '',
        risk_identified_date: initialClient.risk_identified_date ?? '', action_plan: initialClient.action_plan ?? '',
        taxation: initialClient.taxation ?? '',
      });
      // Fetch contacts
      supabase.from('client_contacts').select('*').eq('client_id', clientId).then(({ data }) => {
        if (data) {
          setContacts(data.map((c, i) => ({
            id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email,
            isPrimary: i === 0, // first one as primary marker (no DB column)
          })));
        } else {
          setContacts([]);
        }
      });
    } else {
      setForm(emptyForm);
      setContacts([]);
    }
  }, [open, clientId, initialClient]);

  const updateField = (field: string, value: string) => setForm((prev: any) => ({ ...prev, [field]: value }));

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const lookupCnpj = useCallback(async (rawDoc: string) => {
    const digits = rawDoc.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        toast({ title: 'CNPJ não encontrado', description: 'Verifique o número digitado.', variant: 'destructive' });
        return;
      }
      const data = await res.json();
      setForm((prev: any) => ({
        ...prev,
        name: data.razao_social || prev.name,
        segment: data.cnae_fiscal_descricao || prev.segment,
      }));
      toast({ title: 'Dados carregados', description: `Empresa: ${data.razao_social}` });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível consultar o CNPJ.', variant: 'destructive' });
    } finally {
      setCnpjLoading(false);
    }
  }, [toast]);

  const onDocumentChange = (value: string) => {
    const formatted = formatCnpj(value);
    updateField('document', formatted);
    if (formatted.replace(/\D/g, '').length === 14) lookupCnpj(formatted);
  };

  const handleContactsChange = (next: ContactDraft[]) => {
    // Track removed ones
    const nextIds = new Set(next.map(c => c.id).filter(Boolean));
    const removed = contacts.filter(c => c.id && !nextIds.has(c.id)).map(c => c.id!);
    if (removed.length) setRemovedContactIds(prev => [...prev, ...removed]);
    setContacts(next);
  };

  const completeness = useMemo(() => computeCompleteness(form, contacts.length), [form, contacts.length]);
  const tone = completenessTone(completeness);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Preencha o nome do cliente na etapa Identificação.', variant: 'destructive' });
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        risk_reason: form.risk_reason || null,
        risk_type: form.risk_type || null,
        risk_identified_date: form.risk_identified_date || null,
        action_plan: form.action_plan || null,
        taxation: form.taxation || '',
      };

      let savedId = clientId;
      if (clientId) {
        const { error } = await supabase.from('clients').update(payload).eq('id', clientId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select('id').single();
        if (error) throw error;
        savedId = data.id;
      }

      if (savedId) {
        // Remove deleted contacts
        if (removedContactIds.length) {
          await supabase.from('client_contacts').delete().in('id', removedContactIds);
        }
        // Upsert contacts (filter empty)
        const validContacts = contacts.filter(c => c.name.trim() || c.email.trim() || c.phone.trim());
        for (const c of validContacts) {
          if (c.id) {
            await supabase.from('client_contacts').update({
              name: c.name, role: c.role, phone: c.phone, email: c.email,
            }).eq('id', c.id);
          } else {
            await supabase.from('client_contacts').insert({
              client_id: savedId, name: c.name, role: c.role, phone: c.phone, email: c.email,
            });
          }
        }
      }

      toast({ title: clientId ? 'Cliente atualizado!' : 'Cliente criado!', description: `Cadastro ${completeness}% completo.` });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">{clientId ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>Preencha as informações em etapas — você pode navegar entre elas livremente.</DialogDescription>

          {/* Progress + Steps */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Completude do cadastro</span>
              <span className={cn('font-semibold tabular-nums', tone.badgeClass.split(' ').filter(c => c.startsWith('text-')).join(' '))}>
                {completeness}% — {tone.label}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completeness}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={cn('h-full', tone.barClass)}
              />
            </div>

            <div className="flex items-center gap-1 pt-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                      active && 'bg-primary text-primary-foreground',
                      !active && done && 'bg-primary/10 text-primary',
                      !active && !done && 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    <span className={cn(
                      'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold',
                      active ? 'bg-primary-foreground/20' : done ? 'bg-primary text-primary-foreground' : 'bg-background'
                    )}>
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <Icon className="h-3.5 w-3.5 hidden sm:inline" />
                    <span className="hidden md:inline truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <StepIdentification form={form} updateField={updateField} cnpjLoading={cnpjLoading} onDocumentChange={onDocumentChange} />
              )}
              {step === 1 && <StepContacts contacts={contacts} setContacts={handleContactsChange} />}
              {step === 2 && <StepStrategic form={form} updateField={updateField} />}
              {step === 3 && <StepRisk form={form} updateField={updateField} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="gap-2">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {clientId ? 'Salvar alterações' : 'Criar cliente'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
