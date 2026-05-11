import { useEffect, useState } from 'react';
import { Loader2, Save, Eye, FileBarChart, Calendar } from 'lucide-react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const STATUS_OPTIONS = ['Regular', 'Atenção', 'Crítico'] as const;
export type ReportStatus = typeof STATUS_OPTIONS[number];

export const STATUS_BADGE: Record<ReportStatus, string> = {
  'Regular': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  'Atenção': 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  'Crítico': 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
};

export interface ReportRow {
  id: string;
  client_id: string;
  reference_month: string;
  submitted_at: string;
  overall_status: string;
  completed_obligations: string;
  pending_items: string;
  cs_attention_points: string;
  integration_progress: string;
  operational_difficulties: string;
  upcoming_milestones: string;
}

const schema = z.object({
  reference_month: z.string().trim().regex(/^\d{2}\/\d{4}$/, 'Use o formato MM/AAAA'),
  overall_status: z.enum(STATUS_OPTIONS),
  completed_obligations: z.string().trim().min(2, 'Descreva as obrigações cumpridas').max(2000),
  cs_attention_points: z.string().trim().min(2, 'Descreva os pontos de atenção para o CS').max(2000),
  pending_items: z.string().max(2000).optional(),
  integration_progress: z.string().max(2000).optional(),
  operational_difficulties: z.string().max(2000).optional(),
  upcoming_milestones: z.string().max(2000).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  clientName: string;
  csResponsibleName?: string | null;
  /** Optional: progress id of an Etapa 4 checklist item to mark complete */
  monthlyProgressId?: string;
  /** When provided, opens in read-only view of this report */
  viewReport?: ReportRow | null;
  onSaved?: () => void;
}

const empty = {
  reference_month: '', overall_status: 'Regular' as ReportStatus,
  completed_obligations: '', pending_items: '', cs_attention_points: '',
  integration_progress: '', operational_difficulties: '', upcoming_milestones: '',
};

export function OnboardingMonthlyReportDialog({
  open, onOpenChange, clientId, clientName, csResponsibleName,
  monthlyProgressId, viewReport, onSaved,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isView = !!viewReport;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (viewReport) {
      setForm({
        reference_month: viewReport.reference_month,
        overall_status: viewReport.overall_status as ReportStatus,
        completed_obligations: viewReport.completed_obligations,
        pending_items: viewReport.pending_items,
        cs_attention_points: viewReport.cs_attention_points,
        integration_progress: viewReport.integration_progress,
        operational_difficulties: viewReport.operational_difficulties,
        upcoming_milestones: viewReport.upcoming_milestones,
      });
    } else {
      setForm(empty);
    }
  }, [open, viewReport]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      toast({ title: 'Verifique os campos', description: 'Há campos obrigatórios pendentes.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data: me } = auth.user
        ? await supabase.from('internal_users').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
        : { data: null };

      const { error } = await supabase.from('operational_monthly_reports').insert({
        client_id: clientId,
        submitted_by: me?.id ?? null,
        reference_month: form.reference_month.trim(),
        overall_status: form.overall_status,
        completed_obligations: form.completed_obligations.trim(),
        pending_items: form.pending_items?.trim() || '',
        cs_attention_points: form.cs_attention_points.trim(),
        integration_progress: form.integration_progress?.trim() || '',
        operational_difficulties: form.operational_difficulties?.trim() || '',
        upcoming_milestones: form.upcoming_milestones?.trim() || '',
      });
      if (error) throw error;

      // Mark monthly checklist item complete (if provided)
      if (monthlyProgressId) {
        await supabase.from('client_onboarding_progress').update({
          status: 'concluido',
          completed_at: new Date().toISOString(),
          completed_by: me?.id ?? null,
        }).eq('id', monthlyProgressId);
      }

      // Timeline entry
      await supabase.from('timeline_entries').insert({
        client_id: clientId,
        type: 'service',
        description: `[Onboarding] Relatório mensal recebido (${form.reference_month}) — Status: ${form.overall_status}`,
        responsible: 'Operacional',
        sector: 'fiscal',
        origin: 'internal',
        demand_status: 'resolved',
        is_relevant_event: true,
        relevant_event_type: 'onboarding',
      });

      // Notify CS responsible (lookup by name)
      if (csResponsibleName) {
        const { data: csUser } = await supabase
          .from('internal_users')
          .select('id')
          .eq('name', csResponsibleName)
          .eq('active', true)
          .maybeSingle();
        if (csUser?.id) {
          await supabase.from('notifications').insert({
            user_id: csUser.id,
            type: 'onboarding_report',
            title: 'Novo relatório mensal de onboarding',
            message: `Relatório mensal de ${clientName} recebido — Status: ${form.overall_status}`,
          });
        }
      }

      toast({ title: 'Relatório enviado!', description: 'O CS responsável foi notificado.' });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const ErrText = ({ k }: { k: string }) => errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            {isView ? 'Relatório Mensal' : 'Enviar Relatório Mensal'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>{clientName}</span>
            {isView && (
              <Badge variant="outline" className={cn('text-[11px]', STATUS_BADGE[viewReport!.overall_status as ReportStatus])}>
                {viewReport!.overall_status}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Mês de referência *</Label>
              <Input value={form.reference_month} disabled={isView} placeholder="05/2026" maxLength={7}
                onChange={e => set('reference_month', e.target.value)}
                className={cn(errors.reference_month && 'border-destructive')} />
              <ErrText k="reference_month" />
            </div>
            <div>
              <Label>Situação geral da empresa *</Label>
              <Select value={form.overall_status} disabled={isView} onValueChange={v => set('overall_status', v as ReportStatus)}>
                <SelectTrigger className={cn(errors.overall_status && 'border-destructive')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full',
                          s === 'Regular' ? 'bg-emerald-500' : s === 'Atenção' ? 'bg-orange-500' : 'bg-red-500')} />
                        {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Obrigações cumpridas no mês *</Label>
            <Textarea value={form.completed_obligations} disabled={isView} maxLength={2000}
              onChange={e => set('completed_obligations', e.target.value)}
              className={cn('min-h-[80px]', errors.completed_obligations && 'border-destructive')} />
            <ErrText k="completed_obligations" />
          </div>

          <div>
            <Label>Pendências em aberto</Label>
            <Textarea value={form.pending_items} disabled={isView} maxLength={2000}
              onChange={e => set('pending_items', e.target.value)} className="min-h-[70px]" />
          </div>

          <div>
            <Label>Pontos de atenção para o CS comunicar ao cliente *</Label>
            <Textarea value={form.cs_attention_points} disabled={isView} maxLength={2000}
              onChange={e => set('cs_attention_points', e.target.value)}
              className={cn('min-h-[80px]', errors.cs_attention_points && 'border-destructive')} />
            <ErrText k="cs_attention_points" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Evolução da integração</Label>
              <Textarea value={form.integration_progress} disabled={isView} maxLength={2000}
                onChange={e => set('integration_progress', e.target.value)} className="min-h-[70px]" />
            </div>
            <div>
              <Label>Dificuldades encontradas</Label>
              <Textarea value={form.operational_difficulties} disabled={isView} maxLength={2000}
                onChange={e => set('operational_difficulties', e.target.value)} className="min-h-[70px]" />
            </div>
          </div>

          <div>
            <Label>Próximos marcos importantes (datas / obrigações)</Label>
            <Textarea value={form.upcoming_milestones} disabled={isView} maxLength={2000}
              onChange={e => set('upcoming_milestones', e.target.value)} className="min-h-[70px]" />
          </div>

          {isView && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 border-t pt-3">
              <Calendar className="h-3 w-3" />
              Enviado em {new Date(viewReport!.submitted_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!isView && (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enviar relatório
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
