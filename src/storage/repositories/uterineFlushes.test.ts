import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/id', () => ({
  newId: vi
    .fn()
    .mockReturnValueOnce('generated-flush-id')
    .mockReturnValueOnce('generated-product-id'),
}));

import {
  deleteByDailyLogId,
  getByDailyLogId,
  replaceByDailyLogId,
} from './uterineFlushes';

type FakeDb = {
  runAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
};

function createFakeDb(): FakeDb {
  return {
    runAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
  };
}

describe('uterine flush repository', () => {
  it('loads a flush with product rows by daily log id', async () => {
    const db = createFakeDb();
    db.getFirstAsync.mockResolvedValue({
      id: 'flush-1',
      daily_log_id: 'log-1',
      base_solution: 'LRS',
      total_volume_ml: 1000,
      notes: 'Clear return',
      created_at: '2026-04-01T12:00:00.000Z',
      updated_at: '2026-04-01T12:00:00.000Z',
    });
    db.getAllAsync.mockResolvedValue([
      {
        id: 'product-1',
        uterine_flush_id: 'flush-1',
        product_name: 'Saline',
        dose: '1000 mL',
        notes: null,
        created_at: '2026-04-01T12:00:00.000Z',
        updated_at: '2026-04-01T12:00:00.000Z',
      },
    ]);

    const flush = await getByDailyLogId(db as never, 'log-1');

    expect(flush).toMatchObject({
      id: 'flush-1',
      dailyLogId: 'log-1',
      baseSolution: 'LRS',
      totalVolumeMl: 1000,
      products: [
        {
          id: 'product-1',
          productName: 'Saline',
          dose: '1000 mL',
        },
      ],
    });
  });

  it('replaces rows by deleting the old flush tree and inserting normalized rows', async () => {
    const db = createFakeDb();

    await replaceByDailyLogId(
      db as never,
      'log-1',
      {
        baseSolution: ' LRS ',
        totalVolumeMl: 1000,
        notes: ' Clear return ',
        products: [
          {
            productName: ' Saline ',
            dose: ' 1000 mL ',
            notes: '',
          },
        ],
      },
      '2026-04-01T12:00:00.000Z',
    );

    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(db.runAsync.mock.calls[0]?.[0]).toContain('INSERT INTO uterine_flushes');
    expect(db.runAsync.mock.calls[0]?.[1]).toEqual([
      'generated-flush-id',
      'log-1',
      'LRS',
      1000,
      'Clear return',
      '2026-04-01T12:00:00.000Z',
      '2026-04-01T12:00:00.000Z',
    ]);
    expect(db.runAsync.mock.calls[1]?.[0]).toContain('INSERT INTO uterine_flush_products');
    expect(db.runAsync.mock.calls[1]?.[1]).toEqual([
      'generated-product-id',
      'generated-flush-id',
      'Saline',
      '1000 mL',
      null,
      '2026-04-01T12:00:00.000Z',
      '2026-04-01T12:00:00.000Z',
    ]);
  });

  it('deletes products before deleting the flush parent', async () => {
    const db = createFakeDb();
    db.getFirstAsync.mockResolvedValue({ id: 'flush-1' });

    await deleteByDailyLogId(db as never, 'log-1');

    expect(db.runAsync.mock.calls[0]?.[0]).toContain('DELETE FROM uterine_flush_products');
    expect(db.runAsync.mock.calls[1]?.[0]).toContain('DELETE FROM uterine_flushes');
  });

  it('rejects invalid replacement input', async () => {
    const db = createFakeDb();

    await expect(
      replaceByDailyLogId(db as never, 'log-1', {
        baseSolution: '',
        totalVolumeMl: 0,
        products: [],
      }),
    ).rejects.toThrow('At least one flush product is required.');
  });
});
