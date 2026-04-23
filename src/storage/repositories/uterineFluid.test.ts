import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/id', () => ({
  newId: vi.fn(() => 'generated-pocket-id'),
}));

import {
  deleteByDailyLogId,
  listByDailyLogId,
  replaceByDailyLogId,
} from './uterineFluid';

type FakeDb = {
  runAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
};

function createFakeDb(): FakeDb {
  return {
    runAsync: vi.fn().mockResolvedValue(undefined),
    getAllAsync: vi.fn().mockResolvedValue([]),
  };
}

describe('uterine fluid repository', () => {
  it('maps valid rows and skips invalid rows when listing', async () => {
    const db = createFakeDb();
    db.getAllAsync.mockResolvedValue([
      {
        id: 'pocket-1',
        daily_log_id: 'log-1',
        depth_mm: 7,
        location: 'leftHorn',
        created_at: '2026-04-01T12:00:00.000Z',
        updated_at: '2026-04-01T12:00:00.000Z',
      },
      {
        id: 'pocket-2',
        daily_log_id: 'log-1',
        depth_mm: 0,
        location: 'leftHorn',
        created_at: '2026-04-01T12:00:00.000Z',
        updated_at: '2026-04-01T12:00:00.000Z',
      },
      {
        id: 'pocket-3',
        daily_log_id: 'log-1',
        depth_mm: 4,
        location: 'invalid-location',
        created_at: '2026-04-01T12:00:00.000Z',
        updated_at: '2026-04-01T12:00:00.000Z',
      },
    ]);

    const pockets = await listByDailyLogId(db as never, 'log-1');

    expect(pockets).toEqual([
      {
        id: 'pocket-1',
        dailyLogId: 'log-1',
        depthMm: 7,
        location: 'leftHorn',
        createdAt: '2026-04-01T12:00:00.000Z',
        updatedAt: '2026-04-01T12:00:00.000Z',
      },
    ]);
  });

  it('replaces rows by deleting old pockets and inserting new pockets', async () => {
    const db = createFakeDb();

    await replaceByDailyLogId(
      db as never,
      'log-1',
      [
        { depthMm: 6, location: 'leftHorn' },
        { id: 'pocket-2', depthMm: 3, location: 'uterineBody' },
      ],
      '2026-04-01T12:00:00.000Z',
    );

    expect(db.runAsync).toHaveBeenCalledTimes(3);
    expect(db.runAsync.mock.calls[0]?.[0]).toContain('DELETE FROM uterine_fluid');
    expect(db.runAsync.mock.calls[0]?.[1]).toEqual(['log-1']);

    expect(db.runAsync.mock.calls[1]?.[0]).toContain('INSERT INTO uterine_fluid');
    expect(db.runAsync.mock.calls[1]?.[1]).toEqual([
      'generated-pocket-id',
      'log-1',
      6,
      'leftHorn',
      '2026-04-01T12:00:00.000Z',
      '2026-04-01T12:00:00.000Z',
    ]);

    expect(db.runAsync.mock.calls[2]?.[1]).toEqual([
      'pocket-2',
      'log-1',
      3,
      'uterineBody',
      '2026-04-01T12:00:00.000Z',
      '2026-04-01T12:00:00.000Z',
    ]);
  });

  it('throws when replacing with invalid depth', async () => {
    const db = createFakeDb();

    await expect(
      replaceByDailyLogId(db as never, 'log-1', [{ depthMm: 0, location: 'leftHorn' }]),
    ).rejects.toThrow('Uterine fluid depth must be a whole number greater than 0.');
  });

  it('deletes by daily log id', async () => {
    const db = createFakeDb();

    await deleteByDailyLogId(db as never, 'log-1');

    expect(db.runAsync).toHaveBeenCalledWith(
      'DELETE FROM uterine_fluid WHERE daily_log_id = ?;',
      ['log-1'],
    );
  });
});
