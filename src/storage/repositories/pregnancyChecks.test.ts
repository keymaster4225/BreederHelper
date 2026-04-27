import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

vi.mock('./breedingRecords', () => ({
  getBreedingRecordById: vi.fn(),
}));

vi.mock('./tasks', () => ({
  completeOpenBreedingPregnancyCheckTask: vi.fn(),
}));

import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { createRepoDb, type SqlCall } from '@/test/repoDb';
import { getBreedingRecordById } from './breedingRecords';
import {
  createPregnancyCheck,
  deletePregnancyCheck,
  getPregnancyCheckById,
  updatePregnancyCheck,
} from './pregnancyChecks';
import { completeOpenBreedingPregnancyCheckTask } from './tasks';

type PregnancyCheckRow = {
  id: string;
  mare_id: string;
  breeding_record_id: string;
  date: string;
  result: 'positive' | 'negative';
  heartbeat_detected: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function createPregnancyCheckRepoHarness() {
  const pregnancyChecks = new Map<string, PregnancyCheckRow>([
    [
      'check-1',
      {
        id: 'check-1',
        mare_id: 'mare-1',
        breeding_record_id: 'breed-old',
        date: '2026-04-16',
        result: 'positive',
        heartbeat_detected: 1,
        notes: null,
        created_at: '2026-04-16T00:00:00.000Z',
        updated_at: '2026-04-16T00:00:00.000Z',
      },
    ],
  ]);

  const db = createRepoDb({
    onRun(call) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.startsWith('insert into pregnancy_checks')) {
        const [
          id,
          mareId,
          breedingRecordId,
          date,
          result,
          heartbeatDetected,
          notes,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
          string,
          'positive' | 'negative',
          number | null,
          string | null,
          string,
          string,
        ];

        pregnancyChecks.set(id, {
          id,
          mare_id: mareId,
          breeding_record_id: breedingRecordId,
          date,
          result,
          heartbeat_detected: heartbeatDetected,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update pregnancy_checks')) {
        const [breedingRecordId, date, result, heartbeatDetected, notes, updatedAt, id] =
          params as [
            string,
            string,
            'positive' | 'negative',
            number | null,
            string | null,
            string,
            string,
          ];
        const existing = pregnancyChecks.get(id);
        if (!existing) return;

        pregnancyChecks.set(id, {
          ...existing,
          breeding_record_id: breedingRecordId,
          date,
          result,
          heartbeat_detected: heartbeatDetected,
          notes,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('delete from pregnancy_checks')) {
        pregnancyChecks.delete(params[0] as string);
      }
    },
    onGetFirst<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.includes('from pregnancy_checks') && stmt.includes('where id = ?')) {
        return (pregnancyChecks.get(params[0] as string) as T | undefined) ?? null;
      }

      return null;
    },
  });

  return Object.assign(db, { pregnancyChecks });
}

describe('pregnancyChecks generated task integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBreedingRecordById).mockImplementation(async (breedingRecordId: string) => ({
      id: breedingRecordId,
      mareId: 'mare-1',
    }) as never);
  });

  it('completes the matching generated task when creating a pregnancy check', async () => {
    const db = createPregnancyCheckRepoHarness();

    await createPregnancyCheck({
      id: 'check-new',
      mareId: 'mare-1',
      breedingRecordId: 'breed-1',
      date: '2026-05-11',
      result: 'positive',
      heartbeatDetected: true,
    }, db);

    expect(completeOpenBreedingPregnancyCheckTask).toHaveBeenCalledWith(
      'breed-1',
      'check-new',
      db,
    );
    expect(await getPregnancyCheckById('check-new', db)).toMatchObject({
      breedingRecordId: 'breed-1',
      heartbeatDetected: true,
    });
    expect(emitDataInvalidation).toHaveBeenCalledWith('pregnancyChecks');
  });

  it('completes the generated task for the selected breeding record on update', async () => {
    const db = createPregnancyCheckRepoHarness();

    await updatePregnancyCheck('check-1', {
      breedingRecordId: 'breed-new',
      date: '2026-05-12',
      result: 'negative',
      heartbeatDetected: null,
    }, db);

    expect(completeOpenBreedingPregnancyCheckTask).toHaveBeenCalledTimes(1);
    expect(completeOpenBreedingPregnancyCheckTask).toHaveBeenCalledWith(
      'breed-new',
      'check-1',
      db,
    );
    expect(completeOpenBreedingPregnancyCheckTask).not.toHaveBeenCalledWith(
      'breed-old',
      'check-1',
      db,
    );
    expect(await getPregnancyCheckById('check-1', db)).toMatchObject({
      breedingRecordId: 'breed-new',
      result: 'negative',
    });
  });

  it('does not reopen a generated task when deleting a pregnancy check', async () => {
    const db = createPregnancyCheckRepoHarness();

    await deletePregnancyCheck('check-1', db);

    expect(db.pregnancyChecks.has('check-1')).toBe(false);
    expect(completeOpenBreedingPregnancyCheckTask).not.toHaveBeenCalled();
    expect(emitDataInvalidation).toHaveBeenCalledWith('pregnancyChecks');
  });
});
