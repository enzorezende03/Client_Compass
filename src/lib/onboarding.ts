import { supabase } from '@/integrations/supabase/client';

export const STAGES = ['etapa_1', 'etapa_2', 'etapa_3', 'etapa_4', 'concluido'] as const;
export type OnboardingStage =
  | 'etapa_1' | 'etapa_2' | 'etapa_3' | 'etapa_4' | 'concluido'
  | 'constituicao' | 'etapa_1_nova' | 'etapa_2_nova' | 'etapa_3_nova'
  | 'vmk_ativacao';

export type OnboardingType = 'empresa_existente' | 'empresa_nova' | 'em_constituicao' | 'vmk_parceria';

export const STAGES_EXISTING: OnboardingStage[] = ['etapa_1', 'etapa_2', 'etapa_3', 'etapa_4', 'concluido'];
export const STAGES_NOVA: OnboardingStage[] = ['constituicao', 'etapa_1_nova', 'etapa_2_nova', 'etapa_3_nova', 'concluido'];
export const STAGES_CONSTITUICAO: OnboardingStage[] = ['constituicao', 'concluido'];
export const STAGES_VMK: OnboardingStage[] = ['constituicao', 'vmk_ativacao', 'concluido'];

export function stagesForType(type: OnboardingType): OnboardingStage[] {
  if (type === 'empresa_nova') return STAGES_NOVA;
  if (type === 'em_constituicao') return STAGES_NOVA; // shows constituição alongside the new-company flow
  if (type === 'vmk_parceria') return STAGES_VMK;
  return STAGES_EXISTING;
}

export const ONBOARDING_TYPE_LABELS: Record<OnboardingType, string> = {
  empresa_existente: 'Empresa Existente',
  empresa_nova: 'Empresa Nova',
  em_constituicao: 'Em Constituição',
  vmk_parceria: 'Parceria VMk',
};

export const ONBOARDING_TYPE_BADGE: Record<OnboardingType, string> = {
  empresa_existente: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  empresa_nova: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  em_constituicao: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  vmk_parceria: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
};

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  etapa_1: 'Etapa 1 — Boas-vindas',
  etapa_2: 'Etapa 2 — Diagnóstico',
  etapa_3: 'Etapa 3 — Integração',
  etapa_4: 'Etapa 4 — Acompanhamento',
  constituicao: 'Constituição',
  etapa_1_nova: 'Etapa 1 — Cadastro',
  etapa_2_nova: 'Etapa 2 — Onboarding',
  etapa_3_nova: 'Etapa 3 — Acompanhamento 60d',
  vmk_ativacao: 'Ativação VMk',
  concluido: 'Concluído',
};

