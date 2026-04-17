import { ClientStatus, STATUS_LABELS, STATUS_EMOJIS, FinancialStatus, FINANCIAL_LABELS, FINANCIAL_EMOJIS } from '@/types/client';
import { cn } from '@/lib/utils';

const statusColors: Record<ClientStatus, string> = {
  active: 'bg-status-active/10 text-status-active border-status-active/20',
  at_risk: 'bg-status-risk/10 text-status-risk border-status-risk/20',
  recovery: 'bg-status-recovery/10 text-status-recovery border-status-recovery/20',
  cancelled: 'bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20',
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', statusColors[status])}>
      <span aria-hidden>{STATUS_EMOJIS[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  );
}

const financialColors: Record<FinancialStatus, string> = {
  active_financial: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  suspended: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function FinancialStatusBadge({ status }: { status: FinancialStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', financialColors[status])}>
      <span aria-hidden>{FINANCIAL_EMOJIS[status]}</span>
      {FINANCIAL_LABELS[status]}
    </span>
  );
}
