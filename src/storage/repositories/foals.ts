import { Foal, FoalColor, FoalMilestones, FoalSex, IggTest } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import {
  parseFoalMilestones,
  parseIggTests,
  serializeFoalMilestonesForSave,
  serializeIggTestsForSave,
} from '@/storage/repositories/internal/foalCodecs';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';
import { getFoalingRecordById } from './foalingRecords';

type FoalRow = {
  id: string;
  foaling_record_id: string;
  name: string | null;
  sex: FoalSex | null;
  color: FoalColor | null;
  markings: string | null;
  birth_weight_lbs: number | null;
  milestones: string;
  igg_tests: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapFoalRow(row: FoalRow): Foal {
  return {
    id: row.id,
    foalingRecordId: row.foaling_record_id,
    name: row.name,
    sex: row.sex,
    color: row.color,
    markings: row.markings,
    birthWeightLbs: row.birth_weight_lbs,
    milestones: parseFoalMilestones(row.milestones),
    iggTests: parseIggTests(row.igg_tests),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { parseFoalMilestones, parseIggTests };

async function validateFoalingRecordExists(foalingRecordId: string, db?: RepoDb): Promise<void> {
  const foalingRecord = await getFoalingRecordById(foalingRecordId, db);
  if (!foalingRecord) {
    throw new Error('Foaling record not found.');
  }
}

export async function createFoal(input: {
  id: string;
  foalingRecordId: string;
  name?: string | null;
  sex?: FoalSex | null;
  color?: FoalColor | null;
  markings?: string | null;
  birthWeightLbs?: number | null;
  milestones: FoalMilestones;
  iggTests?: readonly IggTest[];
  notes?: string | null;
}, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await validateFoalingRecordExists(input.foalingRecordId, handle);

  const now = new Date().toISOString();

  await handle.runAsync(
    `
    INSERT INTO foals (
      id,
      foaling_record_id,
      name,
      sex,
      color,
      markings,
      birth_weight_lbs,
      milestones,
      igg_tests,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.foalingRecordId,
      input.name ?? null,
      input.sex ?? null,
      input.color ?? null,
      input.markings ?? null,
      input.birthWeightLbs ?? null,
      serializeFoalMilestonesForSave(undefined, input.milestones),
      serializeIggTestsForSave(undefined, input.iggTests),
      input.notes ?? null,
      now,
      now,
    ],
  );
  emitDataInvalidation('foals');
}

export async function updateFoal(
  id: string,
  input: {
    name?: string | null;
    sex?: FoalSex | null;
    color?: FoalColor | null;
    markings?: string | null;
    birthWeightLbs?: number | null;
    milestones: FoalMilestones;
    iggTests?: readonly IggTest[];
    notes?: string | null;
  },
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existingRow = await handle.getFirstAsync<Pick<FoalRow, 'milestones' | 'igg_tests'>>(
    `
    SELECT milestones, igg_tests
    FROM foals
    WHERE id = ?;
    `,
    [id],
  );

  await handle.runAsync(
    `
    UPDATE foals
    SET
      name = ?,
      sex = ?,
      color = ?,
      markings = ?,
      birth_weight_lbs = ?,
      milestones = ?,
      igg_tests = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.name ?? null,
      input.sex ?? null,
      input.color ?? null,
      input.markings ?? null,
      input.birthWeightLbs ?? null,
      serializeFoalMilestonesForSave(existingRow?.milestones, input.milestones),
      serializeIggTestsForSave(existingRow?.igg_tests, input.iggTests),
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ],
  );
  emitDataInvalidation('foals');
}

export async function getFoalById(id: string, db?: RepoDb): Promise<Foal | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<FoalRow>(
    `
    SELECT id, foaling_record_id, name, sex, color, markings, birth_weight_lbs,
           milestones, igg_tests, notes, created_at, updated_at
    FROM foals
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapFoalRow(row) : null;
}

export async function getFoalByFoalingRecordId(foalingRecordId: string, db?: RepoDb): Promise<Foal | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<FoalRow>(
    `
    SELECT id, foaling_record_id, name, sex, color, markings, birth_weight_lbs,
           milestones, igg_tests, notes, created_at, updated_at
    FROM foals
    WHERE foaling_record_id = ?;
    `,
    [foalingRecordId],
  );

  return row ? mapFoalRow(row) : null;
}

export async function listFoalsByMare(mareId: string, db?: RepoDb): Promise<Foal[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FoalRow>(
    `
    SELECT f.id, f.foaling_record_id, f.name, f.sex, f.color, f.markings,
           f.birth_weight_lbs, f.milestones, f.igg_tests, f.notes, f.created_at, f.updated_at
    FROM foals f
    JOIN foaling_records fr ON fr.id = f.foaling_record_id
    WHERE fr.mare_id = ?
    ORDER BY fr.date DESC;
    `,
    [mareId],
  );

  return rows.map(mapFoalRow);
}

export async function deleteFoal(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.runAsync('DELETE FROM foals WHERE id = ?;', [id]);
  emitDataInvalidation('foals');
}

export async function listAllFoals(db?: RepoDb): Promise<Foal[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FoalRow>(
    `
    SELECT id, foaling_record_id, name, sex, color, markings,
           birth_weight_lbs, milestones, igg_tests, notes, created_at, updated_at
    FROM foals;
    `,
  );

  return rows.map(mapFoalRow);
}
