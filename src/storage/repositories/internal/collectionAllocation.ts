import type * as SQLite from 'expo-sqlite';

import { computeAllocationSummary } from '@/utils/collectionAllocation';

type CollectionRawVolumeRow = {
  raw_volume_ml: number | null;
};

type AllocatedSemenVolumeRow = {
  allocated_semen_volume_ml: number;
};

type AllocatedFrozenSemenVolumeRow = {
  allocated_frozen_volume_ml: number;
};

export type AllocatedSemenVolumeOptions = {
  excludeDoseEventId?: string;
  excludeFrozenBatchId?: string;
};

export async function getCollectionRawVolumeMl(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
): Promise<number | null> {
  const row = await db.getFirstAsync<CollectionRawVolumeRow>(
    'SELECT raw_volume_ml FROM semen_collections WHERE id = ?;',
    [collectionId],
  );

  if (!row) {
    throw new Error('Collection not found.');
  }

  return row.raw_volume_ml;
}

export async function getAllocatedSemenVolumeForCollectionDb(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  options?: AllocatedSemenVolumeOptions,
): Promise<number> {
  const doseEventParams: string[] = [collectionId];
  const doseEventExclusionClause = options?.excludeDoseEventId ? 'AND id <> ?' : '';

  if (options?.excludeDoseEventId) {
    doseEventParams.push(options.excludeDoseEventId);
  }

  const doseEventRow = await db.getFirstAsync<AllocatedSemenVolumeRow>(
    `
    SELECT COALESCE(SUM(dose_semen_volume_ml * COALESCE(dose_count, 0)), 0) AS allocated_semen_volume_ml
    FROM collection_dose_events
    WHERE collection_id = ?
      AND dose_semen_volume_ml IS NOT NULL
      ${doseEventExclusionClause};
    `,
    doseEventParams,
  );

  const frozenBatchParams: string[] = [collectionId];
  const frozenBatchExclusionClause = options?.excludeFrozenBatchId ? 'AND id <> ?' : '';

  if (options?.excludeFrozenBatchId) {
    frozenBatchParams.push(options.excludeFrozenBatchId);
  }

  const frozenBatchRow = await db.getFirstAsync<AllocatedFrozenSemenVolumeRow>(
    `
    SELECT COALESCE(SUM(raw_semen_volume_used_ml), 0) AS allocated_frozen_volume_ml
    FROM frozen_semen_batches
    WHERE collection_id = ?
      AND raw_semen_volume_used_ml IS NOT NULL
      ${frozenBatchExclusionClause};
    `,
    frozenBatchParams,
  );

  return (doseEventRow?.allocated_semen_volume_ml ?? 0) + (frozenBatchRow?.allocated_frozen_volume_ml ?? 0);
}

export async function assertCollectionSemenVolumeCanSupportAllocation(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  doseSemenVolumeMl: number | null,
  doseCount: number,
  options?: AllocatedSemenVolumeOptions,
): Promise<void> {
  if (doseSemenVolumeMl == null) {
    return;
  }

  const rawVolumeMl = await getCollectionRawVolumeMl(db, collectionId);
  const allocatedSemenMl = await getAllocatedSemenVolumeForCollectionDb(db, collectionId, options);
  const summary = computeAllocationSummary(
    [
      {
        doseSemenVolumeMl: allocatedSemenMl,
        doseCount: 1,
      },
      {
        doseSemenVolumeMl,
        doseCount,
      },
    ],
    rawVolumeMl,
  );

  if (!summary.isWithinCap) {
    throw new Error('Allocated semen volume cannot exceed the collection total volume.');
  }
}

export async function assertCollectionRawVolumeCanBeUpdated(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  nextRawVolumeMl: number | null,
): Promise<void> {
  if (nextRawVolumeMl == null) {
    return;
  }

  const allocatedSemenMl = await getAllocatedSemenVolumeForCollectionDb(db, collectionId);
  if (allocatedSemenMl > nextRawVolumeMl) {
    throw new Error('Total volume cannot be lower than the allocated semen volume.');
  }
}

export async function assertCollectionSemenVolumeWithinCap(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
): Promise<void> {
  const rawVolumeMl = await getCollectionRawVolumeMl(db, collectionId);
  const allocatedSemenMl = await getAllocatedSemenVolumeForCollectionDb(db, collectionId);
  const summary = computeAllocationSummary(
    [
      {
        doseSemenVolumeMl: allocatedSemenMl,
        doseCount: 1,
      },
    ],
    rawVolumeMl,
  );

  if (!summary.isWithinCap) {
    throw new Error('Allocated semen volume cannot exceed the collection total volume.');
  }
}
