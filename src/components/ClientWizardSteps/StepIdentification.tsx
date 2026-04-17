import { Loader2, Check, Building2, Briefcase, Calendar, User, Layers, Activity, Heart, Wallet, BadgeCheck, Receipt, Crown, Star, Circle, CircleDot, AlertTriangle, Pause, ShieldAlert, RotateCcw, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { OptionButtons } from '@/components/ui/option-buttons';
import { TAXATION_LABELS } from '@/types/client';

interface Props {
  form: any;
  updateField: (field: string, value: string) => void;
  cnpjLoading: boolean;
  onDocumentChange: (value: string) => void;
}

function FieldLabel({ icon: Icon, children, hint }: { icon: any; children: React.ReactNode; hint?: string }) {
  return (
    <Label className="flex items-center gap-2 text-sm font-medium">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {children}
      {hint && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p className="text-xs">{hint}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </Label>
  );
}

const Emoji = ({ char }: { char: string }) => (
  <span className="text-lg leading-none" aria-hidden>{char}</span>
);

const COMPLEXITY_OPTS = [
  { value: 'A', label: 'A — Alta', description: 'Operação muito complexa', activeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/40', icon: <Emoji char="🔥" /> },
  { value: 'B', label: 'B — Média-Alta', description: 'Demanda atenção frequente', activeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/40', icon: <Emoji char="⚡" /> },
  { value: 'C', label: 'C — Média', description: 'Padrão de mercado', activeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/40', icon: <Emoji char="⚖️" /> },
  { value: 'D', label: 'D — Baixa', description: 'Operação simples', activeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/40', icon: <Emoji char="🌱" /> },
];

const STATUS_OPTS = [
  { value: 'active', label: 'Ativo', description: 'Tudo em dia', activeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/40', icon: <Emoji char="✅" /> },
  { value: 'at_risk', label: 'Em Risco', description: 'Requer atenção', activeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/40', icon: <Emoji char="⚠️" /> },
  { value: 'recovery', label: 'Recuperação', description: 'Em retomada', activeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/40', icon: <Emoji char="🔄" /> },
  { value: 'cancelled', label: 'Cancelado', description: 'Encerrado', activeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/40', icon: <Emoji char="🛑" /> },
];

const PROFILE_OPTS = [
  { value: 'vip', label: 'VIP', description: 'Atendimento prioritário', activeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/40', icon: <Emoji char="👑" /> },
  { value: 'premium', label: 'Premium', description: 'Atenção destacada', activeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/40', icon: <Emoji char="⭐" /> },
  { value: 'standard', label: 'Standard', description: 'Atendimento padrão', activeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/40', icon: <Emoji char="💼" /> },
  { value: 'basic', label: 'Básico', description: 'Operação enxuta', activeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/40', icon: <Emoji char="📦" /> },
];

const FINANCIAL_OPTS = [
  { value: 'active_financial', label: 'Ativo', description: 'Pagamentos em dia', activeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/40', icon: <Emoji char="💚" /> },
  { value: 'suspended', label: 'Suspenso', description: 'Pagamento em atraso', activeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/40', icon: <Emoji char="⛔" /> },
];

const HEALTH_OPTS = [
  { value: 'healthy', label: 'Saudável', description: 'Cliente feliz', activeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/40', icon: <Emoji char="😊" /> },
  { value: 'attention', label: 'Atenção', description: 'Sinais de alerta', activeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/40', icon: <Emoji char="😐" /> },
  { value: 'critical', label: 'Crítico', description: 'Risco elevado', activeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/40', icon: <Emoji char="😟" /> },
];

const TAXATION_EMOJI: Record<string, string> = {
  simples_nacional: '🟢',
  simples_nacional_fator_r: '🟡',
  lucro_presumido: '🔵',
  lucro_presumido_equiparacao_hospitalar: '🏥',
};

const TAXATION_OPTS = Object.entries(TAXATION_LABELS).map(([value, label]) => ({
  value,
  label,
  activeClass: 'bg-primary/10 text-primary ring-primary/40',
  icon: <Emoji char={TAXATION_EMOJI[value] ?? '📄'} />,
}));

export function StepIdentification({ form, updateField, cnpjLoading, onDocumentChange }: Props) {
  const docDigits = (form.document || '').replace(/\D/g, '');
  const docOk = docDigits.length === 14;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Identificação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <FieldLabel icon={Building2}>Nome / Razão Social *</FieldLabel>
            <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Ex: Empresa ABC Ltda" />
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Receipt}>CPF/CNPJ</FieldLabel>
            <div className="relative">
              <Input
                value={form.document}
                onChange={e => onDocumentChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                className={docOk ? 'pr-10 border-emerald-500/50' : 'pr-10'}
              />
              {cnpjLoading ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : docOk ? (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Auto-preenchimento via BrasilAPI ao digitar 14 dígitos.</p>
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Briefcase}>Segmento</FieldLabel>
            <Input value={form.segment} onChange={e => updateField('segment', e.target.value)} placeholder="Ex: Comércio varejista" />
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Calendar}>Início do Contrato</FieldLabel>
            <Input type="date" value={form.contract_start_date} onChange={e => updateField('contract_start_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel icon={User}>CS Responsável</FieldLabel>
            <Input value={form.cs_responsible} onChange={e => updateField('cs_responsible', e.target.value)} placeholder="Nome do responsável" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Classificação Estratégica
        </h3>

        <div className="space-y-2">
          <FieldLabel icon={Layers} hint="Complexidade operacional do cliente. A = mais complexa.">Complexidade</FieldLabel>
          <OptionButtons value={form.complexity} onChange={v => updateField('complexity', v)} options={COMPLEXITY_OPTS} columns={4} />
        </div>

        <div className="space-y-2">
          <FieldLabel icon={Activity}>Status</FieldLabel>
          <OptionButtons value={form.status} onChange={v => updateField('status', v)} options={STATUS_OPTS} columns={4} />
        </div>

        <div className="space-y-2">
          <FieldLabel icon={BadgeCheck} hint="Tier de atendimento: VIP, Premium, Standard ou Básico.">Perfil (Tier)</FieldLabel>
          <OptionButtons value={form.profile} onChange={v => updateField('profile', v)} options={PROFILE_OPTS} columns={4} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            <FieldLabel icon={Wallet}>Status Financeiro</FieldLabel>
            <OptionButtons value={form.financial_status} onChange={v => updateField('financial_status', v)} options={FINANCIAL_OPTS} columns={2} />
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Heart} hint="Saúde do relacionamento com o cliente.">Health Score</FieldLabel>
            <OptionButtons value={form.health_score} onChange={v => updateField('health_score', v)} options={HEALTH_OPTS} columns={3} />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel icon={Receipt}>Tributação</FieldLabel>
          <OptionButtons value={form.taxation || ''} onChange={v => updateField('taxation', v)} options={TAXATION_OPTS} columns={4} clearable size="sm" />
          <p className="text-xs text-muted-foreground">Clique novamente para limpar a seleção.</p>
        </div>
      </div>
    </div>
  );
}
