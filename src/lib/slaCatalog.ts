export const SLA_SECTORS = ['Fiscal', 'Contábil', 'DP', 'Societário', 'Comercial', 'Financeiro', 'CS', 'Geral'] as const;
export type SlaSector = typeof SLA_SECTORS[number];

export const SLA_UNITS = ['horas', 'dias_uteis', 'dias_corridos'] as const;
export type SlaUnit = typeof SLA_UNITS[number];

export const SLA_UNIT_LABELS: Record<SlaUnit, { singular: string; plural: string }> = {
  horas: { singular: 'hora', plural: 'horas' },
  dias_uteis: { singular: 'dia útil', plural: 'dias úteis' },
  dias_corridos: { singular: 'dia corrido', plural: 'dias corridos' },
};

export interface SlaCatalogRow {
  id: string;
  sector: SlaSector;
  demand_name: string;
  sla_value: number;
  sla_unit: SlaUnit;
  notes: string;
  active: boolean;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlaHistoryRow {
  id: string;
  catalog_id: string | null;
  sector: string;
  demand_name: string;
  action: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by_name: string;
  created_at: string;
}

export function formatSla(value: number, unit: SlaUnit): string {
  const labels = SLA_UNIT_LABELS[unit];
  const n = Number(value);
  const pretty = Number.isInteger(n) ? String(n) : n.toString().replace('.', ',');
  return `${pretty} ${n === 1 ? labels.singular : labels.plural}`;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function parseSector(raw: string): SlaSector | null {
  const n = normalize(raw);
  return SLA_SECTORS.find(s => normalize(s) === n) || null;
}

export function parseUnit(raw: string): SlaUnit | null {
  const n = normalize(raw);
  if (['hora', 'horas', 'h'].includes(n)) return 'horas';
  if (['dia util', 'dias uteis', 'dia uteis', 'uteis', 'du'].includes(n)) return 'dias_uteis';
  if (['dia corrido', 'dias corridos', 'corridos', 'dia', 'dias', 'dc'].includes(n)) return 'dias_corridos';
  return null;
}

export interface ImportRow {
  line: number;
  sector: SlaSector | null;
  demand_name: string;
  sla_value: number | null;
  sla_unit: SlaUnit | null;
  notes: string;
  errors: string[];
}

/** Valida uma linha da planilha importada. */
export function validateImportRow(raw: Record<string, unknown>, line: number): ImportRow {
  const get = (...keys: string[]) => {
    for (const k of Object.keys(raw)) {
      if (keys.some(target => normalize(k) === normalize(target))) {
        const v = raw[k];
        return v === null || v === undefined ? '' : String(v).trim();
      }
    }
    return '';
  };

  const sectorRaw = get('setor', 'sector');
  const demand = get('demanda', 'demand', 'demand_name');
  const valueRaw = get('prazo', 'sla', 'sla_value', 'valor');
  const unitRaw = get('unidade', 'unit', 'sla_unit');
  const notes = get('observacao', 'observação', 'obs', 'notes');

  const errors: string[] = [];
  const sector = parseSector(sectorRaw);
  if (!sectorRaw) errors.push('Setor não informado');
  else if (!sector) errors.push(`Setor inválido: "${sectorRaw}"`);

  if (!demand) errors.push('Demanda não informada');

  const value = Number(valueRaw.replace(',', '.'));
  const slaValue = valueRaw && !Number.isNaN(value) && value > 0 ? value : null;
  if (!valueRaw) errors.push('Prazo não informado');
  else if (slaValue === null) errors.push(`Prazo inválido: "${valueRaw}"`);

  const unit = parseUnit(unitRaw);
  if (!unitRaw) errors.push('Unidade não informada');
  else if (!unit) errors.push(`Unidade inválida: "${unitRaw}" (use horas, dias úteis ou dias corridos)`);

  return { line, sector, demand_name: demand, sla_value: slaValue, sla_unit: unit, notes, errors };
}
