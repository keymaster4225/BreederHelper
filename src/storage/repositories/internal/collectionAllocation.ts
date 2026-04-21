import type * as SQLite from 'expo-sqlite';

type CollectionDoseCountRow = {
  dose_count: number | null;
};

type AllocatedDoseCountRow = {
  allocated_dose_count: number;
};

export type AllocatedDoseCountOptions = {
  excludeDoseEventId?: string;
};

export async function getCollectionDoseCount(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
): Promise<number | null> {
  const row = await db.getFirstAsync<CollectionDoseCountRow>(
    'SELECT dose_count FROM semen_collections WHERE id = ?;',
    [collectionId],
  );

  if (!row) {
    throw new Error('Collection not found.');
  }

  return row.dose_count;
}

export async function getAllocatedDoseCountForCollectionDb(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  options?: AllocatedDoseCountOptions,
): Promise<number> {
  const params: string[] = [collectionId];
  const exclusionClause = options?.excludeDoseEventId
    ? 'AND id <> ?'
    : '';

  if (options?.excludeDoseEventId) {
    params.push(options.excludeDoseEventId);
  }

  const row = await db.getFirstAsync<AllocatedDoseCountRow>(
    `
    SELECT COALESCE(SUM(COALESCE(dose_count, 0)), 0) AS allocated_dose_count
    FROM collection_dose_events
    WHERE collection_id = ?
      ${exclusionClause};
    `,
    params,
  );

  return row?.allocated_dose_count ?? 0;
}

export async function assertCollectionDoseCountCanSupportAllocations(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  doseCountToAllocate: number,
  options?: AllocatedDoseCountOptions,
): Promise<void> {
  const collectionDoseCount = await getCollectionDoseCount(db, collectionId);

  if (collectionDoseCount == null) {
    throw new Error('Dose count is required on the collection before allocating doses.');
  }

  const allocatedDoseCount = await getAllocatedDoseCountForCollectionDb(db, collectionId, options);
  if (allocatedDoseCount + doseCountToAllocate > collectionDoseCount) {
    throw new Error('Allocated doses cannot exceed the collection dose count.');
  }
}

export async function assertCollectionDoseCountCanBeUpdated(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  nextDoseCount: number | null,
): Promise<void> {
  const allocatedDoseCount = await getAllocatedDoseCountForCollectionDb(db, collectionId);

  if (nextDoseCount == null) {
    if (allocatedDoseCount > 0) {
      throw new Error('Dose count cannot be cleared while allocations exist.');
    }
    return;
  }

  if (allocatedDoseCount > nextDoseCount) {
    throw new Error('Dose count cannot be lower than the allocated dose total.');
  }
}
