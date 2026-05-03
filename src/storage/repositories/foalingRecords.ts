import { FoalingRecord, type PhotoAsset } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';
import { getBreedingRecordById } from './breedingRecords';
import { deleteAttachmentPhotosForOwnersInTransaction } from './photos';

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
  db?: RepoDb,
): Promise<void> {
  if (breedingRecordId == null) {
    return;
  }

  const breedingRecord = await getBreedingRecordById(breedingRecordId, db);

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
}, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await validateOptionalBreedingRecordForMare(input.breedingRecordId, input.mareId, handle);

  const now = new Date().toISOString();

  await handle.runAsync(
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
  emitDataInvalidation('foalingRecords');
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
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await getFoalingRecordById(id, handle);
  if (!existing) {
    throw new Error('Foaling record not found.');
  }

  await validateOptionalBreedingRecordForMare(input.breedingRecordId, existing.mareId, handle);

  await handle.runAsync(
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
  emitDataInvalidation('foalingRecords');
}

export async function getFoalingRecordById(id: string, db?: RepoDb): Promise<FoalingRecord | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapFoalingRecordRow(row) : null;
}

export async function deleteFoalingRecord(id: string, db?: RepoDb): Promise<PhotoAsset[]> {
  const handle = await resolveDb(db);
  let deletedPhotoAssets: PhotoAsset[] = [];
  await handle.withTransactionAsync(async () => {
    deletedPhotoAssets = await deleteAttachmentPhotosForOwnersInTransaction('foalingRecord', [id], handle);
    await handle.runAsync('DELETE FROM foaling_records WHERE id = ?;', [id]);
  });
  emitDataInvalidation('foalingRecords');
  return deletedPhotoAssets;
}

export async function listAllFoalingRecords(db?: RepoDb): Promise<FoalingRecord[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    ORDER BY date DESC;
    `,
  );

  return rows.map(mapFoalingRecordRow);
}

export async function listFoalingRecordsByMare(mareId: string, db?: RepoDb): Promise<FoalingRecord[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FoalingRecordRow>(
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
