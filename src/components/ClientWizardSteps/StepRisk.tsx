import { AlertOctagon, ShieldCheck, Calendar, FileWarning } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RISK_TYPE_LABELS } from '@/types/client';

interface Props {
  form: any;
  updateField: (field: string, value: string) => void;
}

export function StepRisk({ form, updateField }: Props) {
  const hasRisk = !!(form.risk_type || form.risk_reason);

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 ${hasRisk ? 'bg-destructive/5 border-destructive/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}>
        <div className="flex items-center gap-2">
          {hasRisk ? (
            <AlertOctagon className="h-5 w-5 text-destructive" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><FileWarning className="h-3.5 w-3.5 text-muted-foreground" /> Tipo de Risco</Label>
          <Select value={form.risk_type || 'none'} onValueChange={v => updateField('risk_type', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {Object.entries(RISK_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Data de Identificação</Label>
          <Input type="date" value={form.risk_identified_date} onChange={e => updateField('risk_identified_date', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm">Motivo do Risco</Label>
          <Input value={form.risk_reason} onChange={e => updateField('risk_reason', e.target.value)} placeholder="Ex: insatisfação com prazos, queda no faturamento..." />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm">Plano de Ação Inicial</Label>
          <Textarea
            value={form.action_plan}
            onChange={e => updateField('action_plan', e.target.value)}
            rows={4}
            placeholder="Descreva as primeiras ações para mitigar o risco. Ações detalhadas podem ser cadastradas na aba Plano de Ação do cliente."
            className="resize-none"
          />
        </div>
      </div>
    </div>
  );
}
