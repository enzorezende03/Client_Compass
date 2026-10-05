import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, MessageSquareHeart, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingHandoffDialog } from '@/components/OnboardingHandoffDialog';
import { SECURITY_LABEL } from './FeedbackSurveyDialog';

const db = supabase as any;

/** Read-only view of the onboarding handoff form and feedback surveys on the client file. */
export function ClientOnboardingRecords({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const { data: form } = useQuery({
    queryKey: ['client-handoff-form', clientId],
    queryFn: async () => (await db.from('onboarding_handoff_forms').select('id, sent_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle()).data,
  });
  const { data: surveys = [] } = useQuery({
    queryKey: ['client-feedback-surveys', clientId],
    queryFn: async () => (await db.from('client_feedback_surveys').select('*').eq('client_id', clientId).order('applied_at', { ascending: false })).data || [],
  });

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Formulário de Repasse CS → Operacional</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {!form ? 'Ainda não preenchido.' : form.sent_at ? `Enviado em ${new Date(form.sent_at).toLocaleDateString('pt-BR')}` : 'Rascunho, ainda não enviado.'}
          </p>
        </div>
        {form && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><Eye className="h-3.5 w-3.5" /> Ver</Button>}
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><MessageSquareHeart className="h-4 w-4 text-primary" /> Pesquisas de feedback</p>
        {surveys.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nenhuma pesquisa registrada.</p>}
        <div className="mt-3 space-y-3">
          {surveys.map((s: any) => {
            const alert = s.nps <= 6 || s.security === 'nao';
            return (
              <div key={s.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(s.applied_at).toLocaleDateString('pt-BR')}</span>
                  <Badge variant={alert ? 'destructive' : 'secondary'}>NPS {s.nps}</Badge>
                  <Badge variant="outline">Clareza {s.clarity}/5</Badge>
                  <Badge variant="outline">Seguro(a): {SECURITY_LABEL[s.security]}</Badge>
                </div>
                {s.improvement_point && <p className="mt-2 text-xs"><strong>Poderia ter sido melhor:</strong> {s.improvement_point}</p>}
                {s.suggestion && <p className="mt-1 text-xs"><strong>Faria diferente:</strong> {s.suggestion}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <OnboardingHandoffDialog open={open} onOpenChange={setOpen} clientId={clientId} readOnly />
    </div>
  );
}
