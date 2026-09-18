import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2, TrendingDown, Users, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ChurnMetrics, fetchChurnMetrics, formatBRL, monthRange, TERMINATION_REASON_LABELS, TerminationReason,
} from '@/lib/churn';
import {
  OnboardingType, OnboardingStage, STAGE_SHORT, ONBOARDING_TYPE_LABELS,
} from '@/lib/onboarding';

export interface SlaRow {
  progress_id: string;
  client_id: string;
  client_name: string;
  onboarding_type: OnboardingType;
  onboarding_status: string;
  current_stage: string | null;
  cs_responsible: string | null;
  checklist_item_id: string;
  stage: string;
  order_index: number;
  item_title: string;
  responsible: string;
  is_required: boolean;
  locked: boolean;
  unlocked_at: string | null;
  force_unlocked: boolean;
  due_at: string | null;
  concluded_at: string | null;
  is_overdue: boolean;
  days_overdue: number;
}

const ROLE_LABELS: Record<string, string> = {
  cs: 'CS',
  coordenador_geral: 'Coordenador Geral',
  operacional: 'Operacional',
};

const roleLabel = (r?: string | null) => (r ? ROLE_LABELS[r] || r : 'Sem responsável');
const stageLabel = (s?: string | null) => (s ? STAGE_SHORT[s as OnboardingStage] || s : '—');

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Card({
  title, value, subtitle, icon, emphasis, muted,
}: {
  title: string; value: React.ReactNode; subtitle?: string;
  icon?: React.ReactNode; emphasis?: boolean; muted?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg border bg-card p-4 flex flex-col gap-1',
      emphasis ? 'border-destructive/60 bg-destructive/5' : 'border-border',
      muted && 'border-dashed opacity-70',
    )}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}<span className="truncate">{title}</span>
      </div>
      <div className={cn('text-2xl font-bold', emphasis ? 'text-destructive' : 'text-foreground')}>{value}</div>
      {subtitle && <div className="text-[11px] text-muted-foreground leading-tight">{subtitle}</div>}
    </div>
  );
}

export interface OnboardingSlaPanelProps {
  typeFilter: 'all' | OnboardingType;
  onSelectClient: (clientId: string) => void;
  /** Overdue days per client, lifted up so the Kanban can show the same badge. */
  onOverdueChange?: (map: Record<string, number>) => void;
}

