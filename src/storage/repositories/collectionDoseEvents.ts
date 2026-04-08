import {
  CollectionDoseEvent,
  CreateCollectionDoseEventInput,
  UpdateCollectionDoseEventInput,
  UUID,
} from '@/models/types';
import { getDb } from '@/storage/db';
import { newId } from '@/utils/id';

type CollectionDoseEventRow = {
  id: string;
  collection_id: string;
  event_type: CollectionDoseEvent['eventType'];
  recipient: string;
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
    doseCount: row.dose_count,
    eventDate: row.event_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
      id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at
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
      id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at
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

  await db.runAsync(
    `
    INSERT INTO collection_dose_events (
      id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      id,
      input.collectionId,
      input.eventType,
      input.recipient.trim(),
      input.doseCount ?? null,
      input.eventDate ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

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

  const db = await getDb();

  await db.runAsync(
    `
    UPDATE collection_dose_events
    SET
      event_type = ?,
      recipient = ?,
      dose_count = ?,
      event_date = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.eventType ?? existing.eventType,
      input.recipient?.trim() ?? existing.recipient,
      input.doseCount === undefined ? existing.doseCount : input.doseCount,
      input.eventDate === undefined ? existing.eventDate : input.eventDate,
      input.notes === undefined ? existing.notes : input.notes,
      new Date().toISOString(),
      id,
    ],
  );

  const updated = await getDoseEventById(id);
  if (!updated) {
    throw new Error('Failed to update dose event.');
  }
  return updated;
}

export async function deleteDoseEvent(id: UUID): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM collection_dose_events WHERE id = ?;', [id]);
}

async function getDoseEventById(id: UUID): Promise<CollectionDoseEvent | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CollectionDoseEventRow>(
    `
    SELECT
      id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at
    FROM collection_dose_events
    WHERE id = ?;
    `,
    [id],
  );
  return row ? mapRow(row) : null;
}
