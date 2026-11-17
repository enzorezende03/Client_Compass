import { TAXATION_LABELS, TaxationType } from '@/types/client';

/** Normaliza tanto os identificadores atuais quanto os rótulos gravados por importações antigas. */
export function normalizeTaxation(value?: string | null): TaxationType | '' {
  const key = (value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return key && Object.prototype.hasOwnProperty.call(TAXATION_LABELS, key)
    ? key as TaxationType
    : '';
}

export function getTaxationLabel(value?: string | null): string {
  const key = normalizeTaxation(value);
  return key ? TAXATION_LABELS[key] : (value?.trim() ?? '');
}

export const TAXATION_BADGE_CLASSES: Record<TaxationType, string> = {
  simples_nacional: 'border-health-healthy/30 bg-health-healthy/10 text-health-healthy',
  simples_nacional_fator_r: 'border-health-attention/30 bg-health-attention/10 text-health-attention',
  lucro_presumido: 'border-primary/30 bg-primary/10 text-primary',
  lucro_presumido_equiparacao_hospitalar: 'border-status-recovery/30 bg-status-recovery/10 text-status-recovery',
  lucro_real: 'border-ring/40 bg-ring/10 text-ring',
};
