import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

import { getDb } from '@/storage/db';

import {
  createDailyLog,
  deleteDailyLog,
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

function createExistingDailyLogRow() {
  return {
    id: 'log-1',
    mare_id: 'mare-1',
    date: '2026-04-01',
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
  };
}

describe('daily log repository structured storage', () => {
  let db: FakeDb;

  beforeEach(() => {
    db = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it('writes legacy global ovulation as compatibility value on create', async () => {
    await createDailyLog({
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      ovulationDetected: true,
    });

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[6]).toBe(1);
    expect(params[10]).toBeNull();
    expect(params[15]).toBeNull();
  });

  it('preserves existing global ovulation when update stays in legacy mode', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
    });

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[4]).toBe(1);
  });

  it('derives compatibility ovulation from structured side values when structured mode is active', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      ovulationSource: 'structured',
      rightOvaryOvulation: true,
      leftOvaryOvulation: null,
    });

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[4]).toBe(1);
    expect(params[8]).toBe(1);
    expect(params[13]).toBeNull();
  });

  it('stores empty measurement arrays when follicle state is not measured', async () => {
    await createDailyLog({
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      rightOvaryFollicleState: 'large',
      rightOvaryFollicleMeasurementsMm: [35, 36],
    });

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[12]).toBe('[]');
  });

  it('normalizes discharge notes dependency on dischargeObserved', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      dischargeObserved: false,
      dischargeNotes: 'should not persist',
    });

    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[20]).toBe(0);
    expect(params[21]).toBeNull();
  });

  it('replaces fluid pockets in the same transaction as parent update', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingDailyLogRow());

    await updateDailyLog('log-1', {
      date: '2026-04-02',
      uterineFluidPockets: [{ id: 'pocket-1', depthMm: 5, location: 'leftHorn' }],
    });

    expect(db.runAsync).toHaveBeenCalledTimes(3);
    expect(db.runAsync.mock.calls[0]?.[0]).toContain('UPDATE daily_logs');
    expect(db.runAsync.mock.calls[1]?.[0]).toContain('DELETE FROM uterine_fluid');
    expect(db.runAsync.mock.calls[2]?.[0]).toContain('INSERT INTO uterine_fluid');
  });

  it('deletes uterine fluid children before deleting the daily log parent row', async () => {
    await deleteDailyLog('log-1');

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
