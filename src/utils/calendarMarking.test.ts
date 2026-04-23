import { describe, expect, it } from 'vitest';

import { buildCalendarMarking } from '@/utils/calendarMarking';
import { BreedingRecord, DailyLog, FoalingRecord, MedicationLog, PregnancyCheck } from '@/models/types';

function makeDailyLog(overrides: Partial<DailyLog> & { id: string; date: string; mareId: string }): DailyLog {
  return {
    time: null,
    teasingScore: null,
    rightOvary: null,
    leftOvary: null,
    ovulationDetected: null,
    edema: null,
    uterineTone: null,
    uterineCysts: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeBreedingRecord(overrides: Partial<BreedingRecord> & { id: string; date: string; mareId: string }): BreedingRecord {
  return {
    stallionId: null,
    stallionName: null,
    method: 'liveCover',
    notes: null,
    volumeMl: null,
    concentrationMPerMl: null,
    motilityPercent: null,
    numberOfStraws: null,
    strawVolumeMl: null,
    strawDetails: null,
    collectionDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePregnancyCheck(overrides: Partial<PregnancyCheck> & { id: string; date: string; mareId: string; breedingRecordId: string }): PregnancyCheck {
  return {
    result: 'positive',
    heartbeatDetected: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFoalingRecord(overrides: Partial<FoalingRecord> & { id: string; date: string; mareId: string }): FoalingRecord {
  return {
    breedingRecordId: null,
    outcome: 'liveFoal',
    foalSex: null,
    complications: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const MARE_ID = 'mare-1';

describe('buildCalendarMarking', () => {
  it('returns empty object when no records', () => {
    const result = buildCalendarMarking([], [], [], [], null);
    expect(result).toEqual({});
  });

  it('marks selected day even with no events', () => {
    const result = buildCalendarMarking([], [], [], [], '2026-03-15');
    expect(result['2026-03-15']).toEqual({
      dots: [],
      selected: true,
      selectedColor: '#97B498',
    });
  });

  it('creates heat dot for daily log with teasingScore >= 4', () => {
    const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, teasingScore: 4 })];
    const result = buildCalendarMarking(logs, [], [], [], null);
    expect(result['2026-03-10'].dots).toEqual([{ key: 'heat', color: '#FF9800' }]);
  });

  it('creates heat dot for daily log with edema >= 4', () => {
    const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, edema: 4 })];
    const result = buildCalendarMarking(logs, [], [], [], null);
    expect(result['2026-03-10'].dots).toEqual([{ key: 'heat', color: '#FF9800' }]);
  });

  it('creates ovulation dot for daily log with ovulationDetected', () => {
    const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, ovulationDetected: true })];
    const result = buildCalendarMarking(logs, [], [], [], null);
    expect(result['2026-03-10'].dots).toEqual([{ key: 'ovulation', color: '#9C27B0' }]);
  });

  it('creates breeding dot', () => {
    const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-12', mareId: MARE_ID })];
    const result = buildCalendarMarking([], breedings, [], [], null);
    expect(result['2026-03-12'].dots).toEqual([{ key: 'breeding', color: '#2196F3' }]);
  });

  it('creates pregnancy check dot', () => {
    const checks = [makePregnancyCheck({ id: 'pc-1', date: '2026-03-26', mareId: MARE_ID, breedingRecordId: 'br-1' })];
    const result = buildCalendarMarking([], [], checks, [], null);
    expect(result['2026-03-26'].dots).toEqual([{ key: 'pregnancyCheck', color: '#4CAF50' }]);
  });

  it('creates foaling dot', () => {
    const foalings = [makeFoalingRecord({ id: 'fr-1', date: '2026-12-01', mareId: MARE_ID })];
    const result = buildCalendarMarking([], [], [], foalings, null);
    expect(result['2026-12-01'].dots).toEqual([{ key: 'foaling', color: '#E91E63' }]);
  });

  it('shows multiple dots for multiple events on the same day', () => {
    const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, teasingScore: 5 })];
    const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-10', mareId: MARE_ID })];
    const result = buildCalendarMarking(logs, breedings, [], [], null);
    const dots = result['2026-03-10'].dots;
    expect(dots).toHaveLength(2);
    expect(dots.map((d) => d.key)).toContain('heat');
    expect(dots.map((d) => d.key)).toContain('breeding');
  });

  it('deduplicates dots of the same type on the same day', () => {
    const breedings = [
      makeBreedingRecord({ id: 'br-1', date: '2026-03-10', mareId: MARE_ID }),
      makeBreedingRecord({ id: 'br-2', date: '2026-03-10', mareId: MARE_ID }),
    ];
    const result = buildCalendarMarking([], breedings, [], [], null);
    expect(result['2026-03-10'].dots).toHaveLength(1);
  });

  it('marks selected day with selected flag on event date', () => {
    const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-10', mareId: MARE_ID })];
    const result = buildCalendarMarking([], breedings, [], [], '2026-03-10');
    expect(result['2026-03-10'].selected).toBe(true);
    expect(result['2026-03-10'].selectedColor).toBe('#97B498');
    expect(result['2026-03-10'].dots).toHaveLength(1);
  });

  it('does not mark non-selected dates as selected', () => {
    const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-10', mareId: MARE_ID })];
    const result = buildCalendarMarking([], breedings, [], [], '2026-03-15');
    expect(result['2026-03-10'].selected).toBeUndefined();
  });

  it('ignores daily logs without heat or ovulation signals', () => {
    const logs = [
      makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, teasingScore: 2 }),
      makeDailyLog({ id: 'log-2', date: '2026-03-11', mareId: MARE_ID }),
    ];
    const result = buildCalendarMarking(logs, [], [], [], null);
    expect(Object.keys(result)).toHaveLength(0);
  });

  describe('medication dots', () => {
    function makeMedLog(overrides: Partial<MedicationLog> & { id: string; date: string; mareId: string }): MedicationLog {
      return {
        medicationName: 'Regumate',
        dose: null,
        route: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
      };
    }

    it('shows teal dot for medication log date', () => {
      const medLog = makeMedLog({ id: 'med-1', date: '2026-03-15', mareId: MARE_ID });
      const result = buildCalendarMarking([], [], [], [], null, [medLog]);
      expect(result['2026-03-15']).toBeDefined();
      expect(result['2026-03-15'].dots).toHaveLength(1);
      expect(result['2026-03-15'].dots[0].color).toBe('#009688');
      expect(result['2026-03-15'].dots[0].key).toBe('medication');
    });

    it('medication dot deduplicates on same date', () => {
      const meds = [
        makeMedLog({ id: 'med-1', date: '2026-03-15', mareId: MARE_ID }),
        makeMedLog({ id: 'med-2', date: '2026-03-15', mareId: MARE_ID, medicationName: 'Oxytocin' }),
      ];
      const result = buildCalendarMarking([], [], [], [], null, meds);
      expect(result['2026-03-15'].dots).toHaveLength(1);
    });

    it('selected day filtering only shows medication for that day', () => {
      const meds = [
        makeMedLog({ id: 'med-1', date: '2026-03-15', mareId: MARE_ID }),
        makeMedLog({ id: 'med-2', date: '2026-03-16', mareId: MARE_ID }),
      ];
      const filteredForDay15 = meds.filter((m) => m.date === '2026-03-15');
      const result = buildCalendarMarking([], [], [], [], '2026-03-15', filteredForDay15);
      expect(result['2026-03-15'].dots).toHaveLength(1);
      expect(result['2026-03-16']).toBeUndefined();
    });
  });
});
