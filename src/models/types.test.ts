import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GESTATION_LENGTH_DAYS,
  calculateDaysPostBreeding,
  estimateFoalingDate,
  findCurrentPregnancyCheck,
  findMostRecentOvulationDate,
  buildPregnancyInfoForCheck,
} from './types';
import type { BreedingRecord, DailyLog, FoalingRecord, PregnancyCheck } from './types';

describe('estimateFoalingDate', () => {
  it('adds 340 days to the breeding date', () => {
    // 2026-01-01 + 340 days = 2026-12-07
    expect(estimateFoalingDate('2026-01-01', DEFAULT_GESTATION_LENGTH_DAYS)).toBe('2026-12-07');
  });

  it('handles year boundary crossing', () => {
    // 2026-03-01 + 340 days = 2027-02-04
    expect(estimateFoalingDate('2026-03-01', DEFAULT_GESTATION_LENGTH_DAYS)).toBe('2027-02-04');
  });

  it('handles leap year crossing', () => {
    // 2027-05-01 + 340 days = 2028-04-05 (2028 is a leap year)
    expect(estimateFoalingDate('2027-05-01', DEFAULT_GESTATION_LENGTH_DAYS)).toBe('2028-04-05');
  });

  it('supports mare-specific gestation lengths', () => {
    expect(estimateFoalingDate('2026-03-01', 320)).toBe('2027-01-15');
  });
});

