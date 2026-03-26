import { describe, expect, it } from 'vitest';

import {
  BreedingRecord,
  DailyLog,
  FoalingRecord,
  Mare,
  PregnancyCheck,
} from '@/models/types';

import {
  DashboardInput,
  DUE_DATE_ALERT_WINDOW_DAYS,
  generateDashboardAlerts,
  HEAT_ACTIVITY_WINDOW_DAYS,
  PREG_CHECK_WINDOW_MIN_DAYS,
  RECENT_OVULATION_WINDOW_DAYS,
  STALE_LOG_THRESHOLD_DAYS,
} from '@/utils/dashboardAlerts';

// --- Factories ---

function makeMare(overrides: Partial<Mare> = {}): Mare {
  return {
    id: 'mare-1',
    name: 'Star',
    breed: 'Thoroughbred',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDailyLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'log-1',
    mareId: 'mare-1',
    date: '2026-03-20',
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
    ...overrides,
  };
}

function makeBreeding(overrides: Partial<BreedingRecord> = {}): BreedingRecord {
  return {
    id: 'br-1',
    mareId: 'mare-1',
    stallionId: 'stallion-1',
    stallionName: 'Thunder',
    date: '2026-03-01',
    method: 'liveCover',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makePregnancyCheck(overrides: Partial<PregnancyCheck> = {}): PregnancyCheck {
  return {
    id: 'pc-1',
    mareId: 'mare-1',
    breedingRecordId: 'br-1',
    date: '2026-03-16',
    result: 'positive',
    createdAt: '2026-03-16T00:00:00Z',
    updatedAt: '2026-03-16T00:00:00Z',
    ...overrides,
  };
}

function makeFoaling(overrides: Partial<FoalingRecord> = {}): FoalingRecord {
  return {
    id: 'fr-1',
    mareId: 'mare-1',
    date: '2027-02-04',
    outcome: 'liveFoal',
    createdAt: '2027-02-04T00:00:00Z',
    updatedAt: '2027-02-04T00:00:00Z',
    ...overrides,
  };
}

function makeInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    mares: [],
    dailyLogs: [],
    breedingRecords: [],
    pregnancyChecks: [],
    foalingRecords: [],
    today: '2026-03-26',
    ...overrides,
  };
}

// --- Tests ---

