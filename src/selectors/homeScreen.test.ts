import { describe, expect, it } from 'vitest';

import {
  BreedingRecord,
  DailyLog,
  FoalingRecord,
  Mare,
  PregnancyCheck,
  estimateFoalingDate,
} from '@/models/types';
import {
  buildPregnantInfoMap,
  selectFilteredMares,
} from '@/selectors/homeScreen';

function makeMare(overrides: Partial<Mare> & { id: string; name: string }): Mare {
  return {
    breed: 'Warmblood',
    gestationLengthDays: 340,
    isRecipient: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDailyLog(overrides: Partial<DailyLog> & { id: string; mareId: string; date: string }): DailyLog {
  return {
    time: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeBreedingRecord(
  overrides: Partial<BreedingRecord> & { id: string; mareId: string; date: string },
): BreedingRecord {
  return {
    stallionId: null,
    time: null,
    method: 'liveCover',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePregnancyCheck(
  overrides: Partial<PregnancyCheck> & { id: string; mareId: string; breedingRecordId: string; date: string },
): PregnancyCheck {
  return {
    result: 'positive',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFoalingRecord(
  overrides: Partial<FoalingRecord> & { id: string; mareId: string; date: string },
): FoalingRecord {
  return {
    outcome: 'liveFoal',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildPregnantInfoMap', () => {
  it('returns pregnancy info for mares with active positive checks', () => {
    const mare = makeMare({ id: 'mare-1', name: 'Nova', gestationLengthDays: 320 });
    const breeding = makeBreedingRecord({ id: 'br-1', mareId: mare.id, date: '2025-04-15' });
    const check = makePregnancyCheck({
      id: 'pc-1',
      mareId: mare.id,
      breedingRecordId: breeding.id,
      date: '2025-05-01',
      result: 'positive',
    });
    const logs = [
      makeDailyLog({ id: 'log-1', mareId: mare.id, date: '2025-04-28', ovulationDetected: true }),
      makeDailyLog({ id: 'log-2', mareId: mare.id, date: '2025-05-05', ovulationDetected: true }),
    ];

    const result = buildPregnantInfoMap([mare], logs, [breeding], [check], [], '2025-05-10');

    expect(result.size).toBe(1);
    expect(result.get(mare.id)).toEqual({
      daysPostOvulation: 12,
      estimatedDueDate: estimateFoalingDate('2025-04-15', 320),
    });
  });

  it('excludes mare when the latest pregnancy check is negative', () => {
    const mare = makeMare({ id: 'mare-1', name: 'Nova' });
    const breeding = makeBreedingRecord({ id: 'br-1', mareId: mare.id, date: '2025-04-15' });
    const checks = [
      makePregnancyCheck({
        id: 'pc-older-positive',
        mareId: mare.id,
        breedingRecordId: breeding.id,
        date: '2025-05-01',
        result: 'positive',
      }),
      makePregnancyCheck({
        id: 'pc-latest-negative',
        mareId: mare.id,
        breedingRecordId: breeding.id,
        date: '2025-05-06',
        result: 'negative',
      }),
    ];

    const result = buildPregnantInfoMap([mare], [], [breeding], checks, [], '2025-05-10');
    expect(result.has(mare.id)).toBe(false);
  });

  it('excludes mare when foaling exists after the positive check', () => {
    const mare = makeMare({ id: 'mare-1', name: 'Nova' });
    const breeding = makeBreedingRecord({ id: 'br-1', mareId: mare.id, date: '2025-04-15' });
    const check = makePregnancyCheck({
      id: 'pc-1',
      mareId: mare.id,
      breedingRecordId: breeding.id,
      date: '2025-05-01',
      result: 'positive',
    });
    const foaling = makeFoalingRecord({
      id: 'fr-1',
      mareId: mare.id,
      date: '2025-05-02',
    });

    const result = buildPregnantInfoMap([mare], [], [breeding], [check], [foaling], '2025-05-10');
    expect(result.has(mare.id)).toBe(false);
  });
});

describe('selectFilteredMares', () => {
  it('respects pregnant/open status filters', () => {
    const mares = [
      makeMare({ id: 'mare-1', name: 'Nova' }),
      makeMare({ id: 'mare-2', name: 'Maple' }),
    ];
    const pregnantInfo = new Map([
      ['mare-1', { daysPostOvulation: 30, estimatedDueDate: '2026-10-10' }],
    ]);

    expect(selectFilteredMares(mares, '', 'pregnant', pregnantInfo)).toEqual([mares[0]]);
    expect(selectFilteredMares(mares, '', 'open', pregnantInfo)).toEqual([mares[1]]);
  });

  it('combines search text with status filtering', () => {
    const mares = [
      makeMare({ id: 'mare-1', name: 'Nova' }),
      makeMare({ id: 'mare-2', name: 'Maple' }),
      makeMare({ id: 'mare-3', name: 'Misty' }),
    ];
    const pregnantInfo = new Map([
      ['mare-1', { daysPostOvulation: 30, estimatedDueDate: '2026-10-10' }],
    ]);

    expect(selectFilteredMares(mares, 'mi', 'open', pregnantInfo)).toEqual([mares[2]]);
  });
});
