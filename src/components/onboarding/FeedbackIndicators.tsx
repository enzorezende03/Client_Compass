import { useQuery } from '@tanstack/react-query';
import { MessageSquareHeart, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

/** NPS and clarity averages from onboarding feedback surveys of the last 90 days. */
export function FeedbackIndicators() {
  const { data } = useQuery({
    queryKey: ['onboarding-feedback-metrics'],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('onboarding_feedback_metrics', { p_days: 90 });
      return data as { count: number; nps_avg: number | null; nps_score: number | null; clarity_avg: number | null };
    },
  });
  const n = data?.count ?? 0;
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageSquareHeart className="h-3.5 w-3.5" /> NPS médio (90 dias)</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{data?.nps_avg ?? '—'}</p>
        {data?.nps_score !== null && data?.nps_score !== undefined && <p className="text-[11px] text-muted-foreground">Índice NPS: {data.nps_score}</p>}
      </Card>
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5" /> Clareza média (90 dias)</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{data?.clarity_avg ? `${data.clarity_avg} / 5` : '—'}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Pesquisas aplicadas (90 dias)</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{n}</p>
      </Card>
    </div>
  );
}