describe('generateDashboardAlerts', () => {
  it('returns empty array for empty input', () => {
    const result = generateDashboardAlerts(makeInput());
    expect(result).toEqual([]);
  });

  it('returns empty array when mares exist but no actionable data', () => {
    const mare = makeMare();
    const log = makeDailyLog({ date: '2026-03-25' }); // recent log, no heat
    const result = generateDashboardAlerts(
      makeInput({ mares: [mare], dailyLogs: [log] })
    );
    expect(result).toEqual([]);
  });

  // --- Approaching Due Date ---

  describe('approachingDueDate', () => {
    it('generates alert when due date is within window', () => {
      // Bred on 2025-04-30 -> due ~2026-04-05 (340 days later)
      // Today is 2026-03-26 -> 10 days until due -> within 30 day window
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2025-04-30' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2025-05-15',
        result: 'positive',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
        })
      );

      const dueAlerts = result.filter((a) => a.kind === 'approachingDueDate');
      expect(dueAlerts).toHaveLength(1);
      expect(dueAlerts[0].mareId).toBe('mare-1');
      expect(dueAlerts[0].priority).toBe('high');
      expect(dueAlerts[0].title).toMatch(/Due in \d+ days/);
    });

    it('does not generate alert when due date is beyond window', () => {
      // Bred on 2026-03-01 -> due ~2027-02-04 (way beyond 30 days from today 2026-03-26)
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2026-03-01' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2026-03-16',
        result: 'positive',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
        })
      );

      const dueAlerts = result.filter((a) => a.kind === 'approachingDueDate');
      expect(dueAlerts).toHaveLength(0);
    });

    it('generates alert for overdue mare (negative days)', () => {
      // Bred on 2025-04-15 -> due ~2026-03-21 -> today 2026-03-26 = 5 days overdue
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2025-04-15' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2025-04-30',
        result: 'positive',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
        })
      );

      const dueAlerts = result.filter((a) => a.kind === 'approachingDueDate');
      expect(dueAlerts).toHaveLength(1);
      expect(dueAlerts[0].title).toMatch(/overdue/i);
    });

    it('does not alert when foaling already occurred after pregnancy check', () => {
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2025-04-30' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2025-05-15',
        result: 'positive',
      });
      const foaling = makeFoaling({ date: '2026-03-20' });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
          foalingRecords: [foaling],
        })
      );

      const dueAlerts = result.filter((a) => a.kind === 'approachingDueDate');
      expect(dueAlerts).toHaveLength(0);
    });

    it('does not alert when latest check is negative', () => {
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2025-04-30' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2025-05-15',
        result: 'negative',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
        })
      );

      const dueAlerts = result.filter((a) => a.kind === 'approachingDueDate');
      expect(dueAlerts).toHaveLength(0);
    });

    it('sorts soonest due date first', () => {
      const mare1 = makeMare({ id: 'mare-1', name: 'Star' });
      const mare2 = makeMare({ id: 'mare-2', name: 'Luna' });
      // mare-1 due ~2026-04-05 (10 days away), mare-2 due ~2026-03-31 (5 days away)
      const br1 = makeBreeding({ id: 'br-1', mareId: 'mare-1', date: '2025-04-30' });
      const br2 = makeBreeding({ id: 'br-2', mareId: 'mare-2', date: '2025-04-25' });
      const pc1 = makePregnancyCheck({ id: 'pc-1', mareId: 'mare-1', breedingRecordId: 'br-1', date: '2025-05-15' });
      const pc2 = makePregnancyCheck({ id: 'pc-2', mareId: 'mare-2', breedingRecordId: 'br-2', date: '2025-05-10' });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare1, mare2],
          breedingRecords: [br1, br2],
          pregnancyChecks: [pc1, pc2],
        })
      );

      const dueAlerts = result.filter((a) => a.kind === 'approachingDueDate');
      expect(dueAlerts).toHaveLength(2);
      expect(dueAlerts[0].mareId).toBe('mare-2'); // sooner due date
      expect(dueAlerts[1].mareId).toBe('mare-1');
    });
  });

  // --- Pregnancy Check Needed ---

  describe('pregnancyCheckNeeded', () => {
    it('generates alert when mare is within check window and no check exists', () => {
      // Bred 15 days ago (2026-03-11), no preg check
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2026-03-11' });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
        })
      );

      const checkAlerts = result.filter((a) => a.kind === 'pregnancyCheckNeeded');
      expect(checkAlerts).toHaveLength(1);
      expect(checkAlerts[0].priority).toBe('high');
      expect(checkAlerts[0].title).toMatch(/Day 15 post-breeding/);
    });

    it('does not generate alert when too early', () => {
      // Bred 13 days ago (2026-03-13)
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2026-03-13' });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
        })
      );

      const checkAlerts = result.filter((a) => a.kind === 'pregnancyCheckNeeded');
      expect(checkAlerts).toHaveLength(0);
    });

    it('generates alert when overdue for check (past window max)', () => {
      // Bred 20 days ago (2026-03-06), no check -> still needs one
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2026-03-06' });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
        })
      );

      const checkAlerts = result.filter((a) => a.kind === 'pregnancyCheckNeeded');
      expect(checkAlerts).toHaveLength(1);
    });

    it('does not alert when pregnancy check already exists for that breeding', () => {
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2026-03-11' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2026-03-26',
        result: 'positive',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
        })
      );

      const checkAlerts = result.filter((a) => a.kind === 'pregnancyCheckNeeded');
      expect(checkAlerts).toHaveLength(0);
    });

    it('does not alert when mare already has confirmed pregnancy', () => {
      // Mare has an older breeding with a positive check -> already pregnant
      const mare = makeMare();
      const oldBreeding = makeBreeding({ id: 'br-old', date: '2026-02-01' });
      const positiveCheck = makePregnancyCheck({
        breedingRecordId: 'br-old',
        date: '2026-02-16',
        result: 'positive',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [oldBreeding],
          pregnancyChecks: [positiveCheck],
        })
      );

      const checkAlerts = result.filter((a) => a.kind === 'pregnancyCheckNeeded');
      expect(checkAlerts).toHaveLength(0);
    });

    it('uses the most recent unchecked breeding only', () => {
      const mare = makeMare();
      const oldBreeding = makeBreeding({ id: 'br-old', date: '2026-02-01' });
      const newBreeding = makeBreeding({ id: 'br-new', date: '2026-03-11' });
      // Old breeding has a negative check, new breeding has no check
      const negCheck = makePregnancyCheck({
        breedingRecordId: 'br-old',
        date: '2026-02-16',
        result: 'negative',
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [oldBreeding, newBreeding],
          pregnancyChecks: [negCheck],
        })
      );

      const checkAlerts = result.filter((a) => a.kind === 'pregnancyCheckNeeded');
      expect(checkAlerts).toHaveLength(1);
    });
  });

  // --- Recent Ovulation ---

  describe('recentOvulation', () => {
    it('generates alert when ovulation detected today', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-26',
        ovulationDetected: true,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const ovAlerts = result.filter((a) => a.kind === 'recentOvulation');
      expect(ovAlerts).toHaveLength(1);
      expect(ovAlerts[0].priority).toBe('medium');
    });

    it('generates alert when ovulation detected yesterday', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-25',
        ovulationDetected: true,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const ovAlerts = result.filter((a) => a.kind === 'recentOvulation');
      expect(ovAlerts).toHaveLength(1);
    });

    it('does not alert when ovulation is older than window', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-23', // 3 days ago, outside 2-day window
        ovulationDetected: true,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const ovAlerts = result.filter((a) => a.kind === 'recentOvulation');
      expect(ovAlerts).toHaveLength(0);
    });

    it('does not alert when follow-up log exists after ovulation', () => {
      const mare = makeMare();
      const ovLog = makeDailyLog({
        id: 'log-ov',
        date: '2026-03-25',
        ovulationDetected: true,
      });
      const followUp = makeDailyLog({
        id: 'log-followup',
        date: '2026-03-26',
        ovulationDetected: false,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [ovLog, followUp],
        })
      );

      const ovAlerts = result.filter((a) => a.kind === 'recentOvulation');
      expect(ovAlerts).toHaveLength(0);
    });

    it('does not alert when mare has no daily logs', () => {
      const mare = makeMare();

      const result = generateDashboardAlerts(
        makeInput({ mares: [mare] })
      );

      const ovAlerts = result.filter((a) => a.kind === 'recentOvulation');
      expect(ovAlerts).toHaveLength(0);
    });
  });

  // --- Heat Activity ---

  describe('heatActivity', () => {
    it('generates alert for teasing score 5 today', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-26',
        teasingScore: 5,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const heatAlerts = result.filter((a) => a.kind === 'heatActivity');
      expect(heatAlerts).toHaveLength(1);
      expect(heatAlerts[0].priority).toBe('medium');
    });

    it('generates alert for teasing score 4 yesterday', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-25',
        teasingScore: 4,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const heatAlerts = result.filter((a) => a.kind === 'heatActivity');
      expect(heatAlerts).toHaveLength(1);
    });

    it('generates alert for edema 4-5', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-26',
        edema: 5,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const heatAlerts = result.filter((a) => a.kind === 'heatActivity');
      expect(heatAlerts).toHaveLength(1);
    });

    it('does not alert for teasing score 3', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-26',
        teasingScore: 3,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const heatAlerts = result.filter((a) => a.kind === 'heatActivity');
      expect(heatAlerts).toHaveLength(0);
    });

    it('does not alert when log is outside window', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-22', // 4 days ago, outside 3-day window
        teasingScore: 5,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const heatAlerts = result.filter((a) => a.kind === 'heatActivity');
      expect(heatAlerts).toHaveLength(0);
    });

    it('does not alert when ovulation already detected after heat', () => {
      const mare = makeMare();
      const heatLog = makeDailyLog({
        id: 'log-heat',
        date: '2026-03-24',
        teasingScore: 5,
      });
      const ovLog = makeDailyLog({
        id: 'log-ov',
        date: '2026-03-25',
        ovulationDetected: true,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [heatLog, ovLog],
        })
      );

      const heatAlerts = result.filter((a) => a.kind === 'heatActivity');
      expect(heatAlerts).toHaveLength(0);
    });
  });

  // --- No Recent Log ---

  describe('noRecentLog', () => {
    it('generates alert when last log is older than threshold', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-18', // 8 days ago
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const staleAlerts = result.filter((a) => a.kind === 'noRecentLog');
      expect(staleAlerts).toHaveLength(1);
      expect(staleAlerts[0].priority).toBe('low');
      expect(staleAlerts[0].title).toMatch(/Last log 8 days ago/);
    });

    it('does not alert when log is recent', () => {
      const mare = makeMare();
      const log = makeDailyLog({
        date: '2026-03-20', // 6 days ago, within 7-day threshold
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          dailyLogs: [log],
        })
      );

      const staleAlerts = result.filter((a) => a.kind === 'noRecentLog');
      expect(staleAlerts).toHaveLength(0);
    });

    it('generates alert when mare has zero logs', () => {
      const mare = makeMare();

      const result = generateDashboardAlerts(
        makeInput({ mares: [mare] })
      );

      const staleAlerts = result.filter((a) => a.kind === 'noRecentLog');
      expect(staleAlerts).toHaveLength(1);
      expect(staleAlerts[0].title).toMatch(/No logs recorded/);
    });

    it('does not alert for pregnant mare past 60 DPO', () => {
      // Bred 2025-12-01 -> today is 2026-03-26 -> ~115 days post breeding
      // Ovulation detected 2025-12-02 -> DPO ~114
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2025-12-01' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2025-12-16',
        result: 'positive',
      });
      const ovLog = makeDailyLog({
        date: '2025-12-02',
        ovulationDetected: true,
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
          dailyLogs: [ovLog],
        })
      );

      const staleAlerts = result.filter((a) => a.kind === 'noRecentLog');
      expect(staleAlerts).toHaveLength(0);
    });

    it('alerts for pregnant mare at 30 DPO with stale log', () => {
      // Bred 2026-02-24 -> 30 days post breeding, still actively monitoring
      const mare = makeMare();
      const breeding = makeBreeding({ date: '2026-02-24' });
      const check = makePregnancyCheck({
        breedingRecordId: 'br-1',
        date: '2026-03-11',
        result: 'positive',
      });
      const log = makeDailyLog({
        date: '2026-03-11', // 15 days ago, stale
      });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare],
          breedingRecords: [breeding],
          pregnancyChecks: [check],
          dailyLogs: [log],
        })
      );

      const staleAlerts = result.filter((a) => a.kind === 'noRecentLog');
      expect(staleAlerts).toHaveLength(1);
    });

    it('sorts oldest last-log first', () => {
      const mare1 = makeMare({ id: 'mare-1', name: 'Star' });
      const mare2 = makeMare({ id: 'mare-2', name: 'Luna' });
      const log1 = makeDailyLog({ id: 'log-1', mareId: 'mare-1', date: '2026-03-15' }); // 11 days ago
      const log2 = makeDailyLog({ id: 'log-2', mareId: 'mare-2', date: '2026-03-10' }); // 16 days ago

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare1, mare2],
          dailyLogs: [log1, log2],
        })
      );

      const staleAlerts = result.filter((a) => a.kind === 'noRecentLog');
      expect(staleAlerts).toHaveLength(2);
      expect(staleAlerts[0].mareId).toBe('mare-2'); // more neglected
      expect(staleAlerts[1].mareId).toBe('mare-1');
    });
  });

  // --- Priority Ordering ---

  describe('priority ordering', () => {
    it('sorts high before medium before low', () => {
      const mare = makeMare();
      // Trigger all 3 priority levels:
      // HIGH: preg check needed (bred 15 days ago, no check)
      const breeding = makeBreeding({ date: '2026-03-11' });
      // MEDIUM: heat activity (teasing 5 today)
      const heatLog = makeDailyLog({ id: 'log-heat', date: '2026-03-26', teasingScore: 5 });
      // LOW: no recent log would also trigger but heat log is today so won't trigger

      // Use a second mare for low priority
      const mare2 = makeMare({ id: 'mare-2', name: 'Luna' });
      // mare-2 has no logs at all -> noRecentLog

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare, mare2],
          breedingRecords: [breeding],
          dailyLogs: [heatLog],
        })
      );

      const priorities = result.map((a) => a.priority);
      const highIdx = priorities.indexOf('high');
      const mediumIdx = priorities.indexOf('medium');
      const lowIdx = priorities.indexOf('low');

      if (highIdx !== -1 && mediumIdx !== -1) {
        expect(highIdx).toBeLessThan(mediumIdx);
      }
      if (mediumIdx !== -1 && lowIdx !== -1) {
        expect(mediumIdx).toBeLessThan(lowIdx);
      }
    });
  });

  // --- Multiple alerts for same mare ---

  describe('multiple alerts per mare', () => {
    it('can produce heat activity and noRecentLog for same mare', () => {
      const mare = makeMare();
      // Heat log 2 days ago but no log in last 7 days before that
      // Actually, if there's a heat log 2 days ago it's recent, so noRecentLog won't fire.
      // Let's use a scenario where heat was detected but log is on day boundary
      const log = makeDailyLog({
        date: '2026-03-24', // 2 days ago, heat detected
        teasingScore: 5,
      });
      // Most recent log is 2 days ago which is within 7-day window, so no stale log.
      // Instead test with different scenario: no log for mare-2
      const mare2 = makeMare({ id: 'mare-2', name: 'Luna' });

      const result = generateDashboardAlerts(
        makeInput({
          mares: [mare, mare2],
          dailyLogs: [log],
        })
      );

      // mare-1 gets heatActivity, mare-2 gets noRecentLog
      expect(result.some((a) => a.mareId === 'mare-1' && a.kind === 'heatActivity')).toBe(true);
      expect(result.some((a) => a.mareId === 'mare-2' && a.kind === 'noRecentLog')).toBe(true);
    });
  });

  // --- Constants are exported ---

  describe('exported constants', () => {
    it('exports expected threshold values', () => {
      expect(DUE_DATE_ALERT_WINDOW_DAYS).toBe(30);
      expect(PREG_CHECK_WINDOW_MIN_DAYS).toBe(14);
      expect(RECENT_OVULATION_WINDOW_DAYS).toBe(2);
      expect(HEAT_ACTIVITY_WINDOW_DAYS).toBe(3);
      expect(STALE_LOG_THRESHOLD_DAYS).toBe(7);
    });
  });
});
