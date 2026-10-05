import { useState } from 'react';
import { Loader2, Star, MessageSquareHeart, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const db = supabase as any;
export const SECURITY_LABEL: Record<string, string> = { sim: 'Sim', parcialmente: 'Parcialmente', nao: 'Não' };

export function FeedbackSurveyDialog({ open, onOpenChange, clientId, office, onSaved, onSuggestActionPlan }: {
  open: boolean; onOpenChange: (o: boolean) => void; clientId: string; office: string;
  onSaved?: () => void; onSuggestActionPlan?: () => void;
}) {
  const { toast } = useToast();
  const [nps, setNps] = useState<number | null>(null);
  const [clarity, setClarity] = useState(0);
  const [improvement, setImprovement] = useState('');
  const [security, setSecurity] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(false);

  const reset = () => { setNps(null); setClarity(0); setImprovement(''); setSecurity(''); setSuggestion(''); setAlert(false); };

  const save = async () => {
    if (nps === null || !clarity || !security) {
      toast({ title: 'Responda as perguntas 1, 2 e 4', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: me } = await db.rpc('current_internal_user_id');
    const { error } = await db.from('client_feedback_surveys').insert({
      client_id: clientId, applied_by: me ?? null, nps, clarity, security,
      improvement_point: improvement.trim(), suggestion: suggestion.trim(),
    });
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Pesquisa registrada' });
    onSaved?.();
    if (nps <= 6 || security === 'nao') setAlert(true);
    else { reset(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquareHeart className="h-5 w-5 text-primary" /> Pesquisa de feedback — 30 dias</DialogTitle>
          <DialogDescription>Registre as respostas do cliente. O item só é concluído com a pesquisa registrada.</DialogDescription>
        </DialogHeader>

        {alert ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Ponto de atenção</p>
            <p className="text-sm text-foreground">
              {nps !== null && nps <= 6 ? `Nota de recomendação ${nps}. ` : ''}
              {security === 'nao' ? 'O cliente não se sente seguro(a) com a contabilidade. ' : ''}
              O responsável foi avisado. Recomendamos criar um plano de ação.
            </p>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
              {onSuggestActionPlan && <Button onClick={() => { reset(); onOpenChange(false); onSuggestActionPlan(); }}>Criar plano de ação</Button>}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5 py-1">
            <div>
              <Label>1. De 0 a 10, qual a probabilidade de você recomendar {office} a um colega ou parceiro de negócio? *</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Array.from({ length: 11 }, (_, n) => (
                  <Button key={n} type="button" size="sm" variant={nps === n ? 'default' : 'outline'} className="h-9 w-9 p-0" onClick={() => setNps(n)}>{n}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label>2. Como você avalia a clareza das informações recebidas até agora? *</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setClarity(n)} aria-label={`${n} estrelas`}>
                    <Star className={cn('h-7 w-7', n <= clarity ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>3. Houve algum ponto do processo de integração que poderia ter sido melhor?</Label>
              <Textarea className="mt-1.5" value={improvement} maxLength={2000} onChange={e => setImprovement(e.target.value)} />
            </div>
            <div>
              <Label>4. Você se sente seguro(a) sobre como funciona a sua contabilidade conosco? *</Label>
              <div className="flex gap-2 mt-2">
                {Object.entries(SECURITY_LABEL).map(([k, l]) => (
                  <Button key={k} type="button" size="sm" variant={security === k ? 'default' : 'outline'} onClick={() => setSecurity(k)}>{l}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label>5. Tem algo que você gostaria que a gente fizesse diferente?</Label>
              <Textarea className="mt-1.5" value={suggestion} maxLength={2000} onChange={e => setSuggestion(e.target.value)} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Registrar pesquisa</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
