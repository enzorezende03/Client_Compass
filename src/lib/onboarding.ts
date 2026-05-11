import { supabase } from '@/integrations/supabase/client';

export const STAGES = ['etapa_1', 'etapa_2', 'etapa_3', 'etapa_4', 'concluido'] as const;
export type OnboardingStage = typeof STAGES[number];

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  etapa_1: 'Etapa 1 — Boas-vindas',
  etapa_2: 'Etapa 2 — Diagnóstico',
  etapa_3: 'Etapa 3 — Integração',
  etapa_4: 'Etapa 4 — Acompanhamento',
  concluido: 'Concluído',
};

export const STAGE_SHORT: Record<OnboardingStage, string> = {
  etapa_1: 'Boas-vindas',
  etapa_2: 'Diagnóstico',
  etapa_3: 'Integração',
  etapa_4: 'Acompanhamento',
  concluido: 'Concluído',
};

export interface ChecklistItem {
  id: string;
  stage: string;
  order_index: number;
  title: string;
  sla_hours: number;
  is_required: boolean;
}

export interface ProgressRow {
  id: string;
  client_id: string;
  checklist_item_id: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
}

export const MESSAGE_TEMPLATES: Record<string, { title: string; text: string }[]> = {
  etapa_1: [
    {
      title: 'Boas-vindas',
      text: 'Olá! Seja muito bem-vindo(a) à 2M Saúde & Contabilidade. Sou {seu_nome}, do time de Customer Success, e serei seu ponto de contato durante todo o onboarding. Em breve te envio a lista de documentos e acessos iniciais. Qualquer dúvida, é só chamar por aqui!',
    },
    {
      title: 'Solicitação de documentos',
      text: 'Para iniciarmos seu cadastro, precisamos dos seguintes documentos:\n\n• Contrato social atualizado\n• Cartão CNPJ\n• Últimos balancetes\n• Acessos a sistemas (Sefaz, Receita, eSocial)\n\nPode nos enviar por aqui mesmo. Obrigado!',
    },
  ],
  etapa_2: [
    {
      title: 'Procuração eletrônica',
      text: 'Segue o link da procuração eletrônica para que possamos atuar nos órgãos em seu nome. O processo é 100% digital via gov.br. Qualquer dificuldade, me chama que ajudo no passo a passo.',
    },
    {
      title: 'Pós-procuração',
      text: 'Procuração validada com sucesso! Agora seguiremos com o diagnóstico fiscal e contábil. Em até 5 dias úteis te trazemos o panorama completo da sua operação.',
    },
  ],
  etapa_3: [
    {
      title: 'Pós-reunião de integração',
      text: 'Foi ótimo nosso alinhamento hoje! Conforme combinado, sua operação já está integrada ao nosso sistema. A partir de agora, o time operacional assume a rotina e eu sigo acompanhando estrategicamente. Qualquer ponto crítico, fale comigo.',
    },
  ],
  etapa_4: [
    {
      title: 'Follow-up 7 dias',
      text: 'Olá! Já se passou uma semana desde nosso início e queria saber: como tem sido sua experiência? Tem algum ponto que podemos melhorar? Sua opinião é fundamental para garantirmos uma parceria duradoura.',
    },
  ],
};

/** SLA tone based on hours elapsed since item creation vs sla_hours */
export function slaTone(createdAt: string, slaHours: number, completedAt?: string | null) {
  if (completedAt) return { color: 'bg-emerald-500', label: 'Concluído', tone: 'green' as const };
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  const remaining = slaHours - elapsed;
  if (remaining <= 0) return { color: 'bg-red-500', label: 'SLA estourado', tone: 'red' as const };
  if (remaining / slaHours <= 0.2) return { color: 'bg-orange-500', label: 'SLA próximo', tone: 'orange' as const };
  return { color: 'bg-emerald-500', label: 'No prazo', tone: 'green' as const };
}

export function aggregateSlaTone(progress: { created_at: string; completed_at: string | null; sla_hours: number }[]): 'green' | 'orange' | 'red' {
  let worst: 'green' | 'orange' | 'red' = 'green';
  for (const p of progress) {
    const t = slaTone(p.created_at, p.sla_hours, p.completed_at).tone;
    if (t === 'red') return 'red';
    if (t === 'orange') worst = 'orange';
  }
  return worst;
}

export function nextStage(stage: string | null | undefined): OnboardingStage | null {
  const idx = STAGES.indexOf((stage || 'etapa_1') as OnboardingStage);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

async function getCurrentInternalUserId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from('internal_users')
    .select('id, name')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  return data?.id ?? null;
}

