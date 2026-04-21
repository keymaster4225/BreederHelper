import { DEFAULT_GESTATION_LENGTH_DAYS, LocalDate, Mare } from '@/models/types';
import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

export async function listMares(includeDeleted = false): Promise<Mare[]> {
  const db = await getDb();
  const deletedClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

  return db.getAllAsync<MareRow>(
    `
    SELECT
      id,
      name,
      breed,
      gestation_length_days,
      date_of_birth,
      registration_number,
      notes,
      created_at,
      updated_at,
      deleted_at
    FROM mares
    ${deletedClause}
    ORDER BY name COLLATE NOCASE ASC;
    `
  ).then((rows) => rows.map(mapMareRow));
}

export async function getMareById(id: string): Promise<Mare | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MareRow>(
    `
    SELECT
      id,
      name,
      breed,
      gestation_length_days,
      date_of_birth,
      registration_number,
      notes,
      created_at,
      updated_at,
      deleted_at
    FROM mares
    WHERE id = ?;
    `,
    [id]
  );

  return row ? mapMareRow(row) : null;
}

export async function createMare(input: {
  id: string;
  name: string;
  breed: string;
  gestationLengthDays?: number;
  dateOfBirth?: LocalDate | null;
  registrationNumber?: string | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO mares (
      id,
      name,
      breed,
      gestation_length_days,
      date_of_birth,
      registration_number,
      notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `,
    [
      input.id,
      input.name,
      input.breed,
      input.gestationLengthDays ?? DEFAULT_GESTATION_LENGTH_DAYS,
      input.dateOfBirth ?? null,
      input.registrationNumber ?? null,
      input.notes ?? null,
      now,
      now,
    ]
  );
  emitDataInvalidation('mares');
}

export async function updateMare(
  id: string,
  input: {
    name: string;
    breed: string;
    gestationLengthDays: number;
    dateOfBirth?: LocalDate | null;
    registrationNumber?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE mares
    SET
      name = ?,
      breed = ?,
      gestation_length_days = ?,
      date_of_birth = ?,
      registration_number = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.name,
      input.breed,
      input.gestationLengthDays,
      input.dateOfBirth ?? null,
      input.registrationNumber ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ]
  );
  emitDataInvalidation('mares');
}

export async function softDeleteMare(id: string): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE mares
    SET deleted_at = ?, updated_at = ?
    WHERE id = ?;
    `,
    [new Date().toISOString(), new Date().toISOString(), id]
  );
  emitDataInvalidation('mares');
}

type MareRow = {
  id: string;
  name: string;
  breed: string;
  gestation_length_days: number;
  date_of_birth: string | null;
  registration_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapMareRow(row: MareRow): Mare {
  return {
    id: row.id,
    name: row.name,
    breed: row.breed,
    gestationLengthDays: row.gestation_length_days,
    dateOfBirth: row.date_of_birth,
    registrationNumber: row.registration_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
