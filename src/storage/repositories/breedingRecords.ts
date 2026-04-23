import { BreedingMethod, BreedingRecord } from '@/models/types';
import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { assertCollectionSemenVolumeCanSupportAllocation } from './internal/collectionAllocation';
import { getSemenCollectionById } from './semenCollections';

type BreedingRecordRow = {
  id: string;
  mare_id: string;
  stallion_id: string | null;
  stallion_name: string | null;
  collection_id: string | null;
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
    collectionId: row.collection_id,
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

async function validateCollectionStallion(
  collectionId: string | null | undefined,
  stallionId: string | null,
): Promise<void> {
  if (collectionId != null) {
    if (stallionId == null) {
      throw new Error('A collection requires a linked stallion.');
    }
    const collection = await getSemenCollectionById(collectionId);
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

async function getLinkedOnFarmDoseEventByBreedingRecordId(
  db: Awaited<ReturnType<typeof getDb>>,
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
): Promise<boolean> {
  const db = await getDb();
  const row = await getLinkedOnFarmDoseEventByBreedingRecordId(db, breedingRecordId);
  return row != null;
}

export async function createBreedingRecord(input: {
  id: string;
  mareId: string;
  stallionId: string | null;
  stallionName?: string | null;
  collectionId?: string | null;
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
  await validateCollectionStallion(input.collectionId, input.stallionId);

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO breeding_records (
      id, mare_id, stallion_id, stallion_name, collection_id,
      date, method, notes,
      volume_ml, concentration_m_per_ml, motility_percent,
      number_of_straws, straw_volume_ml, straw_details,
      collection_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.stallionId,
      input.stallionName ?? null,
      input.collectionId ?? null,
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
  emitDataInvalidation('breedingRecords');
}

export async function updateBreedingRecord(
  id: string,
  input: {
    stallionId: string | null;
    stallionName?: string | null;
    collectionId?: string | null;
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
  const existing = await db.getFirstAsync<ExistingBreedingRecordRow>(
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

  const linkedOnFarmDoseEvent = await getLinkedOnFarmDoseEventByBreedingRecordId(db, id);

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

  await validateCollectionStallion(input.collectionId, input.stallionId);

  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();

    if (linkedOnFarmDoseEvent) {
      await assertCollectionSemenVolumeCanSupportAllocation(
        db,
        linkedOnFarmDoseEvent.collection_id,
        input.volumeMl ?? null,
        1,
        { excludeDoseEventId: linkedOnFarmDoseEvent.id },
      );
    }

    await db.runAsync(
      `
      UPDATE breeding_records
      SET
        stallion_id = ?,
        stallion_name = ?,
        collection_id = ?,
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
        input.collectionId ?? null,
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
        id,
      ],
    );

    if (linkedOnFarmDoseEvent) {
      await db.runAsync(
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

export async function getBreedingRecordById(id: string): Promise<BreedingRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
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
  emitDataInvalidation('breedingRecords');
}

export async function listAllBreedingRecords(): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
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
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId],
  );

  return rows.map(mapBreedingRecordRow);
}

export async function listBreedingRecordsForStallion(
  stallionId: string,
): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE stallion_id = ?
    ORDER BY date DESC;
    `,
    [stallionId],
  );
  return rows.map(mapBreedingRecordRow);
}

export async function listLegacyBreedingRecordsMatchingStallionName(
  stallionName: string,
): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, collection_id, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE stallion_id IS NULL
    AND LOWER(stallion_name) = LOWER(?)
    ORDER BY date DESC;
    `,
    [stallionName],
  );
  return rows.map(mapBreedingRecordRow);
}
