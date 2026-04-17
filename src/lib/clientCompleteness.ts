// Calculates completeness % of a client record (0-100)
// Considers strategic fields. Risk fields are optional and excluded.

const REQUIRED_FIELDS = [
  'name',
  'document',
  'segment',
  'contract_start_date',
  'cs_responsible',
  'complexity',
  'status',
  'profile',
  'financial_status',
  'health_score',
  'taxation',
  'pain_points',
  'expectations',
  'attention_points',
  'recurring_issues',
  'behavioral_profile',
  'strategic_notes',
] as const;

export function computeCompleteness(client: Record<string, any>, contactsCount = 0): number {
  let filled = 0;
  const total = REQUIRED_FIELDS.length + 1; // +1 for at least one contact

  REQUIRED_FIELDS.forEach((field) => {
    const v = client?.[field];
    if (v !== null && v !== undefined && String(v).trim() !== '') filled += 1;
  });

  if (contactsCount > 0) filled += 1;

  return Math.round((filled / total) * 100);
}

export function completenessTone(pct: number): {
  label: string;
  badgeClass: string;
  barClass: string;
} {
  if (pct >= 90) {
    return {
      label: 'Completo',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      barClass: 'bg-emerald-500',
    };
  }
  if (pct >= 60) {
    return {
      label: 'Em progresso',
      badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
      barClass: 'bg-sky-500',
    };
  }
  return {
    label: 'Incompleto',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    barClass: 'bg-amber-500',
  };
}
