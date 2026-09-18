import { useMemo, useState } from 'react';
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Lock, CheckSquare, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CalendarEventStatus = 'overdue' | 'today' | 'upcoming' | 'done' | 'blocked';
export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm (opcional) */
  time?: string | null;
  title: string;
  subtitle?: string;
  status: CalendarEventStatus;
  kind: 'task' | 'onboarding';
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  /** Quando definido, os eventos podem ser arrastados para outro dia. */
  onEventDrop?: (event: CalendarEvent, newDate: string) => void;
  /** Chave para lembrar a visão (dia/semana/mês) no navegador. */
  storageKey?: string;
  emptyLabel?: string;
}

const STATUS_STYLES: Record<CalendarEventStatus, string> = {
  overdue: 'bg-destructive/10 text-destructive border-destructive/30',
  today: 'bg-status-risk/10 text-status-risk border-status-risk/30',
  upcoming: 'bg-primary/10 text-primary border-primary/25',
  done: 'bg-status-active/10 text-status-active border-status-active/30',
  blocked: 'bg-muted text-muted-foreground border-border border-dashed',
};

export const STATUS_LEGEND: { status: CalendarEventStatus; label: string }[] = [
  { status: 'overdue', label: 'Atrasada' },
  { status: 'today', label: 'Vence hoje' },
  { status: 'upcoming', label: 'No prazo' },
  { status: 'done', label: 'Concluída' },
  { status: 'blocked', label: 'Bloqueada' },
];

const VIEW_LABELS: Record<CalendarViewMode, string> = { day: 'Dia', week: 'Semana', month: 'Mês' };

function readStoredView(key?: string): CalendarViewMode {
  if (!key) return 'month';
  try {
    const v = localStorage.getItem(key);
    if (v === 'day' || v === 'week' || v === 'month') return v;
  } catch { /* localStorage indisponível */ }
  return 'month';
}

function storeView(key: string | undefined, view: CalendarViewMode) {
  if (!key) return;
  try { localStorage.setItem(key, view); } catch { /* localStorage indisponível */ }
}

const toKey = (d: Date) => format(d, 'yyyy-MM-dd');

