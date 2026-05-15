import { FileText, MessageSquare, Handshake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const HANDOFF_SERVICES = [
  'Contabilidade', 'Folha de Pagamento', 'RH', 'BPO Financeiro',
  'Fiscal', 'Societário', 'Saúde Ocupacional',
] as const;

export const PAYMENT_METHODS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'debito', label: 'Débito automático' },
] as const;

export interface HandoffDraft {
  services: string[];
  otherService: string;
  monthlyValue: string;
  paymentMethod: string;
  paymentDueDay: string;
  dealClosedAt: string;
  salesperson: string;
  commercialNotes: string;
}

export const emptyHandoff: HandoffDraft = {
  services: [], otherService: '', monthlyValue: '', paymentMethod: '',
  paymentDueDay: '', dealClosedAt: '', salesperson: '', commercialNotes: '',
};

interface Props {
  handoff: HandoffDraft;
  setHandoff: (next: HandoffDraft) => void;
}

export function StepHandoff({ handoff, setHandoff }: Props) {
  const update = <K extends keyof HandoffDraft>(field: K, value: HandoffDraft[K]) => {
    setHandoff({ ...handoff, [field]: value });
  };
  const toggleService = (s: string) => {
    update('services', handoff.services.includes(s)
      ? handoff.services.filter(x => x !== s)
      : [...handoff.services, s]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" /> Repasse Comercial
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Dados da negociação fechada pelo Comercial. Estes dados são obrigatórios para iniciar o onboarding.
        </p>
      </div>

      {/* Contrato */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> Contrato
        </h4>

        <div>
          <Label className="text-xs">Serviços contratados</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
            {HANDOFF_SERVICES.map(s => (
              <label key={s} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/40">
                <Checkbox checked={handoff.services.includes(s)} onCheckedChange={() => toggleService(s)} />
                <span>{s}</span>
              </label>
            ))}
          </div>
          <Input
            value={handoff.otherService}
            onChange={e => update('otherService', e.target.value)}
            placeholder="Outros (especifique)"
            className="mt-2"
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Valor da mensalidade (R$)</Label>
            <Input type="number" step="0.01" min="0" value={handoff.monthlyValue} onChange={e => update('monthlyValue', e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={handoff.paymentMethod} onValueChange={(v) => update('paymentMethod', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Dia de vencimento (1–31)</Label>
            <Input type="number" min="1" max="31" value={handoff.paymentDueDay} onChange={e => update('paymentDueDay', e.target.value)} placeholder="10" />
          </div>
          <div>
            <Label className="text-xs">Data de fechamento</Label>
            <Input type="date" value={handoff.dealClosedAt} onChange={e => update('dealClosedAt', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Vendedor responsável</Label>
            <Input value={handoff.salesperson} onChange={e => update('salesperson', e.target.value)} placeholder="Nome do vendedor" maxLength={120} />
          </div>
        </div>
      </section>

      {/* Observações */}
      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> Observações Comerciais
        </h4>
        <Textarea
          value={handoff.commercialNotes}
          onChange={e => update('commercialNotes', e.target.value)}
          placeholder="Promessas feitas pelo vendedor, condições especiais, histórico da negociação, perfil do decisor..."
          rows={5}
          maxLength={4000}
        />
        <p className="text-[11px] text-muted-foreground">
          🔒 Visível apenas para CS e Coordenador Geral.
        </p>
      </section>
    </div>
  );
}
