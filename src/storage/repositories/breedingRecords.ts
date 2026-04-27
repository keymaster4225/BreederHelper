import { BreedingMethod, BreedingRecord } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { normalizeBreedingRecordTime } from '@/utils/breedingRecordTime';
import { assertCollectionSemenVolumeCanSupportAllocation } from './internal/collectionAllocation';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';
import { getSemenCollectionById } from './semenCollections';

type BreedingRecordRow = {
  id: string;
  mare_id: string;
  stallion_id: string | null;
  stallion_name: string | null;
  collection_id: string | null;
  date: string;
  time: string | null;
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
    collectionId: row.collection_id,
    date: row.date,
    time: row.time,
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

async function validateCollectionStallion(
  collectionId: string | null | undefined,
  stallionId: string | null,
  db?: RepoDb,
): Promise<void> {
  if (collectionId != null) {
    if (stallionId == null) {
      throw new Error('A collection requires a linked stallion.');
    }
    const collection = await getSemenCollectionById(collectionId, db);
    if (!collection) {
      throw new Error('Collection not found.');
    }
    if (collection.stallionId !== stallionId) {
      throw new Error('Collection belongs to a different stallion.');
    }
  }
}

type LinkedOnFarmDoseEventRow = {
  id: string;
  collection_id: string;
};

type ExistingBreedingRecordRow = {
  id: string;
};

function normalizeRequiredTime(value: string | null | undefined): string {
  if (value == null || value === '') {
    throw new Error('Breeding time is required.');
  }

  const normalized = normalizeBreedingRecordTime(value);
  if (normalized == null) {
    throw new Error('Breeding time must be a valid HH:MM time.');
  }

  return normalized;
}

function normalizeNullableTime(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const normalized = normalizeBreedingRecordTime(value);
  if (normalized == null) {
    throw new Error('Breeding time must be a valid HH:MM time.');
  }

  return normalized;
}

async function getLinkedOnFarmDoseEventByBreedingRecordId(
  db: RepoDb,
  breedingRecordId: string,
): Promise<LinkedOnFarmDoseEventRow | null> {
  const row = await db.getFirstAsync<LinkedOnFarmDoseEventRow>(
    `
    SELECT id, collection_id
    FROM collection_dose_events
    WHERE breeding_record_id = ?
      AND event_type = 'usedOnSite'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    `,
    [breedingRecordId],
  );

  return row ?? null;
}

export async function hasLinkedOnFarmDoseEvent(
  breedingRecordId: string,
  db?: RepoDb,
): Promise<boolean> {
  const handle = await resolveDb(db);
  const row = await getLinkedOnFarmDoseEventByBreedingRecordId(handle, breedingRecordId);
  return row != null;
}

export async function createBreedingRecord(input: {
  id: string;
  mareId: string;
  stallionId: string | null;
  stallionName?: string | null;
  collectionId?: string | null;
  date: string;
  time: string;
  method: BreedingMethod;
  notes?: string | null;
  volumeMl?: number | null;
  concentrationMPerMl?: number | null;
  motilityPercent?: number | null;
  numberOfStraws?: number | null;
  strawVolumeMl?: number | null;
  strawDetails?: string | null;
  collectionDate?: string | null;
}, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await validateCollectionStallion(input.collectionId, input.stallionId, handle);

  const now = new Date().toISOString();
  const time = normalizeRequiredTime(input.time);

  await handle.runAsync(
    `
    INSERT INTO breeding_records (
      id, mare_id, stallion_id, stallion_name, collection_id,
      date, time, method, notes,
      volume_ml, concentration_m_per_ml, motility_percent,
      number_of_straws, straw_volume_ml, straw_details,
      collection_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.stallionId,
      input.stallionName ?? null,
      input.collectionId ?? null,
      input.date,
      time,
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
  emitDataInvalidation('breedingRecords');
}

export async function updateBreedingRecord(
  id: string,
  input: {
    stallionId: string | null;
    stallionName?: string | null;
    collectionId?: string | null;
    date: string;
    time: string | null;
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
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const time = normalizeNullableTime(input.time);
  const existing = await handle.getFirstAsync<ExistingBreedingRecordRow>(
    `
    SELECT id
    FROM breeding_records
    WHERE id = ?;
    `,
    [id],
  );

  if (!existing) {
    throw new Error('Breeding record not found.');
  }

  const linkedOnFarmDoseEvent = await getLinkedOnFarmDoseEventByBreedingRecordId(handle, id);

  if (linkedOnFarmDoseEvent) {
    if (input.method !== 'freshAI') {
      throw new Error('Linked on-farm breeding records must remain Fresh AI.');
    }

    if (input.collectionId == null) {
      throw new Error('Linked on-farm breeding records must keep their collection link.');
    }

    if (input.collectionId !== linkedOnFarmDoseEvent.collection_id) {
      throw new Error(
        'Linked on-farm breeding records cannot be moved to a different collection.',
      );
    }
  }

  await validateCollectionStallion(input.collectionId, input.stallionId, handle);

  await handle.withTransactionAsync(async () => {
    const now = new Date().toISOString();

    if (linkedOnFarmDoseEvent) {
      await assertCollectionSemenVolumeCanSupportAllocation(
        handle,
        linkedOnFarmDoseEvent.collection_id,
        input.volumeMl ?? null,
        1,
        { excludeDoseEventId: linkedOnFarmDoseEvent.id },
      );
    }

    await handle.runAsync(
      `
      UPDATE breeding_records
      SET
        stallion_id = ?,
        stallion_name = ?,
        collection_id = ?,
        date = ?,
        time = ?,
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
        input.collectionId ?? null,
        input.date,
        time,
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
        id,
      ],
    );

    if (linkedOnFarmDoseEvent) {
      await handle.runAsync(
        `
        UPDATE collection_dose_events
        SET
          event_date = ?,
          dose_semen_volume_ml = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?;
        `,
        [
          input.date,
          input.volumeMl ?? null,
          input.notes ?? null,
          now,
          linkedOnFarmDoseEvent.id,
        ],
      );
    }
  });

  emitDataInvalidation('breedingRecords');
  if (linkedOnFarmDoseEvent) {
    emitDataInvalidation('collectionDoseEvents');
  }
}