export const STAGE_SHORT: Record<OnboardingStage, string> = {
  etapa_1: 'Boas-vindas',
  etapa_2: 'Diagnóstico',
  etapa_3: 'Integração',
  etapa_4: 'Acompanhamento',
  constituicao: 'Constituição',
  etapa_1_nova: 'Cadastro',
  etapa_2_nova: 'Onboarding',
  etapa_3_nova: 'Acomp. 60d',
  vmk_ativacao: 'Ativação VMk',
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

export interface MessageTemplate {
  id: string;
  onboarding_type: string;
  stage: string;
  moment: string;
  title: string;
  content: string;
  variables: string[];
}

/** Replace [VAR] placeholders with values from the provided map; missing keys remain as [VAR]. */
export function applyTemplateVars(text: string, vars: Record<string, string | undefined | null>): string {
  return text.replace(/\[([A-Z0-9_\/]+)\]/g, (full, key) => {
    const v = vars[key];
    return v != null && v !== '' ? String(v) : full;
  });
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

export function nextStage(stage: string | null | undefined, type: OnboardingType = 'empresa_existente'): OnboardingStage | null {
  const list = stagesForType(type);
  const idx = list.indexOf((stage || list[0]) as OnboardingStage);
  if (idx < 0 || idx >= list.length - 1) return null;
  return list[idx + 1];
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

  // create tasks (one per item) — idempotent: skip items that already have a task.
  // Each task is linked to its checklist item so both panels stay in sync.
  const { data: existing } = await supabase
    .from('tasks')
    .select('checklist_item_id')
    .eq('client_id', clientId)
    .not('checklist_item_id', 'is', null);
  const existingItemIds = new Set((existing || []).map((t: any) => t.checklist_item_id));

  const user = await getCurrentInternalUser();
  const taskRows = items
    .filter(it => !existingItemIds.has(it.id))
    .map(it => {
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
        category: 'onboarding',
        onboarding_stage: stage,
        checklist_item_id: it.id,
      };
    });
  if (taskRows.length) await supabase.from('tasks').insert(taskRows);
}

/**
 * Moves a client to a target Kanban stage (manual drag-and-drop).
 * The DB triggers handle seeding the new stage's items and marking prior
 * stages as completed; here we only set the stage / completion status.
 */
export async function moveClientToStage(
  clientId: string,
  targetStage: OnboardingStage,
) {
  if (targetStage === 'concluido') {
    await supabase.from('clients').update({
      onboarding_status: 'completed',
      onboarding_stage: 'concluido',
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', clientId);
  } else {
    await supabase.from('clients').update({
      onboarding_status: 'active',
      onboarding_stage: targetStage,
      onboarding_completed_at: null,
    }).eq('id', clientId);
  }
}

export async function startOnboarding(
  clientId: string,
  clientName: string,
  type: OnboardingType = 'empresa_existente',
) {
  const now = new Date().toISOString();

  // VMk-partnership clients always run on the "Parceria VMk" flow.
  // If they're still being constituted, keep the "constituicao" stage; otherwise go to "vmk_ativacao".
  const { data: clientPre } = await supabase
    .from('clients').select('parceria').eq('id', clientId).maybeSingle();
  const isVmk = (clientPre as any)?.parceria === 'vmk';

  const effectiveType: OnboardingType = isVmk ? 'vmk_parceria' : type;

  const stage: OnboardingStage = isVmk
    ? (type === 'em_constituicao' ? 'constituicao' : 'vmk_ativacao')
    : type === 'empresa_nova' ? 'etapa_1_nova'
    : type === 'em_constituicao' ? 'constituicao'
    : type === 'vmk_parceria' ? 'vmk_ativacao'
    : 'etapa_1';

  await supabase.from('clients').update({
    onboarding_status: 'active',
    onboarding_stage: stage,
    onboarding_type: effectiveType,
    onboarding_started_at: now,
  } as any).eq('id', clientId);
  await seedStage(clientId, stage, clientName);
  await supabase.from('timeline_entries').insert({
    client_id: clientId,
    type: 'service',
    description: `[Onboarding] Iniciado — ${STAGE_LABELS[stage]} (${ONBOARDING_TYPE_LABELS[effectiveType]})`,
    responsible: 'CS',
    sector: 'commercial',
    origin: 'internal',
    demand_status: 'in_progress',
    is_relevant_event: true,
    relevant_event_type: 'onboarding',
  });
}

/**
 * Cancels/deletes an in-progress onboarding so it can be recreated correctly
 * (e.g. created with the wrong type). Clears onboarding fields on the client,
 * removes the checklist progress rows and the auto-generated onboarding tasks.
 * The client is set back to "pending_onboarding" so a new onboarding can be started.
 */
export async function cancelOnboarding(clientId: string, clientName: string) {
  // remove checklist progress rows
  await supabase.from('client_onboarding_progress').delete().eq('client_id', clientId);
  // remove auto-generated onboarding tasks
  await supabase.from('tasks').delete().eq('client_id', clientId).eq('category', 'onboarding');
  // reset client onboarding state
  await supabase.from('clients').update({
    onboarding_status: 'pending_onboarding',
    onboarding_stage: null,
    onboarding_type: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
  } as any).eq('id', clientId);

  await supabase.from('timeline_entries').insert({
    client_id: clientId,
    type: 'service',
    description: `[Onboarding] Onboarding excluído — fluxo cancelado para recriação`,
    responsible: 'CS',
    sector: 'commercial',
    origin: 'internal',
    demand_status: 'resolved',
    is_relevant_event: true,
    relevant_event_type: 'onboarding',
  });
}

/**
 * Converts an "em_constituicao" client once CNPJ is received.
 * VMk-partnership clients (parceria = 'vmk') go to the "vmk_parceria" flow
 * (stage "vmk_ativacao"); all others go to "empresa_nova" (stage "etapa_1_nova").
 */
export async function convertConstitutionToNewCompany(
  clientId: string,
  clientName: string,
  newCnpj: string,
) {
  // Determine partnership to choose the correct destination flow.
  const { data: clientPre } = await supabase
    .from('clients').select('cs_responsible, parceria').eq('id', clientId).maybeSingle();
  const isVmk = (clientPre as any)?.parceria === 'vmk';

  const targetType: OnboardingType = isVmk ? 'vmk_parceria' : 'empresa_nova';
  const targetStage: OnboardingStage = isVmk ? 'vmk_ativacao' : 'etapa_1_nova';
  const flowLabel = isVmk ? 'Parceria VMk' : 'Empresa Nova';

  await supabase.from('clients').update({
    onboarding_type: targetType,
    onboarding_stage: targetStage,
    document: newCnpj,
  } as any).eq('id', clientId);

  await seedStage(clientId, targetStage, clientName);

  await supabase.from('timeline_entries').insert({
    client_id: clientId,
    type: 'service',
    description: `[Onboarding] Cliente convertido de Constituição para ${flowLabel} — CNPJ ${newCnpj}`,
    responsible: 'CS',
    sector: 'commercial',
    origin: 'internal',
    demand_status: 'in_progress',
    is_relevant_event: true,
    relevant_event_type: 'onboarding',
  });

  // notify Coordenador Geral + CS responsible
  const csResponsible = (clientPre as any)?.cs_responsible;
  const recipients = await supabase
    .from('internal_users')
    .select('id, name, access_profile')
    .eq('active', true);
  const targets = (recipients.data || []).filter((u: any) =>
    u.access_profile === 'coordenador_geral' || u.access_profile === 'admin' ||
    (csResponsible && u.name === csResponsible)
  );
  if (targets.length) {
    await supabase.from('notifications').insert(
      targets.map((u: any) => ({
        user_id: u.id,
        type: 'onboarding_conversion',
        title: `Cliente convertido para ${flowLabel}`,
        message: `${clientName} recebeu CNPJ (${newCnpj}) e entrou no onboarding de ${flowLabel}.`,
      }))
    );
  }
}

export async function advanceStage(
  clientId: string,
  currentStage: OnboardingStage,
  clientName: string,
  type: OnboardingType = 'empresa_existente',
) {
  const next = nextStage(currentStage, type);
  if (!next) return;
  if (next === 'concluido') {
    await supabase.from('clients').update({
      onboarding_status: 'completed',
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
  await supabase.from('timeline_entries').insert({
    client_id: clientId,
    type: 'service',
    description: `[Onboarding] ${STAGE_LABELS[currentStage]} concluída → ${STAGE_LABELS[next]}`,
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
