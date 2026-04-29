import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UrgentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  task_id: string | null;
  created_at: string;
  read: boolean;
}

const STORAGE_KEY = 'urgent_alert_seen_ids';
const POLL_MS = 30000;

function getSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

function playBeep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.stop(ctx.currentTime + 0.45);
  } catch {}
}

export function UrgentTaskAlert() {
  const navigate = useNavigate();
  const seenRef = useRef<Set<string>>(getSeenIds());
  const [popupQueue, setPopupQueue] = useState<UrgentNotification[]>([]);
  const [current, setCurrent] = useState<UrgentNotification | null>(null);

  const goToTask = (taskId: string | null) => {
    navigate('/tarefas');
    if (taskId) {
      // store target so TaskCenter can highlight if implemented later
      sessionStorage.setItem('focus_task_id', taskId);
    }
  };

  const fetchUrgent = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data || data.length === 0) return;

    const urgentTypes = new Set(['task_overdue', 'task_due', 'task_reminder', 'task_urgent']);
    const fresh = (data as UrgentNotification[]).filter(
      (n) => !seenRef.current.has(n.id) && (urgentTypes.has(n.type) || /atras|venc|hoje|urgente|agora/i.test(n.title)),
    );

    if (fresh.length === 0) return;

    fresh.forEach((n) => seenRef.current.add(n.id));
    saveSeenIds(seenRef.current);

    // Critical = overdue or due now -> popup
    const critical = fresh.filter((n) => n.type === 'task_overdue' || n.type === 'task_due' || /atras|agora|hoje/i.test(n.title));
    const others = fresh.filter((n) => !critical.includes(n));

    if (critical.length > 0) {
      playBeep();
      setPopupQueue((q) => [...q, ...critical]);
    }

    others.forEach((n) => {
      toast(n.title, {
        description: n.message.replace(/\[deadline:[^\]]+\]\s*/g, ''),
        duration: 15000,
        icon: <Bell className="h-4 w-4 text-primary" />,
        action: {
          label: 'Ver tarefa',
          onClick: () => goToTask(n.task_id),
        },
      });
    });
  };

  useEffect(() => {
    fetchUrgent();
    const interval = setInterval(fetchUrgent, POLL_MS);

    // Realtime: react instantly to new notifications
    const channel = supabase
      .channel('urgent-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => fetchUrgent(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the popup queue
  useEffect(() => {
    if (!current && popupQueue.length > 0) {
      setCurrent(popupQueue[0]);
      setPopupQueue((q) => q.slice(1));
    }
  }, [popupQueue, current]);

  const dismiss = async () => {
    if (current) {
      await supabase.from('notifications').update({ read: true } as any).eq('id', current.id);
    }
    setCurrent(null);
  };

  const open = !!current;
  const isOverdue = current?.type === 'task_overdue' || /atras/i.test(current?.title || '');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="border-2 border-destructive/60 shadow-2xl">
        <DialogHeader>
          <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${isOverdue ? 'bg-destructive/15 animate-pulse' : 'bg-primary/15'}`}>
            {isOverdue ? (
              <AlertTriangle className="h-7 w-7 text-destructive" />
            ) : (
              <Clock className="h-7 w-7 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {isOverdue ? '⚠️ Tarefa atrasada!' : '🔔 Tarefa no horário!'}
          </DialogTitle>
          <DialogDescription className="text-center text-base font-medium text-foreground">
            {current?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          {current?.message.replace(/\[deadline:[^\]]+\]\s*/g, '')}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss}>
            Dispensar
          </Button>
          <Button
            onClick={() => {
              const taskId = current?.task_id ?? null;
              dismiss();
              goToTask(taskId);
            }}
          >
            Ver tarefa agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
