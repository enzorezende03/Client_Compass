import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Loader2, Save, Building2, Users, Sparkles, ArrowLeft, Rocket, Handshake } from 'lucide-react';
import { StartOnboardingDialog } from '@/components/StartOnboardingDialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { computeCompleteness, completenessTone } from '@/lib/clientCompleteness';
import { AppLayout } from '@/components/AppLayout';
import { StepIdentification } from '@/components/ClientWizardSteps/StepIdentification';
import { StepContacts, ContactDraft } from '@/components/ClientWizardSteps/StepContacts';
import { StepStrategic } from '@/components/ClientWizardSteps/StepStrategic';

import { StepHandoff, HandoffDraft, emptyHandoff, HANDOFF_SERVICES } from '@/components/ClientWizardSteps/StepHandoff';

const emptyForm = {
  name: '', document: '', segment: '', contract_start_date: new Date().toISOString().split('T')[0],
  cs_responsible: '', complexity: 'C', status: 'active', profile: 'standard',
  financial_status: 'active_financial', health_score: 'healthy',
  pain_points: '', expectations: '', attention_points: '', recurring_issues: '',
  behavioral_profile: '', strategic_notes: '',
  taxation: '',
};

const STEPS = [
  { id: 0, label: 'Identificação', icon: Building2, description: 'Dados básicos e classificação' },
  { id: 1, label: 'Contatos', icon: Users, description: 'Pessoas-chave do cliente' },
  { id: 2, label: 'Repasse Comercial', icon: Handshake, description: 'Contrato, serviços e vendedor' },
  { id: 3, label: 'Visão Estratégica', icon: Sparkles, description: 'Dores, expectativas e perfil' },
] as const;

