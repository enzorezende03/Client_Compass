import { TimelineEntry, INTERACTION_LABELS, SECTOR_LABELS, ORIGIN_LABELS, DEMAND_STATUS_LABELS } from '@/types/client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  MessageSquare, AlertTriangle, FileText, Users, Flame, ThumbsUp, TrendingUp, Star
} from 'lucide-react';

const typeIcons: Record<string, typeof MessageSquare> = {
  service: MessageSquare,
  complaint: AlertTriangle,
  request: FileText,
  meeting: Users,
  critical_issue: Flame,
  feedback: ThumbsUp,
  opportunity: TrendingUp,
};

const typeColors: Record<string, string> = {
  service: 'bg-primary/10 text-primary',
  complaint: 'bg-health-attention/10 text-health-attention',
  request: 'bg-sidebar-primary/10 text-sidebar-primary',
  meeting: 'bg-health-healthy/10 text-health-healthy',
  critical_issue: 'bg-health-critical/10 text-health-critical',
  feedback: 'bg-primary/10 text-primary',
  opportunity: 'bg-health-healthy/10 text-health-healthy',
};

const demandStatusColors: Record<string, string> = {
  open: 'bg-health-attention/10 text-health-attention',
  in_progress: 'bg-sidebar-primary/10 text-sidebar-primary',
  waiting_client: 'bg-muted text-muted-foreground',
  resolved: 'bg-health-healthy/10 text-health-healthy',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="relative space-y-0">
      {sorted.map((entry, i) => {
        const Icon = typeIcons[entry.type] || MessageSquare;
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative flex gap-4 pb-6"
          >
            {/* Timeline line */}
            {i < sorted.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />
            )}

            {/* Icon */}
            <div className={cn(
              'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              typeColors[entry.type]
            )}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className={cn(
              'flex-1 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover',
              entry.isRelevantEvent && 'border-health-attention/40 ring-1 ring-health-attention/20'
            )}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', typeColors[entry.type])}>
                  {INTERACTION_LABELS[entry.type]}
                </span>
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {SECTOR_LABELS[entry.sector]}
                </span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', demandStatusColors[entry.demandStatus])}>
                  {DEMAND_STATUS_LABELS[entry.demandStatus]}
                </span>
                {entry.isRelevantEvent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-health-attention/10 px-2 py-0.5 text-xs font-semibold text-health-attention">
                    <Star className="h-3 w-3" />
                    {entry.relevantEventType}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{entry.description}</p>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span>Responsável: <strong>{entry.responsible}</strong></span>
                <span>Origem: {ORIGIN_LABELS[entry.origin]}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
