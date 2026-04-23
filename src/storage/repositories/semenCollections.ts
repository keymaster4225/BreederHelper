import { SemenCollection } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { assertCollectionRawVolumeCanBeUpdated } from './internal/collectionAllocation';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';
import { getStallionById } from './stallions';

type SemenCollectionRow = {
  id: string;
  stallion_id: string;
  collection_date: string;
  raw_volume_ml: number | null;
  extender_type: string | null;
  concentration_millions_per_ml: number | null;
  progressive_motility_percent: number | null;
  target_mode: 'progressive' | 'total' | null;
  target_motile_sperm_millions_per_dose: number | null;
  target_post_extension_concentration_millions_per_ml: number | null;
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
    extenderType: row.extender_type,
    concentrationMillionsPerMl: row.concentration_millions_per_ml,
    progressiveMotilityPercent: row.progressive_motility_percent,
    targetMode: row.target_mode,
    targetSpermMillionsPerDose: row.target_motile_sperm_millions_per_dose,
    targetPostExtensionConcentrationMillionsPerMl:
      row.target_post_extension_concentration_millions_per_ml,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSemenCollectionsByStallion(
  stallionId: string,
  options?: { limit?: number },
  db?: RepoDb,
): Promise<SemenCollection[]> {
  const handle = await resolveDb(db);
  const limit = options?.limit ?? 1000;
  const rows = await handle.getAllAsync<SemenCollectionRow>(
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
  db?: RepoDb,
): Promise<SemenCollection | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<SemenCollectionRow>(
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
  extenderType?: string | null;
  concentrationMillionsPerMl?: number | null;
  progressiveMotilityPercent?: number | null;
  targetMode?: 'progressive' | 'total' | null;
  targetSpermMillionsPerDose?: number | null;
  targetPostExtensionConcentrationMillionsPerMl?: number | null;
  notes?: string | null;
}, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const stallion = await getStallionById(input.stallionId, handle);
  if (!stallion) {
    throw new Error('Stallion not found.');
  }
  if (stallion.deletedAt != null) {
    throw new Error('Cannot add collection for a deleted stallion.');
  }

  const now = new Date().toISOString();

  await handle.runAsync(
    `INSERT INTO semen_collections (
      id, stallion_id, collection_date,
      raw_volume_ml, extender_type, concentration_millions_per_ml,
      progressive_motility_percent, target_mode, target_motile_sperm_millions_per_dose,
      target_post_extension_concentration_millions_per_ml,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.stallionId,
      input.collectionDate,
      input.rawVolumeMl ?? null,
      input.extenderType ?? null,
      input.concentrationMillionsPerMl ?? null,
      input.progressiveMotilityPercent ?? null,
      input.targetMode ?? null,
      input.targetSpermMillionsPerDose ?? null,
      input.targetPostExtensionConcentrationMillionsPerMl ?? null,
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
    extenderType?: string | null;
    concentrationMillionsPerMl?: number | null;
    progressiveMotilityPercent?: number | null;
    targetMode?: 'progressive' | 'total' | null;
    targetSpermMillionsPerDose?: number | null;
    targetPostExtensionConcentrationMillionsPerMl?: number | null;
    notes?: string | null;
  },
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  await assertCollectionRawVolumeCanBeUpdated(handle, id, input.rawVolumeMl ?? null);

  await handle.runAsync(
    `UPDATE semen_collections
     SET
       collection_date = ?,
       raw_volume_ml = ?,
       extender_type = ?,
       concentration_millions_per_ml = ?,
       progressive_motility_percent = ?,
       target_mode = ?,
       target_motile_sperm_millions_per_dose = ?,
       target_post_extension_concentration_millions_per_ml = ?,
        notes = ?,
        updated_at = ?
     WHERE id = ?;`,
    [
      input.collectionDate,
      input.rawVolumeMl ?? null,
      input.extenderType ?? null,
      input.concentrationMillionsPerMl ?? null,
      input.progressiveMotilityPercent ?? null,
      input.targetMode ?? null,
      input.targetSpermMillionsPerDose ?? null,
      input.targetPostExtensionConcentrationMillionsPerMl ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ],
  );
  emitDataInvalidation('semenCollections');
}

export async function deleteSemenCollection(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const linked = await isSemenCollectionLinked(id, handle);
  if (linked) {
    throw new Error('This collection is linked to breeding or frozen records and cannot be deleted.');
  }

  await handle.runAsync('DELETE FROM semen_collections WHERE id = ?;', [id]);
  emitDataInvalidation('semenCollections');
}

export async function isSemenCollectionLinked(id: string, db?: RepoDb): Promise<boolean> {
  const handle = await resolveDb(db);
  const breedingRow = await handle.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM breeding_records WHERE collection_id = ?;',
    [id],
  );
  const frozenRow = await handle.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM frozen_semen_batches WHERE collection_id = ?;',
    [id],
  );
  return (breedingRow?.count ?? 0) > 0 || (frozenRow?.count ?? 0) > 0;
}
