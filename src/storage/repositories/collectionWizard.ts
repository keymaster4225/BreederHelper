import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { normalizeBreedingRecordTime } from '@/utils/breedingRecordTime';
import { computeAllocationSummary } from '@/utils/collectionAllocation';
import { newId } from '@/utils/id';
import type { AllocatedSemenVolumeOptions } from './internal/collectionAllocation';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';
import {
  assertCollectionSemenVolumeWithinCap,
  getAllocatedSemenVolumeForCollectionDb,
} from './internal/collectionAllocation';

type CollectionDraftInput = {
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
  doseSemenVolumeMl: number;
  doseExtenderVolumeMl: number;
  doseCount: number;
  notes?: string | null;
};

export type CreateCollectionWizardOnFarmRowInput = {
  mareId: string;
  eventDate: string;
  eventTime: string;
  doseSemenVolumeMl?: number | null;
  notes?: string | null;
  doseCount?: number;
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

function validateWizardInput(input: CreateCollectionWithAllocationsInput): void {
  const seenMareIds = new Set<string>();
  const allocationRows = [
    ...input.shippedRows.map((row) => ({
      doseSemenVolumeMl: row.doseSemenVolumeMl,
      doseCount: row.doseCount,
    })),
    ...input.onFarmRows.map((row) => ({
      doseSemenVolumeMl: row.doseSemenVolumeMl ?? null,
      doseCount: 1,
    })),
  ];

  for (const row of input.shippedRows) {
    if (row.doseCount <= 0) {
      throw new Error('Dose count is required.');
    }
    if (row.doseSemenVolumeMl == null || row.doseSemenVolumeMl <= 0) {
      throw new Error('Dose semen volume is required.');
    }
    if (row.doseExtenderVolumeMl == null || row.doseExtenderVolumeMl < 0) {
      throw new Error('Dose extender volume is required.');
    }
  }

  for (const row of input.onFarmRows) {
    if (seenMareIds.has(row.mareId)) {
      throw new Error('A mare can only be selected once per collection wizard.');
    }
    seenMareIds.add(row.mareId);

    if (row.doseCount != null && row.doseCount !== 1) {
      throw new Error('On-farm allocations must always use a dose count of 1.');
    }
    if (normalizeBreedingRecordTime(row.eventTime) == null) {
      throw new Error('Breeding time is required.');
    }
    if (row.doseSemenVolumeMl != null && row.doseSemenVolumeMl <= 0) {
      throw new Error('Dose semen volume must be greater than zero when provided.');
    }
  }

  const summary = computeAllocationSummary(allocationRows, input.collection.rawVolumeMl ?? null);
  if (!summary.isWithinCap) {
    throw new Error('Allocated semen volume cannot exceed the collection total volume.');
  }
}

async function getRequiredStallion(
  db: RepoDb,
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
  db: RepoDb,
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
  db: RepoDb,
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
      extender_type,
      concentration_millions_per_ml,
      progressive_motility_percent,
      target_mode,
      target_motile_sperm_millions_per_dose,
      target_post_extension_concentration_millions_per_ml,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      collectionId,
      input.stallionId,
      input.collectionDate,
      input.rawVolumeMl ?? null,
      normalizeOptionalText(input.extenderType),
      input.concentrationMillionsPerMl ?? null,
      input.progressiveMotilityPercent ?? null,
      input.targetMode ?? null,
      input.targetSpermMillionsPerDose ?? null,
      input.targetPostExtensionConcentrationMillionsPerMl ?? null,
      normalizeOptionalText(input.notes),
      now,
      now,
    ],
  );
}

async function insertShippedDoseEvent(
  db: RepoDb,
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
      dose_semen_volume_ml,
      dose_extender_volume_ml,
      dose_count,
      event_date,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
      row.doseSemenVolumeMl,
      row.doseExtenderVolumeMl,
      row.doseCount,
      row.eventDate,
      normalizeOptionalText(row.notes),
      now,
      now,
    ],
  );
}

async function insertOnFarmAllocation(
  db: RepoDb,
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
      time,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      breedingRecordId,
      row.mareId,
      collection.stallionId,
      null,
      collectionId,
      row.eventDate,
      normalizeBreedingRecordTime(row.eventTime),
      'freshAI',
      normalizeOptionalText(row.notes),
      row.doseSemenVolumeMl ?? null,
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
      dose_semen_volume_ml,
      dose_extender_volume_ml,
      dose_count,
      event_date,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
      row.doseSemenVolumeMl ?? null,
      null,
      1,
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
  db?: RepoDb,
): Promise<CreateCollectionWithAllocationsResult> {
  validateWizardInput(input);

  const handle = await resolveDb(db);
  await getRequiredStallion(handle, input.collection.stallionId);

  const collectionId = newId();
  const breedingRecordIds: string[] = [];
  const now = new Date().toISOString();

  await handle.withTransactionAsync(async () => {
    await insertCollection(handle, collectionId, input.collection, now);

    for (const row of input.shippedRows) {
      await insertShippedDoseEvent(handle, collectionId, row, now);
    }

    for (const row of input.onFarmRows) {
      const breedingRecordId = await insertOnFarmAllocation(
        handle,
        collectionId,
        input.collection,
        row,
        now,
      );
      breedingRecordIds.push(breedingRecordId);
    }

    await assertCollectionSemenVolumeWithinCap(handle, collectionId);
  });

  emitDataInvalidation('semenCollections');
  emitDataInvalidation('collectionDoseEvents');
  emitDataInvalidation('breedingRecords');

  return {
    collectionId,
    breedingRecordIds,
  };
}

export async function getAllocatedSemenVolumeForCollection(
  collectionId: string,
  options?: AllocatedSemenVolumeOptions,
  db?: RepoDb,
): Promise<number> {
  const handle = await resolveDb(db);
  return getAllocatedSemenVolumeForCollectionDb(handle, collectionId, options);
}
