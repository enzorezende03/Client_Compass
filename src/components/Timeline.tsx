import { useMemo, useState } from 'react';
import {
  TimelineEntry, INTERACTION_LABELS, SECTOR_LABELS, ORIGIN_LABELS, DEMAND_STATUS_LABELS,
  RESPONSIBILITY_ORIGIN_LABELS, ResponsibilityOrigin,
} from '@/types/client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquare, AlertTriangle, FileText, Users, Flame, ThumbsUp, TrendingUp, Star, CheckSquare, Tag, Plus
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

const responsibilityColors: Record<ResponsibilityOrigin, string> = {
  escritorio: 'bg-rework-office/10 text-rework-office',
  cliente: 'bg-rework-client/10 text-rework-client',
  neutro: 'bg-rework-neutral/10 text-rework-neutral',
};

const TZ = 'America/Sao_Paulo';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

function formatFull(dateStr: string) {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return `${date} às ${time}`;
}

export interface LinkedTask { id: string; title: string; status: string }

interface Props {
  entries: TimelineEntry[];
  tasksByEntry?: Record<string, LinkedTask>;
  onClassify?: (entry: TimelineEntry, value: ResponsibilityOrigin) => void;
  onGenerateTask?: (entry: TimelineEntry) => void;
  onOpenTask?: (task: LinkedTask) => void;
}

export function Timeline({ entries, tasksByEntry = {}, onClassify, onGenerateTask, onOpenTask }: Props) {
  const [filter, setFilter] = useState<'all' | ResponsibilityOrigin | 'unclassified'>('all');

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries]
  );

  const summary = useMemo(() => {
    const limit = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recent = entries.filter(e => new Date(e.date).getTime() >= limit);
    return {
      escritorio: recent.filter(e => e.responsibilityOrigin === 'escritorio').length,
      cliente: recent.filter(e => e.responsibilityOrigin === 'cliente').length,
    };
  }, [entries]);

  const visible = useMemo(() => sorted.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'unclassified') return !e.responsibilityOrigin;
    return e.responsibilityOrigin === filter;
  }), [sorted, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <p className="text-sm text-muted-foreground">
          Últimos 90 dias: <strong className="text-destructive">{summary.escritorio}</strong> problemas do escritório
          {' · '}
          <strong className="text-foreground">{summary.cliente}</strong> ocorrências do cliente
        </p>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as classificações</SelectItem>
            <SelectItem value="escritorio">{RESPONSIBILITY_ORIGIN_LABELS.escritorio}</SelectItem>
            <SelectItem value="cliente">{RESPONSIBILITY_ORIGIN_LABELS.cliente}</SelectItem>
            <SelectItem value="unclassified">Sem classificação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative space-y-0">
        {visible.map((entry, i) => {
          const Icon = typeIcons[entry.type] || MessageSquare;
          const task = tasksByEntry[entry.id];
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.04 }}
              className="relative flex gap-4 pb-6"
            >
              {i < visible.length - 1 && (
                <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />
              )}

              <div className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                typeColors[entry.type]
              )}>
                <Icon className="h-4 w-4" />
              </div>

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
                  {entry.responsibilityOrigin && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', responsibilityColors[entry.responsibilityOrigin])}>
                      <Tag className="h-3 w-3" />
                      {RESPONSIBILITY_ORIGIN_LABELS[entry.responsibilityOrigin]}
                    </span>
                  )}
                  {entry.isRelevantEvent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-health-attention/10 px-2 py-0.5 text-xs font-semibold text-health-attention">
                      <Star className="h-3 w-3" />
                      {entry.relevantEventType}
                    </span>
                  )}
                  {task && (
                    <button
                      onClick={() => onOpenTask?.(task)}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      <CheckSquare className="h-3 w-3" />
                      Tarefa: {task.status === 'completed' ? 'Concluída' : 'Pendente'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{entry.description}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Responsável: <strong>{entry.responsible}</strong></span>
                  <span>Origem: {ORIGIN_LABELS[entry.origin]}</span>
                  <span>
                    Registrado por {entry.createdByName || 'Sistema'} em {formatFull(entry.createdAt || entry.date)}
                  </span>
                </div>

                {(onClassify || onGenerateTask) && entry.origin !== ('system' as any) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {onClassify && (
                      <Select
                        value={entry.responsibilityOrigin || ''}
                        onValueChange={(v) => onClassify(entry, v as ResponsibilityOrigin)}
                      >
                        <SelectTrigger className="h-7 w-60 text-xs">
                          <SelectValue placeholder="Classificar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="escritorio">{RESPONSIBILITY_ORIGIN_LABELS.escritorio}</SelectItem>
                          <SelectItem value="cliente">{RESPONSIBILITY_ORIGIN_LABELS.cliente}</SelectItem>
                          <SelectItem value="neutro">{RESPONSIBILITY_ORIGIN_LABELS.neutro}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {onGenerateTask && !task && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onGenerateTask(entry)}>
                        <Plus className="h-3 w-3" /> Gerar tarefa
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {visible.length === 0 && (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhum registro para este filtro.</p>
        )}
      </div>
    </div>
  );
}
