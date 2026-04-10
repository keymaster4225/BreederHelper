import { PregnancyCheck } from '@/models/types';
import { getDb } from '@/storage/db';
import { getBreedingRecordById } from './breedingRecords';

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

async function validateBreedingRecordForMare(
  breedingRecordId: string,
  mareId: string,
): Promise<void> {
  const breedingRecord = await getBreedingRecordById(breedingRecordId);

  if (!breedingRecord) {
    throw new Error('Breeding record not found.');
  }

  if (breedingRecord.mareId !== mareId) {
    throw new Error('Breeding record belongs to a different mare.');
  }
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
  await validateBreedingRecordForMare(input.breedingRecordId, input.mareId);

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
    ],
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
  },
): Promise<void> {
  const existing = await getPregnancyCheckById(id);
  if (!existing) {
    throw new Error('Pregnancy check not found.');
  }

  await validateBreedingRecordForMare(input.breedingRecordId, existing.mareId);

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
    ],
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
    [id],
  );

  return row ? mapPregnancyCheckRow(row) : null;
}

export async function deletePregnancyCheck(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pregnancy_checks WHERE id = ?;', [id]);
}

export async function listAllPregnancyChecks(): Promise<PregnancyCheck[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PregnancyCheckRow>(
    `
    SELECT id, mare_id, breeding_record_id, date, result, heartbeat_detected, notes, created_at, updated_at
    FROM pregnancy_checks
    ORDER BY date DESC;
    `,
  );

  return rows.map(mapPregnancyCheckRow);
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
    [mareId],
  );

  return rows.map(mapPregnancyCheckRow);
}
