import { Loader2, Check, Building2, Briefcase, Calendar, User, Layers, Activity, Heart, Wallet, BadgeCheck, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import {
  STATUS_LABELS, COMPLEXITY_LABELS, PROFILE_LABELS, FINANCIAL_LABELS, HEALTH_LABELS, TAXATION_LABELS, PROFILE_ICONS,
} from '@/types/client';

interface Props {
  form: any;
  updateField: (field: string, value: string) => void;
  cnpjLoading: boolean;
  onDocumentChange: (value: string) => void;
}

const HEALTH_DOTS: Record<string, string> = {
  healthy: '🟢',
  attention: '🟡',
  critical: '🔴',
};

function FieldLabel({ icon: Icon, children, hint }: { icon: any; children: React.ReactNode; hint?: string }) {
  return (
    <Label className="flex items-center gap-2 text-sm">
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

export function StepIdentification({ form, updateField, cnpjLoading, onDocumentChange }: Props) {
  const docDigits = (form.document || '').replace(/\D/g, '');
  const docOk = docDigits.length === 14;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
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

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Classificação Estratégica
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel icon={Layers} hint="Complexidade operacional do cliente. A = mais complexa.">Complexidade</FieldLabel>
            <Select value={form.complexity} onValueChange={v => updateField('complexity', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Activity}>Status</FieldLabel>
            <Select value={form.status} onValueChange={v => updateField('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel icon={BadgeCheck} hint="Tier de atendimento: VIP, Premium, Standard ou Básico.">Perfil (Tier)</FieldLabel>
            <Select value={form.profile} onValueChange={v => updateField('profile', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROFILE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="mr-2">{PROFILE_ICONS[k as keyof typeof PROFILE_ICONS]}</span>{v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Wallet}>Status Financeiro</FieldLabel>
            <Select value={form.financial_status} onValueChange={v => updateField('financial_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FINANCIAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Heart} hint="Saúde do relacionamento com o cliente.">Health Score</FieldLabel>
            <Select value={form.health_score} onValueChange={v => updateField('health_score', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(HEALTH_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="mr-2">{HEALTH_DOTS[k]}</span>{v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel icon={Receipt}>Tributação</FieldLabel>
            <Select value={form.taxation || 'none'} onValueChange={v => updateField('taxation', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não definida</SelectItem>
                {Object.entries(TAXATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
