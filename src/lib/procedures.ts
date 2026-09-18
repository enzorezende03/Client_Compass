import { supabase } from '@/integrations/supabase/client';
import type { OnboardingType } from '@/lib/onboarding';

const db = supabase as any;

export type ProcedureItemKind = 'orientacao' | 'mensagem' | 'checklist_referencia';
export type ProcedureChannel = 'whatsapp' | 'email' | 'interno';

export const ITEM_KIND_LABELS: Record<ProcedureItemKind, string> = {
  orientacao: 'Orientação',
  mensagem: 'Mensagem padrão',
  checklist_referencia: 'Referência de checklist',
};

export const CHANNEL_LABELS: Record<ProcedureChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  interno: 'Interno',
};

export interface ProcedurePhase {
  id: string;
  title: string;
  description: string;
  onboarding_type: OnboardingType | null;
  linked_stage_key: string | null;
  sort_order: number;
  active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface ProcedureItem {
  id: string;
  phase_id: string;
  kind: ProcedureItemKind;
  title: string;
  content: string;
  channel: ProcedureChannel | null;
  sort_order: number;
  active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface ProcedureHistoryRow {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  changed_by_name: string;
  created_at: string;
}

export async function fetchProcedure(): Promise<{ phases: ProcedurePhase[]; items: ProcedureItem[] }> {
  const [phases, items] = await Promise.all([
    db.from('onboarding_procedure_phases').select('*').order('sort_order').order('title'),
    db.from('onboarding_procedure_items').select('*').order('sort_order').order('title'),
  ]);
  return {
    phases: (phases.data || []) as ProcedurePhase[],
    items: (items.data || []) as ProcedureItem[],
  };
}

export interface ProcedureClientContext {
  name?: string | null;
  document?: string | null;
  cs_responsible?: string | null;
  contact_name?: string | null;
  segment?: string | null;
}

/** Placeholders {{cliente_nome}} / [NOME_CLIENTE]; chaves sem valor permanecem visíveis. */
export function applyProcedureVars(text: string, ctx?: ProcedureClientContext | null): string {
  if (!ctx) return text;
  const isSaude = /sa[uú]de|cl[íi]nic|m[ée]dic|odont|hospital|farm[áa]c/i.test(
    `${ctx.segment || ''} ${ctx.name || ''}`,
  );
  const curly: Record<string, string> = {
    cliente_nome: ctx.name || '',
    cnpj: ctx.document || '',
    responsavel: ctx.cs_responsible || '',
    contato_nome: ctx.contact_name || '',
  };
  const bracket: Record<string, string> = {
    NOME_CLIENTE: ctx.name || '',
    CNPJ_EMPRESA: ctx.document || '',
    NOME_CS: ctx.cs_responsible || '',
    NOME_CONTATO: ctx.contact_name || '',
    'SAUDE/CONTABILIDADE': isSaude ? 'Saúde' : 'Contabilidade',
  };

  return text
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (full, key: string) => curly[key.toLowerCase()] || full)
    .replace(/\[([A-Z0-9_\/]+)\]/g, (full, key: string) => bracket[key] || full);
}

export const PROCEDURE_PLACEHOLDERS = ['{{cliente_nome}}', '{{cnpj}}', '{{responsavel}}', '{{contato_nome}}'];
