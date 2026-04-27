import { describe, expect, it } from 'vitest';

import {
  buildBreedingRecordPickerOptions,
  compareBreedingRecordsDesc,
  formatBreedingRecordDateTime,
  formatBreedingRecordTime,
  isBreedingRecordTime,
  normalizeBreedingRecordTime,
  type BreedingRecordComparable,
} from './breedingRecordTime';

function makeComparable(overrides: Partial<BreedingRecordComparable>): BreedingRecordComparable {
  return {
    id: 'breed-1',
    date: '2026-04-26',
    time: '09:30',
    createdAt: '2026-04-26T09:30:00.000Z',
    ...overrides,
  };
}

describe('normalizeBreedingRecordTime', () => {
  it('accepts canonical HH:MM times', () => {
    expect(normalizeBreedingRecordTime('00:00')).toBe('00:00');
    expect(normalizeBreedingRecordTime('09:05')).toBe('09:05');
    expect(normalizeBreedingRecordTime('23:59')).toBe('23:59');
  });

  it('rejects malformed and non-canonical values', () => {
    expect(normalizeBreedingRecordTime('')).toBeNull();
    expect(normalizeBreedingRecordTime('8:00')).toBeNull();
    expect(normalizeBreedingRecordTime('08:00 ')).toBeNull();
    expect(normalizeBreedingRecordTime('24:00')).toBeNull();
    expect(normalizeBreedingRecordTime(null)).toBeNull();
  });
});

describe('isBreedingRecordTime', () => {
  it('returns true only for canonical times', () => {
    expect(isBreedingRecordTime('07:45')).toBe(true);
    expect(isBreedingRecordTime('7:45')).toBe(false);
    expect(isBreedingRecordTime('07:45 ')).toBe(false);
  });
});

describe('formatBreedingRecordTime', () => {
  it('formats times by clock display mode', () => {
    expect(formatBreedingRecordTime('16:15')).toBe('4:15 PM');
    expect(formatBreedingRecordTime('16:15', '24h')).toBe('16:15');
    expect(formatBreedingRecordTime(null)).toBe('-');
  });
});

describe('formatBreedingRecordDateTime', () => {
  it('formats date and time together', () => {
    expect(
      formatBreedingRecordDateTime(
        { date: '2026-04-26', time: '09:30' },
        '12h',
        { dateFormat: 'MM-DD-YYYY' },
      ),
    ).toBe('04-26-2026 9:30 AM');
  });

  it('can label untimed records', () => {
    expect(
      formatBreedingRecordDateTime(
        { date: '2026-04-26', time: null },
        '12h',
        { dateFormat: 'MM-DD-YYYY', includeUntimedLabel: true },
      ),
    ).toBe('04-26-2026 - Untimed');
  });
});

describe('compareBreedingRecordsDesc', () => {
  it('sorts by date, timed rows, time, createdAt, and id descending', () => {
    const timedLate = makeComparable({ id: 'timed-late', time: '16:00' });
    const timedEarly = makeComparable({ id: 'timed-early', time: '08:00' });
    const untimedNewer = makeComparable({
      id: 'untimed-newer',
      time: null,
      createdAt: '2026-04-26T11:00:00.000Z',
    });
    const untimedOlder = makeComparable({
      id: 'untimed-older',
      time: null,
      createdAt: '2026-04-26T10:00:00.000Z',
    });
    const nextDay = makeComparable({ id: 'next-day', date: '2026-04-27', time: null });

    expect(
      [untimedOlder, timedEarly, nextDay, untimedNewer, timedLate]
        .sort(compareBreedingRecordsDesc)
        .map((record) => record.id),
    ).toEqual(['next-day', 'timed-late', 'timed-early', 'untimed-newer', 'untimed-older']);
  });
});

describe('buildBreedingRecordPickerOptions', () => {
  it('formats timed and untimed picker labels with duplicate suffixes', () => {
    const options = buildBreedingRecordPickerOptions(
      [
        {
          id: 'timed-1',
          date: '2026-04-26',
          time: '09:30',
          stallionName: 'Brego',
          method: 'frozenAI',
        },
        {
          id: 'untimed-1',
          date: '2026-04-26',
          time: null,
          stallionName: 'Brego',
          method: 'frozenAI',
        },
        {
          id: 'timed-2',
          date: '2026-04-26',
          time: '09:30',
          stallionName: 'Brego',
          method: 'frozenAI',
        },
      ],
      '12h',
    );

    expect(options).toEqual([
      {
        value: 'timed-1',
        label: '04-26-2026 9:30 AM - Brego (Frozen AI) - Record 1',
      },
      {
        value: 'untimed-1',
        label: '04-26-2026 - Untimed - Brego (Frozen AI)',
      },
      {
        value: 'timed-2',
        label: '04-26-2026 9:30 AM - Brego (Frozen AI) - Record 2',
      },
    ]);
  });

  it('can include a leading none option and respect 24-hour time', () => {
    const options = buildBreedingRecordPickerOptions(
      [
        {
          id: 'timed-1',
          date: '2026-04-26',
          time: '09:30',
          stallionName: 'Brego',
          method: 'frozenAI',
        },
      ],
      '24h',
      { includeNoneOption: true },
    );

    expect(options).toEqual([
      { value: '', label: 'None' },
      { value: 'timed-1', label: '04-26-2026 09:30 - Brego (Frozen AI)' },
    ]);
  });
});
