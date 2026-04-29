import {
  CollectionDoseEvent,
  CreateCollectionDoseEventInput,
  UpdateCollectionDoseEventInput,
  UUID,
} from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { newId } from '@/utils/id';
import {
  assertCollectionSemenVolumeCanSupportAllocation,
} from './internal/collectionAllocation';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

type CollectionDoseEventRow = {
  id: string;
  collection_id: string;
  event_type: CollectionDoseEvent['eventType'];
  recipient: string;
  recipient_phone: string | null;
  recipient_street: string | null;
  recipient_city: string | null;
  recipient_state: string | null;
  recipient_zip: string | null;
  carrier_service: string | null;
  container_type: string | null;
  tracking_number: string | null;
  breeding_record_id: string | null;
  dose_semen_volume_ml: number | null;
  dose_extender_volume_ml: number | null;
  dose_count: number | null;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: CollectionDoseEventRow): CollectionDoseEvent {
  return {
    id: row.id,
    collectionId: row.collection_id,
    eventType: row.event_type,
    recipient: row.recipient,
    recipientPhone: row.recipient_phone,
    recipientStreet: row.recipient_street,
    recipientCity: row.recipient_city,
    recipientState: row.recipient_state,
    recipientZip: row.recipient_zip,
    carrierService: row.carrier_service,
    containerType: row.container_type,
    trackingNumber: row.tracking_number,
    breedingRecordId: row.breeding_record_id,
    doseSemenVolumeMl: row.dose_semen_volume_ml,
    doseExtenderVolumeMl: row.dose_extender_volume_ml,
    doseCount: row.dose_count,
    eventDate: row.event_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRequiredText(value: string | null | undefined, label: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function normalizeRequiredDoseCount(value: number | null | undefined): number {
  if (value == null || value <= 0) {
    throw new Error('Dose count is required.');
  }
  return value;
}

function normalizeRequiredPositiveNumber(
  value: number | null | undefined,
  label: string,
): number {
  if (value == null || value <= 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function normalizeRequiredNonNegativeNumber(
  value: number | null | undefined,
  label: string,
): number {
  if (value == null || value < 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function buildCollectionIdPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function listDoseEventsByCollection(
  collectionId: UUID,
  db?: RepoDb,
): Promise<CollectionDoseEvent[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<CollectionDoseEventRow>(
    `
    SELECT
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
    FROM collection_dose_events
    WHERE collection_id = ?
    ORDER BY created_at DESC, id DESC;
    `,
    [collectionId],
  );
  return rows.map(mapRow);
}

export async function listDoseEventsByCollectionIds(
  collectionIds: readonly UUID[],
  db?: RepoDb,
): Promise<Record<UUID, CollectionDoseEvent[]>> {
  const grouped: Record<UUID, CollectionDoseEvent[]> = {};

  for (const collectionId of collectionIds) {
    grouped[collectionId] = [];
  }

  if (collectionIds.length === 0) {
    return grouped;
  }

  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<CollectionDoseEventRow>(
    `
    SELECT
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
    FROM collection_dose_events
    WHERE collection_id IN (${buildCollectionIdPlaceholders(collectionIds.length)})
    ORDER BY created_at DESC, id DESC;
    `,
    [...collectionIds],
  );

  for (const row of rows) {
    grouped[row.collection_id] ??= [];
    grouped[row.collection_id].push(mapRow(row));
  }

  return grouped;
}

export async function createDoseEvent(
  input: CreateCollectionDoseEventInput & { readonly id?: UUID },
  db?: RepoDb,
): Promise<CollectionDoseEvent> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();
  const id = input.id ?? newId();
  const eventType = input.eventType;

  if (eventType !== 'shipped') {
    throw new Error('On-farm allocations must be created through the collection wizard.');
  }

  const doseCount = normalizeRequiredDoseCount(input.doseCount);
  const doseSemenVolumeMl = normalizeRequiredPositiveNumber(
    input.doseSemenVolumeMl,
    'Dose semen volume',
  );
  const doseExtenderVolumeMl = normalizeRequiredNonNegativeNumber(
    input.doseExtenderVolumeMl,
    'Dose extender volume',
  );
  await assertCollectionSemenVolumeCanSupportAllocation(
    handle,
    input.collectionId,
    doseSemenVolumeMl,
    doseCount,
  );

  await handle.runAsync(
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
      id,
      input.collectionId,
      eventType,
      normalizeRequiredText(input.recipient, 'Recipient name'),
      normalizeRequiredText(input.recipientPhone, 'Recipient phone'),
      normalizeRequiredText(input.recipientStreet, 'Recipient street'),
      normalizeRequiredText(input.recipientCity, 'Recipient city'),
      normalizeRequiredText(input.recipientState, 'Recipient state'),
      normalizeRequiredText(input.recipientZip, 'Recipient ZIP'),
      normalizeRequiredText(input.carrierService, 'Carrier/service'),
      normalizeRequiredText(input.containerType, 'Container type'),
      normalizeOptionalText(input.trackingNumber),
      null,
      doseSemenVolumeMl,
      doseExtenderVolumeMl,
      doseCount,
      normalizeRequiredText(input.eventDate, 'Ship date'),
      normalizeOptionalText(input.notes),
      now,
      now,
    ],
  );
  emitDataInvalidation('collectionDoseEvents');

  const created = await getDoseEventById(id, handle);
  if (!created) {
    throw new Error('Failed to create dose event.');
  }
  return created;
}

export async function updateDoseEvent(
  id: UUID,
  input: UpdateCollectionDoseEventInput,
  db?: RepoDb,
): Promise<CollectionDoseEvent> {
  const handle = await resolveDb(db);
  const existing = await getDoseEventById(id, handle);
  if (!existing) {
    throw new Error('Dose event not found.');
  }

  if (existing.eventType !== 'shipped' || input.eventType === 'usedOnSite') {
    throw new Error('On-farm allocations must be edited through the breeding record.');
  }

  const doseCount = normalizeRequiredDoseCount(
    input.doseCount === undefined ? existing.doseCount : input.doseCount,
  );
  const doseSemenVolumeMl = normalizeRequiredPositiveNumber(
    input.doseSemenVolumeMl === undefined ? existing.doseSemenVolumeMl : input.doseSemenVolumeMl,
    'Dose semen volume',
  );
  const doseExtenderVolumeMl = normalizeRequiredNonNegativeNumber(
    input.doseExtenderVolumeMl === undefined
      ? existing.doseExtenderVolumeMl
      : input.doseExtenderVolumeMl,
    'Dose extender volume',
  );
  await assertCollectionSemenVolumeCanSupportAllocation(
    handle,
    existing.collectionId,
    doseSemenVolumeMl,
    doseCount,
    { excludeDoseEventId: id },
  );

  await handle.runAsync(
    `
    UPDATE collection_dose_events
    SET
      event_type = ?,
      recipient = ?,
      recipient_phone = ?,
      recipient_street = ?,
      recipient_city = ?,
      recipient_state = ?,
      recipient_zip = ?,
      carrier_service = ?,
      container_type = ?,
      tracking_number = ?,
      breeding_record_id = ?,
      dose_semen_volume_ml = ?,
      dose_extender_volume_ml = ?,
      dose_count = ?,
      event_date = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      'shipped',
      normalizeRequiredText(input.recipient ?? existing.recipient, 'Recipient name'),
      normalizeRequiredText(input.recipientPhone ?? existing.recipientPhone, 'Recipient phone'),
      normalizeRequiredText(input.recipientStreet ?? existing.recipientStreet, 'Recipient street'),
      normalizeRequiredText(input.recipientCity ?? existing.recipientCity, 'Recipient city'),
      normalizeRequiredText(input.recipientState ?? existing.recipientState, 'Recipient state'),
      normalizeRequiredText(input.recipientZip ?? existing.recipientZip, 'Recipient ZIP'),
      normalizeRequiredText(input.carrierService ?? existing.carrierService, 'Carrier/service'),
      normalizeRequiredText(input.containerType ?? existing.containerType, 'Container type'),
      normalizeOptionalText(input.trackingNumber === undefined ? existing.trackingNumber : input.trackingNumber),
      existing.breedingRecordId ?? null,
      doseSemenVolumeMl,
      doseExtenderVolumeMl,
      doseCount,
      normalizeRequiredText(input.eventDate === undefined ? existing.eventDate : input.eventDate, 'Ship date'),
      normalizeOptionalText(input.notes === undefined ? existing.notes : input.notes),
      new Date().toISOString(),
      id,
    ],
  );
  emitDataInvalidation('collectionDoseEvents');

  const updated = await getDoseEventById(id, handle);
  if (!updated) {
    throw new Error('Failed to update dose event.');
  }
  return updated;
}

export async function deleteDoseEvent(id: UUID, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.runAsync('DELETE FROM collection_dose_events WHERE id = ?;', [id]);
  emitDataInvalidation('collectionDoseEvents');
}

export async function getDoseEventById(id: UUID, db?: RepoDb): Promise<CollectionDoseEvent | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<CollectionDoseEventRow>(
    `
    SELECT
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
    FROM collection_dose_events
    WHERE id = ?;
    `,
    [id],
  );
  return row ? mapRow(row) : null;
}
