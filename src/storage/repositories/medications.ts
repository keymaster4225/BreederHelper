import { LocalDate, MedicationLog, MedicationRoute } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { normalizeMedicationLogTime } from '@/utils/medicationLogTime';

import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

type MedicationLogRow = {
  id: string;
  mare_id: string;
  date: string;
  time: string | null;
  medication_name: string;
  dose: string | null;
  route: string | null;
  notes: string | null;
  source_daily_log_id: string | null;
  created_at: string;
  updated_at: string;
};

type MedicationLogInsertInput = {
  id: string;
  mareId: string;
  date: LocalDate;
  time?: string | null;
  medicationName: string;
  dose?: string | null;
  route?: MedicationRoute | null;
  notes?: string | null;
  sourceDailyLogId?: string | null;
};

type MedicationLogInsertOptions = {
  readonly allowUntimed?: boolean;
};

const MEDICATION_LOG_SELECT_COLUMNS = `
  id,
  mare_id,
  date,
  time,
  medication_name,
  dose,
  route,
  notes,
  source_daily_log_id,
  created_at,
  updated_at
`;

const MEDICATION_LOG_ORDER_BY = `
  ORDER BY
    date DESC,
    time IS NULL ASC,
    time DESC,
    created_at DESC,
    id DESC
`;

function mapMedicationLogRow(row: MedicationLogRow): MedicationLog {
  return {
    id: row.id,
    mareId: row.mare_id,
    date: row.date,
    time: row.time,
    medicationName: row.medication_name,
    dose: row.dose,
    route: row.route as MedicationRoute | null,
    notes: row.notes,
    sourceDailyLogId: row.source_daily_log_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveCreateTime(input: MedicationLogInsertInput, options?: MedicationLogInsertOptions): string | null {
  const normalized = normalizeMedicationLogTime(input.time);
  if (normalized !== null) {
    return normalized;
  }

  if (options?.allowUntimed) {
    return null;
  }

  throw new Error('Medication log time is required.');
}

function resolveUpdateTime(
  inputTime: string | null | undefined,
  existing: MedicationLogRow,
): string | null {
  if (inputTime === undefined) {
    return existing.time;
  }

  if (inputTime === null) {
    if (existing.time === null) {
      return null;
    }
    throw new Error('Timed medication logs cannot be cleared back to untimed.');
  }

  const normalized = normalizeMedicationLogTime(inputTime);
  if (normalized === null) {
    throw new Error('Medication log time must be a valid HH:MM value.');
  }
  return normalized;
}

export async function insertMedicationLogWithoutInvalidation(
  db: RepoDb,
  input: MedicationLogInsertInput,
  now = new Date().toISOString(),
  options: MedicationLogInsertOptions = {},
): Promise<void> {
  const time = resolveCreateTime(input, options);

  await db.runAsync(
    `INSERT INTO medication_logs (
      id,
      mare_id,
      date,
      time,
      medication_name,
      dose,
      route,
      notes,
      source_daily_log_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.mareId,
      input.date,
      time,
      input.medicationName,
      input.dose ?? null,
      input.route ?? null,
      input.notes ?? null,
      input.sourceDailyLogId ?? null,
      now,
      now,
    ],
  );
}

export async function deleteMedicationLogsBySourceDailyLogId(
  db: RepoDb,
  sourceDailyLogId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM medication_logs WHERE source_daily_log_id = ?;', [
    sourceDailyLogId,
  ]);
}

export async function createMedicationLog(input: MedicationLogInsertInput, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await insertMedicationLogWithoutInvalidation(handle, { ...input, sourceDailyLogId: null }, now);
  emitDataInvalidation('medicationLogs');
}

export async function getMedicationLogById(id: string, db?: RepoDb): Promise<MedicationLog | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<MedicationLogRow>(
    `SELECT ${MEDICATION_LOG_SELECT_COLUMNS}
     FROM medication_logs WHERE id = ?;`,
    [id],
  );

  return row ? mapMedicationLogRow(row) : null;
}

export async function listMedicationLogsByMare(mareId: string, db?: RepoDb): Promise<MedicationLog[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<MedicationLogRow>(
    `SELECT ${MEDICATION_LOG_SELECT_COLUMNS}
     FROM medication_logs WHERE mare_id = ? ${MEDICATION_LOG_ORDER_BY};`,
    [mareId],
  );

  return rows.map(mapMedicationLogRow);
}

export async function listAllMedicationLogs(db?: RepoDb): Promise<MedicationLog[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<MedicationLogRow>(
    `SELECT ${MEDICATION_LOG_SELECT_COLUMNS}
     FROM medication_logs ${MEDICATION_LOG_ORDER_BY};`,
  );

  return rows.map(mapMedicationLogRow);
}

export async function updateMedicationLog(
  id: string,
  input: {
    date: LocalDate;
    time?: string | null;
    medicationName: string;
    dose?: string | null;
    route?: MedicationRoute | null;
    notes?: string | null;
  },
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await handle.getFirstAsync<MedicationLogRow>(
    `SELECT ${MEDICATION_LOG_SELECT_COLUMNS}
     FROM medication_logs WHERE id = ?;`,
    [id],
  );
  if (!existing) {
    throw new Error('Medication log not found.');
  }

  const now = new Date().toISOString();
  const time = resolveUpdateTime(input.time, existing);

  await handle.runAsync(
    `UPDATE medication_logs
     SET date = ?, time = ?, medication_name = ?, dose = ?, route = ?, notes = ?, updated_at = ?
     WHERE id = ?;`,
    [
      input.date,
      time,
      input.medicationName,
      input.dose ?? null,
      input.route ?? null,
      input.notes ?? null,
      now,
      id,
    ],
  );
  emitDataInvalidation('medicationLogs');
}

export async function deleteMedicationLog(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.runAsync('DELETE FROM medication_logs WHERE id = ?;', [id]);
  emitDataInvalidation('medicationLogs');
}
