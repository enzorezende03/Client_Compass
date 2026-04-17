import { AlertOctagon, ShieldCheck, Calendar, FileWarning, Wrench, DollarSign, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionButtons } from '@/components/ui/option-buttons';

interface Props {
  form: any;
  updateField: (field: string, value: string) => void;
}

const Emoji = ({ char }: { char: string }) => (
  <span className="text-lg leading-none" aria-hidden>{char}</span>
);

const RISK_OPTS = [
  { value: 'operational', label: 'Operacional', description: 'Falhas de processo, prazos, qualidade', activeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/40', icon: <Emoji char="🛠️" /> },
  { value: 'financial', label: 'Financeiro', description: 'Inadimplência, queda de receita', activeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/40', icon: <Emoji char="💸" /> },
  { value: 'relationship', label: 'Relacionamento', description: 'Insatisfação, ruído de comunicação', activeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/40', icon: <Emoji char="💔" /> },
];

export function StepRisk({ form, updateField }: Props) {
  const hasRisk = !!(form.risk_type || form.risk_reason);

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border p-4 shadow-sm ${hasRisk ? 'bg-destructive/5 border-destructive/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}>
        <div className="flex items-center gap-3">
          {hasRisk ? (
            <AlertOctagon className="h-6 w-6 text-destructive" />
          ) : (
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {hasRisk ? 'Cliente sinalizado com risco' : 'Sem risco identificado'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {hasRisk
                ? 'Preencha os campos abaixo para acompanhamento.'
                : 'Selecione um tipo de risco abaixo apenas se houver sinal de alerta.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-5 shadow-sm">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <FileWarning className="h-3.5 w-3.5 text-muted-foreground" /> Tipo de Risco
          </Label>
          <OptionButtons
            value={form.risk_type || ''}
            onChange={v => updateField('risk_type', v)}
            options={RISK_OPTS}
            columns={3}
            clearable
          />
          <p className="text-xs text-muted-foreground">Clique novamente no tipo selecionado para remover.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Data de Identificação
            </Label>
            <Input type="date" value={form.risk_identified_date} onChange={e => updateField('risk_identified_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Motivo do Risco</Label>
            <Input value={form.risk_reason} onChange={e => updateField('risk_reason', e.target.value)} placeholder="Ex: insatisfação com prazos..." />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Plano de Ação Inicial</Label>
          <Textarea
            value={form.action_plan}
            onChange={e => updateField('action_plan', e.target.value)}
            rows={5}
            placeholder="Descreva as primeiras ações para mitigar o risco. Ações detalhadas podem ser cadastradas na aba Plano de Ação do cliente."
            className="resize-none"
          />
        </div>
      </div>
    </div>
  );
}