export function OnboardingSlaPanel({ typeFilter, onSelectClient, onOverdueChange }: OnboardingSlaPanelProps) {
  const [rows, setRows] = useState<SlaRow[]>([]);
  const [completed, setCompleted] = useState<{ id: string; onboarding_type: string | null; started: string | null; done: string | null }[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [churn, setChurn] = useState<ChurnMetrics | null>(null);
  const [churnOpen, setChurnOpen] = useState(false);
  const [churnList, setChurnList] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const [slaRes, doneRes] = await Promise.all([
      supabase.from('onboarding_sla_status' as any).select('*').eq('onboarding_status', 'active'),
      supabase.from('clients')
        .select('id,onboarding_type,onboarding_started_at,onboarding_completed_at')
        .eq('onboarding_status', 'completed')
        .not('onboarding_completed_at', 'is', null),
    ]);
    setRows(((slaRes.data || []) as unknown as SlaRow[]));
    setCompleted(((doneRes.data || []) as any[]).map(c => ({
      id: c.id, onboarding_type: c.onboarding_type,
      started: c.onboarding_started_at, done: c.onboarding_completed_at,
    })));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadChurn = useCallback(async () => {
    setChurn(await fetchChurnMetrics(month));
    const { start, end } = monthRange(month);
    const [termRes, usersRes] = await Promise.all([
      supabase.from('client_terminations' as any)
        .select('*, clients(name)')
        .gte('request_date', start).lte('request_date', end)
        .is('reverted_at', null)
        .order('request_date', { ascending: false }),
      supabase.from('internal_users').select('id,name'),
    ]);
    const userMap = Object.fromEntries(((usersRes.data as any[]) || []).map(u => [u.id, u.name]));
    setChurnList(((termRes.data as any[]) || []).map(t => ({
      ...t,
      client_name: t.clients?.name || '—',
      registered_by_name: t.registered_by ? (userMap[t.registered_by] || '—') : '—',
    })));
  }, [month]);

  useEffect(() => { loadChurn(); }, [loadChurn]);

  useEffect(() => {
    const ch = supabase
      .channel('onboarding-sla-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_onboarding_progress' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clients' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const matchesType = useCallback((t?: string | null) =>
    typeFilter === 'all' || (t || 'empresa_existente') === typeFilter, [typeFilter]);

  const scoped = useMemo(() => rows.filter(r => matchesType(r.onboarding_type)), [rows, matchesType]);

  const activeClients = useMemo(
    () => new Set(scoped.map(r => r.client_id)).size, [scoped]);

  const overdueRequired = useMemo(
    () => scoped.filter(r => r.is_overdue && r.is_required), [scoped]);

  const overdueByClient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of overdueRequired) {
      map[r.client_id] = Math.max(map[r.client_id] || 0, r.days_overdue);
    }
    return map;
  }, [overdueRequired]);

  useEffect(() => { onOverdueChange?.(overdueByClient); }, [overdueByClient, onOverdueChange]);

  const riskList = useMemo(() => {
    const byClient = new Map<string, { row: SlaRow; days: number }>();
    for (const r of overdueRequired) {
      const cur = byClient.get(r.client_id);
      if (!cur || r.days_overdue > cur.days) byClient.set(r.client_id, { row: r, days: r.days_overdue });
    }
    return Array.from(byClient.values()).sort((a, b) => b.days - a.days);
  }, [overdueRequired]);

  const byStage = useMemo(() => {
    const acc: Record<string, { clients: Set<string>; totalDays: number; count: number }> = {};
    for (const r of overdueRequired) {
      const k = r.stage;
      acc[k] ||= { clients: new Set(), totalDays: 0, count: 0 };
      acc[k].clients.add(r.client_id);
      acc[k].totalDays += r.days_overdue;
      acc[k].count += 1;
    }
    return Object.entries(acc)
      .map(([stage, v]) => ({ stage, clients: v.clients.size, avg: v.count ? v.totalDays / v.count : 0 }))
      .sort((a, b) => b.avg - a.avg);
  }, [overdueRequired]);

  const bottleneck = byStage[0];
  const maxClients = Math.max(1, ...byStage.map(s => s.clients));

  const byResponsible = useMemo(() => {
    const acc: Record<string, { active: number; overdue: number }> = {};
    for (const r of scoped) {
      if (r.concluded_at || r.locked || !r.unlocked_at) continue;
      const k = r.responsible || '—';
      acc[k] ||= { active: 0, overdue: 0 };
      acc[k].active += 1;
      if (r.is_overdue) acc[k].overdue += 1;
    }
    return Object.entries(acc).sort((a, b) => b[1].overdue - a[1].overdue || b[1].active - a[1].active);
  }, [scoped]);

  const periodStats = useMemo(() => {
    const inMonth = completed.filter(c =>
      matchesType(c.onboarding_type) && c.done && c.done.slice(0, 7) === month);
    const durations = inMonth
      .filter(c => c.started && c.done)
      .map(c => (new Date(c.done!).getTime() - new Date(c.started!).getTime()) / 864e5)
      .filter(d => d >= 0);
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    return { count: inMonth.length, avg };
  }, [completed, month, matchesType]);

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Card
          title="Em onboarding agora"
          value={activeClients}
          subtitle={typeFilter === 'all' ? 'todos os tipos' : ONBOARDING_TYPE_LABELS[typeFilter]}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <Card
          title="Onboardings em risco por atraso no SLA"
          value={riskList.length}
          subtitle="clientes com item obrigatório atrasado"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          emphasis={riskList.length > 0}
        />
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Concluídos no período
            </div>
            <Input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value || currentMonth())}
              className="h-6 w-[120px] text-[11px] px-1.5"
            />
          </div>
          <div className="text-2xl font-bold text-foreground">{periodStats.count}</div>
        </div>
        <Card
          title="Tempo médio de onboarding (dias)"
          value={periodStats.avg ?? '—'}
          subtitle="clientes concluídos no mês selecionado"
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
        <Card
          title="Churn do período"
          value="—"
          subtitle="Em breve"
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          muted
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Atrasos por etapa */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Atrasos por etapa</h3>
          {byStage.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item obrigatório atrasado.</p>
          ) : (
            <>
              <div className="space-y-2.5">
                {byStage.map(s => (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{stageLabel(s.stage)}</span>
                      <span className="text-muted-foreground">
                        {s.clients} cliente{s.clients > 1 ? 's' : ''} · {s.avg.toFixed(1)} dias em média
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-destructive transition-all"
                        style={{ width: `${Math.round((s.clients / maxClients) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {bottleneck && (
                <p className="text-xs font-medium text-destructive mt-3">
                  Gargalo: {stageLabel(bottleneck.stage)} — {bottleneck.avg.toFixed(1)} dias em média
                </p>
              )}
            </>
          )}
        </div>

        {/* Carga por responsável */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Carga por responsável</h3>
          {byResponsible.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item ativo no momento.</p>
          ) : (
            <div className="space-y-2">
              {byResponsible.map(([role, v]) => (
                <div key={role} className="flex items-center justify-between text-xs border-b border-border/60 last:border-0 pb-1.5 last:pb-0">
                  <span className="font-medium text-foreground">{roleLabel(role)}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{v.active} ativos</Badge>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', v.overdue > 0 && 'border-destructive/50 text-destructive')}
                    >
                      {v.overdue} atrasados
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de onboardings em risco */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <AlertTriangle className={cn('h-4 w-4', riskList.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
          <h3 className="text-sm font-semibold text-foreground">Onboardings em risco</h3>
          <Badge variant="outline" className="text-[10px]">{riskList.length}</Badge>
        </div>
        {riskList.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-4">Nenhum onboarding com SLA estourado. 🎉</p>
        ) : (
          <div className="divide-y divide-border max-h-[320px] overflow-auto">
            {riskList.map(({ row, days }) => (
              <button
                key={row.client_id}
                onClick={() => onSelectClient(row.client_id)}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 flex-wrap"
              >
                <span className="font-medium text-sm text-foreground min-w-[180px] truncate">{row.client_name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {ONBOARDING_TYPE_LABELS[(row.onboarding_type || 'empresa_existente') as OnboardingType]}
                </Badge>
                <span className="text-xs text-muted-foreground">Etapa: {stageLabel(row.current_stage)}</span>
                <span className="text-xs text-muted-foreground flex-1 min-w-[180px] truncate">
                  Item: {row.item_title}
                </span>
                <span className="text-xs text-muted-foreground">{roleLabel(row.responsible)}</span>
                <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive gap-1">
                  <Clock className="h-2.5 w-2.5" /> {days} dia{days === 1 ? '' : 's'} atrasado
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
