import type * as SQLite from 'expo-sqlite';

import { computeAllocationSummary } from '@/utils/collectionAllocation';

type CollectionRawVolumeRow = {
  raw_volume_ml: number | null;
};

type AllocatedSemenVolumeRow = {
  allocated_semen_volume_ml: number;
};

export type AllocatedSemenVolumeOptions = {
  excludeDoseEventId?: string;
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
  const params: string[] = [collectionId];
  const exclusionClause = options?.excludeDoseEventId ? 'AND id <> ?' : '';

  if (options?.excludeDoseEventId) {
    params.push(options.excludeDoseEventId);
  }

  const row = await db.getFirstAsync<AllocatedSemenVolumeRow>(
    `
    SELECT COALESCE(SUM(dose_semen_volume_ml * COALESCE(dose_count, 0)), 0) AS allocated_semen_volume_ml
    FROM collection_dose_events
    WHERE collection_id = ?
      AND dose_semen_volume_ml IS NOT NULL
      ${exclusionClause};
    `,
    params,
  );

  return row?.allocated_semen_volume_ml ?? 0;
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
