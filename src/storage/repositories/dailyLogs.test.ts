import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

import {
  createDailyLog,
  deleteDailyLog,
  listAllDailyLogs,
  parseFollicleMeasurementsJson,
  parseOvaryStructuresJson,
  updateDailyLog,
} from './dailyLogs';

type FakeDb = {
  runAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
  withTransactionAsync: ReturnType<typeof vi.fn>;
};

function createFakeDb(): FakeDb {
  return {
    runAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
    withTransactionAsync: vi.fn(async (callback: () => Promise<unknown>) => callback()),
  };
}

function createExistingDailyLogRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    mare_id: 'mare-1',
    date: '2026-04-01',
    time: '08:15',
    teasing_score: null,
    right_ovary: 'legacy right',
    left_ovary: 'legacy left',
    ovulation_detected: 1,
    edema: null,
    uterine_tone: 'legacy tone',
    uterine_cysts: null,
    right_ovary_ovulation: null,
    right_ovary_follicle_state: null,
    right_ovary_follicle_measurements_mm: '[]',
    right_ovary_consistency: null,
    right_ovary_structures: '[]',
    left_ovary_ovulation: null,
    left_ovary_follicle_state: null,
    left_ovary_follicle_measurements_mm: '[]',
    left_ovary_consistency: null,
    left_ovary_structures: '[]',
    uterine_tone_category: null,
    cervical_firmness: null,
    discharge_observed: null,
    discharge_notes: null,
    notes: null,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('daily log repository structured storage', () => {
  let db: FakeDb;

  beforeEach(() => {
    db = createFakeDb();
  });

  it('writes legacy global ovulation as compatibility value on create', async () => {
    await createDailyLog({
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      time: '08:00',
      ovulationDetected: true,
    }, db);

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[3]).toBe('08:00');
    expect(params[7]).toBe(1);
    expect(params[11]).toBeNull();
    expect(params[16]).toBeNull();
  });

  it('preserves existing time when update omits time', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toBe('08:15');
  });

  it('preserves existing global ovulation when update stays in legacy mode', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[5]).toBe(1);
  });

  it('derives compatibility ovulation from structured side values when structured mode is active', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      ovulationSource: 'structured',
      rightOvaryOvulation: true,
      leftOvaryOvulation: null,
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[5]).toBe(1);
    expect(params[9]).toBe(1);
    expect(params[14]).toBeNull();
  });

  it('stores empty measurement arrays when follicle state is not measured', async () => {
    await createDailyLog({
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      time: '08:00',
      rightOvaryFollicleState: 'large',
      rightOvaryFollicleMeasurementsMm: [35, 36],
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[13]).toBe('[]');
  });

  it('normalizes discharge notes dependency on dischargeObserved', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      dischargeObserved: false,
      dischargeNotes: 'should not persist',
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[21]).toBe(0);
    expect(params[22]).toBeNull();
  });

  it('replaces fluid pockets in the same transaction as parent update', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      uterineFluidPockets: [{ id: 'pocket-1', depthMm: 5, location: 'leftHorn' }],
    }, db);

    expect(db.runAsync).toHaveBeenCalledTimes(3);
    expect(db.runAsync.mock.calls[0]?.[0]).toContain('UPDATE daily_logs');
    expect(db.runAsync.mock.calls[1]?.[0]).toContain('DELETE FROM uterine_fluid');
    expect(db.runAsync.mock.calls[2]?.[0]).toContain('INSERT INTO uterine_fluid');
  });

  it('rejects create when time is missing', async () => {
    await expect(
      createDailyLog({
        id: 'log-1',
        mareId: 'mare-1',
        date: '2026-04-01',
      } as never, db),
    ).rejects.toThrow('Daily log time is required.');
  });

  it('rejects create when time is invalid', async () => {
    await expect(
      createDailyLog({
        id: 'log-1',
        mareId: 'mare-1',
        date: '2026-04-01',
        time: '29:30',
      }, db),
    ).rejects.toThrow('Daily log time must be a valid HH:MM value.');
  });

  it('allows an untimed legacy row to remain untimed on update', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow({ time: null }));

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      time: null,
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toBeNull();
  });

  it('allows an untimed legacy row to gain a valid time', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow({ time: null }));

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      time: '16:45',
    }, db);

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toBe('16:45');
  });

  it('rejects clearing a timed row back to null', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow({ time: '16:45' }));

    await expect(
      updateDailyLog('log-1', {
        date: '2026-04-02',
        time: null,
      }, db),
    ).rejects.toThrow('Timed daily logs cannot be cleared back to untimed.');
  });

  it('orders listAllDailyLogs with timed rows before untimed rows on the same day', async () => {
    db.getAllAsync.mockResolvedValue([
      createExistingDailyLogRow({ id: 'afternoon', time: '16:00', created_at: '2026-04-01T16:00:00.000Z' }),
      createExistingDailyLogRow({ id: 'morning', time: '08:00', created_at: '2026-04-01T08:00:00.000Z' }),
      createExistingDailyLogRow({ id: 'untimed', time: null, created_at: '2026-04-01T07:00:00.000Z' }),
    ]);

    const result = await listAllDailyLogs(db);

    expect(result.map((log) => log.id)).toEqual(['afternoon', 'morning', 'untimed']);
    expect(db.getAllAsync.mock.calls[0]?.[0]).toContain('CASE WHEN time IS NULL THEN 1 ELSE 0 END');
  });

  it('deletes uterine fluid children before deleting the daily log parent row', async () => {
    await deleteDailyLog('log-1', db);

    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(db.runAsync.mock.calls[0]?.[0]).toContain('DELETE FROM uterine_fluid');
    expect(db.runAsync.mock.calls[1]?.[0]).toContain('DELETE FROM daily_logs');
  });
});

describe('daily log JSON normalization helpers', () => {
  it('parses invalid measurement JSON as empty array', () => {
    expect(parseFollicleMeasurementsJson('{bad json')).toEqual([]);
  });

  it('normalizes measured follicle arrays to values in 0-100 range with up to one decimal place', () => {
    expect(parseFollicleMeasurementsJson('[12, \"15.5\", 0, 100, \"bad\", 16.45, 100.1]')).toEqual([
      12,
      15.5,
      0,
      100,
    ]);
  });

  it('drops invalid structure values and de-duplicates in enum declaration order', () => {
    expect(
      parseOvaryStructuresJson(
        JSON.stringify([
          'follicularCyst',
          'multipleSmallFollicles',
          'follicularCyst',
          'invalid',
          'adhesion',
          'multipleSmallFollicles',
        ]),
      ),
    ).toEqual(['multipleSmallFollicles', 'follicularCyst', 'adhesion']);
  });
});
