import {
  BreedingMethod,
  BreedingRecord,
  DailyLog,
  Foal,
  FoalColor,
  FoalMilestoneEntry,
  FoalMilestoneKey,
  FoalMilestones,
  FoalSex,
  FoalingRecord,
  PregnancyCheck,
  Stallion,
} from '@/models/types';

import { getDb } from '@/storage/db';

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
    [id]
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
  stallionId: string | null;
  stallionName?: string | null;
  date: string;
  method: BreedingMethod;
  notes?: string | null;
  volumeMl?: number | null;
  concentrationMPerMl?: number | null;
  motilityPercent?: number | null;
  numberOfStraws?: number | null;
  strawVolumeMl?: number | null;
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
      stallion_name,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.stallionId,
      input.stallionName ?? null,
      input.date,
      input.method,
      input.notes ?? null,
      input.volumeMl ?? null,
      input.concentrationMPerMl ?? null,
      input.motilityPercent ?? null,
      input.numberOfStraws ?? null,
      input.strawVolumeMl ?? null,
      input.strawDetails ?? null,
      input.collectionDate ?? null,
      now,
      now,
    ]
  );
}

export async function updateBreedingRecord(
  id: string,
  input: {
    stallionId: string | null;
    stallionName?: string | null;
    date: string;
    method: BreedingMethod;
    notes?: string | null;
    volumeMl?: number | null;
    concentrationMPerMl?: number | null;
    motilityPercent?: number | null;
    numberOfStraws?: number | null;
    strawVolumeMl?: number | null;
    strawDetails?: string | null;
    collectionDate?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE breeding_records
    SET
      stallion_id = ?,
      stallion_name = ?,
      date = ?,
      method = ?,
      notes = ?,
      volume_ml = ?,
      concentration_m_per_ml = ?,
      motility_percent = ?,
      number_of_straws = ?,
      straw_volume_ml = ?,
      straw_details = ?,
      collection_date = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.stallionId,
      input.stallionName ?? null,
      input.date,
      input.method,
      input.notes ?? null,
      input.volumeMl ?? null,
      input.concentrationMPerMl ?? null,
      input.motilityPercent ?? null,
      input.numberOfStraws ?? null,
      input.strawVolumeMl ?? null,
      input.strawDetails ?? null,
      input.collectionDate ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function getBreedingRecordById(id: string): Promise<BreedingRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE id = ?;
    `,
    [id]
  );

  return row ? mapBreedingRecordRow(row) : null;
}

export async function deleteBreedingRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM breeding_records WHERE id = ?;', [id]);
}

export async function createDailyLog(input: {
  id: string;
  mareId: string;
  date: string;
  teasingScore?: number | null;
  rightOvary?: string | null;
  leftOvary?: string | null;
  ovulationDetected?: boolean | null;
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
      ovulation_detected,
      edema,
      uterine_tone,
      uterine_cysts,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.date,
      input.teasingScore ?? null,
      input.rightOvary ?? null,
      input.leftOvary ?? null,
      input.ovulationDetected == null ? null : input.ovulationDetected ? 1 : 0,
      input.edema ?? null,
      input.uterineTone ?? null,
      input.uterineCysts ?? null,
      input.notes ?? null,
      now,
      now,
    ]
  );
}

export async function updateDailyLog(
  id: string,
  input: {
    date: string;
    teasingScore?: number | null;
    rightOvary?: string | null;
    leftOvary?: string | null;
    ovulationDetected?: boolean | null;
    edema?: number | null;
    uterineTone?: string | null;
    uterineCysts?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE daily_logs
    SET
      date = ?,
      teasing_score = ?,
      right_ovary = ?,
      left_ovary = ?,
      ovulation_detected = ?,
      edema = ?,
      uterine_tone = ?,
      uterine_cysts = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.date,
      input.teasingScore ?? null,
      input.rightOvary ?? null,
      input.leftOvary ?? null,
      input.ovulationDetected == null ? null : input.ovulationDetected ? 1 : 0,
      input.edema ?? null,
      input.uterineTone ?? null,
      input.uterineCysts ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function getDailyLogById(id: string): Promise<DailyLog | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DailyLogRow>(
    `
    SELECT id, mare_id, date, teasing_score, right_ovary, left_ovary, ovulation_detected, edema, uterine_tone, uterine_cysts, notes, created_at, updated_at
    FROM daily_logs
    WHERE id = ?;
    `,
    [id]
  );

  return row ? mapDailyLogRow(row) : null;
}

export async function deleteDailyLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM daily_logs WHERE id = ?;', [id]);
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

export async function updatePregnancyCheck(
  id: string,
  input: {
    breedingRecordId: string;
    date: string;
    result: PregnancyCheck['result'];
    heartbeatDetected?: boolean | null;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE pregnancy_checks
    SET
      breeding_record_id = ?,
      date = ?,
      result = ?,
      heartbeat_detected = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.breedingRecordId,
      input.date,
      input.result,
      input.heartbeatDetected == null ? null : input.heartbeatDetected ? 1 : 0,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function getPregnancyCheckById(id: string): Promise<PregnancyCheck | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PregnancyCheckRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, result, heartbeat_detected, notes, created_at, updated_at
    FROM pregnancy_checks
    WHERE id = ?;
    `,
    [id]
  );

  return row ? mapPregnancyCheckRow(row) : null;
}