describe('calculateDaysPostBreeding', () => {
  it('returns correct day count for normal dates', () => {
    expect(calculateDaysPostBreeding('2026-03-15', '2026-03-01')).toBe(14);
  });

  it('returns 0 for same-day dates', () => {
    expect(calculateDaysPostBreeding('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('handles DST spring-forward transition correctly', () => {
    // US DST spring-forward 2026 is March 8.
    // 2026-03-07 → 2026-03-09 should be exactly 2 days.
    expect(calculateDaysPostBreeding('2026-03-09', '2026-03-07')).toBe(2);
  });
});

function makeDailyLog(overrides: Partial<DailyLog> & { date: string }): DailyLog {
  return {
    id: overrides.id ?? `log-${overrides.date}`,
    mareId: overrides.mareId ?? 'mare-1',
    date: overrides.date,
    ovulationDetected: overrides.ovulationDetected ?? null,
    teasingScore: null,
    rightOvary: null,
    leftOvary: null,
    edema: null,
    uterineTone: null,
    uterineCysts: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('findMostRecentOvulationDate', () => {
  it('returns null for empty logs', () => {
    expect(findMostRecentOvulationDate([], '2026-03-15')).toBeNull();
  });

  it('returns null when no ovulation detected in any log', () => {
    const logs = [
      makeDailyLog({ date: '2026-03-10', ovulationDetected: false }),
      makeDailyLog({ date: '2026-03-11', ovulationDetected: null }),
    ];
    expect(findMostRecentOvulationDate(logs, '2026-03-15')).toBeNull();
  });

  it('returns null when all ovulation logs are after check date', () => {
    const logs = [
      makeDailyLog({ date: '2026-03-20', ovulationDetected: true }),
    ];
    expect(findMostRecentOvulationDate(logs, '2026-03-15')).toBeNull();
  });

  it('returns the check date itself when ovulation is on the same day', () => {
    const logs = [
      makeDailyLog({ date: '2026-03-15', ovulationDetected: true }),
    ];
    expect(findMostRecentOvulationDate(logs, '2026-03-15')).toBe('2026-03-15');
  });

  it('returns most recent ovulation date before check date', () => {
    const logs = [
      makeDailyLog({ date: '2026-03-05', ovulationDetected: true }),
      makeDailyLog({ date: '2026-03-10', ovulationDetected: true }),
      makeDailyLog({ date: '2026-03-12', ovulationDetected: false }),
    ];
    expect(findMostRecentOvulationDate(logs, '2026-03-15')).toBe('2026-03-10');
  });

  it('handles single matching log', () => {
    const logs = [
      makeDailyLog({ date: '2026-03-08', ovulationDetected: true }),
    ];
    expect(findMostRecentOvulationDate(logs, '2026-03-15')).toBe('2026-03-08');
  });

  it('returns correct result when input is unsorted', () => {
    const logs = [
      makeDailyLog({ date: '2026-03-12', ovulationDetected: true }),
      makeDailyLog({ date: '2026-03-05', ovulationDetected: true }),
      makeDailyLog({ date: '2026-03-08', ovulationDetected: true }),
      makeDailyLog({ date: '2026-03-20', ovulationDetected: true }),
    ];
    expect(findMostRecentOvulationDate(logs, '2026-03-15')).toBe('2026-03-12');
  });
});

function makePregnancyCheck(
  overrides: Partial<PregnancyCheck> & { date: string }
): PregnancyCheck {
  return {
    id: overrides.id ?? `check-${overrides.date}`,
    mareId: overrides.mareId ?? 'mare-1',
    breedingRecordId: overrides.breedingRecordId ?? 'br-1',
    date: overrides.date,
    result: overrides.result ?? 'positive',
    heartbeatDetected: overrides.heartbeatDetected ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
  };
}

function makeFoalingRecord(
  overrides: Partial<FoalingRecord> & { date: string }
): FoalingRecord {
  return {
    id: overrides.id ?? `foal-${overrides.date}`,
    mareId: overrides.mareId ?? 'mare-1',
    breedingRecordId: overrides.breedingRecordId ?? null,
    date: overrides.date,
    outcome: overrides.outcome ?? 'liveFoal',
    foalSex: overrides.foalSex ?? null,
    complications: overrides.complications ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
  };
}

function makeBreedingRecord(
  overrides: Partial<BreedingRecord> & { date: string }
): BreedingRecord {
  return {
    id: overrides.id ?? `br-${overrides.date}`,
    mareId: overrides.mareId ?? 'mare-1',
    stallionId: overrides.stallionId ?? 'stallion-1',
    stallionName: overrides.stallionName ?? null,
    date: overrides.date,
    method: overrides.method ?? 'liveCover',
    notes: overrides.notes ?? null,
    volumeMl: overrides.volumeMl ?? null,
    concentrationMPerMl: overrides.concentrationMPerMl ?? null,
    motilityPercent: overrides.motilityPercent ?? null,
    numberOfStraws: overrides.numberOfStraws ?? null,
    strawVolumeMl: overrides.strawVolumeMl ?? null,
    strawDetails: overrides.strawDetails ?? null,
    collectionDate: overrides.collectionDate ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
  };
}

describe('findCurrentPregnancyCheck', () => {
  it('returns null when there are no checks', () => {
    expect(findCurrentPregnancyCheck([], [])).toBeNull();
  });

  it('returns null when the latest check is negative', () => {
    const checks = [
      makePregnancyCheck({ id: 'older-positive', date: '2026-05-10', result: 'positive' }),
      makePregnancyCheck({ id: 'latest-negative', date: '2026-05-20', result: 'negative' }),
    ];

    expect(findCurrentPregnancyCheck(checks, [])).toBeNull();
  });

  it('breaks same-day ties by updatedAt so latest is deterministic', () => {
    const checks = [
      makePregnancyCheck({
        id: 'positive-earlier',
        date: '2026-05-20',
        result: 'positive',
        updatedAt: '2026-05-20T09:00:00Z',
      }),
      makePregnancyCheck({
        id: 'negative-later',
        date: '2026-05-20',
        result: 'negative',
        updatedAt: '2026-05-20T10:00:00Z',
      }),
    ];

    expect(findCurrentPregnancyCheck(checks, [])).toBeNull();
  });

  it('returns null when a foaling record exists on or after the positive check date', () => {
    const checks = [makePregnancyCheck({ date: '2026-05-20', result: 'positive' })];
    const foalings = [makeFoalingRecord({ date: '2026-05-20' })];

    expect(findCurrentPregnancyCheck(checks, foalings)).toBeNull();
  });

  it('returns the latest positive check when no foaling supersedes it', () => {
    const checks = [
      makePregnancyCheck({ id: 'older', date: '2026-05-10', result: 'positive' }),
      makePregnancyCheck({ id: 'latest', date: '2026-05-20', result: 'positive' }),
    ];

    expect(findCurrentPregnancyCheck(checks, [])?.id).toBe('latest');
  });
});

describe('buildPregnancyInfoForCheck', () => {
  it('uses the most recent ovulation on or before the check date, not a later ovulation', () => {
    const check = makePregnancyCheck({ date: '2026-05-20', result: 'positive' });
    const dailyLogs = [
      makeDailyLog({ date: '2026-05-18', ovulationDetected: true }),
      makeDailyLog({ date: '2026-05-25', ovulationDetected: true }),
    ];
    const breedingRecord = makeBreedingRecord({ date: '2026-05-10' });

    expect(
      buildPregnancyInfoForCheck(
        check,
        dailyLogs,
        breedingRecord,
        '2026-06-01',
        DEFAULT_GESTATION_LENGTH_DAYS,
      )
    ).toEqual({
      daysPostOvulation: 14,
      estimatedDueDate: '2027-04-15',
    });
  });

  it('returns a null due date when the breeding record is missing', () => {
    const check = makePregnancyCheck({ date: '2026-05-20', result: 'positive' });
    const dailyLogs = [makeDailyLog({ date: '2026-05-18', ovulationDetected: true })];

    expect(
      buildPregnancyInfoForCheck(
        check,
        dailyLogs,
        null,
        '2026-06-01',
        DEFAULT_GESTATION_LENGTH_DAYS,
      )
    ).toEqual({
      daysPostOvulation: 14,
      estimatedDueDate: null,
    });
  });
});
