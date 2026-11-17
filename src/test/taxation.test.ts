import { describe, expect, it } from 'vitest';
import { getTaxationLabel, normalizeTaxation } from '@/lib/taxation';

describe('tributação', () => {
  it('inclui Lucro Real como opção canônica', () => {
    expect(normalizeTaxation('lucro_real')).toBe('lucro_real');
    expect(getTaxationLabel('lucro_real')).toBe('Lucro Real');
  });

  it('reconhece Lucro Real digitado como rótulo', () => {
    expect(normalizeTaxation('Lucro Real')).toBe('lucro_real');
  });

  it('reconhece rótulos antigos com espaços e acentos', () => {
    expect(normalizeTaxation('Lucro Presumido ')).toBe('lucro_presumido');
    expect(normalizeTaxation('Lucro Presumido Equiparação Hospitalar')).toBe('lucro_presumido_equiparacao_hospitalar');
  });

  it('mantém tributação vazia sem seleção', () => {
    expect(normalizeTaxation('')).toBe('');
    expect(getTaxationLabel('')).toBe('');
  });
});