export default function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>(emptyForm);
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [removedContactIds, setRemovedContactIds] = useState<string[]>([]);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [onboardingStatus, setOnboardingStatus] = useState<string>('pending_handoff');
  const [handoff, setHandoff] = useState<HandoffDraft>(emptyHandoff);
  const [hasHandoff, setHasHandoff] = useState(false);
  const [startingOnboarding, setStartingOnboarding] = useState(false);
  const { toast } = useToast();

  // Load existing client when editing
  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    (async () => {
      const { data: client } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
      if (client) {
        setForm({
          name: client.name ?? '', document: client.document ?? '', segment: client.segment ?? '',
          contract_start_date: client.contract_start_date ?? '', cs_responsible: client.cs_responsible ?? '',
          complexity: client.complexity ?? 'C', status: client.status ?? 'active',
          profile: client.profile ?? 'standard', financial_status: client.financial_status ?? 'active_financial',
          health_score: client.health_score ?? 'healthy',
          pain_points: client.pain_points ?? '', expectations: client.expectations ?? '',
          attention_points: client.attention_points ?? '', recurring_issues: client.recurring_issues ?? '',
          behavioral_profile: client.behavioral_profile ?? '', strategic_notes: client.strategic_notes ?? '',
          taxation: client.taxation ?? '',
        });
        setOnboardingStatus((client as any).onboarding_status || 'pending_handoff');
        const { data: h } = await supabase.from('commercial_handoff' as any).select('*').eq('client_id', id).maybeSingle();
        const hh = h as any;
        if (hh) {
          setHasHandoff(true);
          const svcArr: string[] = Array.isArray(hh.services) ? hh.services : [];
          const known = svcArr.filter(s => (HANDOFF_SERVICES as readonly string[]).includes(s));
          const other = svcArr.find(s => !(HANDOFF_SERVICES as readonly string[]).includes(s));
          setHandoff({
            services: known,
            otherService: other ?? '',
            monthlyValue: hh.monthly_value != null ? String(hh.monthly_value) : '',
            paymentMethod: hh.payment_method ?? '',
            paymentDueDay: hh.payment_due_day != null ? String(hh.payment_due_day) : '',
            dealClosedAt: hh.deal_closed_at ?? '',
            salesperson: hh.salesperson ?? '',
            commercialNotes: hh.commercial_notes ?? '',
          });
        }
      }
      const { data: cts } = await supabase.from('client_contacts').select('*').eq('client_id', id);
      if (cts) {
        setContacts(cts.map((c: any, i: number) => ({
          id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email,
          isPrimary: i === 0, isWhatsapp: c.is_whatsapp ?? true,
        })));
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

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

      let savedId = id;
      if (isEdit && id) {
        const { error } = await supabase.from('clients').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select('id').single();
        if (error) throw error;
        savedId = data.id;
      }

      if (savedId) {
        if (removedContactIds.length) {
          await supabase.from('client_contacts').delete().in('id', removedContactIds);
        }
        const validContacts = contacts.filter(c => c.name.trim() || c.email.trim() || c.phone.trim());
        for (const c of validContacts) {
          if (c.id) {
            await supabase.from('client_contacts').update({
              name: c.name, role: c.role, phone: c.phone, email: c.email, is_whatsapp: c.isWhatsapp ?? true,
            }).eq('id', c.id);
          } else {
            await supabase.from('client_contacts').insert({
              client_id: savedId, name: c.name, role: c.role, phone: c.phone, email: c.email, is_whatsapp: c.isWhatsapp ?? true,
            });
          }
        }

        // Persist commercial handoff if user filled at least services or value
        const allServices = [...handoff.services, ...(handoff.otherService.trim() ? [handoff.otherService.trim()] : [])];
        const handoffFilled = allServices.length > 0 || !!handoff.monthlyValue || !!handoff.salesperson || !!handoff.dealClosedAt;
        if (handoffFilled) {
          const { data: auth } = await supabase.auth.getUser();
          let filledBy: string | null = null;
          if (auth.user) {
            const { data: iu } = await supabase.from('internal_users').select('id').eq('auth_user_id', auth.user.id).maybeSingle();
            filledBy = iu?.id ?? null;
          }
          const { error: upErr } = await supabase.from('commercial_handoff' as any).upsert({
            client_id: savedId,
            services: allServices,
            monthly_value: handoff.monthlyValue ? Number(handoff.monthlyValue) : null,
            payment_method: handoff.paymentMethod || null,
            payment_due_day: handoff.paymentDueDay ? Number(handoff.paymentDueDay) : null,
            deal_closed_at: handoff.dealClosedAt || null,
            salesperson: handoff.salesperson || null,
            commercial_notes: handoff.commercialNotes || null,
            filled_by: filledBy,
          }, { onConflict: 'client_id' });
          if (upErr) throw upErr;

          // Move client out of pending_handoff once the ficha is filled
          await supabase.from('clients')
            .update({ onboarding_status: 'pending_onboarding' } as any)
            .eq('id', savedId)
            .eq('onboarding_status', 'pending_handoff');

          if (!hasHandoff) {
            await supabase.from('timeline_entries').insert({
              client_id: savedId,
              type: 'service',
              description: '[Repasse Comercial] Ficha de repasse preenchida',
              responsible: 'CS',
              sector: 'commercial',
              origin: 'internal',
              demand_status: 'resolved',
              is_relevant_event: true,
              relevant_event_type: 'handoff',
            });
          }
          setHasHandoff(true);
          if (onboardingStatus === 'pending_handoff') setOnboardingStatus('pending_onboarding');
        }
      }

      toast({ title: isEdit ? 'Cliente atualizado!' : 'Cliente criado!', description: `Cadastro ${completeness}% completo.` });
      navigate('/cadastro/clientes');
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cadastro/clientes')} className="gap-1.5 mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para lista
          </Button>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Preencha as informações em etapas — você pode navegar entre elas livremente.
              </p>
            </div>
            <div className="flex items-end gap-4">
              {isEdit && onboardingStatus === 'pending_handoff' && !hasHandoff && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Preencha o passo "Repasse Comercial" para liberar o onboarding
                </span>
              )}
              {isEdit && (onboardingStatus === 'pending_handoff' || onboardingStatus === 'pending_onboarding') && (
                <span title={!hasHandoff ? 'Preencha a Ficha de Repasse Comercial antes de iniciar o onboarding.' : undefined}>
                  <Button
                    variant="default"
                    disabled={!id || !hasHandoff}
                    onClick={() => setStartingOnboarding(true)}
                    className="gap-2 shadow-md"
                  >
                    <Rocket className="h-4 w-4" />
                    Iniciar Onboarding
                  </Button>
                </span>
              )}
              {isEdit && (onboardingStatus === 'active' || onboardingStatus === 'completed' || onboardingStatus === 'paused') && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                  Onboarding: {onboardingStatus === 'active' ? 'em andamento' : onboardingStatus === 'completed' ? 'concluído' : 'pausado'}
                </span>
              )}
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">Completude do cadastro</div>
                <div className={cn('text-2xl font-bold tabular-nums', tone.badgeClass.split(' ').filter(c => c.startsWith('text-')).join(' '))}>
                  {completeness}%
                </div>
                <div className="text-xs text-muted-foreground">{tone.label}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completeness}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn('h-full', tone.barClass)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar steps */}
          <aside className="lg:sticky lg:top-6 self-start">
            <nav className="space-y-1.5">
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
                      'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all border',
                      active && 'bg-primary text-primary-foreground border-primary shadow-sm',
                      !active && done && 'bg-primary/5 text-foreground border-primary/20 hover:bg-primary/10',
                      !active && !done && 'bg-card text-foreground border-border hover:bg-muted/50',
                    )}
                  >
                    <span className={cn(
                      'flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0',
                      active ? 'bg-primary-foreground/20' : done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Icon className="h-3.5 w-3.5" />
                        {s.label}
                      </div>
                      <div className={cn(
                        'text-xs mt-0.5 leading-snug',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      )}>
                        {s.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="min-w-0">
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
                {step === 2 && <StepHandoff handoff={handoff} setHandoff={setHandoff} />}
                {step === 3 && <StepStrategic form={form} updateField={updateField} />}
                
              </motion.div>
            </AnimatePresence>

            {/* Action bar */}
            <div className="mt-6 flex items-center justify-between gap-2 sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-6 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => navigate('/cadastro/clientes')} disabled={saving}>
                  Cancelar
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="gap-2">
                    Próximo <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Salvar alterações' : 'Criar cliente'}
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {isEdit && id && (
        <StartOnboardingDialog
          open={startingOnboarding}
          onOpenChange={setStartingOnboarding}
          clientId={id}
          clientName={form.name}
          onStarted={() => navigate('/onboarding')}
        />
      )}
    </AppLayout>
  );
}
