import { FileText, MessageSquare, Handshake, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ServiceCode = 'contabilidade_completa' | 'emissao_nf' | 'relatorios_personalizados' | 'demonstracoes_contabeis';
export type DemonstracoesPeriodicidade = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export interface HandoffServiceItem {
  code: ServiceCode;
  label: string;
  quantity?: number | null;
  frequency?: DemonstracoesPeriodicidade | null;
  details?: string | null;
}

export const SERVICE_CATALOG: { code: ServiceCode; label: string }[] = [
  { code: 'contabilidade_completa', label: 'Contabilidade Completa' },
  { code: 'emissao_nf', label: 'Emissão de Notas Fiscais' },
  { code: 'relatorios_personalizados', label: 'Relatórios Personalizados' },
  { code: 'demonstracoes_contabeis', label: 'Demonstrações Contábeis' },
];

export const PERIODICIDADE_OPTS: { value: DemonstracoesPeriodicidade; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

export interface HandoffDraft {
  services: HandoffServiceItem[];
  otherService: string;
  monthlyValue: string;
  commercialNotes: string;
}

export const emptyHandoff: HandoffDraft = {
  services: [],
  otherService: '',
  monthlyValue: '',
  commercialNotes: '',
};

// Backward-compat parser: accepts old string[] or new object[]
export function parseServices(raw: any): HandoffServiceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any): HandoffServiceItem | null => {
      if (typeof it === 'string') {
        const found = SERVICE_CATALOG.find(s => s.label.toLowerCase() === it.toLowerCase());
        if (found) return { code: found.code, label: found.label };
        return null;
      }
      if (it && typeof it === 'object' && it.code) {
        const found = SERVICE_CATALOG.find(s => s.code === it.code);
        return {
          code: it.code,
          label: found?.label ?? it.label ?? it.code,
          quantity: it.quantity ?? null,
          frequency: it.frequency ?? null,
          details: it.details ?? null,
        };
      }
      return null;
    })
    .filter((x): x is HandoffServiceItem => !!x);
}

export function extractOtherService(raw: any): string {
  if (!Array.isArray(raw)) return '';
  const codes = new Set(SERVICE_CATALOG.map(s => s.code));
  for (const it of raw) {
    if (typeof it === 'string') {
      const isKnown = SERVICE_CATALOG.some(s => s.label.toLowerCase() === it.toLowerCase());
      if (!isKnown) return it;
    }
  }
  return '';
}

interface Props {
  handoff: HandoffDraft;
  setHandoff: (next: HandoffDraft) => void;
}

export function StepHandoff({ handoff, setHandoff }: Props) {
  const update = <K extends keyof HandoffDraft>(field: K, value: HandoffDraft[K]) => {
    setHandoff({ ...handoff, [field]: value });
  };

  const isChecked = (code: ServiceCode) => handoff.services.some(s => s.code === code);
  const getItem = (code: ServiceCode) => handoff.services.find(s => s.code === code);

  const toggleService = (code: ServiceCode, label: string) => {
    if (isChecked(code)) {
      update('services', handoff.services.filter(s => s.code !== code));
    } else {
      update('services', [...handoff.services, { code, label }]);
    }
  };

  const updateServiceField = (code: ServiceCode, patch: Partial<HandoffServiceItem>) => {
    update('services', handoff.services.map(s => s.code === code ? { ...s, ...patch } : s));
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

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> Serviços Contratados
        </h4>

        <div className="space-y-2">
          {SERVICE_CATALOG.map(({ code, label }) => {
            const checked = isChecked(code);
            const item = getItem(code);
            return (
              <div key={code} className={`rounded-md border px-3 py-2.5 transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={() => toggleService(code, label)} />
                  <span className="text-sm font-medium">{label}</span>
                </label>

                {checked && code === 'emissao_nf' && (
                  <div className="mt-2 ml-6 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Quantidade mensal:</Label>
                    <Input
                      type="number" min="0" step="1"
                      className="h-8 w-28"
                      value={item?.quantity ?? ''}
                      onChange={e => updateServiceField(code, { quantity: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="ex: 50"
                    />
                  </div>
                )}

                {checked && code === 'relatorios_personalizados' && (
                  <div className="mt-2 ml-6 space-y-1">
                    <Label className="text-xs text-muted-foreground">Relatórios acordados:</Label>
                    <Textarea
                      rows={2}
                      value={item?.details ?? ''}
                      onChange={e => updateServiceField(code, { details: e.target.value })}
                      placeholder="Ex: DRE gerencial mensal, fluxo de caixa por centro de custo, indicadores comerciais..."
                      maxLength={500}
                    />
                  </div>
                )}

                {checked && code === 'demonstracoes_contabeis' && (
                  <div className="mt-2 ml-6 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Periodicidade:</Label>
                    <Select
                      value={item?.frequency ?? ''}
                      onValueChange={(v) => updateServiceField(code, { frequency: v as DemonstracoesPeriodicidade })}
                    >
                      <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {PERIODICIDADE_OPTS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <Label className="text-xs">Outros serviços (opcional)</Label>
          <Input
            value={handoff.otherService}
            onChange={e => update('otherService', e.target.value)}
            placeholder="Especifique outros serviços contratados..."
            maxLength={200}
          />
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Valor da mensalidade (R$)
          </Label>
          <Input type="number" step="0.01" min="0" value={handoff.monthlyValue} onChange={e => update('monthlyValue', e.target.value)} placeholder="0,00" />
        </div>
      </section>

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
