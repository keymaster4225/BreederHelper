import { SemenCollection } from '@/models/types';
import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { assertCollectionDoseCountCanBeUpdated } from './internal/collectionAllocation';
import { getStallionById } from './stallions';

type SemenCollectionRow = {
  id: string;
  stallion_id: string;
  collection_date: string;
  raw_volume_ml: number | null;
  extended_volume_ml: number | null;
  extender_volume_ml: number | null;
  extender_type: string | null;
  concentration_millions_per_ml: number | null;
  progressive_motility_percent: number | null;
  dose_count: number | null;
  dose_size_millions: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: SemenCollectionRow): SemenCollection {
  return {
    id: row.id,
    stallionId: row.stallion_id,
    collectionDate: row.collection_date,
    rawVolumeMl: row.raw_volume_ml,
    totalVolumeMl: row.extended_volume_ml,
    extenderVolumeMl: row.extender_volume_ml,
    extenderType: row.extender_type,
    concentrationMillionsPerMl: row.concentration_millions_per_ml,
    progressiveMotilityPercent: row.progressive_motility_percent,
    doseCount: row.dose_count,
    doseSizeMillions: row.dose_size_millions,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSemenCollectionsByStallion(
  stallionId: string,
  options?: { limit?: number },
): Promise<SemenCollection[]> {
  const db = await getDb();
  const limit = options?.limit ?? 1000;
  const rows = await db.getAllAsync<SemenCollectionRow>(
    `SELECT * FROM semen_collections
     WHERE stallion_id = ?
     ORDER BY collection_date DESC
     LIMIT ?;`,
    [stallionId, limit],
  );
  return rows.map(mapRow);
}

export async function getSemenCollectionById(
  id: string,
): Promise<SemenCollection | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SemenCollectionRow>(
    'SELECT * FROM semen_collections WHERE id = ?;',
    [id],
  );
  return row ? mapRow(row) : null;
}

export async function createSemenCollection(input: {
  id: string;
  stallionId: string;
  collectionDate: string;
  rawVolumeMl?: number | null;
  totalVolumeMl?: number | null;
  extenderVolumeMl?: number | null;
  extenderType?: string | null;
  concentrationMillionsPerMl?: number | null;
  progressiveMotilityPercent?: number | null;
  doseCount?: number | null;
  doseSizeMillions?: number | null;
  notes?: string | null;
}): Promise<void> {
  const stallion = await getStallionById(input.stallionId);
  if (!stallion) {
    throw new Error('Stallion not found.');
  }
  if (stallion.deletedAt != null) {
    throw new Error('Cannot add collection for a deleted stallion.');
  }

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO semen_collections (
      id, stallion_id, collection_date,
      raw_volume_ml, extended_volume_ml, extender_volume_ml, extender_type, concentration_millions_per_ml,
      progressive_motility_percent, dose_count, dose_size_millions,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.stallionId,
      input.collectionDate,
      input.rawVolumeMl ?? null,
      input.totalVolumeMl ?? null,
      input.extenderVolumeMl ?? null,
      input.extenderType ?? null,
      input.concentrationMillionsPerMl ?? null,
      input.progressiveMotilityPercent ?? null,
      input.doseCount ?? null,
      input.doseSizeMillions ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
  emitDataInvalidation('semenCollections');
}

export async function updateSemenCollection(
  id: string,
  input: {
    collectionDate: string;
    rawVolumeMl?: number | null;
    totalVolumeMl?: number | null;
    extenderVolumeMl?: number | null;
    extenderType?: string | null;
    concentrationMillionsPerMl?: number | null;
    progressiveMotilityPercent?: number | null;
    doseCount?: number | null;
    doseSizeMillions?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const db = await getDb();
  await assertCollectionDoseCountCanBeUpdated(db, id, input.doseCount ?? null);

  await db.runAsync(
    `UPDATE semen_collections
     SET
       collection_date = ?,
       raw_volume_ml = ?,
       extended_volume_ml = ?,
       extender_volume_ml = ?,
       extender_type = ?,
       concentration_millions_per_ml = ?,
       progressive_motility_percent = ?,
       dose_count = ?,
       dose_size_millions = ?,
        notes = ?,
        updated_at = ?
     WHERE id = ?;`,
    [
      input.collectionDate,
      input.rawVolumeMl ?? null,
      input.totalVolumeMl ?? null,
      input.extenderVolumeMl ?? null,
      input.extenderType ?? null,
      input.concentrationMillionsPerMl ?? null,
      input.progressiveMotilityPercent ?? null,
      input.doseCount ?? null,
      input.doseSizeMillions ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ],
  );
  emitDataInvalidation('semenCollections');
}

export async function deleteSemenCollection(id: string): Promise<void> {
  const linked = await isSemenCollectionLinked(id);
  if (linked) {
    throw new Error('This collection is linked to a breeding record and cannot be deleted.');
  }

  const db = await getDb();
  await db.runAsync('DELETE FROM semen_collections WHERE id = ?;', [id]);
  emitDataInvalidation('semenCollections');
}

export async function isSemenCollectionLinked(id: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM breeding_records WHERE collection_id = ?;',
    [id],
  );
  return (row?.count ?? 0) > 0;
}
