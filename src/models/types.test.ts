import { describe, expect, it } from 'vitest';
import { calculateDaysPostBreeding, estimateFoalingDate, findMostRecentOvulationDate } from './types';
import type { DailyLog } from './types';

describe('estimateFoalingDate', () => {
  it('adds 340 days to the breeding date', () => {
    // 2026-01-01 + 340 days = 2026-12-07
    expect(estimateFoalingDate('2026-01-01')).toBe('2026-12-07');
  });

  it('handles year boundary crossing', () => {
    // 2026-03-01 + 340 days = 2027-02-04
    expect(estimateFoalingDate('2026-03-01')).toBe('2027-02-04');
  });

  it('handles leap year crossing', () => {
    // 2027-05-01 + 340 days = 2028-04-05 (2028 is a leap year)
    expect(estimateFoalingDate('2027-05-01')).toBe('2028-04-05');
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
