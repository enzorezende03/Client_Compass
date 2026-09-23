import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, MessageSquareQuote, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Parsed {
  typical?: string; decision?: string; area?: string; risk?: string;
  can?: string; escalate?: string; reply?: string; immediate: boolean; rest: string[];
}

function parse(notes: string): Parsed {
  const p: Parsed = { immediate: false, rest: [] };
  for (const raw of notes.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [k, ...v] = line.split(':');
    const val = v.join(':').trim();
    const key = k.trim().toLowerCase();
    if (/^resposta imediata/i.test(line)) p.immediate = true;
    else if (key === 'demanda típica') p.typical = val;
    else if (key === 'o que o cs pode fazer') p.can = val;
    else if (key === 'quando escalar') p.escalate = val;
    else if (key === 'resposta inicial sugerida') p.reply = val;
    else if (key === 'decisão') {
      const parts = line.split('·').map(s => s.trim());
      for (const part of parts) {
        const [pk, ...pv] = part.split(':');
        const pval = pv.join(':').trim();
        const pkey = pk.trim().toLowerCase();
        if (pkey === 'decisão') p.decision = pval;
        else if (pkey === 'área') p.area = pval;
        else if (pkey === 'risco') p.risk = pval;
      }
    } else p.rest.push(line);
  }
  return p;
}

function riskClass(risk?: string) {
  const r = (risk || '').toLowerCase();
  if (r.includes('alto')) return 'border-destructive/40 bg-destructive/10 text-destructive';
  if (r.includes('médio')) return 'border-health-attention/40 bg-health-attention/10 text-health-attention';
  return 'border-health-healthy/40 bg-health-healthy/10 text-health-healthy';
}

export function SlaPlaybook({ notes }: { notes: string }) {
  const p = parse(notes);
  const structured = p.can || p.escalate || p.reply || p.decision;
  if (!structured) return <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{notes}</p>;

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {p.decision && <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0">{p.decision}</Badge>}
        {p.area && <Badge variant="outline">Área: {p.area}</Badge>}
        {p.risk && <Badge variant="outline" className={riskClass(p.risk)}>Risco {p.risk}</Badge>}
        {p.immediate && <Badge variant="outline" className="border-destructive/40 text-destructive">Resposta imediata</Badge>}
      </div>

      {p.typical && (
        <p className="text-xs text-muted-foreground flex gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span><span className="font-medium text-foreground">Quando usar:</span> {p.typical}</span>
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {p.can && (
          <div className="rounded-md border border-health-healthy/30 bg-health-healthy/5 p-2.5">
            <p className="text-xs font-semibold text-health-healthy flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> O que o CS faz
            </p>
            <p className="text-xs text-foreground">{p.can}</p>
          </div>
        )}
        {p.escalate && (
          <div className="rounded-md border border-health-attention/30 bg-health-attention/5 p-2.5">
            <p className="text-xs font-semibold text-health-attention flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Escalar quando
            </p>
            <p className="text-xs text-foreground">{p.escalate}</p>
          </div>
        )}
      </div>

      {p.reply && (
        <div className="rounded-md border bg-secondary/50 p-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <MessageSquareQuote className="h-3.5 w-3.5" /> Resposta sugerida ao cliente
            </p>
            <Button
              size="sm" variant="ghost" className="h-6 px-2 text-xs"
              onClick={() => { navigator.clipboard.writeText(p.reply!); toast.success('Resposta copiada'); }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
          <p className="text-xs italic text-foreground">“{p.reply}”</p>
        </div>
      )}

      {p.rest.length > 0 && <p className="text-xs text-muted-foreground whitespace-pre-line">{p.rest.join('\n')}</p>}
    </div>
  );
}
