import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

import { getDb } from '@/storage/db';

import { createDailyLog, updateDailyLog } from './dailyLogs';

type FakeDb = {
  runAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
};

const STORAGE_CASES = [
  { label: 'unknown', value: null, expected: null },
  { label: 'no', value: false, expected: 0 },
  { label: 'yes', value: true, expected: 1 },
] as const;

function createFakeDb(): FakeDb {
  return {
    runAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
  };
}

describe('daily log repository ovulation storage', () => {
  let db: FakeDb;

  beforeEach(() => {
    db = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it.each(STORAGE_CASES)('writes $label as $expected on create', async ({ value, expected }) => {
    await createDailyLog({
      id: 'log-1',
      mareId: 'mare-1',
      date: '2026-04-01',
      ovulationDetected: value,
    });

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[6]).toBe(expected);
  });

  it.each(STORAGE_CASES)('writes $label as $expected on update', async ({ value, expected }) => {
    await updateDailyLog('log-1', {
      date: '2026-04-01',
      ovulationDetected: value,
    });

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const params = db.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(params[4]).toBe(expected);
  });
});