export async function getBreedingRecordById(id: string, db?: RepoDb): Promise<BreedingRecord | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      time, motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapBreedingRecordRow(row) : null;
}

export async function deleteBreedingRecord(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.runAsync('DELETE FROM breeding_records WHERE id = ?;', [id]);
  emitDataInvalidation('breedingRecords');
}

export async function listAllBreedingRecords(db?: RepoDb): Promise<BreedingRecord[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      time, motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    ORDER BY date DESC, time DESC, created_at DESC, id DESC;
    `,
  );

  return rows.map(mapBreedingRecordRow);
}

export async function listBreedingRecordsByMare(mareId: string, db?: RepoDb): Promise<BreedingRecord[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      time, motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE mare_id = ?
    ORDER BY date DESC, time DESC, created_at DESC, id DESC;
    `,
    [mareId],
  );

  return rows.map(mapBreedingRecordRow);
}

export async function listBreedingRecordsForStallion(
  stallionId: string,
  db?: RepoDb,
): Promise<BreedingRecord[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      time, motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE stallion_id = ?
    ORDER BY date DESC, time DESC, created_at DESC, id DESC;
    `,
    [stallionId],
  );
  return rows.map(mapBreedingRecordRow);
}

export async function listLegacyBreedingRecordsMatchingStallionName(
  stallionName: string,
  db?: RepoDb,
): Promise<BreedingRecord[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      time, motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE stallion_id IS NULL
    AND LOWER(stallion_name) = LOWER(?)
    ORDER BY date DESC, time DESC, created_at DESC, id DESC;
    `,
    [stallionName],
  );
  return rows.map(mapBreedingRecordRow);
}
