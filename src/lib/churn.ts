import { supabase } from '@/integrations/supabase/client';

export type TerminationReason =
  | 'preco'
  | 'atendimento'
  | 'prazo_ou_erro_operacional'
  | 'encerramento_da_empresa'
  | 'mudanca_de_contador'
  | 'vendeu_ou_incorporou'
  | 'outro';

export const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
  preco: 'Preço',
  atendimento: 'Atendimento',
  prazo_ou_erro_operacional: 'Prazo ou erro operacional',
  encerramento_da_empresa: 'Encerramento da empresa',
  mudanca_de_contador: 'Mudança de contador',
  vendeu_ou_incorporou: 'Vendeu ou incorporou',
  outro: 'Outro',
};

export interface Termination {
  id: string;
  client_id: string;
  request_date: string;
  effective_date: string | null;
  reason_category: TerminationReason;
  reason_detail: string | null;
  monthly_fee_at_termination: number | null;
  during_onboarding: boolean;
  registered_by: string | null;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  revert_reason: string | null;
}

export interface ChurnMetrics {
  clientes_ativos_inicio: number;
  distratos_periodo: number;
  taxa_churn: number;
  receita_mensal_perdida: number;
  distratos_durante_onboarding: number;
  distratos_revertidos: number;
}

/** "2026-09" -> { start: '2026-09-01', end: '2026-09-30' } */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${month}-${String(last).padStart(2, '0')}` };
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function fetchChurnMetrics(month: string): Promise<ChurnMetrics | null> {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase.rpc('churn_metrics' as any, { p_start: start, p_end: end } as any);
  if (error || !data) return null;
  return data as unknown as ChurnMetrics;
}

export function formatBRL(v: number | null | undefined) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
