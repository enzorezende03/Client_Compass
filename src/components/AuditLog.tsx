import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText } from 'lucide-react';

// Friendly labels for DB field names
const FIELD_LABELS: Record<string, string> = {
  pain_points: 'Principais Dores',
  expectations: 'Expectativas',
  attention_points: 'Pontos de Atenção',
  recurring_issues: 'Problemas Recorrentes',
  behavioral_profile: 'Perfil Comportamental',
  strategic_notes: 'Notas Estratégicas',
  risk_reason: 'Motivo do Risco',
  action_plan: 'Plano de Ação',
  risk_type: 'Tipo de Risco',
  health_score: 'Saúde',
  financial_status: 'Status Financeiro',
  name: 'Nome',
  segment: 'Segmento',
  complexity: 'Complexidade',
  profile: 'Perfil',
  taxation: 'Tributação',
  cs_responsible: 'CS Responsável',
};

interface AuditEntry {
  id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  created_at: string;
}

interface AuditLogProps {
  clientId: string;
  refreshKey?: number;
}

export function AuditLog({ clientId, refreshKey }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setEntries(data as AuditEntry[]);
      }
      setLoading(false);
    };
    fetchLogs();
  }, [clientId, refreshKey]);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Carregando histórico...</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma alteração registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold text-foreground">
                  {FIELD_LABELS[entry.field_name] || entry.field_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              {entry.changed_by && (
                <p className="text-xs text-muted-foreground mb-2">
                  Alterado por: <span className="font-medium text-foreground">{entry.changed_by}</span>
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-destructive/5 border border-destructive/10 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Antes</p>
                  <p className="text-foreground whitespace-pre-wrap">{entry.old_value || '(vazio)'}</p>
                </div>
                <div className="rounded-md bg-primary/5 border border-primary/10 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Depois</p>
                  <p className="text-foreground whitespace-pre-wrap">{entry.new_value || '(vazio)'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