async function getCurrentInternalUser(): Promise<{ id: string; name: string } | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from('internal_users')
    .select('id, name')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  return data ?? null;
}

/** Creates progress rows + tasks for the given stage's checklist items. */
async function seedStage(clientId: string, stage: OnboardingStage, clientName: string) {
  const { data: items } = await supabase
    .from('onboarding_checklist_items')
    .select('*')
    .eq('stage', stage)
    .order('order_index');
  if (!items?.length) return;

  // create progress rows (idempotent via UNIQUE)
  const progressRows = items.map(it => ({
    client_id: clientId,
    checklist_item_id: it.id,
    status: 'pendente',
  }));
  await supabase.from('client_onboarding_progress').upsert(progressRows, {
    onConflict: 'client_id,checklist_item_id',
    ignoreDuplicates: true,
  } as any);

  // create tasks (one per item) — internal_due_date = today + ceil(sla_hours/24) days
  const user = await getCurrentInternalUser();
  const taskRows = items.map(it => {
    const days = Math.max(1, Math.ceil(it.sla_hours / 24));
    const due = new Date();
    due.setDate(due.getDate() + days);
    return {
      client_id: clientId,
      title: `[Onboarding] ${it.title}`,
      description: `Item de onboarding (${STAGE_SHORT[stage]}) — SLA: ${it.sla_hours}h`,
      responsible: user?.name ?? '',
      responsible_id: user?.id ?? null,
      due_date: due.toISOString().split('T')[0],
      internal_due_date: due.toISOString().split('T')[0],
      status: 'pending',
    };
  });
  if (taskRows.length) await supabase.from('tasks').insert(taskRows);
}

export async function startOnboarding(clientId: string, clientName: string) {
  const now = new Date().toISOString();
  await supabase.from('clients').update({
    onboarding_status: 'em_andamento',
    onboarding_stage: 'etapa_1',
    onboarding_started_at: now,
  }).eq('id', clientId);
  await seedStage(clientId, 'etapa_1', clientName);
  await supabase.from('timeline_entries').insert({
    client_id: clientId,
    type: 'service',
    description: '[Onboarding] Iniciado — Etapa 1: Boas-vindas começou',
    responsible: 'CS',
    sector: 'commercial',
    origin: 'internal',
    demand_status: 'in_progress',
    is_relevant_event: true,
    relevant_event_type: 'onboarding',
  });
}

export async function advanceStage(clientId: string, currentStage: OnboardingStage, clientName: string) {
  const next = nextStage(currentStage);
  if (!next) return;
  if (next === 'concluido') {
    await supabase.from('clients').update({
      onboarding_status: 'concluido',
      onboarding_stage: 'concluido',
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', clientId);
    await supabase.from('timeline_entries').insert({
      client_id: clientId,
      type: 'service',
      description: '[Onboarding] Concluído — Cliente migrado para atendimento regular',
      responsible: 'CS',
      sector: 'commercial',
      origin: 'internal',
      demand_status: 'resolved',
      is_relevant_event: true,
      relevant_event_type: 'onboarding',
    });
    return;
  }
  await supabase.from('clients').update({ onboarding_stage: next }).eq('id', clientId);
  await seedStage(clientId, next, clientName);
  const stageNum = (s: string) => Number(s.replace('etapa_', ''));
  await supabase.from('timeline_entries').insert({
    client_id: clientId,
    type: 'service',
    description: `[Onboarding] Etapa ${stageNum(currentStage)} concluída → avançou para Etapa ${stageNum(next)}`,
    responsible: 'CS',
    sector: 'commercial',
    origin: 'internal',
    demand_status: 'in_progress',
    is_relevant_event: true,
    relevant_event_type: 'onboarding',
  });
}

export async function toggleChecklistItem(
  progressId: string,
  clientId: string,
  itemTitle: string,
  done: boolean,
) {
  const userId = await getCurrentInternalUserId();
  await supabase.from('client_onboarding_progress').update({
    status: done ? 'concluido' : 'pendente',
    completed_at: done ? new Date().toISOString() : null,
    completed_by: done ? userId : null,
  }).eq('id', progressId);

  if (done) {
    await supabase.from('timeline_entries').insert({
      client_id: clientId,
      type: 'service',
      description: `[Onboarding] Item concluído: ${itemTitle}`,
      responsible: 'CS',
      sector: 'commercial',
      origin: 'internal',
      demand_status: 'resolved',
      is_relevant_event: false,
    });
  }
}

export async function updateProgressNotes(progressId: string, notes: string) {
  await supabase.from('client_onboarding_progress').update({ notes }).eq('id', progressId);
}
