import type * as SQLite from 'expo-sqlite';

import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { newId } from '@/utils/id';
import type { AllocatedDoseCountOptions } from './internal/collectionAllocation';
import {
  getAllocatedDoseCountForCollectionDb,
} from './internal/collectionAllocation';

type CollectionDraftInput = {
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
};

export type CreateCollectionWizardShippedRowInput = {
  recipient: string;
  recipientPhone: string;
  recipientStreet: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;
  carrierService: string;
  containerType: string;
  trackingNumber?: string | null;
  eventDate: string;
  doseCount: number;
  notes?: string | null;
};

export type CreateCollectionWizardOnFarmRowInput = {
  mareId: string;
  eventDate: string;
  doseCount: number;
  notes?: string | null;
};

export type CreateCollectionWithAllocationsInput = {
  collection: CollectionDraftInput;
  shippedRows: readonly CreateCollectionWizardShippedRowInput[];
  onFarmRows: readonly CreateCollectionWizardOnFarmRowInput[];
};

export type CreateCollectionWithAllocationsResult = {
  collectionId: string;
  breedingRecordIds: readonly string[];
};

type StallionRow = {
  name: string;
  deleted_at: string | null;
};

type MareRow = {
  name: string;
  deleted_at: string | null;
};

function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function getAllocatedDoseCountFromInput(
  input: CreateCollectionWithAllocationsInput,
): number {
  const shippedDoseCount = input.shippedRows.reduce((total, row) => total + row.doseCount, 0);
  const onFarmDoseCount = input.onFarmRows.reduce((total, row) => total + row.doseCount, 0);
  return shippedDoseCount + onFarmDoseCount;
}

function validateWizardInput(input: CreateCollectionWithAllocationsInput): void {
  const hasAllocations = input.shippedRows.length > 0 || input.onFarmRows.length > 0;
  const collectionDoseCount = input.collection.doseCount ?? null;
  const allocatedDoseCount = getAllocatedDoseCountFromInput(input);

  if (hasAllocations && (collectionDoseCount == null || collectionDoseCount <= 0)) {
    throw new Error('Dose count is required before saving allocations.');
  }

  if (collectionDoseCount != null && allocatedDoseCount > collectionDoseCount) {
    throw new Error('Allocated doses cannot exceed the collection dose count.');
  }

  const seenMareIds = new Set<string>();
  for (const row of input.onFarmRows) {
    if (seenMareIds.has(row.mareId)) {
      throw new Error('A mare can only be selected once per collection wizard.');
    }
    seenMareIds.add(row.mareId);
  }
}

async function getRequiredStallion(
  db: SQLite.SQLiteDatabase,
  stallionId: string,
): Promise<StallionRow> {
  const stallion = await db.getFirstAsync<StallionRow>(
    `
    SELECT name, deleted_at
    FROM stallions
    WHERE id = ?;
    `,
    [stallionId],
  );

  if (!stallion) {
    throw new Error('Stallion not found.');
  }

  if (stallion.deleted_at != null) {
    throw new Error('Cannot add collection for a deleted stallion.');
  }

  return stallion;
}

async function getRequiredMare(
  db: SQLite.SQLiteDatabase,
  mareId: string,
): Promise<MareRow> {
  const mare = await db.getFirstAsync<MareRow>(
    `
    SELECT name, deleted_at
    FROM mares
    WHERE id = ?;
    `,
    [mareId],
  );

  if (!mare) {
    throw new Error('Mare not found.');
  }

  if (mare.deleted_at != null) {
    throw new Error('Cannot use a deleted mare for on-farm allocation.');
  }

  return mare;
}

async function insertCollection(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  input: CollectionDraftInput,
  now: string,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO semen_collections (
      id,
      stallion_id,
      collection_date,
      raw_volume_ml,
      extended_volume_ml,
      extender_volume_ml,
      extender_type,
      concentration_millions_per_ml,
      progressive_motility_percent,
      dose_count,
      dose_size_millions,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      collectionId,
      input.stallionId,
      input.collectionDate,
      input.rawVolumeMl ?? null,
      input.totalVolumeMl ?? null,
      input.extenderVolumeMl ?? null,
      normalizeOptionalText(input.extenderType),
      input.concentrationMillionsPerMl ?? null,
      input.progressiveMotilityPercent ?? null,
      input.doseCount ?? null,
      input.doseSizeMillions ?? null,
      normalizeOptionalText(input.notes),
      now,
      now,
    ],
  );
}

