export type ClientStatus = 'active' | 'at_risk' | 'recovery' | 'cancelled';
export type ComplexityLevel = 'A' | 'B' | 'C' | 'D';
export type ClientProfile = 'vip' | 'premium' | 'standard' | 'basic';
export type FinancialStatus = 'active_financial' | 'suspended';
export type HealthScore = 'healthy' | 'attention' | 'critical';

export type InteractionType = 'service' | 'complaint' | 'request' | 'meeting' | 'critical_issue' | 'feedback' | 'opportunity';
export type Sector = 'fiscal' | 'accounting' | 'hr' | 'corporate' | 'commercial';
export type DemandOrigin = 'client' | 'internal' | 'error' | 'preventive';
export type DemandStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved';
export type RiskType = 'operational' | 'financial' | 'relationship';
export type TaskStatus = 'pending' | 'completed';

export interface Client {
  id: string;
  name: string;
  document: string; // CPF/CNPJ
  segment: string;
  contractStartDate: string;
  csResponsible: string;
  complexity: ComplexityLevel;
  status: ClientStatus;
  profile: ClientProfile;
  financialStatus: FinancialStatus;
  healthScore: HealthScore;
  // Strategic vision
  painPoints: string;
  expectations: string;
  attentionPoints: string;
  recurringIssues: string;
  behavioralProfile: string;
  strategicNotes: string;
  // Risk
  riskReason?: string;
  riskType?: RiskType;
  riskIdentifiedDate?: string;
  actionPlan?: string;
}

export interface TimelineEntry {
  id: string;
  clientId: string;
  date: string;
  type: InteractionType;
  description: string;
  responsible: string;
  sector: Sector;
  origin: DemandOrigin;
  demandStatus: DemandStatus;
  isRelevantEvent?: boolean;
  relevantEventType?: string;
}

export interface Task {
  id: string;
  clientId: string;
  title: string;
  responsible: string;
  dueDate: string;
  scheduledTime?: string; // HH:mm
  status: TaskStatus;
  createdAt: string;
}

// Labels
export const STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Ativo',
  at_risk: 'Em Risco',
  recovery: 'Em Recuperação',
  cancelled: 'Cancelado',
};

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  A: 'A - Alta',
  B: 'B - Média-Alta',
  C: 'C - Média',
  D: 'D - Baixa',
};

export const PROFILE_LABELS: Record<ClientProfile, string> = {
  vip: 'VIP',
  premium: 'Premium',
  standard: 'Standard',
  basic: 'Básico',
};

export const PROFILE_COLORS: Record<ClientProfile, { bg: string; text: string; border: string }> = {
  vip: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/30' },
  premium: { bg: 'bg-violet-500/15', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-500/30' },
  standard: { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-500/30' },
  basic: { bg: 'bg-slate-500/15', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-500/30' },
};

export const PROFILE_ICONS: Record<ClientProfile, string> = {
  vip: '👑',
  premium: '⭐',
  standard: '●',
  basic: '○',
};

export const FINANCIAL_LABELS: Record<FinancialStatus, string> = {
  active_financial: 'Ativo',
  suspended: 'Suspenso',
};

export const HEALTH_LABELS: Record<HealthScore, string> = {
  healthy: 'Saudável',
  attention: 'Atenção',
  critical: 'Crítico',
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  service: 'Atendimento',
  complaint: 'Reclamação',
  request: 'Solicitação',
  meeting: 'Reunião',
  critical_issue: 'Problema Crítico',
  feedback: 'Feedback',
  opportunity: 'Oportunidade',
};

export const SECTOR_LABELS: Record<Sector, string> = {
  fiscal: 'Fiscal',
  accounting: 'Contábil',
  hr: 'Depto. Pessoal',
  corporate: 'Societário',
  commercial: 'Comercial',
};

export const ORIGIN_LABELS: Record<DemandOrigin, string> = {
  client: 'Cliente',
  internal: 'Interno',
  error: 'Erro',
  preventive: 'Preventivo',
};

export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_client: 'Aguardando Cliente',
  resolved: 'Resolvido',
};

export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  operational: 'Operacional',
  financial: 'Financeiro',
  relationship: 'Relacionamento',
};
