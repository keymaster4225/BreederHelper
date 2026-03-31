import { BreedingMethod, BreedingRecord } from '@/models/types';
import { getDb } from '@/storage/db';

type BreedingRecordRow = {
  id: string;
  mare_id: string;
  stallion_id: string | null;
  stallion_name: string | null;
  date: string;
  method: BreedingRecord['method'];
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

function mapBreedingRecordRow(row: BreedingRecordRow): BreedingRecord {
  return {
    id: row.id,
    mareId: row.mare_id,
    stallionId: row.stallion_id,
    stallionName: row.stallion_name,
    date: row.date,
    method: row.method,
    notes: row.notes,
    volumeMl: row.volume_ml,
    concentrationMPerMl: row.concentration_m_per_ml,
    motilityPercent: row.motility_percent,
    numberOfStraws: row.number_of_straws,
    strawVolumeMl: row.straw_volume_ml,
    strawDetails: row.straw_details,
    collectionDate: row.collection_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createBreedingRecord(input: {
  id: string;
  mareId: string;
  stallionId: string | null;
  stallionName?: string | null;
  date: string;
  method: BreedingMethod;
  notes?: string | null;
  volumeMl?: number | null;
  concentrationMPerMl?: number | null;
  motilityPercent?: number | null;
  numberOfStraws?: number | null;
  strawVolumeMl?: number | null;
  strawDetails?: string | null;
  collectionDate?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO breeding_records (
      id,
      mare_id,
      stallion_id,
      stallion_name,
      date,
      method,
      notes,
      volume_ml,
      concentration_m_per_ml,
      motility_percent,
      number_of_straws,
      straw_volume_ml,
      straw_details,
      collection_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.stallionId,
      input.stallionName ?? null,
      input.date,
      input.method,
      input.notes ?? null,
      input.volumeMl ?? null,
      input.concentrationMPerMl ?? null,
      input.motilityPercent ?? null,
      input.numberOfStraws ?? null,
      input.strawVolumeMl ?? null,
      input.strawDetails ?? null,
      input.collectionDate ?? null,
      now,
      now,
    ],
  );
}

export async function updateBreedingRecord(
  id: string,
  input: {
    stallionId: string | null;
    stallionName?: string | null;
    date: string;
    method: BreedingMethod;
    notes?: string | null;
    volumeMl?: number | null;
    concentrationMPerMl?: number | null;
    motilityPercent?: number | null;
    numberOfStraws?: number | null;
    strawVolumeMl?: number | null;
    strawDetails?: string | null;
    collectionDate?: string | null;
  },
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE breeding_records
    SET
      stallion_id = ?,
      stallion_name = ?,
      date = ?,
      method = ?,
      notes = ?,
      volume_ml = ?,
      concentration_m_per_ml = ?,
      motility_percent = ?,
      number_of_straws = ?,
      straw_volume_ml = ?,
      straw_details = ?,
      collection_date = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.stallionId,
      input.stallionName ?? null,
      input.date,
      input.method,
      input.notes ?? null,
      input.volumeMl ?? null,
      input.concentrationMPerMl ?? null,
      input.motilityPercent ?? null,
      input.numberOfStraws ?? null,
      input.strawVolumeMl ?? null,
      input.strawDetails ?? null,
      input.collectionDate ?? null,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function getBreedingRecordById(id: string): Promise<BreedingRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapBreedingRecordRow(row) : null;
}

export async function deleteBreedingRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM breeding_records WHERE id = ?;', [id]);
}

export async function listAllBreedingRecords(): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    ORDER BY date DESC;
    `,
  );

  return rows.map(mapBreedingRecordRow);
}

export async function listBreedingRecordsByMare(mareId: string): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId],
  );

  return rows.map(mapBreedingRecordRow);
}
