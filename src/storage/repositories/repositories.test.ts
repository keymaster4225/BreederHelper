import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/storage/db';
import {
  createBreedingRecord,
  createDailyLog,
  createFoal,
  createFoalingRecord,
  createPregnancyCheck,
  createStallion,
  deleteBreedingRecord,
  deleteDailyLog,
  deleteFoal,
  getBreedingRecordById,
  getDailyLogById,
  getFoalByFoalingRecordId,
  getFoalById,
  getFoalingRecordById,
  getPregnancyCheckById,
  listFoalsByMare,
  parseIggTests,
  parseFoalMilestones,
  updateBreedingRecord,
  updateFoalingRecord,
  updatePregnancyCheck,
  updateDailyLog,
  updateFoal,
} from '@/storage/repositories/queries';
import { serializeIggTestsForSave } from '@/storage/repositories/internal/foalCodecs';
import { createMare, getMareById, listMares, softDeleteMare, updateMare } from '@/storage/repositories/mares';

type MareRow = {
  id: string;
  name: string;
  breed: string;
  gestation_length_days: number;
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
  ovulation_detected: number | null;
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
  collection_id: string | null;
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

type FoalRow = {
  id: string;
  foaling_record_id: string;
  name: string | null;
  sex: string | null;
  color: string | null;
  markings: string | null;
  birth_weight_lbs: number | null;
  milestones: string;
  igg_tests: string;
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
  const foals = new Map<string, FoalRow>();

  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('insert into mares')) {
        const [id, name, breed, gestationLengthDays, dateOfBirth, registrationNumber, notes, createdAt, updatedAt] = params as [
          string,
          string,
          string,
          number,
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
          gestation_length_days: gestationLengthDays,
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
        const [name, breed, gestationLengthDays, dateOfBirth, registrationNumber, notes, updatedAt, id] = params as [
          string,
          string,
          number,
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
          gestation_length_days: gestationLengthDays,
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
          ovulationDetected,
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
          ovulation_detected: ovulationDetected,
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
          ovulationDetected,
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
          ovulation_detected: ovulationDetected,
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
          collectionId,
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
          collection_id: collectionId,
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

      if (stmt.startsWith('update breeding_records set')) {
        const [
          stallionId,
          stallionName,
          collectionId,
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
          updatedAt,
          id,
        ] = params as [
          string | null,
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
        const existing = breedingRecords.get(id);
        if (!existing) return;
        breedingRecords.set(id, {
          ...existing,
          stallion_id: stallionId,
          stallion_name: stallionName,
          collection_id: collectionId,
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

      if (stmt.startsWith('update pregnancy_checks set')) {
        const [breedingRecordId, date, result, heartbeat, notes, updatedAt, id] = params as [
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
          heartbeat_detected: heartbeat,
          notes,
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

      if (stmt.startsWith('update foaling_records set')) {
        const [breedingRecordId, date, outcome, foalSex, complications, notes, updatedAt, id] = params as [
          string | null,
          string,
          string,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        const existing = foalingRecords.get(id);
        if (!existing) return;
        foalingRecords.set(id, {
          ...existing,
          breeding_record_id: breedingRecordId,
          date,
          outcome,
          foal_sex: foalSex,
          complications,
          notes,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('insert into foals')) {
        const [id, foalingRecordId, name, sex, color, markings, birthWeightLbs, milestones, iggTests, notes, createdAt, updatedAt] =
          params as [string, string, string | null, string | null, string | null, string | null, number | null, string, string, string | null, string, string];
        const duplicate = Array.from(foals.values()).some((f) => f.foaling_record_id === foalingRecordId);
        if (duplicate) {
          throw new Error('UNIQUE constraint failed: foals.foaling_record_id');
        }
        foals.set(id, {
          id,
          foaling_record_id: foalingRecordId,
          name,
          sex,
          color,
          markings,
          birth_weight_lbs: birthWeightLbs,
          milestones,
          igg_tests: iggTests,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update foals set')) {
        const [name, sex, color, markings, birthWeightLbs, milestones, iggTests, notes, updatedAt, id] =
          params as [string | null, string | null, string | null, string | null, number | null, string, string, string | null, string, string];
        const existing = foals.get(id);
        if (!existing) return;
        foals.set(id, {
          ...existing,
          name,
          sex,
          color,
          markings,
          birth_weight_lbs: birthWeightLbs,
          milestones,
          igg_tests: iggTests,
          notes,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('delete from foals')) {
        const [id] = params as [string];
        foals.delete(id);
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

      if (stmt.includes('from foals') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (foals.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('from foals') && stmt.includes('where foaling_record_id = ?')) {
        const [foalingRecordId] = params as [string];
        const match = Array.from(foals.values()).find((f) => f.foaling_record_id === foalingRecordId);
        return (match as T | undefined) ?? null;
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

      if (stmt.includes('from foals') && stmt.includes('mare_id = ?')) {
        const [mareId] = params as [string];
        const foalingRecordIds = new Set(
          Array.from(foalingRecords.values())
            .filter((fr) => fr.mare_id === mareId)
            .map((fr) => fr.id)
        );
        const values = Array.from(foals.values())
          .filter((f) => foalingRecordIds.has(f.foaling_record_id));
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
      gestationLengthDays: 340,
      dateOfBirth: '2018-03-01',
      registrationNumber: 'REG-1',
      notes: 'Initial',
    });

    const created = await getMareById('mare-1');
    expect(created?.name).toBe('Astra');
    expect(created?.breed).toBe('Thoroughbred');
    expect(created?.gestationLengthDays).toBe(340);

    await updateMare('mare-1', {
      name: 'Astra Prime',
      breed: 'Arabian',
      gestationLengthDays: 345,
      dateOfBirth: '2018-03-01',
      registrationNumber: 'REG-2',
      notes: 'Updated',
    });

    const updated = await getMareById('mare-1');
    expect(updated?.name).toBe('Astra Prime');
    expect(updated?.registrationNumber).toBe('REG-2');
    expect(updated?.gestationLengthDays).toBe(345);

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

  it('pregnancy check rejects a missing breeding record before SQLite', async () => {
    await createMare({ id: 'mare-preg-missing', name: 'Lark', breed: 'Warmblood' });

    await expect(
      createPregnancyCheck({
        id: 'check-missing',
        mareId: 'mare-preg-missing',
        breedingRecordId: 'breed-missing',
        date: '2026-05-15',
        result: 'positive',
      }),
    ).rejects.toThrow('Breeding record not found.');
  });

  it('pregnancy check rejects breeding records from a different mare', async () => {
    await createMare({ id: 'mare-preg-a', name: 'June', breed: 'Quarter Horse' });
    await createMare({ id: 'mare-preg-b', name: 'Maple', breed: 'Arabian' });
    await createStallion({ id: 'stallion-preg', name: 'Comet' });
    await createBreedingRecord({
      id: 'breed-preg-a',
      mareId: 'mare-preg-a',
      stallionId: 'stallion-preg',
      date: '2026-05-01',
      method: 'freshAI',
    });

    await expect(
      createPregnancyCheck({
        id: 'check-wrong-mare',
        mareId: 'mare-preg-b',
        breedingRecordId: 'breed-preg-a',
        date: '2026-05-16',
        result: 'positive',
      }),
    ).rejects.toThrow('Breeding record belongs to a different mare.');
  });

  it('pregnancy check update rejects a missing breeding record', async () => {
    await createMare({ id: 'mare-preg-update', name: 'Iris', breed: 'Warmblood' });
    await createStallion({ id: 'stallion-preg-update', name: 'North' });
    await createBreedingRecord({
      id: 'breed-preg-update',
      mareId: 'mare-preg-update',
      stallionId: 'stallion-preg-update',
      date: '2026-05-01',
      method: 'freshAI',
    });
    await createPregnancyCheck({
      id: 'check-update',
      mareId: 'mare-preg-update',
      breedingRecordId: 'breed-preg-update',
      date: '2026-05-15',
      result: 'positive',
    });

    await expect(
      updatePregnancyCheck('check-update', {
        breedingRecordId: 'breed-does-not-exist',
        date: '2026-05-16',
        result: 'negative',
      }),
    ).rejects.toThrow('Breeding record not found.');
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

  it('foaling record rejects a missing breeding record before SQLite', async () => {
    await createMare({ id: 'mare-foaling-missing', name: 'Ruby', breed: 'Thoroughbred' });

    await expect(
      createFoalingRecord({
        id: 'foaling-missing',
        mareId: 'mare-foaling-missing',
        breedingRecordId: 'breed-missing',
        date: '2026-07-01',
        outcome: 'liveFoal',
      }),
    ).rejects.toThrow('Breeding record not found.');
  });

  it('foaling record rejects breeding records from a different mare', async () => {
    await createMare({ id: 'mare-foaling-a', name: 'Skye', breed: 'Warmblood' });
    await createMare({ id: 'mare-foaling-b', name: 'Fern', breed: 'Arabian' });
    await createStallion({ id: 'stallion-foaling', name: 'Drift' });
    await createBreedingRecord({
      id: 'breed-foaling-a',
      mareId: 'mare-foaling-a',
      stallionId: 'stallion-foaling',
      date: '2026-06-01',
      method: 'freshAI',
    });

    await expect(
      createFoalingRecord({
        id: 'foaling-wrong-mare',
        mareId: 'mare-foaling-b',
        breedingRecordId: 'breed-foaling-a',
        date: '2027-04-01',
        outcome: 'liveFoal',
      }),
    ).rejects.toThrow('Breeding record belongs to a different mare.');
  });

  it('foaling record update rejects a missing breeding record', async () => {
    await createMare({ id: 'mare-foaling-update', name: 'Hazel', breed: 'Warmblood' });
    await createFoalingRecord({
      id: 'foaling-update',
      mareId: 'mare-foaling-update',
      date: '2027-03-20',
      outcome: 'unknown',
    });

    await expect(
      updateFoalingRecord('foaling-update', {
        breedingRecordId: 'breed-does-not-exist',
        date: '2027-03-21',
        outcome: 'liveFoal',
      }),
    ).rejects.toThrow('Breeding record not found.');
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

  it('preserves decimal straw volume values across breeding record create and update', async () => {
    await createMare({ id: 'mare-straw-decimal', name: 'Delta', breed: 'Warmblood' });
    await createStallion({ id: 'stallion-straw-decimal', name: 'North Star' });
    await createBreedingRecord({
      id: 'breed-straw-decimal',
      mareId: 'mare-straw-decimal',
      stallionId: 'stallion-straw-decimal',
      date: '2026-06-01',
      method: 'frozenAI',
      numberOfStraws: 2,
      strawVolumeMl: 0.5,
    });

    let record = await getBreedingRecordById('breed-straw-decimal');
    expect(record?.strawVolumeMl).toBe(0.5);

    await updateBreedingRecord('breed-straw-decimal', {
      stallionId: 'stallion-straw-decimal',
      date: '2026-06-02',
      method: 'frozenAI',
      numberOfStraws: 2,
      strawVolumeMl: 0.75,
    });

    record = await getBreedingRecordById('breed-straw-decimal');
    expect(record?.strawVolumeMl).toBe(0.75);
  });

  it('daily log with ovulationDetected true reads back as true', async () => {
    await createMare({ id: 'mare-ov1', name: 'Sunny', breed: 'Thoroughbred' });
    await createDailyLog({
      id: 'log-ov1',
      mareId: 'mare-ov1',
      date: '2026-03-14',
      ovulationDetected: true,
    });

    const log = await getDailyLogById('log-ov1');
    expect(log).not.toBeNull();
    expect(log?.ovulationDetected).toBe(true);
  });

  it('daily log with ovulationDetected false reads back as false', async () => {
    await createMare({ id: 'mare-ov2', name: 'Daisy', breed: 'Quarter Horse' });
    await createDailyLog({
      id: 'log-ov2',
      mareId: 'mare-ov2',
      date: '2026-03-14',
      ovulationDetected: false,
    });

    const log = await getDailyLogById('log-ov2');
    expect(log).not.toBeNull();
    expect(log?.ovulationDetected).toBe(false);
  });

  it('daily log with ovulationDetected omitted reads back as null', async () => {
    await createMare({ id: 'mare-ov3', name: 'Willow', breed: 'Warmblood' });
    await createDailyLog({
      id: 'log-ov3',
      mareId: 'mare-ov3',
      date: '2026-03-14',
    });

    const log = await getDailyLogById('log-ov3');
    expect(log).not.toBeNull();
    expect(log?.ovulationDetected).toBeNull();
  });

  it('daily log update from null to ovulationDetected true', async () => {
    await createMare({ id: 'mare-ov4', name: 'Pepper', breed: 'Arabian' });
    await createDailyLog({
      id: 'log-ov4',
      mareId: 'mare-ov4',
      date: '2026-03-14',
    });

    await updateDailyLog('log-ov4', {
      date: '2026-03-14',
      ovulationDetected: true,
    });

    const log = await getDailyLogById('log-ov4');
    expect(log).not.toBeNull();
    expect(log?.ovulationDetected).toBe(true);
  });

  it('supports foal create/get/update/delete flow', async () => {
    await createMare({ id: 'mare-foal1', name: 'Stella', breed: 'Thoroughbred' });
    await createFoalingRecord({
      id: 'fr-foal1',
      mareId: 'mare-foal1',
      date: '2026-04-01',
      outcome: 'liveFoal',
      foalSex: 'colt',
    });

    await createFoal({
      id: 'foal-1',
      foalingRecordId: 'fr-foal1',
      name: 'Starlight',
      sex: 'colt',
      color: 'bay',
      birthWeightLbs: 85,
      milestones: { stood: { done: true, recordedAt: '2026-04-01T02:00:00Z' } },
    });

    const created = await getFoalById('foal-1');
    expect(created).not.toBeNull();
    expect(created?.name).toBe('Starlight');
    expect(created?.sex).toBe('colt');
    expect(created?.color).toBe('bay');
    expect(created?.birthWeightLbs).toBe(85);
    expect(created?.milestones.stood?.done).toBe(true);

    await updateFoal('foal-1', {
      name: 'Starlight Jr',
      sex: 'colt',
      color: 'chestnut',
      birthWeightLbs: 90,
      milestones: { stood: { done: true, recordedAt: '2026-04-01T02:00:00Z' }, nursed: { done: true, recordedAt: '2026-04-01T03:00:00Z' } },
    });

    const updated = await getFoalById('foal-1');
    expect(updated?.name).toBe('Starlight Jr');
    expect(updated?.color).toBe('chestnut');
    expect(updated?.milestones.nursed?.done).toBe(true);

    await deleteFoal('foal-1');
    const deleted = await getFoalById('foal-1');
    expect(deleted).toBeNull();
  });

  it('foal rejects a missing foaling record before SQLite', async () => {
    await expect(
      createFoal({
        id: 'foal-missing-parent',
        foalingRecordId: 'foaling-does-not-exist',
        milestones: {},
      }),
    ).rejects.toThrow('Foaling record not found.');
  });

  it('gets foal by foaling record id', async () => {
    await createMare({ id: 'mare-foal2', name: 'Luna', breed: 'Arabian' });
    await createFoalingRecord({
      id: 'fr-foal2',
      mareId: 'mare-foal2',
      date: '2026-05-01',
      outcome: 'liveFoal',
    });

    await createFoal({
      id: 'foal-2',
      foalingRecordId: 'fr-foal2',
      milestones: {},
    });

    const foal = await getFoalByFoalingRecordId('fr-foal2');
    expect(foal).not.toBeNull();
    expect(foal?.id).toBe('foal-2');

    const noFoal = await getFoalByFoalingRecordId('nonexistent');
    expect(noFoal).toBeNull();
  });

  it('lists foals by mare', async () => {
    await createMare({ id: 'mare-foal3', name: 'Misty', breed: 'Warmblood' });
    await createFoalingRecord({
      id: 'fr-foal3a',
      mareId: 'mare-foal3',
      date: '2025-04-01',
      outcome: 'liveFoal',
      foalSex: 'filly',
    });
    await createFoalingRecord({
      id: 'fr-foal3b',
      mareId: 'mare-foal3',
      date: '2026-04-01',
      outcome: 'liveFoal',
      foalSex: 'colt',
    });
    await createFoal({ id: 'foal-3a', foalingRecordId: 'fr-foal3a', name: 'First', milestones: {} });
    await createFoal({ id: 'foal-3b', foalingRecordId: 'fr-foal3b', name: 'Second', milestones: {} });

    const foals = await listFoalsByMare('mare-foal3');
    expect(foals).toHaveLength(2);
  });

  it('duplicate foal for same foaling record fails', async () => {
    await createMare({ id: 'mare-foal4', name: 'Daisy', breed: 'Thoroughbred' });
    await createFoalingRecord({
      id: 'fr-foal4',
      mareId: 'mare-foal4',
      date: '2026-06-01',
      outcome: 'liveFoal',
    });

    await createFoal({ id: 'foal-4a', foalingRecordId: 'fr-foal4', milestones: {} });
    await expect(
      createFoal({ id: 'foal-4b', foalingRecordId: 'fr-foal4', milestones: {} })
    ).rejects.toThrow('UNIQUE constraint failed');
  });

  it('parseFoalMilestones returns {} for invalid JSON', () => {
    expect(parseFoalMilestones('not json')).toEqual({});
    expect(parseFoalMilestones('null')).toEqual({});
    expect(parseFoalMilestones('[]')).toEqual({});
  });

  it('parseFoalMilestones preserves unknown keys and extra entry properties while filtering malformed known entries', () => {
    const input = JSON.stringify({
      stood: { done: true, recordedAt: '2026-04-01T02:00:00Z', source: 'nurse note' },
      unknownKey: { done: true, windowHours: 6 },
      nursed: { done: 'yes' },
      iggTested: { done: false },
    });
    const result = parseFoalMilestones(input) as Record<string, unknown>;
    const stood = result.stood as { done?: unknown; recordedAt?: unknown } | undefined;
    const iggTested = result.iggTested as { done?: unknown } | undefined;
    expect(stood?.done).toBe(true);
    expect(stood?.recordedAt).toBe('2026-04-01T02:00:00Z');
    expect((result.stood as Record<string, unknown>).source).toBe('nurse note');
    expect(result.unknownKey).toEqual({ done: true, windowHours: 6 });
    expect(result).not.toHaveProperty('nursed');
    expect(iggTested?.done).toBe(false);
  });

  it('parseIggTests preserves unknown properties on valid tests', () => {
    const result = parseIggTests(
      JSON.stringify([
        {
          date: '2026-04-01',
          valueMgDl: 900,
          recordedAt: '2026-04-01T08:00:00Z',
          lab: 'North Lab',
        },
      ]),
    ) as unknown as Array<Record<string, unknown>>;

    expect(result).toHaveLength(1);
    expect(result[0]?.valueMgDl).toBe(900);
    expect(result[0]?.lab).toBe('North Lab');
  });

  it('updateFoal preserves forward-compatible milestone keys and igg properties when saving known fields', async () => {
    await createMare({ id: 'mare-foal-forward', name: 'Juniper', breed: 'Warmblood' });
    await createFoalingRecord({
      id: 'fr-foal-forward',
      mareId: 'mare-foal-forward',
      date: '2026-08-01',
      outcome: 'liveFoal',
    });

    await createFoal({
      id: 'foal-forward',
      foalingRecordId: 'fr-foal-forward',
      milestones: {
        stood: {
          done: true,
          recordedAt: '2026-08-01T02:00:00Z',
          source: 'initial observation',
        } as never,
        futureMilestone: {
          done: true,
          windowHours: 6,
        } as never,
      } as never,
      iggTests: [
        {
          date: '2026-08-02',
          valueMgDl: 800,
          recordedAt: '2026-08-02T09:00:00Z',
          lab: 'North Lab',
        } as never,
      ],
    });

    await updateFoal('foal-forward', {
      milestones: {
        stood: {
          done: false,
          recordedAt: '2026-08-01T02:00:00Z',
        },
      },
      iggTests: [
        {
          date: '2026-08-02',
          valueMgDl: 950,
          recordedAt: '2026-08-02T09:00:00Z',
        },
      ],
    });

    const updated = await getFoalById('foal-forward');
    expect(updated).not.toBeNull();

    const milestones = updated?.milestones as Record<string, unknown>;
    expect(updated?.milestones.stood?.done).toBe(false);
    expect((milestones.stood as Record<string, unknown>).source).toBe('initial observation');
    expect(milestones.futureMilestone).toEqual({ done: true, windowHours: 6 });

    const iggTest = updated?.iggTests[0] as unknown as Record<string, unknown>;
    expect(updated?.iggTests[0]?.valueMgDl).toBe(950);
    expect(iggTest.lab).toBe('North Lab');
  });

  it('serializeIggTestsForSave preserves hidden raw igg entries without reordering visible tests', () => {
    const rawTests = JSON.parse(
      serializeIggTestsForSave(
        JSON.stringify([
          {
            date: '2026-09-02',
            valueMgDl: 800,
            recordedAt: '2026-09-02T09:00:00Z',
            lab: 'North Lab',
          },
          {
            recordedAt: '2026-09-04T09:00:00Z',
            panel: 'future-format',
            externalId: 'lab-7',
          },
        ]),
        [
          {
            date: '2026-09-03',
            valueMgDl: 700,
            recordedAt: '2026-09-03T09:00:00Z',
          } as never,
          {
            date: '2026-09-02',
            valueMgDl: 950,
            recordedAt: '2026-09-02T09:00:00Z',
          } as never,
        ],
      ),
    ) as Array<string | Record<string, unknown>>;

    expect(rawTests).toEqual([
      {
        date: '2026-09-03',
        valueMgDl: 700,
        recordedAt: '2026-09-03T09:00:00Z',
      },
      {
        date: '2026-09-02',
        valueMgDl: 950,
        recordedAt: '2026-09-02T09:00:00Z',
        lab: 'North Lab',
      },
      {
        recordedAt: '2026-09-04T09:00:00Z',
        panel: 'future-format',
        externalId: 'lab-7',
      },
    ]);
  });

  it('foal with null name reads back as null', async () => {
    await createMare({ id: 'mare-foal5', name: 'Penny', breed: 'Quarter Horse' });
    await createFoalingRecord({
      id: 'fr-foal5',
      mareId: 'mare-foal5',
      date: '2026-07-01',
      outcome: 'liveFoal',
    });
    await createFoal({ id: 'foal-5', foalingRecordId: 'fr-foal5', milestones: {} });

    const foal = await getFoalById('foal-5');
    expect(foal).not.toBeNull();
    expect(foal?.name).toBeNull();
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
