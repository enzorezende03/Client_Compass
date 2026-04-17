import { AlertTriangle, Target, Eye, Repeat, Brain, FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  form: any;
  updateField: (field: string, value: string) => void;
}

const FIELDS = [
  { key: 'pain_points', label: 'Principais Dores', icon: AlertTriangle, color: 'text-rose-500', placeholder: 'Ex: dificuldade com fechamento mensal, prazos apertados de obrigações...' },
  { key: 'expectations', label: 'Expectativas', icon: Target, color: 'text-sky-500', placeholder: 'Ex: receber relatórios proativos, redução de carga tributária, atendimento consultivo...' },
  { key: 'attention_points', label: 'Pontos de Atenção', icon: Eye, color: 'text-amber-500', placeholder: 'Ex: sócio sensível a falhas de comunicação, prazos de DCTF...' },
  { key: 'recurring_issues', label: 'Problemas Recorrentes', icon: Repeat, color: 'text-orange-500', placeholder: 'Ex: atrasos no envio de NF, pendências documentais frequentes...' },
  { key: 'behavioral_profile', label: 'Perfil Comportamental', icon: Brain, color: 'text-violet-500', placeholder: 'Ex: prefere WhatsApp, gosta de reuniões objetivas, sensível a prazos...' },
  { key: 'strategic_notes', label: 'Notas Estratégicas', icon: FileText, color: 'text-emerald-500', placeholder: 'Ex: empresa em fase de expansão, planeja abrir filial em 2026...' },
] as const;

export function StepStrategic({ form, updateField }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Estes campos alimentam a Visão Estratégica do cliente. Quanto mais detalhe, melhor a atuação consultiva do time.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, icon: Icon, color, placeholder }) => {
          const value = form[key] || '';
          const filled = value.trim().length > 0;
          return (
            <div
              key={key}
              className={`rounded-lg border p-3 space-y-2 transition-colors ${
                filled ? 'bg-card border-primary/30' : 'bg-muted/20 border-border'
              }`}
            >
              <Label className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon className={`h-3.5 w-3.5 ${color}`} /> {label}
                </span>
                <span className="text-muted-foreground tabular-nums">{value.length} car.</span>
              </Label>
              <Textarea
                value={value}
                onChange={e => updateField(key, e.target.value)}
                rows={3}
                placeholder={placeholder}
                className="resize-none text-sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
