import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, FileText, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const HANDOFF_SERVICES = [
  'Contabilidade', 'Folha de Pagamento', 'RH', 'BPO Financeiro',
  'Fiscal', 'Societário', 'Saúde Ocupacional',
] as const;

export const PAYMENT_METHODS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'debito', label: 'Débito automático' },
] as const;

export const CONTACT_ROLES = [
  { value: 'socio', label: 'Sócio' },
  { value: 'responsavel_financeiro', label: 'Resp. Financeiro' },
  { value: 'responsavel_contabil', label: 'Resp. Contábil' },
  { value: 'outro', label: 'Outro' },
] as const;

interface ContactRow {
  id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  contact_role: string;
  is_whatsapp: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  clientName: string;
  /** Called after the handoff is saved; parent should refresh and optionally open the onboarding-type modal. */
  onSaved?: () => void;
}

export function CommercialHandoffDialog({ open, onOpenChange, clientId, clientName, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [services, setServices] = useState<string[]>([]);
  const [otherService, setOtherService] = useState('');
  const [monthlyValue, setMonthlyValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  const [dealClosedAt, setDealClosedAt] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [commercialNotes, setCommercialNotes] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    (async () => {
      const [{ data: handoff }, { data: cts }] = await Promise.all([
        supabase.from('commercial_handoff' as any).select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_contacts').select('*').eq('client_id', clientId),
      ]);
      const h = handoff as any;
      if (h) {
        const svcArr: string[] = Array.isArray(h.services) ? h.services : [];
        setServices(svcArr.filter((s: string) => (HANDOFF_SERVICES as readonly string[]).includes(s)));
        const other = svcArr.find((s: string) => !(HANDOFF_SERVICES as readonly string[]).includes(s));
        setOtherService(other ?? '');
        setMonthlyValue(h.monthly_value != null ? String(h.monthly_value) : '');
        setPaymentMethod(h.payment_method ?? '');
        setPaymentDueDay(h.payment_due_day != null ? String(h.payment_due_day) : '');
        setDealClosedAt(h.deal_closed_at ?? '');
        setSalesperson(h.salesperson ?? '');
        setCommercialNotes(h.commercial_notes ?? '');
      } else {
        setServices([]); setOtherService(''); setMonthlyValue('');
        setPaymentMethod(''); setPaymentDueDay(''); setDealClosedAt('');
        setSalesperson(''); setCommercialNotes('');
      }
      const rows: ContactRow[] = (cts || []).map((c: any) => ({
        id: c.id,
        name: c.name ?? '',
        role: c.role ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        contact_role: ['socio','responsavel_financeiro','responsavel_contabil','outro'].includes(c.role) ? c.role : 'outro',
        is_whatsapp: c.is_whatsapp ?? true,
      }));
      setContacts(rows.length ? rows : [{ name: '', role: '', phone: '', email: '', contact_role: 'outro', is_whatsapp: true }]);
      setLoading(false);
    })();
  }, [open, clientId]);

  const toggleService = (s: string) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const updateContact = (idx: number, patch: Partial<ContactRow>) => {
    setContacts(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };
  const addContact = () => setContacts(prev => [...prev, { name: '', role: '', phone: '', email: '', contact_role: 'outro', is_whatsapp: true }]);
  const removeContact = (idx: number) => setContacts(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const validContacts = contacts.filter(c => c.name.trim());
    if (!validContacts.length) {
      toast({ title: 'Adicione ao menos 1 contato', description: 'A ficha exige pelo menos um contato preenchido.', variant: 'destructive' });
      return;
    }
    if (!services.length && !otherService.trim()) {
      toast({ title: 'Selecione os serviços contratados', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // who is filling
      const { data: auth } = await supabase.auth.getUser();
      let filledBy: string | null = null;
      if (auth.user) {
        const { data: iu } = await supabase.from('internal_users').select('id').eq('auth_user_id', auth.user.id).maybeSingle();
        filledBy = iu?.id ?? null;
      }

      const allServices = [...services, ...(otherService.trim() ? [otherService.trim()] : [])];
      const payload: any = {
        client_id: clientId,
        services: allServices,
        monthly_value: monthlyValue ? Number(monthlyValue) : null,
        payment_method: paymentMethod || null,
        payment_due_day: paymentDueDay ? Number(paymentDueDay) : null,
        deal_closed_at: dealClosedAt || null,
        salesperson: salesperson || null,
        commercial_notes: commercialNotes || null,
        filled_by: filledBy,
      };

      const { error: upErr } = await supabase
        .from('commercial_handoff' as any)
        .upsert(payload, { onConflict: 'client_id' });
      if (upErr) throw upErr;

      // Sync contacts (replace strategy: delete then insert)
      const existingIds = contacts.filter(c => c.id).map(c => c.id!);
      // Delete contacts that were removed compared to DB
      const { data: dbContacts } = await supabase.from('client_contacts').select('id').eq('client_id', clientId);
      const toDelete = (dbContacts || []).map((d: any) => d.id).filter((dId: string) => !existingIds.includes(dId));
      if (toDelete.length) await supabase.from('client_contacts').delete().in('id', toDelete);

      for (const c of validContacts) {
        const row: any = {
          client_id: clientId,
          name: c.name,
          role: c.contact_role,
          phone: c.phone,
          email: c.email,
          is_whatsapp: c.is_whatsapp,
        };
        if (c.id) {
          await supabase.from('client_contacts').update(row).eq('id', c.id);
        } else {
          await supabase.from('client_contacts').insert(row);
        }
      }

      // Move client to pending_onboarding (only if currently pending_handoff)
      await supabase.from('clients')
        .update({ onboarding_status: 'pending_onboarding' } as any)
        .eq('id', clientId)
        .eq('onboarding_status', 'pending_handoff');

      // Timeline
      await supabase.from('timeline_entries').insert({
        client_id: clientId,
        type: 'service',
        description: '[Repasse Comercial] Ficha de repasse preenchida',
        responsible: 'CS',
        sector: 'commercial',
        origin: 'internal',
        demand_status: 'resolved',
        is_relevant_event: true,
        relevant_event_type: 'handoff',
      });

      toast({ title: 'Ficha salva!', description: `Repasse comercial de ${clientName} registrado.` });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Ficha de Repasse Comercial
          </DialogTitle>
          <DialogDescription>
            Registre os dados da negociação fechada pelo Comercial para <span className="font-medium text-foreground">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Bloco 1 — Contrato */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Contrato</h3>
              <div>
                <Label className="text-xs">Serviços contratados</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
                  {HANDOFF_SERVICES.map(s => (
                    <label key={s} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/40">
                      <Checkbox checked={services.includes(s)} onCheckedChange={() => toggleService(s)} />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
                <Input
                  value={otherService}
                  onChange={e => setOtherService(e.target.value)}
                  placeholder="Outros (especifique)"
                  className="mt-2"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor da mensalidade (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={monthlyValue} onChange={e => setMonthlyValue(e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Dia de vencimento (1–31)</Label>
                  <Input type="number" min="1" max="31" value={paymentDueDay} onChange={e => setPaymentDueDay(e.target.value)} placeholder="10" />
                </div>
                <div>
                  <Label className="text-xs">Data de fechamento</Label>
                  <Input type="date" value={dealClosedAt} onChange={e => setDealClosedAt(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Vendedor responsável</Label>
                  <Input value={salesperson} onChange={e => setSalesperson(e.target.value)} placeholder="Nome do vendedor" maxLength={120} />
                </div>
              </div>
            </section>

            {/* Bloco 2 — Contatos */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Contatos</h3>
                <Button type="button" size="sm" variant="outline" onClick={addContact} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Adicionar contato
                </Button>
              </div>
              <div className="space-y-2">
                {contacts.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-lg border p-2.5 bg-muted/20">
                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-[10px]">Nome*</Label>
                      <Input value={c.name} onChange={e => updateContact(idx, { name: e.target.value })} maxLength={120} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-[10px]">Cargo/Função</Label>
                      <Input value={c.role} onChange={e => updateContact(idx, { role: e.target.value })} maxLength={80} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-[10px]">Telefone</Label>
                      <Input value={c.phone} onChange={e => updateContact(idx, { phone: e.target.value })} maxLength={30} />
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <Label className="text-[10px]">E-mail</Label>
                      <Input type="email" value={c.email} onChange={e => updateContact(idx, { email: e.target.value })} maxLength={255} />
                    </div>
                    <div className="col-span-7 md:col-span-2">
                      <Label className="text-[10px]">Tipo</Label>
                      <Select value={c.contact_role} onValueChange={(v) => updateContact(idx, { contact_role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTACT_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5 md:col-span-1 flex items-center justify-between gap-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <Label className="text-[10px]">WhatsApp</Label>
                        <Switch checked={c.is_whatsapp} onCheckedChange={(v) => updateContact(idx, { is_whatsapp: v })} />
                      </div>
                      {contacts.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeContact(idx)} className="h-7 w-7 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Pelo menos 1 contato é obrigatório.</p>
            </section>

            {/* Bloco 3 — Observações */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-primary" /> Observações Comerciais
              </h3>
              <Textarea
                value={commercialNotes}
                onChange={e => setCommercialNotes(e.target.value)}
                placeholder="Promessas feitas pelo vendedor, condições especiais, histórico da negociação, perfil do decisor..."
                rows={5}
                maxLength={4000}
              />
              <p className="text-[11px] text-muted-foreground">
                🔒 Visível apenas para CS e Coordenador Geral.
              </p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
