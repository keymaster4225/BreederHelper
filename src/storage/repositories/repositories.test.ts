import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/storage/db';
import {
  createBreedingRecord,
  createDailyLog,
  createFoalingRecord,
  createPregnancyCheck,
  createStallion,
  deleteBreedingRecord,
  deleteDailyLog,
  getBreedingRecordById,
  getDailyLogById,
  getFoalingRecordById,
  getPregnancyCheckById,
  updateDailyLog,
} from '@/storage/repositories/queries';
import { createMare, getMareById, listMares, softDeleteMare, updateMare } from '@/storage/repositories/mares';

type MareRow = {
  id: string;
  name: string;
  breed: string;
  date_of_birth: string | null;
  registration_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type DailyLogRow = {
  id: string;
  mare_id: string;
  date: string;
  teasing_score: number | null;
  right_ovary: string | null;
  left_ovary: string | null;
  edema: number | null;
  uterine_tone: string | null;
  uterine_cysts: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type StallionRow = {
  id: string;
  name: string;
  breed: string | null;
  registration_number: string | null;
  sire: string | null;
  dam: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type BreedingRecordRow = {
  id: string;
  mare_id: string;
  stallion_id: string | null;
  stallion_name: string | null;
  date: string;
  method: string;
  notes: string | null;
  volume_ml: number | null;
  concentration_m_per_ml: number | null;
  motility_percent: number | null;
  number_of_straws: number | null;
  straw_volume_ml: number | null;
  straw_details: string | null;
  collection_date: string | null;
  created_at: string;
  updated_at: string;
};

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

type FoalingRecordRow = {
  id: string;
  mare_id: string;
  breeding_record_id: string | null;
  date: string;
  outcome: string;
  foal_sex: string | null;
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FakeDb = {
  runAsync: (sql: string, params?: unknown[]) => Promise<void>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeDb(): FakeDb {
  const mares = new Map<string, MareRow>();
  const dailyLogs = new Map<string, DailyLogRow>();
  const stallions = new Map<string, StallionRow>();
  const breedingRecords = new Map<string, BreedingRecordRow>();
  const pregnancyChecks = new Map<string, PregnancyCheckRow>();

  const foalingRecords = new Map<string, FoalingRecordRow>();

  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('insert into mares')) {
        const [id, name, breed, dateOfBirth, registrationNumber, notes, createdAt, updatedAt] = params as [
          string,
          string,
          string,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        mares.set(id, {
          id,
          name,
          breed,
          date_of_birth: dateOfBirth,
          registration_number: registrationNumber,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
          deleted_at: null,
        });
        return;
      }

      if (stmt.startsWith('update mares set name =')) {
        const [name, breed, dateOfBirth, registrationNumber, notes, updatedAt, id] = params as [
          string,
          string,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        const existing = mares.get(id);
        if (!existing) return;
        mares.set(id, {
          ...existing,
          name,
          breed,
          date_of_birth: dateOfBirth,
          registration_number: registrationNumber,
          notes,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update mares set deleted_at =')) {
        const [deletedAt, updatedAt, id] = params as [string, string, string];
        const existing = mares.get(id);
        if (!existing) return;
        mares.set(id, { ...existing, deleted_at: deletedAt, updated_at: updatedAt });
        return;
      }

      if (stmt.startsWith('insert into daily_logs')) {
        const [
          id,
          mareId,
          date,
          teasingScore,
          rightOvary,
          leftOvary,
          edema,
          uterineTone,
          uterineCysts,
          notes,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
          number | null,
          string | null,
          string | null,
          number | null,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        dailyLogs.set(id, {
          id,
          mare_id: mareId,
          date,
          teasing_score: teasingScore,
          right_ovary: rightOvary,
          left_ovary: leftOvary,
          edema,
          uterine_tone: uterineTone,
          uterine_cysts: uterineCysts,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update daily_logs set')) {
        const [
          date,
          teasingScore,
          rightOvary,
          leftOvary,
          edema,
          uterineTone,
          uterineCysts,
          notes,
          updatedAt,
          id,
        ] = params as [
          string,
          number | null,
          string | null,
          string | null,
          number | null,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        const existing = dailyLogs.get(id);
        if (!existing) return;
        dailyLogs.set(id, {
          ...existing,
          date,
          teasing_score: teasingScore,
          right_ovary: rightOvary,
          left_ovary: leftOvary,
          edema,
          uterine_tone: uterineTone,
          uterine_cysts: uterineCysts,
          notes,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('delete from daily_logs')) {
        const [id] = params as [string];
        dailyLogs.delete(id);
        return;
      }

      if (stmt.startsWith('insert into stallions')) {
        const [id, name, breed, registrationNumber, sire, dam, notes, createdAt, updatedAt] = params as [
          string,
          string,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        stallions.set(id, {
          id,
          name,
          breed,
          registration_number: registrationNumber,
          sire,
          dam,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
          deleted_at: null,
        });
        return;
      }

      if (stmt.startsWith('insert into breeding_records')) {
        const [
          id,
          mareId,
          stallionId,
          stallionName,
          date,
          method,
          notes,
          volumeMl,
          concentration,
          motility,
          numberOfStraws,
          strawVolumeMl,
          strawDetails,
          collectionDate,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string | null,
          string | null,
          string,
          string,
          string | null,
          number | null,
          number | null,
          number | null,
          number | null,
          number | null,
          string | null,
          string | null,
          string,
          string,
        ];
        breedingRecords.set(id, {
          id,
          mare_id: mareId,
          stallion_id: stallionId,
          stallion_name: stallionName,
          date,
          method,
          notes,
          volume_ml: volumeMl,
          concentration_m_per_ml: concentration,
          motility_percent: motility,
          number_of_straws: numberOfStraws,
          straw_volume_ml: strawVolumeMl,
          straw_details: strawDetails,
          collection_date: collectionDate,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('insert into pregnancy_checks')) {
        const [id, mareId, breedingRecordId, date, result, heartbeat, notes, createdAt, updatedAt] = params as [
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
          heartbeat_detected: heartbeat,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('insert into foaling_records')) {
        const [id, mareId, breedingRecordId, date, outcome, foalSex, complications, notes, createdAt, updatedAt] =
          params as [string, string, string | null, string, string, string | null, string | null, string | null, string, string];
        foalingRecords.set(id, {
          id,
          mare_id: mareId,
          breeding_record_id: breedingRecordId,
          date,
          outcome,
          foal_sex: foalSex,
          complications,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('delete from breeding_records')) {
        const [id] = params as [string];
        const referenced = Array.from(pregnancyChecks.values()).some((row) => row.breeding_record_id === id);
        if (referenced) {
          throw new Error('FOREIGN KEY constraint failed');
        }
        breedingRecords.delete(id);
        return;
      }
    },

    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = normalized(sql);

      if (stmt.includes('from mares') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (mares.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('from daily_logs') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (dailyLogs.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('from pregnancy_checks') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (pregnancyChecks.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('from foaling_records') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (foalingRecords.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('from breeding_records') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (breedingRecords.get(id) as T | undefined) ?? null;
      }

      return null;
    },

    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = normalized(sql);

      if (stmt.includes('from mares')) {
        let values = Array.from(mares.values());
        if (stmt.includes('where deleted_at is null')) {
          values = values.filter((row) => row.deleted_at === null);
        }
        values.sort((a, b) => a.name.localeCompare(b.name));
        return values as T[];
      }

      if (stmt.includes('from daily_logs') && stmt.includes('where mare_id = ?')) {
        const [mareId] = params as [string];
        const values = Array.from(dailyLogs.values())
          .filter((row) => row.mare_id === mareId)
          .sort((a, b) => b.date.localeCompare(a.date));
        return values as T[];
      }

      return [];
    },
  };
}

describe('repository smoke tests', () => {
  beforeEach(() => {
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockResolvedValue(createFakeDb() as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it('supports mare create/get/update/list/soft-delete flow', async () => {
    await createMare({
      id: 'mare-1',
      name: 'Astra',
      breed: 'Thoroughbred',
      dateOfBirth: '2018-03-01',
      registrationNumber: 'REG-1',
      notes: 'Initial',
    });

    const created = await getMareById('mare-1');
    expect(created?.name).toBe('Astra');
    expect(created?.breed).toBe('Thoroughbred');

    await updateMare('mare-1', {
      name: 'Astra Prime',
      breed: 'Arabian',
      dateOfBirth: '2018-03-01',
      registrationNumber: 'REG-2',
      notes: 'Updated',
    });

    const updated = await getMareById('mare-1');
    expect(updated?.name).toBe('Astra Prime');
    expect(updated?.registrationNumber).toBe('REG-2');

    const listedBeforeDelete = await listMares();
    expect(listedBeforeDelete).toHaveLength(1);

    await softDeleteMare('mare-1');

    const listedAfterDelete = await listMares();
    expect(listedAfterDelete).toHaveLength(0);

    const includeDeleted = await listMares(true);
    expect(includeDeleted).toHaveLength(1);
    expect(includeDeleted[0].deletedAt).not.toBeNull();
  });

  it('supports daily log create/get/update/delete flow', async () => {
    await createMare({ id: 'mare-2', name: 'Nova', breed: 'Quarter Horse' });

    await createDailyLog({
      id: 'log-1',
      mareId: 'mare-2',
      date: '2026-03-10',
      teasingScore: 3,
      edema: 2,
      notes: 'Baseline',
    });

    const created = await getDailyLogById('log-1');
    expect(created?.date).toBe('2026-03-10');
    expect(created?.teasingScore).toBe(3);

    await updateDailyLog('log-1', {
      date: '2026-03-11',
      teasingScore: 4,
      edema: 3,
      rightOvary: '35mm',
      notes: 'Updated note',
    });

    const updated = await getDailyLogById('log-1');
    expect(updated?.date).toBe('2026-03-11');
    expect(updated?.teasingScore).toBe(4);
    expect(updated?.rightOvary).toBe('35mm');

    await deleteDailyLog('log-1');

    const deleted = await getDailyLogById('log-1');
    expect(deleted).toBeNull();
  });

  it('negative pregnancy check stores null heartbeatDetected', async () => {
    await createMare({ id: 'mare-hb', name: 'Luna', breed: 'Warmblood' });
    await createStallion({ id: 'stallion-hb', name: 'Storm' });
    await createBreedingRecord({
      id: 'breed-hb',
      mareId: 'mare-hb',
      stallionId: 'stallion-hb',
      date: '2026-05-01',
      method: 'freshAI',
    });
    await createPregnancyCheck({
      id: 'check-hb',
      mareId: 'mare-hb',
      breedingRecordId: 'breed-hb',
      date: '2026-05-15',
      result: 'negative',
      heartbeatDetected: null,
    });

    const check = await getPregnancyCheckById('check-hb');
    expect(check).not.toBeNull();
    expect(check?.heartbeatDetected).toBeNull();
  });

  it('foaling record stores null foalSex when not provided', async () => {
    await createMare({ id: 'mare-fs', name: 'Rosie', breed: 'Quarter Horse' });
    await createFoalingRecord({
      id: 'foal-fs',
      mareId: 'mare-fs',
      date: '2026-07-01',
      outcome: 'liveFoal',
      foalSex: null,
    });

    const record = await getFoalingRecordById('foal-fs');
    expect(record).not.toBeNull();
    expect(record?.foalSex).toBeNull();
  });

  it('creates breeding record with stallion_name instead of stallionId', async () => {
    await createMare({ id: 'mare-sn', name: 'Bella', breed: 'Thoroughbred' });
    await createBreedingRecord({
      id: 'breed-sn',
      mareId: 'mare-sn',
      stallionId: null,
      stallionName: 'Outside Stallion',
      date: '2026-06-01',
      method: 'liveCover',
    });

    const record = await getBreedingRecordById('breed-sn');
    expect(record).not.toBeNull();
    expect(record?.stallionId).toBeNull();
    expect(record?.stallionName).toBe('Outside Stallion');
  });

  it('blocks breeding record delete when pregnancy checks reference it', async () => {
    await createMare({ id: 'mare-3', name: 'Ivy', breed: 'Warmblood' });
    await createStallion({ id: 'stallion-1', name: 'Atlas' });

    await createBreedingRecord({
      id: 'breed-1',
      mareId: 'mare-3',
      stallionId: 'stallion-1',
      date: '2026-04-01',
      method: 'freshAI',
    });

    await createPregnancyCheck({
      id: 'preg-1',
      mareId: 'mare-3',
      breedingRecordId: 'breed-1',
      date: '2026-04-15',
      result: 'positive',
      heartbeatDetected: true,
    });

    await expect(deleteBreedingRecord('breed-1')).rejects.toThrow('FOREIGN KEY constraint failed');
  });
});
