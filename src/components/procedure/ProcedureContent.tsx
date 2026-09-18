import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  applyProcedureVars, CHANNEL_LABELS, ITEM_KIND_LABELS,
  type ProcedureClientContext, type ProcedureItem, type ProcedurePhase,
} from '@/lib/procedures';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm text-foreground leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Conteúdo copiado');
}

interface Props {
  phase: ProcedurePhase;
  items: ProcedureItem[];
  clientContext?: ProcedureClientContext | null;
}

export function PhaseContent({ phase, items, clientContext }: Props) {
  const orientations = items.filter(i => i.active && i.kind !== 'mensagem');
  const messages = items.filter(i => i.active && i.kind === 'mensagem');

  return (
    <div className="space-y-5">
      {phase.description && (
        <div className="rounded-md border bg-card p-4">
          <Markdown>{applyProcedureVars(phase.description, clientContext)}</Markdown>
        </div>
      )}

      {orientations.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orientações</h3>
          {orientations.map(item => (
            <div key={item.id} className="rounded-md border bg-card p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <Badge variant="outline" className="text-xs">{ITEM_KIND_LABELS[item.kind]}</Badge>
              </div>
              <Markdown>{applyProcedureVars(item.content, clientContext)}</Markdown>
            </div>
          ))}
        </section>
      )}

      {messages.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagens padrão</h3>
          {messages.map(item => {
            const filled = applyProcedureVars(item.content, clientContext);
            return (
              <div key={item.id} className="rounded-md border bg-card p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    {item.channel && <Badge variant="secondary" className="text-xs">{CHANNEL_LABELS[item.channel]}</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs shrink-0" onClick={() => copyText(filled)}>
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{filled}</p>
              </div>
            );
          })}
        </section>
      )}

      {!phase.description && !orientations.length && !messages.length && (
        <p className="text-sm text-muted-foreground">Esta fase ainda não tem conteúdo cadastrado.</p>
      )}
    </div>
  );
}
