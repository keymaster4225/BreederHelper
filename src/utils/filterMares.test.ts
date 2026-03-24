import { describe, expect, it } from 'vitest';
import { filterMares, type StatusFilter } from './filterMares';
import { Mare, PregnancyInfo } from '@/models/types';

function makeMare(overrides: Partial<Mare> & { id: string; name: string }): Mare {
  return {
    breed: 'Thoroughbred',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const MARE_A = makeMare({ id: '1', name: 'Athena' });
const MARE_B = makeMare({ id: '2', name: 'Bella' });
const MARE_C = makeMare({ id: '3', name: 'Cleopatra' });

const pregnantIds = new Map<string, PregnancyInfo>([
  ['1', { daysPostOvulation: 30, estimatedDueDate: '2027-01-01' }],
]);

describe('filterMares', () => {
  it('returns all mares when search is empty and filter is all', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], '', 'all', pregnantIds);
    expect(result).toEqual([MARE_A, MARE_B, MARE_C]);
  });

  it('filters by name case-insensitively', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], 'bell', 'all', pregnantIds);
    expect(result).toEqual([MARE_B]);
  });

  it('filters pregnant mares only', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], '', 'pregnant', pregnantIds);
    expect(result).toEqual([MARE_A]);
  });

  it('filters open mares only', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], '', 'open', pregnantIds);
    expect(result).toEqual([MARE_B, MARE_C]);
  });

  it('combines search and status filter', () => {
    // 'cleo' matches only Cleopatra; Athena is excluded by 'open' filter (pregnant)
    const result = filterMares([MARE_A, MARE_B, MARE_C], 'cleo', 'open', pregnantIds);
    expect(result).toEqual([MARE_C]);
  });

  it('returns empty array when nothing matches', () => {
    const result = filterMares([MARE_A, MARE_B], 'zzz', 'all', pregnantIds);
    expect(result).toEqual([]);
  });
});
