import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

import {
  createMedicationLog,
  listMedicationLogsByMare,
  updateMedicationLog,
} from './medications';
import {
  createRepoDb,
  expectInsertForTable,
  expectUpdateForTable,
  type RepoDbHarness,
} from '@/test/repoDb';

function createExistingMedicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'med-1',
    mare_id: 'mare-1',
    date: '2026-05-05',
    time: '08:30',
    medication_name: 'Regumate',
    dose: null,
    route: null,
    notes: null,
    source_daily_log_id: null,
    created_at: '2026-05-05T08:30:00.000Z',
    updated_at: '2026-05-05T08:30:00.000Z',
    ...overrides,
  };
}

describe('medication log repository time handling', () => {
  let db: RepoDbHarness;

  beforeEach(() => {
    db = createRepoDb();
  });

  it('requires and persists normalized time on manual create', async () => {
    await createMedicationLog(
      {
        id: 'med-1',
        mareId: 'mare-1',
        date: '2026-05-05',
        time: ' 08:30 ',
        medicationName: 'Regumate',
      },
      db,
    );

    const { params } = expectInsertForTable(db, 'medication_logs');
    expect(params.time).toBe('08:30');
    expect(params.source_daily_log_id).toBeNull();
  });

  it('rejects missing and malformed manual create times', async () => {
    await expect(
      createMedicationLog({
        id: 'med-1',
        mareId: 'mare-1',
        date: '2026-05-05',
        medicationName: 'Regumate',
      }, db),
    ).rejects.toThrow('Medication log time is required.');

    await expect(
      createMedicationLog({
        id: 'med-2',
        mareId: 'mare-1',
        date: '2026-05-05',
        time: '8:30',
        medicationName: 'Regumate',
      }, db),
    ).rejects.toThrow('Medication log time is required.');
  });

  it('persists replacement time on update', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingMedicationRow());

    await updateMedicationLog(
      'med-1',
      {
        date: '2026-05-05',
        time: '18:15',
        medicationName: 'Regumate',
      },
      db,
    );

    const { params } = expectUpdateForTable(db, 'medication_logs');
    expect(params.time).toBe('18:15');
  });

  it('rejects clearing a timed manual row back to untimed', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingMedicationRow());

    await expect(
      updateMedicationLog(
        'med-1',
        {
          date: '2026-05-05',
          time: null,
          medicationName: 'Regumate',
        },
        db,
      ),
    ).rejects.toThrow('Timed medication logs cannot be cleared back to untimed.');
  });

  it('allows an untimed legacy row to remain untimed', async () => {
    db.getFirstAsync.mockResolvedValue(createExistingMedicationRow({ time: null }));

    await updateMedicationLog(
      'med-1',
      {
        date: '2026-05-05',
        time: null,
        medicationName: 'Regumate',
      },
      db,
    );

    const { params } = expectUpdateForTable(db, 'medication_logs');
    expect(params.time).toBeNull();
  });

  it('uses explicit date and time ordering for mare lists', async () => {
    db.getAllAsync.mockResolvedValue([
      createExistingMedicationRow({ id: 'evening', time: '18:00' }),
      createExistingMedicationRow({ id: 'morning', time: '08:00' }),
      createExistingMedicationRow({ id: 'legacy', time: null }),
    ]);

    const result = await listMedicationLogsByMare('mare-1', db);

    expect(result.map((log) => log.id)).toEqual(['evening', 'morning', 'legacy']);
    expect(db.getAllAsync.mock.calls[0]?.[0]).toContain('time IS NULL ASC');
    expect(db.getAllAsync.mock.calls[0]?.[0]).toContain('time DESC');
  });
});
