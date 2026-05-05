import { describe, expect, it } from 'vitest';

import { normalizeDailyLogTime } from './dailyLogTime';
import {
  compareMedicationLogsDesc,
  formatMedicationLogDateTime,
  formatMedicationLogTime,
  normalizeMedicationLogTime,
  type MedicationLogComparable,
} from './medicationLogTime';

function makeComparable(overrides: Partial<MedicationLogComparable>): MedicationLogComparable {
  return {
    id: 'med-1',
    date: '2026-05-05',
    time: '09:30',
    createdAt: '2026-05-05T09:30:00.000Z',
    ...overrides,
  };
}

describe('normalizeMedicationLogTime', () => {
  it('matches daily log normalization for representative inputs', () => {
    const values = [
      '09:30',
      ' 09:30 ',
      '00:00',
      '23:59',
      '9:30',
      '09:5',
      '24:00',
      '23:60',
      '09:30:00',
      '',
      null,
      undefined,
      930,
      true,
    ];

    for (const value of values) {
      expect(normalizeMedicationLogTime(value)).toBe(normalizeDailyLogTime(value));
    }
  });
});

describe('formatMedicationLogTime', () => {
  it('formats medication times using 12-hour and 24-hour display modes', () => {
    expect(formatMedicationLogTime('09:30', '12h')).toBe('9:30 AM');
    expect(formatMedicationLogTime('21:30', '12h')).toBe('9:30 PM');
    expect(formatMedicationLogTime('21:30', '24h')).toBe('21:30');
  });
});

describe('formatMedicationLogDateTime', () => {
  it('renders timed rows as date at time', () => {
    expect(formatMedicationLogDateTime({ date: '2026-05-05', time: '21:30' }, '12h')).toBe(
      '2026-05-05 at 9:30 PM',
    );
    expect(formatMedicationLogDateTime({ date: '2026-05-05', time: '21:30' }, '24h')).toBe(
      '2026-05-05 at 21:30',
    );
  });

  it('renders untimed rows as date only', () => {
    expect(formatMedicationLogDateTime({ date: '2026-05-05', time: null }, '12h')).toBe(
      '2026-05-05',
    );
  });
});

describe('compareMedicationLogsDesc', () => {
  it('sorts newer dates before older dates', () => {
    const older = makeComparable({ id: 'older', date: '2026-05-04' });
    const newer = makeComparable({ id: 'newer', date: '2026-05-05' });

    expect([older, newer].sort(compareMedicationLogsDesc).map((log) => log.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('sorts timed rows before untimed rows on the same date', () => {
    const timed = makeComparable({ id: 'timed', time: '08:00' });
    const untimed = makeComparable({ id: 'untimed', time: null });

    expect([untimed, timed].sort(compareMedicationLogsDesc).map((log) => log.id)).toEqual([
      'timed',
      'untimed',
    ]);
  });

  it('sorts later times before earlier times on the same date', () => {
    const morning = makeComparable({ id: 'morning', time: '08:00' });
    const evening = makeComparable({ id: 'evening', time: '18:00' });

    expect([morning, evening].sort(compareMedicationLogsDesc).map((log) => log.id)).toEqual([
      'evening',
      'morning',
    ]);
  });

  it('sorts later createdAt values first when date and time tie', () => {
    const earlier = makeComparable({
      id: 'earlier',
      createdAt: '2026-05-05T09:30:00.000Z',
    });
    const later = makeComparable({
      id: 'later',
      createdAt: '2026-05-05T09:31:00.000Z',
    });

    expect([earlier, later].sort(compareMedicationLogsDesc).map((log) => log.id)).toEqual([
      'later',
      'earlier',
    ]);
  });

  it('sorts higher ids first as the final tiebreaker', () => {
    const lower = makeComparable({ id: 'a-med' });
    const higher = makeComparable({ id: 'z-med' });

    expect([lower, higher].sort(compareMedicationLogsDesc).map((log) => log.id)).toEqual([
      'z-med',
      'a-med',
    ]);
  });
});