export async function deletePregnancyCheck(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pregnancy_checks WHERE id = ?;', [id]);
}

export async function createFoalingRecord(input: {
  id: string;
  mareId: string;
  breedingRecordId?: string | null;
  date: string;
  outcome: FoalingRecord['outcome'];
  foalSex?: FoalingRecord['foalSex'];
  complications?: string | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO foaling_records (
      id,
      mare_id,
      breeding_record_id,
      date,
      outcome,
      foal_sex,
      complications,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.breedingRecordId ?? null,
      input.date,
      input.outcome,
      input.foalSex ?? null,
      input.complications ?? null,
      input.notes ?? null,
      now,
      now,
    ]
  );
}

export async function updateFoalingRecord(
  id: string,
  input: {
    breedingRecordId?: string | null;
    date: string;
    outcome: FoalingRecord['outcome'];
    foalSex?: FoalingRecord['foalSex'];
    complications?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE foaling_records
    SET
      breeding_record_id = ?,
      date = ?,
      outcome = ?,
      foal_sex = ?,
      complications = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.breedingRecordId ?? null,
      input.date,
      input.outcome,
      input.foalSex ?? null,
      input.complications ?? null,
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function getFoalingRecordById(id: string): Promise<FoalingRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    WHERE id = ?;
    `,
    [id]
  );

  return row ? mapFoalingRecordRow(row) : null;
}

export async function deleteFoalingRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM foaling_records WHERE id = ?;', [id]);
}

export async function listAllDailyLogs(): Promise<DailyLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyLogRow>(
    `
    SELECT id, mare_id, date, teasing_score, right_ovary, left_ovary, ovulation_detected, edema, uterine_tone, uterine_cysts, notes, created_at, updated_at
    FROM daily_logs
    ORDER BY date DESC;
    `
  );

  return rows.map(mapDailyLogRow);
}

export async function listAllBreedingRecords(): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    ORDER BY date DESC;
    `
  );

  return rows.map(mapBreedingRecordRow);
}

export async function listAllPregnancyChecks(): Promise<PregnancyCheck[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PregnancyCheckRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, result, heartbeat_detected, notes, created_at, updated_at
    FROM pregnancy_checks
    ORDER BY date DESC;
    `
  );

  return rows.map(mapPregnancyCheckRow);
}

export async function listAllFoalingRecords(): Promise<FoalingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoalingRecordRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, outcome, foal_sex, complications, notes, created_at, updated_at
    FROM foaling_records
    ORDER BY date DESC;
    `
  );

  return rows.map(mapFoalingRecordRow);
}

export async function listDailyLogsByMare(mareId: string): Promise<DailyLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyLogRow>(
    `
    SELECT id, mare_id, date, teasing_score, right_ovary, left_ovary, ovulation_detected, edema, uterine_tone, uterine_cysts, notes, created_at, updated_at
    FROM daily_logs
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId]
  );

  return rows.map(mapDailyLogRow);
}

export async function listBreedingRecordsByMare(mareId: string): Promise<BreedingRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BreedingRecordRow>(
    `
    SELECT
      id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, concentration_m_per_ml,
      motility_percent, number_of_straws, straw_volume_ml, straw_details, collection_date, created_at, updated_at
    FROM breeding_records
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId]
  );

  return rows.map(mapBreedingRecordRow);
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

  return rows.map(mapPregnancyCheckRow);
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

  return rows.map(mapFoalingRecordRow);
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
  ovulation_detected: number | null;
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
  stallion_id: string | null;
  stallion_name: string | null;
  date: string;
  method: BreedingRecord['method'];
  notes: string | null;
  volume_ml: number | null;
  concentration_m_per_ml: number | null;
  motility_percent: number | null;
  number_of_straws: number | null;
  straw_volume_ml: number | null;
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

