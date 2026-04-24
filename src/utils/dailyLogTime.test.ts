import { describe, expect, it } from 'vitest';

import {
  compareDailyLogsDesc,
  formatDailyLogTime,
  getCurrentTimeHHMM,
  isDailyLogAfter,
  isDailyLogTime,
  normalizeDailyLogTime,
  type DailyLogComparable,
} from './dailyLogTime';

function makeComparable(overrides: Partial<DailyLogComparable>): DailyLogComparable {
  return {
    id: 'log-1',
    date: '2026-04-23',
    time: '09:30',
    createdAt: '2026-04-23T09:30:00.000Z',
    ...overrides,
  };
}

describe('normalizeDailyLogTime', () => {
  it('accepts valid HH:MM times', () => {
    expect(normalizeDailyLogTime('00:00')).toBe('00:00');
    expect(normalizeDailyLogTime('09:05')).toBe('09:05');
    expect(normalizeDailyLogTime('23:59')).toBe('23:59');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDailyLogTime(' 16:15 ')).toBe('16:15');
  });

  it('rejects invalid hour and minute edges', () => {
    expect(normalizeDailyLogTime('24:00')).toBeNull();
    expect(normalizeDailyLogTime('23:60')).toBeNull();
    expect(normalizeDailyLogTime('29:59')).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(normalizeDailyLogTime('9:00')).toBeNull();
    expect(normalizeDailyLogTime('09:0')).toBeNull();
    expect(normalizeDailyLogTime('09-00')).toBeNull();
    expect(normalizeDailyLogTime('')).toBeNull();
    expect(normalizeDailyLogTime(null)).toBeNull();
    expect(normalizeDailyLogTime(undefined)).toBeNull();
  });
});

describe('isDailyLogTime', () => {
  it('returns true only for valid HH:MM strings', () => {
    expect(isDailyLogTime('07:45')).toBe(true);
    expect(isDailyLogTime('7:45')).toBe(false);
    expect(isDailyLogTime('25:00')).toBe(false);
  });
});

describe('getCurrentTimeHHMM', () => {
  it('formats a Date into local HH:MM', () => {
    const date = new Date(2026, 3, 23, 16, 5, 0, 0);
    expect(getCurrentTimeHHMM(date)).toBe('16:05');
  });
});

describe('formatDailyLogTime', () => {
  it('formats times in 12-hour display form', () => {
    expect(formatDailyLogTime('00:00')).toBe('12:00 AM');
    expect(formatDailyLogTime('12:00')).toBe('12:00 PM');
    expect(formatDailyLogTime('16:15')).toBe('4:15 PM');
  });

  it('formats times in 24-hour display form', () => {
    expect(formatDailyLogTime('00:00', '24h')).toBe('00:00');
    expect(formatDailyLogTime('12:00', '24h')).toBe('12:00');
    expect(formatDailyLogTime('16:15', '24h')).toBe('16:15');
  });

  it('returns dash for null or invalid values', () => {
    expect(formatDailyLogTime(null)).toBe('-');
    expect(formatDailyLogTime('99:99')).toBe('-');
    expect(formatDailyLogTime('99:99', '24h')).toBe('-');
  });
});

describe('compareDailyLogsDesc', () => {
  it('sorts newer dates before older dates', () => {
    const older = makeComparable({ id: 'older', date: '2026-04-22' });
    const newer = makeComparable({ id: 'newer', date: '2026-04-23' });

    expect([older, newer].sort(compareDailyLogsDesc).map((log) => log.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('sorts timed rows before untimed rows on the same date', () => {
    const timed = makeComparable({ id: 'timed', time: '08:00' });
    const untimed = makeComparable({ id: 'untimed', time: null });

    expect([untimed, timed].sort(compareDailyLogsDesc).map((log) => log.id)).toEqual([
      'timed',
      'untimed',
    ]);
  });

  it('sorts later times before earlier times on the same date', () => {
    const morning = makeComparable({ id: 'morning', time: '08:00' });
    const afternoon = makeComparable({ id: 'afternoon', time: '16:00' });

    expect([morning, afternoon].sort(compareDailyLogsDesc).map((log) => log.id)).toEqual([
      'afternoon',
      'morning',
    ]);
  });

  it('breaks ties by createdAt and then id', () => {
    const earlierCreated = makeComparable({
      id: 'a-log',
      createdAt: '2026-04-23T09:00:00.000Z',
    });
    const laterCreated = makeComparable({
      id: 'b-log',
      createdAt: '2026-04-23T10:00:00.000Z',
    });
    const sameCreatedLowerId = makeComparable({
      id: 'a-log',
      createdAt: '2026-04-23T10:00:00.000Z',
    });
    const sameCreatedHigherId = makeComparable({
      id: 'z-log',
      createdAt: '2026-04-23T10:00:00.000Z',
    });

    expect([earlierCreated, laterCreated].sort(compareDailyLogsDesc).map((log) => log.id)).toEqual([
      'b-log',
      'a-log',
    ]);
    expect(
      [sameCreatedLowerId, sameCreatedHigherId].sort(compareDailyLogsDesc).map((log) => log.id),
    ).toEqual(['z-log', 'a-log']);
  });
});

describe('isDailyLogAfter', () => {
  it('returns true when the candidate should sort before the reference', () => {
    const morning = makeComparable({ id: 'morning', time: '08:00' });
    const afternoon = makeComparable({ id: 'afternoon', time: '16:00' });

    expect(isDailyLogAfter(afternoon, morning)).toBe(true);
    expect(isDailyLogAfter(morning, afternoon)).toBe(false);
  });
});