async function insertShippedDoseEvent(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  row: CreateCollectionWizardShippedRowInput,
  now: string,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO collection_dose_events (
      id,
      collection_id,
      event_type,
      recipient,
      recipient_phone,
      recipient_street,
      recipient_city,
      recipient_state,
      recipient_zip,
      carrier_service,
      container_type,
      tracking_number,
      breeding_record_id,
      dose_count,
      event_date,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      newId(),
      collectionId,
      'shipped',
      row.recipient.trim(),
      row.recipientPhone.trim(),
      row.recipientStreet.trim(),
      row.recipientCity.trim(),
      row.recipientState.trim(),
      row.recipientZip.trim(),
      row.carrierService.trim(),
      row.containerType.trim(),
      normalizeOptionalText(row.trackingNumber),
      null,
      row.doseCount,
      row.eventDate,
      normalizeOptionalText(row.notes),
      now,
      now,
    ],
  );
}

async function insertOnFarmAllocation(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  collection: CollectionDraftInput,
  row: CreateCollectionWizardOnFarmRowInput,
  now: string,
): Promise<string> {
  const mare = await getRequiredMare(db, row.mareId);
  const breedingRecordId = newId();

  await db.runAsync(
    `
    INSERT INTO breeding_records (
      id,
      mare_id,
      stallion_id,
      stallion_name,
      collection_id,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      breedingRecordId,
      row.mareId,
      collection.stallionId,
      null,
      collectionId,
      row.eventDate,
      'freshAI',
      normalizeOptionalText(row.notes),
      collection.rawVolumeMl ?? null,
      collection.concentrationMillionsPerMl ?? null,
      collection.progressiveMotilityPercent ?? null,
      null,
      null,
      null,
      collection.collectionDate,
      now,
      now,
    ],
  );

  await db.runAsync(
    `
    INSERT INTO collection_dose_events (
      id,
      collection_id,
      event_type,
      recipient,
      recipient_phone,
      recipient_street,
      recipient_city,
      recipient_state,
      recipient_zip,
      carrier_service,
      container_type,
      tracking_number,
      breeding_record_id,
      dose_count,
      event_date,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      newId(),
      collectionId,
      'usedOnSite',
      mare.name,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      breedingRecordId,
      row.doseCount,
      row.eventDate,
      normalizeOptionalText(row.notes),
      now,
      now,
    ],
  );

  return breedingRecordId;
}

export async function createCollectionWithAllocations(
  input: CreateCollectionWithAllocationsInput,
): Promise<CreateCollectionWithAllocationsResult> {
  validateWizardInput(input);

  const db = await getDb();
  await getRequiredStallion(db, input.collection.stallionId);

  const collectionId = newId();
  const breedingRecordIds: string[] = [];
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await insertCollection(db, collectionId, input.collection, now);

    for (const row of input.shippedRows) {
      await insertShippedDoseEvent(db, collectionId, row, now);
    }

    for (const row of input.onFarmRows) {
      const breedingRecordId = await insertOnFarmAllocation(
        db,
        collectionId,
        input.collection,
        row,
        now,
      );
      breedingRecordIds.push(breedingRecordId);
    }
  });

  emitDataInvalidation('semenCollections');
  emitDataInvalidation('collectionDoseEvents');
  emitDataInvalidation('breedingRecords');

  return {
    collectionId,
    breedingRecordIds,
  };
}

export async function getAllocatedDoseCountForCollection(
  collectionId: string,
  options?: AllocatedDoseCountOptions,
): Promise<number> {
  const db = await getDb();
  return getAllocatedDoseCountForCollectionDb(db, collectionId, options);
}
