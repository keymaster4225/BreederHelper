import {
  BreedingMethod,
  BreedingRecord,
  DailyLog,
  FoalingRecord,
  PregnancyCheck,
  Stallion,
} from '@/models/types';

import { getDb } from '@/storage/db';

// Minimal repository set to unblock app scaffolding; expand with full CRUD next.

export async function listStallions(): Promise<Stallion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StallionRow>(
    `
    SELECT id, name, breed, registration_number, sire, dam, notes, created_at, updated_at, deleted_at
    FROM stallions
    WHERE deleted_at IS NULL
    ORDER BY name COLLATE NOCASE ASC;
    `
  );

  return rows.map((row) => ({
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
  }));
}

export async function getStallionById(id: string): Promise<Stallion | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<StallionRow>(
    `
    SELECT id, name, breed, registration_number, sire, dam, notes, created_at, updated_at, deleted_at
    FROM stallions
    WHERE id = ?;
    `,
    [id]
  );

  if (!row) {
    return null;
  }

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
    ]
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
  }
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
    ]
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
    [new Date().toISOString(), new Date().toISOString(), id]
  );
}

export async function createBreedingRecord(input: {
  id: string;
  mareId: string;
  stallionId: string;
  date: string;
  method: BreedingMethod;
  notes?: string | null;
  volumeMl?: number | null;
  concentrationMPerMl?: number | null;
  motilityPercent?: number | null;
  numberOfStraws?: number | null;
  strawDetails?: string | null;
  collectionDate?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO breeding_records (
      id,
      mare_id,
      stallion_id,
      date,
      method,
      notes,
      volume_ml,
      concentration_m_per_ml,
      motility_percent,
      number_of_straws,
      straw_details,
      collection_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.stallionId,
      input.date,
      input.method,
      input.notes ?? null,
      input.volumeMl ?? null,
      input.concentrationMPerMl ?? null,
      input.motilityPercent ?? null,
      input.numberOfStraws ?? null,
      input.strawDetails ?? null,
      input.collectionDate ?? null,
      now,
      now,
    ]
  );
}

export async function createDailyLog(input: {
  id: string;
  mareId: string;
  date: string;
  teasingScore?: number | null;
  rightOvary?: string | null;
  leftOvary?: string | null;
  edema?: number | null;
  uterineTone?: string | null;
  uterineCysts?: string | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO daily_logs (
      id,
      mare_id,
      date,
      teasing_score,
      right_ovary,
      left_ovary,
      edema,
      uterine_tone,
      uterine_cysts,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.date,
      input.teasingScore ?? null,
      input.rightOvary ?? null,
      input.leftOvary ?? null,
      input.edema ?? null,
      input.uterineTone ?? null,
      input.uterineCysts ?? null,
      input.notes ?? null,
      now,
      now,
    ]
  );
}

export async function createPregnancyCheck(input: {
  id: string;
  mareId: string;
  breedingRecordId: string;
  date: string;
  result: PregnancyCheck['result'];
  heartbeatDetected?: boolean | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO pregnancy_checks (
      id,
      mare_id,
      breeding_record_id,
      date,
      result,
      heartbeat_detected,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.breedingRecordId,
      input.date,
      input.result,
      input.heartbeatDetected == null ? null : input.heartbeatDetected ? 1 : 0,
      input.notes ?? null,
      now,
      now,
    ]
  );
}

export async function listDailyLogsByMare(mareId: string): Promise<DailyLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyLogRow>(
    `
    SELECT id, mare_id, date, teasing_score, right_ovary, left_ovary, edema, uterine_tone, uterine_cysts, notes, created_at, updated_at
    FROM daily_logs
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId]
  );

  return rows.map((row) => ({
    id: row.id,
    mareId: row.mare_id,
    date: row.date,
    teasingScore: row.teasing_score,
    rightOvary: row.right_ovary,
    leftOvary: row.left_ovary,
    edema: row.edema,
    uterineTone: row.uterine_tone,
    uterineCysts: row.uterine_cysts,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listBreedingRecordsByMare(mareId: string): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId]
  );

  return rows.map((row) => ({
    id: row.id,
    mareId: row.mare_id,
    stallionId: row.stallion_id,
    date: row.date,
    method: row.method,
    notes: row.notes,
    volumeMl: row.volume_ml,
    concentrationMPerMl: row.concentration_m_per_ml,
    motilityPercent: row.motility_percent,
    numberOfStraws: row.number_of_straws,
    strawDetails: row.straw_details,
    collectionDate: row.collection_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listPregnancyChecksByMare(mareId: string): Promise<PregnancyCheck[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PregnancyCheckRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, result, heartbeat_detected, notes, created_at, updated_at
    FROM pregnancy_checks
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId]
  );

  return rows.map((row) => ({
    id: row.id,
    mareId: row.mare_id,
    breedingRecordId: row.breeding_record_id,
    date: row.date,
    result: row.result,
    heartbeatDetected: row.heartbeat_detected === null ? null : Boolean(row.heartbeat_detected),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listFoalingRecordsByMare(mareId: string): Promise<FoalingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId]
  );

  return rows.map((row) => ({
    id: row.id,
    mareId: row.mare_id,
    breedingRecordId: row.breeding_record_id,
    date: row.date,
    outcome: row.outcome,
    foalSex: row.foal_sex,
    complications: row.complications,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

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

type DailyLogRow = {
  id: string;
  mare_id: string;
  date: string;
  teasing_score: number | null;
  right_ovary: string | null;
  left_ovary: string | null;
  edema: number | null;
  uterine_tone: string | null;
  uterine_cysts: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BreedingRecordRow = {
  id: string;
  mare_id: string;
  stallion_id: string;
  date: string;
  method: BreedingRecord['method'];
  notes: string | null;
  volume_ml: number | null;
  concentration_m_per_ml: number | null;
  motility_percent: number | null;
  number_of_straws: number | null;
  straw_details: string | null;
  collection_date: string | null;
  created_at: string;
  updated_at: string;
};

type PregnancyCheckRow = {
  id: string;
  mare_id: string;
  breeding_record_id: string;
  date: string;
  result: PregnancyCheck['result'];
  heartbeat_detected: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FoalingRecordRow = {
  id: string;
  mare_id: string;
  breeding_record_id: string | null;
  date: string;
  outcome: FoalingRecord['outcome'];
  foal_sex: FoalingRecord['foalSex'];
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
