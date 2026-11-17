export type Company = '2m_saude' | '2m_contabilidade';

export const COMPANY_LABELS: Record<Company, string> = {
  '2m_saude': '2M Saúde',
  '2m_contabilidade': '2M Contabilidade',
};

export function normalizeCompany(value: unknown): Company {
  return value === '2m_contabilidade' ? '2m_contabilidade' : '2m_saude';
}

export function getCompanyLabel(value: unknown): string {
  return COMPANY_LABELS[normalizeCompany(value)];
}
