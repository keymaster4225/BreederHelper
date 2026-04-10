import { DailyLog } from '@/models/types';
import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

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
    ],
  );
  emitDataInvalidation('dailyLogs');
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
  },
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
    ],
  );
  emitDataInvalidation('dailyLogs');
}

export async function getDailyLogById(id: string): Promise<DailyLog | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DailyLogRow>(
    `
    SELECT id, mare_id, date, teasing_score, right_ovary, left_ovary, ovulation_detected, edema, uterine_tone, uterine_cysts, notes, created_at, updated_at
    FROM daily_logs
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapDailyLogRow(row) : null;
}

export async function deleteDailyLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM daily_logs WHERE id = ?;', [id]);
  emitDataInvalidation('dailyLogs');
}

export async function listAllDailyLogs(): Promise<DailyLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyLogRow>(
    `
    SELECT id, mare_id, date, teasing_score, right_ovary, left_ovary, ovulation_detected, edema, uterine_tone, uterine_cysts, notes, created_at, updated_at
    FROM daily_logs
    ORDER BY date DESC;
    `,
  );

  return rows.map(mapDailyLogRow);
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
    [mareId],
  );

  return rows.map(mapDailyLogRow);
}
