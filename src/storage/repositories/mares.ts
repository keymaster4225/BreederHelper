import { DEFAULT_GESTATION_LENGTH_DAYS, LocalDate, Mare } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

export async function listMares(includeDeleted = false, db?: RepoDb): Promise<Mare[]> {
  const handle = await resolveDb(db);
  const deletedClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

  return handle.getAllAsync<MareRow>(
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

export async function getMareById(id: string, db?: RepoDb): Promise<Mare | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<MareRow>(
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
}, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
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
  },
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);

  await handle.runAsync(
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

export async function softDeleteMare(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);

  await handle.runAsync(
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
