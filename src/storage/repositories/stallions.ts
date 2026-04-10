import { Stallion } from '@/models/types';
import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

type StallionRow = {
  id: string;
  name: string;
  breed: string | null;
  registration_number: string | null;
  sire: string | null;
  dam: string | null;
  notes: string | null;
  date_of_birth: string | null;
  av_temperature_f: number | null;
  av_type: string | null;
  av_liner_type: string | null;
  av_water_volume_ml: number | null;
  av_notes: string | null;
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
    dateOfBirth: row.date_of_birth,
    avTemperatureF: row.av_temperature_f,
    avType: row.av_type,
    avLinerType: row.av_liner_type,
    avWaterVolumeMl: row.av_water_volume_ml,
    avNotes: row.av_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function listStallions(): Promise<Stallion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StallionRow>(
    `
    SELECT id, name, breed, registration_number, sire, dam, notes, date_of_birth, av_temperature_f, av_type, av_liner_type, av_water_volume_ml, av_notes, created_at, updated_at, deleted_at
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
    SELECT id, name, breed, registration_number, sire, dam, notes, date_of_birth, av_temperature_f, av_type, av_liner_type, av_water_volume_ml, av_notes, created_at, updated_at, deleted_at
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
  dateOfBirth?: string | null;
  avTemperatureF?: number | null;
  avType?: string | null;
  avLinerType?: string | null;
  avWaterVolumeMl?: number | null;
  avNotes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO stallions (
      id, name, breed, registration_number, sire, dam, notes,
      date_of_birth, av_temperature_f, av_type, av_liner_type, av_water_volume_ml, av_notes,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
    `,
    [
      input.id,
      input.name,
      input.breed ?? null,
      input.registrationNumber ?? null,
      input.sire ?? null,
      input.dam ?? null,
      input.notes ?? null,
      input.dateOfBirth ?? null,
      input.avTemperatureF ?? null,
      input.avType ?? null,
      input.avLinerType ?? null,
      input.avWaterVolumeMl ?? null,
      input.avNotes ?? null,
      now,
      now,
    ],
  );
  emitDataInvalidation('stallions');
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
    dateOfBirth?: string | null;
    avTemperatureF?: number | null;
    avType?: string | null;
    avLinerType?: string | null;
    avWaterVolumeMl?: number | null;
    avNotes?: string | null;
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
      date_of_birth = ?,
      av_temperature_f = ?,
      av_type = ?,
      av_liner_type = ?,
      av_water_volume_ml = ?,
      av_notes = ?,
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
      input.dateOfBirth ?? null,
      input.avTemperatureF ?? null,
      input.avType ?? null,
      input.avLinerType ?? null,
      input.avWaterVolumeMl ?? null,
      input.avNotes ?? null,
      new Date().toISOString(),
      id,
    ],
  );
  emitDataInvalidation('stallions');
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
  emitDataInvalidation('stallions');
}
