import { LocalDate, MedicationLog, MedicationRoute } from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

type MedicationLogRow = {
  id: string;
  mare_id: string;
  date: string;
  medication_name: string;
  dose: string | null;
  route: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapMedicationLogRow(row: MedicationLogRow): MedicationLog {
  return {
    id: row.id,
    mareId: row.mare_id,
    date: row.date,
    medicationName: row.medication_name,
    dose: row.dose,
    route: row.route as MedicationRoute | null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMedicationLog(input: {
  id: string;
  mareId: string;
  date: LocalDate;
  medicationName: string;
  dose?: string | null;
  route?: MedicationRoute | null;
  notes?: string | null;
}, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
    `INSERT INTO medication_logs (
      id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.mareId,
      input.date,
      input.medicationName,
      input.dose ?? null,
      input.route ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
  emitDataInvalidation('medicationLogs');
}

export async function getMedicationLogById(id: string, db?: RepoDb): Promise<MedicationLog | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<MedicationLogRow>(
    `SELECT id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
     FROM medication_logs WHERE id = ?;`,
    [id],
  );

  return row ? mapMedicationLogRow(row) : null;
}

export async function listMedicationLogsByMare(mareId: string, db?: RepoDb): Promise<MedicationLog[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<MedicationLogRow>(
    `SELECT id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
     FROM medication_logs WHERE mare_id = ? ORDER BY date DESC;`,
    [mareId],
  );

  return rows.map(mapMedicationLogRow);
}

export async function listAllMedicationLogs(db?: RepoDb): Promise<MedicationLog[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<MedicationLogRow>(
    `SELECT id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
     FROM medication_logs ORDER BY date DESC;`,
  );

  return rows.map(mapMedicationLogRow);
}

export async function updateMedicationLog(
  id: string,
  input: {
    date: LocalDate;
    medicationName: string;
    dose?: string | null;
    route?: MedicationRoute | null;
    notes?: string | null;
  },
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
    `UPDATE medication_logs
     SET date = ?, medication_name = ?, dose = ?, route = ?, notes = ?, updated_at = ?
     WHERE id = ?;`,
    [
      input.date,
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
