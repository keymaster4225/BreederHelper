import { describe, expect, it } from 'vitest';

import { buildTimelineEvents } from '@/utils/timelineEvents';
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
    time: null,
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

describe('buildTimelineEvents', () => {
  describe('filtering daily logs', () => {
    it('includes logs with ovulationDetected === true as ovulation type', () => {
      const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, ovulationDetected: true })];
      const result = buildTimelineEvents(logs, [], [], []);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ovulation');
      expect(result[0].id).toBe('log-1');
    });

    it('includes logs with teasingScore >= 4 as heat type', () => {
      const logs = [
        makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, teasingScore: 4 }),
        makeDailyLog({ id: 'log-2', date: '2026-03-11', mareId: MARE_ID, teasingScore: 5 }),
      ];
      const result = buildTimelineEvents(logs, [], [], []);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('heat');
      expect(result[1].type).toBe('heat');
    });

    it('excludes logs with teasingScore < 4 and no ovulation', () => {
      const logs = [
        makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, teasingScore: 3 }),
        makeDailyLog({ id: 'log-2', date: '2026-03-11', mareId: MARE_ID, teasingScore: 0 }),
        makeDailyLog({ id: 'log-3', date: '2026-03-12', mareId: MARE_ID }),
      ];
      const result = buildTimelineEvents(logs, [], [], []);
      expect(result).toHaveLength(0);
    });

    it('uses ovulation type (not heat) when both ovulation and teasing >= 4 on same log', () => {
      const logs = [
        makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, ovulationDetected: true, teasingScore: 5 }),
      ];
      const result = buildTimelineEvents(logs, [], [], []);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ovulation');
    });
  });

  describe('merging record types', () => {
    it('merges all four record types into a single array', () => {
      const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-01', mareId: MARE_ID, ovulationDetected: true })];
      const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-02', mareId: MARE_ID })];
      const checks = [makePregnancyCheck({ id: 'pc-1', date: '2026-03-16', mareId: MARE_ID, breedingRecordId: 'br-1' })];
      const foalings = [makeFoalingRecord({ id: 'fr-1', date: '2026-12-01', mareId: MARE_ID })];

      const result = buildTimelineEvents(logs, breedings, checks, foalings);
      expect(result).toHaveLength(4);

      const types = result.map((e) => e.type);
      expect(types).toContain('ovulation');
      expect(types).toContain('breeding');
      expect(types).toContain('pregnancyCheck');
      expect(types).toContain('foaling');
    });

    it('assigns correct type field to each event', () => {
      const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-02', mareId: MARE_ID })];
      const checks = [makePregnancyCheck({ id: 'pc-1', date: '2026-03-16', mareId: MARE_ID, breedingRecordId: 'br-1' })];

      const result = buildTimelineEvents([], breedings, checks, []);
      expect(result.find((e) => e.id === 'br-1')?.type).toBe('breeding');
      expect(result.find((e) => e.id === 'pc-1')?.type).toBe('pregnancyCheck');
    });
  });

  describe('sorting', () => {
    it('sorts events descending by date (most recent first)', () => {
      const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-01', mareId: MARE_ID, ovulationDetected: true })];
      const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-15', mareId: MARE_ID })];
      const foalings = [makeFoalingRecord({ id: 'fr-1', date: '2026-12-01', mareId: MARE_ID })];

      const result = buildTimelineEvents(logs, breedings, [], foalings);
      const dates = result.map((e) => e.date);
      expect(dates).toEqual(['2026-12-01', '2026-03-15', '2026-03-01']);
    });

    it('sorts same-date events by type priority (foaling > pregnancyCheck > breeding > ovulation > heat)', () => {
      const sameDate = '2026-03-10';
      const logs = [
        makeDailyLog({ id: 'log-heat', date: sameDate, mareId: MARE_ID, teasingScore: 4 }),
        makeDailyLog({ id: 'log-ovulation', date: '2026-03-11', mareId: MARE_ID, ovulationDetected: true }),
      ];
      const breedings = [makeBreedingRecord({ id: 'br-1', date: sameDate, mareId: MARE_ID })];
      const checks = [makePregnancyCheck({ id: 'pc-1', date: sameDate, mareId: MARE_ID, breedingRecordId: 'br-1' })];
      const foalings = [makeFoalingRecord({ id: 'fr-1', date: sameDate, mareId: MARE_ID })];

      const result = buildTimelineEvents(logs, breedings, checks, foalings);

      // Same-date events should be: foaling, pregnancyCheck, breeding, heat
      // Then the 2026-03-11 ovulation comes before them (more recent date)
      const march11 = result.filter((e) => e.date === '2026-03-11');
      const march10 = result.filter((e) => e.date === sameDate);

      expect(march11).toHaveLength(1);
      expect(march11[0].type).toBe('ovulation');

      expect(march10.map((e) => e.type)).toEqual(['foaling', 'pregnancyCheck', 'breeding', 'heat']);
    });

    it('sorts same-date daily log events by log time before daily-log type priority', () => {
      const sameDate = '2026-03-10';
      const logs = [
        makeDailyLog({ id: 'log-heat-late', date: sameDate, mareId: MARE_ID, time: '16:00', teasingScore: 4 }),
        makeDailyLog({ id: 'log-ovulation-early', date: sameDate, mareId: MARE_ID, time: '08:00', ovulationDetected: true }),
      ];

      const result = buildTimelineEvents(logs, [], [], []);

      expect(result.map((event) => event.id)).toEqual(['log-heat-late', 'log-ovulation-early']);
      expect(result.map((event) => event.type)).toEqual(['heat', 'ovulation']);
    });

    it('keeps cross-type priority ahead of same-date daily log events', () => {
      const sameDate = '2026-03-10';
      const logs = [
        makeDailyLog({ id: 'log-heat-late', date: sameDate, mareId: MARE_ID, time: '16:00', teasingScore: 4 }),
        makeDailyLog({ id: 'log-ovulation-early', date: sameDate, mareId: MARE_ID, time: '08:00', ovulationDetected: true }),
      ];
      const breedings = [makeBreedingRecord({ id: 'br-1', date: sameDate, mareId: MARE_ID })];

      const result = buildTimelineEvents(logs, breedings, [], []);

      expect(result.map((event) => event.id)).toEqual(['br-1', 'log-heat-late', 'log-ovulation-early']);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when all inputs are empty', () => {
      const result = buildTimelineEvents([], [], [], []);
      expect(result).toEqual([]);
    });

    it('works with a single event type', () => {
      const breedings = [makeBreedingRecord({ id: 'br-1', date: '2026-03-02', mareId: MARE_ID })];
      const result = buildTimelineEvents([], breedings, [], []);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('breeding');
    });

    it('handles null/undefined optional fields without crashing', () => {
      const logs = [makeDailyLog({ id: 'log-1', date: '2026-03-10', mareId: MARE_ID, teasingScore: null, ovulationDetected: null })];
      const result = buildTimelineEvents(logs, [], [], []);
      expect(result).toHaveLength(0);
    });

    it('preserves the original data reference in each event', () => {
      const breeding = makeBreedingRecord({ id: 'br-1', date: '2026-03-02', mareId: MARE_ID, method: 'frozenAI' });
      const result = buildTimelineEvents([], [breeding], [], []);
      expect(result[0].data).toBe(breeding);
    });
  });

  describe('medication events', () => {
    function makeMedLog(overrides: Partial<MedicationLog> & { id: string; date: string; mareId: string }): MedicationLog {
      return {
        medicationName: 'Regumate',
        time: '08:30',
        dose: null,
        route: null,
        notes: null,
        sourceDailyLogId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
      };
    }

    it('includes medication logs in timeline events', () => {
      const medLog = makeMedLog({ id: 'med-1', date: '2026-03-15', mareId: MARE_ID });
      const result = buildTimelineEvents([], [], [], [], [medLog]);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('medication');
      expect(result[0].data).toBe(medLog);
    });

    it('sorts medication events after other event types on same date', () => {
      const breeding = makeBreedingRecord({ id: 'br-1', date: '2026-03-15', mareId: MARE_ID });
      const medLog = makeMedLog({ id: 'med-1', date: '2026-03-15', mareId: MARE_ID });
      const result = buildTimelineEvents([], [breeding], [], [], [medLog]);
      expect(result[0].type).toBe('breeding');
      expect(result[1].type).toBe('medication');
    });

    it('defaults to empty medication array when omitted', () => {
      const result = buildTimelineEvents([], [], [], []);
      expect(result).toHaveLength(0);
    });
  });
});