function mapDailyLogRow(row: DailyLogRow): DailyLog {
  return {
    id: row.id,
    mareId: row.mare_id,
    date: row.date,
    teasingScore: row.teasing_score,
    rightOvary: row.right_ovary,
    leftOvary: row.left_ovary,
    ovulationDetected: row.ovulation_detected === null ? null : Boolean(row.ovulation_detected),
    edema: row.edema,
    uterineTone: row.uterine_tone,
    uterineCysts: row.uterine_cysts,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBreedingRecordRow(row: BreedingRecordRow): BreedingRecord {
  return {
    id: row.id,
    mareId: row.mare_id,
    stallionId: row.stallion_id,
    stallionName: row.stallion_name,
    date: row.date,
    method: row.method,
    notes: row.notes,
    volumeMl: row.volume_ml,
    concentrationMPerMl: row.concentration_m_per_ml,
    motilityPercent: row.motility_percent,
    numberOfStraws: row.number_of_straws,
    strawVolumeMl: row.straw_volume_ml,
    strawDetails: row.straw_details,
    collectionDate: row.collection_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPregnancyCheckRow(row: PregnancyCheckRow): PregnancyCheck {
  return {
    id: row.id,
    mareId: row.mare_id,
    breedingRecordId: row.breeding_record_id,
    date: row.date,
    result: row.result,
    heartbeatDetected: row.heartbeat_detected === null ? null : Boolean(row.heartbeat_detected),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFoalingRecordRow(row: FoalingRecordRow): FoalingRecord {
  return {
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
  };
}

// --- Foal ---

type FoalRow = {
  id: string;
  foaling_record_id: string;
  name: string | null;
  sex: FoalSex | null;
  color: FoalColor | null;
  markings: string | null;
  birth_weight_lbs: number | null;
  milestones: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const VALID_MILESTONE_KEYS: ReadonlySet<string> = new Set<FoalMilestoneKey>([
  'stood',
  'nursed',
  'passedMeconium',
  'iggTested',
  'enemaGiven',
  'umbilicalTreated',
  'firstVetCheck',
]);

export function parseFoalMilestones(value: string): FoalMilestones {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return {};
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: FoalMilestones = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_MILESTONE_KEYS.has(key)) continue;
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.done !== 'boolean') continue;
    const recordedAt =
      typeof e.recordedAt === 'string' ? e.recordedAt : null;
    result[key as FoalMilestoneKey] = { done: e.done, recordedAt } as FoalMilestoneEntry;
  }
  return result;
}

function mapFoalRow(row: FoalRow): Foal {
  return {
    id: row.id,
    foalingRecordId: row.foaling_record_id,
    name: row.name,
    sex: row.sex,
    color: row.color,
    markings: row.markings,
    birthWeightLbs: row.birth_weight_lbs,
    milestones: parseFoalMilestones(row.milestones),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createFoal(input: {
  id: string;
  foalingRecordId: string;
  name?: string | null;
  sex?: FoalSex | null;
  color?: FoalColor | null;
  markings?: string | null;
  birthWeightLbs?: number | null;
  milestones: FoalMilestones;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO foals (
      id,
      foaling_record_id,
      name,
      sex,
      color,
      markings,
      birth_weight_lbs,
      milestones,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.foalingRecordId,
      input.name ?? null,
      input.sex ?? null,
      input.color ?? null,
      input.markings ?? null,
      input.birthWeightLbs ?? null,
      JSON.stringify(input.milestones),
      input.notes ?? null,
      now,
      now,
    ]
  );
}

export async function updateFoal(
  id: string,
  input: {
    name?: string | null;
    sex?: FoalSex | null;
    color?: FoalColor | null;
    markings?: string | null;
    birthWeightLbs?: number | null;
    milestones: FoalMilestones;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    UPDATE foals
    SET
      name = ?,
      sex = ?,
      color = ?,
      markings = ?,
      birth_weight_lbs = ?,
      milestones = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.name ?? null,
      input.sex ?? null,
      input.color ?? null,
      input.markings ?? null,
      input.birthWeightLbs ?? null,
      JSON.stringify(input.milestones),
      input.notes ?? null,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function getFoalById(id: string): Promise<Foal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FoalRow>(
    `
    SELECT id, foaling_record_id, name, sex, color, markings, birth_weight_lbs,
           milestones, notes, created_at, updated_at
    FROM foals
    WHERE id = ?;
    `,
    [id]
  );

  return row ? mapFoalRow(row) : null;
}

export async function getFoalByFoalingRecordId(foalingRecordId: string): Promise<Foal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FoalRow>(
    `
    SELECT id, foaling_record_id, name, sex, color, markings, birth_weight_lbs,
           milestones, notes, created_at, updated_at
    FROM foals
    WHERE foaling_record_id = ?;
    `,
    [foalingRecordId]
  );

  return row ? mapFoalRow(row) : null;
}

export async function listFoalsByMare(mareId: string): Promise<Foal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoalRow>(
    `
    SELECT f.id, f.foaling_record_id, f.name, f.sex, f.color, f.markings,
           f.birth_weight_lbs, f.milestones, f.notes, f.created_at, f.updated_at
    FROM foals f
    JOIN foaling_records fr ON fr.id = f.foaling_record_id
    WHERE fr.mare_id = ?
    ORDER BY fr.date DESC;
    `,
    [mareId]
  );

  return rows.map(mapFoalRow);
}

export async function deleteFoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM foals WHERE id = ?;', [id]);
}
