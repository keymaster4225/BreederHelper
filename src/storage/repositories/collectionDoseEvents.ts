import {
  CollectionDoseEvent,
  CreateCollectionDoseEventInput,
  UpdateCollectionDoseEventInput,
  UUID,
} from '@/models/types';
import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { newId } from '@/utils/id';
import {
  assertCollectionDoseCountCanSupportAllocations,
} from './internal/collectionAllocation';

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

function buildCollectionIdPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function listDoseEventsByCollection(
  collectionId: UUID,
): Promise<CollectionDoseEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CollectionDoseEventRow>(
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
): Promise<Record<UUID, CollectionDoseEvent[]>> {
  const grouped: Record<UUID, CollectionDoseEvent[]> = {};

  for (const collectionId of collectionIds) {
    grouped[collectionId] = [];
  }

  if (collectionIds.length === 0) {
    return grouped;
  }

  const db = await getDb();
  const rows = await db.getAllAsync<CollectionDoseEventRow>(
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
  input: CreateCollectionDoseEventInput,
): Promise<CollectionDoseEvent> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = newId();
  const eventType = input.eventType;

  if (eventType !== 'shipped') {
    throw new Error('On-farm allocations must be created through the collection wizard.');
  }

  const doseCount = normalizeRequiredDoseCount(input.doseCount);
  await assertCollectionDoseCountCanSupportAllocations(db, input.collectionId, doseCount);

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
      doseCount,
      normalizeRequiredText(input.eventDate, 'Ship date'),
      normalizeOptionalText(input.notes),
      now,
      now,
    ],
  );
  emitDataInvalidation('collectionDoseEvents');

  const created = await getDoseEventById(id);
  if (!created) {
    throw new Error('Failed to create dose event.');
  }
  return created;
}

export async function updateDoseEvent(
  id: UUID,
  input: UpdateCollectionDoseEventInput,
): Promise<CollectionDoseEvent> {
  const existing = await getDoseEventById(id);
  if (!existing) {
    throw new Error('Dose event not found.');
  }

  if (existing.eventType !== 'shipped' || input.eventType === 'usedOnSite') {
    throw new Error('On-farm allocations must be edited through the breeding record.');
  }

  const db = await getDb();
  const doseCount = normalizeRequiredDoseCount(
    input.doseCount === undefined ? existing.doseCount : input.doseCount,
  );
  await assertCollectionDoseCountCanSupportAllocations(
    db,
    existing.collectionId,
    doseCount,
    { excludeDoseEventId: id },
  );

  await db.runAsync(
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
      doseCount,
      normalizeRequiredText(input.eventDate === undefined ? existing.eventDate : input.eventDate, 'Ship date'),
      normalizeOptionalText(input.notes === undefined ? existing.notes : input.notes),
      new Date().toISOString(),
      id,
    ],
  );
  emitDataInvalidation('collectionDoseEvents');

  const updated = await getDoseEventById(id);
  if (!updated) {
    throw new Error('Failed to update dose event.');
  }
  return updated;
}

export async function deleteDoseEvent(id: UUID): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM collection_dose_events WHERE id = ?;', [id]);
  emitDataInvalidation('collectionDoseEvents');
}

async function getDoseEventById(id: UUID): Promise<CollectionDoseEvent | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CollectionDoseEventRow>(
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
