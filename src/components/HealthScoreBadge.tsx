import { HealthScore, HEALTH_LABELS } from '@/types/client';
import { cn } from '@/lib/utils';
import { Heart, AlertTriangle, XCircle } from 'lucide-react';

const config: Record<HealthScore, { icon: typeof Heart; className: string }> = {
  healthy: { icon: Heart, className: 'bg-health-healthy/10 text-health-healthy border-health-healthy/20' },
  attention: { icon: AlertTriangle, className: 'bg-health-attention/10 text-health-attention border-health-attention/20' },
  critical: { icon: XCircle, className: 'bg-health-critical/10 text-health-critical border-health-critical/20' },
};

export function HealthScoreBadge({ score, size = 'sm' }: { score: HealthScore; size?: 'sm' | 'lg' }) {
  const { icon: Icon, className } = config[score];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-4 py-1.5 text-sm',
      className
    )}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {HEALTH_LABELS[score]}
    </span>
  );
}
