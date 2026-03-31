import { Stallion } from '@/models/types';
import { getDb } from '@/storage/db';

type StallionRow = {
  id: string;
  name: string;
  breed: string | null;
  registration_number: string | null;
  sire: string | null;
  dam: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapStallionRow(row: StallionRow): Stallion {
  return {
    id: row.id,
    name: row.name,
    breed: row.breed,
    registrationNumber: row.registration_number,
    sire: row.sire,
    dam: row.dam,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function listStallions(): Promise<Stallion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StallionRow>(
    `
    SELECT id, name, breed, registration_number, sire, dam, notes, created_at, updated_at, deleted_at
    FROM stallions
    WHERE deleted_at IS NULL
    ORDER BY name COLLATE NOCASE ASC;
    `,
  );

  return rows.map(mapStallionRow);
}

export async function getStallionById(id: string): Promise<Stallion | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<StallionRow>(
    `
    SELECT id, name, breed, registration_number, sire, dam, notes, created_at, updated_at, deleted_at
    FROM stallions
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapStallionRow(row) : null;
}

export async function createStallion(input: {
  id: string;
  name: string;
  breed?: string | null;
  registrationNumber?: string | null;
  sire?: string | null;
  dam?: string | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO stallions (
      id,
      name,
      breed,
      registration_number,
      sire,
      dam,
      notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `,
    [
      input.id,
      input.name,
      input.breed ?? null,
      input.registrationNumber ?? null,
      input.sire ?? null,
      input.dam ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export async function updateStallion(
  id: string,
  input: {
    name: string;
    breed?: string | null;
    registrationNumber?: string | null;
    sire?: string | null;
    dam?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE stallions
    SET
      name = ?,
      breed = ?,
      registration_number = ?,
      sire = ?,
      dam = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.name,
      input.breed ?? null,
      input.registrationNumber ?? null,
      input.sire ?? null,
      input.dam ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function softDeleteStallion(id: string): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE stallions
    SET deleted_at = ?, updated_at = ?
    WHERE id = ?;
    `,
    [new Date().toISOString(), new Date().toISOString(), id],
  );
}
