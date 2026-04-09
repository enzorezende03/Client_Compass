import { ClientStatus, STATUS_LABELS, FinancialStatus, FINANCIAL_LABELS } from '@/types/client';
import { cn } from '@/lib/utils';

const statusColors: Record<ClientStatus, string> = {
  active: 'bg-status-active/10 text-status-active border-status-active/20',
  at_risk: 'bg-status-risk/10 text-status-risk border-status-risk/20',
  recovery: 'bg-status-recovery/10 text-status-recovery border-status-recovery/20',
  cancelled: 'bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20',
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', statusColors[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const financialColors: Record<FinancialStatus, string> = {
  current: 'bg-financial-ok/10 text-financial-ok border-financial-ok/20',
  late: 'bg-financial-late/10 text-financial-late border-financial-late/20',
  critical: 'bg-financial-critical/10 text-financial-critical border-financial-critical/20',
};

export function FinancialStatusBadge({ status }: { status: FinancialStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', financialColors[status])}>
      {FINANCIAL_LABELS[status]}
    </span>
  );
}
