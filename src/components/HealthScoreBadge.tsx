import { HealthScore, HEALTH_LABELS, HEALTH_EMOJIS } from '@/types/client';
import { cn } from '@/lib/utils';

const colorClass: Record<HealthScore, string> = {
  healthy: 'bg-health-healthy/10 text-health-healthy border-health-healthy/20',
  attention: 'bg-health-attention/10 text-health-attention border-health-attention/20',
  critical: 'bg-health-critical/10 text-health-critical border-health-critical/20',
};

export function HealthScoreBadge({ score, size = 'sm' }: { score: HealthScore; size?: 'sm' | 'lg' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-4 py-1.5 text-sm',
      colorClass[score],
    )}>
      <span aria-hidden className={size === 'sm' ? 'text-sm leading-none' : 'text-base leading-none'}>
        {HEALTH_EMOJIS[score]}
      </span>
      {HEALTH_LABELS[score]}
    </span>
  );
}