export function CalendarView({ events, onEventClick, onEventDrop, storageKey, emptyLabel = 'Nenhum evento' }: CalendarViewProps) {
  const [view, setView] = useState<CalendarViewMode>(() => readStoredView(storageKey));
  const [cursor, setCursor] = useState<Date>(new Date());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const changeView = (v: CalendarViewMode) => { setView(v); storeView(storageKey, v); };

  const byDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      if (!e.date) continue;
      (map[e.date] ||= []).push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title));
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    if (view === 'day') return [cursor];
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, view]);

  const title = useMemo(() => {
    if (view === 'day') return format(cursor, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (view === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 0 });
      const e = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
  }, [cursor, view]);

  const step = (dir: 1 | -1) => {
    if (view === 'day') setCursor(addDays(cursor, dir));
    else if (view === 'week') setCursor(dir === 1 ? addWeeks(cursor, 1) : subWeeks(cursor, 1));
    else setCursor(dir === 1 ? addMonths(cursor, 1) : subMonths(cursor, 1));
  };

  const dropProps = (dayKey: string) => onEventDrop ? {
    onDragOver: (e: React.DragEvent) => { if (dragId) { e.preventDefault(); setDropDay(dayKey); } },
    onDragLeave: () => setDropDay(prev => prev === dayKey ? null : prev),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropDay(null);
      const ev = events.find(x => x.id === dragId);
      setDragId(null);
      if (ev && ev.date !== dayKey) onEventDrop(ev, dayKey);
    },
  } : {};

  const EventChip = ({ event, showTime }: { event: CalendarEvent; showTime?: boolean }) => (
    <button
      type="button"
      draggable={!!onEventDrop && event.status !== 'blocked'}
      onDragStart={() => setDragId(event.id)}
      onDragEnd={() => { setDragId(null); setDropDay(null); }}
      onClick={() => onEventClick?.(event)}
      title={`${event.title}${event.subtitle ? ` — ${event.subtitle}` : ''}`}
      className={cn(
        'w-full text-left rounded-md border px-1.5 py-1 text-[11px] leading-tight transition-colors hover:brightness-95',
        STATUS_STYLES[event.status],
        dragId === event.id && 'opacity-50',
        onEventDrop && event.status !== 'blocked' && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <span className="flex items-center gap-1">
        {event.status === 'blocked'
          ? <Lock className="h-3 w-3 shrink-0" />
          : event.kind === 'onboarding'
            ? <Rocket className="h-3 w-3 shrink-0" />
            : <CheckSquare className="h-3 w-3 shrink-0" />}
        {showTime && event.time && <span className="font-mono tabular-nums">{event.time.slice(0, 5)}</span>}
        <span className="truncate font-medium">{event.title}</span>
      </span>
      {event.subtitle && <span className="block truncate opacity-80">{event.subtitle}</span>}
    </button>
  );

  const DayColumn = ({ day }: { day: Date }) => {
    const key = toKey(day);
    const list = byDay[key] || [];
    const allDay = list.filter(e => !e.time);
    const timed = list.filter(e => e.time);
    return (
      <div
        {...dropProps(key)}
        className={cn(
          'flex flex-col rounded-lg border bg-card min-h-[220px]',
          isSameDay(day, new Date()) ? 'border-primary/50' : 'border-border',
          dropDay === key && 'ring-2 ring-primary',
        )}
      >
        <div className="px-2 py-1.5 border-b border-border/60 flex items-center justify-between">
          <span className="text-xs font-semibold capitalize">
            {format(day, view === 'day' ? "EEEE, d 'de' MMMM" : 'EEEE d', { locale: ptBR })}
          </span>
          <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
        </div>
        <div className="p-2 space-y-2 flex-1">
          {allDay.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dia inteiro</p>
              {allDay.map(e => <EventChip key={e.id} event={e} />)}
            </div>
          )}
          {timed.length > 0 && (
            <div className="space-y-1">
              {timed.map(e => <EventChip key={e.id} event={e} showTime />)}
            </div>
          )}
          {list.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-6">{emptyLabel}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label="Próximo">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold capitalize ml-1">{title}</h2>
        <div className="inline-flex rounded-md border bg-muted p-1 ml-auto">
          {(['day', 'week', 'month'] as CalendarViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-sm transition-colors',
                view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {STATUS_LEGEND.map(l => (
          <span key={l.status} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('h-2.5 w-2.5 rounded-full border', STATUS_STYLES[l.status])} />
            {l.label}
          </span>
        ))}
      </div>

      {view === 'month' ? (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => (
              <div key={d} className="text-[11px] font-medium text-muted-foreground text-center uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const key = toKey(day);
              const list = byDay[key] || [];
              const isOpen = expanded === key;
              const shown = isOpen ? list : list.slice(0, 3);
              return (
                <div
                  key={key}
                  {...dropProps(key)}
                  className={cn(
                    'min-h-[110px] rounded-lg border p-1.5 flex flex-col gap-1 transition-colors',
                    isSameMonth(day, cursor) ? 'bg-card border-border' : 'bg-muted/40 border-border/50',
                    isSameDay(day, new Date()) && 'border-primary/60 ring-1 ring-primary/30',
                    dropDay === key && 'ring-2 ring-primary',
                  )}
                >
                  <span className={cn(
                    'text-[11px] font-semibold',
                    isSameDay(day, new Date()) ? 'text-primary' : isSameMonth(day, cursor) ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {format(day, 'd')}
                  </span>
                  {shown.map(e => <EventChip key={e.id} event={e} />)}
                  {list.length > 3 && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : key)}
                      className="text-[10px] text-primary hover:underline text-left"
                    >
                      {isOpen ? 'Ver menos' : `+${list.length - 3}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={cn('grid gap-2', view === 'week' ? 'grid-cols-1 md:grid-cols-4 xl:grid-cols-7' : 'grid-cols-1')}>
          {days.map(d => <DayColumn key={toKey(d)} day={d} />)}
        </div>
      )}
    </div>
  );
}

export function eventStatusForDate(dateStr: string, completed: boolean, locked?: boolean): CalendarEventStatus {
  if (locked) return 'blocked';
  if (completed) return 'done';
  const today = toKey(new Date());
  if (dateStr < today) return 'overdue';
  if (dateStr === today) return 'today';
  return 'upcoming';
}

export function isoDay(value: string | Date): string {
  return toKey(typeof value === 'string' ? parseISO(value) : value);
}
