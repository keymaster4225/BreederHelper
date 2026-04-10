import { FoalingRecord } from '@/models/types';
import { getDb } from '@/storage/db';
import { getBreedingRecordById } from './breedingRecords';

type FoalingRecordRow = {
  id: string;
  mare_id: string;
  breeding_record_id: string | null;
  date: string;
  outcome: FoalingRecord['outcome'];
  foal_sex: FoalingRecord['foalSex'];
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapFoalingRecordRow(row: FoalingRecordRow): FoalingRecord {
  return {
    id: row.id,
    mareId: row.mare_id,
    breedingRecordId: row.breeding_record_id,
    date: row.date,
    outcome: row.outcome,
    foalSex: row.foal_sex,
    complications: row.complications,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function validateOptionalBreedingRecordForMare(
  breedingRecordId: string | null | undefined,
  mareId: string,
): Promise<void> {
  if (breedingRecordId == null) {
    return;
  }

  const breedingRecord = await getBreedingRecordById(breedingRecordId);

  if (!breedingRecord) {
    throw new Error('Breeding record not found.');
  }

  if (breedingRecord.mareId !== mareId) {
    throw new Error('Breeding record belongs to a different mare.');
  }
}

export async function createFoalingRecord(input: {
  id: string;
  mareId: string;
  breedingRecordId?: string | null;
  date: string;
  outcome: FoalingRecord['outcome'];
  foalSex?: FoalingRecord['foalSex'];
  complications?: string | null;
  notes?: string | null;
}): Promise<void> {
  await validateOptionalBreedingRecordForMare(input.breedingRecordId, input.mareId);

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO foaling_records (
      id,
      mare_id,
      breeding_record_id,
      date,
      outcome,
      foal_sex,
      complications,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.breedingRecordId ?? null,
      input.date,
      input.outcome,
      input.foalSex ?? null,
      input.complications ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export async function updateFoalingRecord(
  id: string,
  input: {
    breedingRecordId?: string | null;
    date: string;
    outcome: FoalingRecord['outcome'];
    foalSex?: FoalingRecord['foalSex'];
    complications?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const existing = await getFoalingRecordById(id);
  if (!existing) {
    throw new Error('Foaling record not found.');
  }

  await validateOptionalBreedingRecordForMare(input.breedingRecordId, existing.mareId);

  const db = await getDb();

  await db.runAsync(
    `
    UPDATE foaling_records
    SET
      breeding_record_id = ?,
      date = ?,
      outcome = ?,
      foal_sex = ?,
      complications = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.breedingRecordId ?? null,
      input.date,
      input.outcome,
      input.foalSex ?? null,
      input.complications ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function getFoalingRecordById(id: string): Promise<FoalingRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapFoalingRecordRow(row) : null;
}

export async function deleteFoalingRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM foaling_records WHERE id = ?;', [id]);
}

export async function listAllFoalingRecords(): Promise<FoalingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    ORDER BY date DESC;
    `,
  );

  return rows.map(mapFoalingRecordRow);
}

export async function listFoalingRecordsByMare(mareId: string): Promise<FoalingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId],
  );

  return rows.map(mapFoalingRecordRow);
}
