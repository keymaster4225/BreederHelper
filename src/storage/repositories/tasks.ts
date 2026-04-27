import {
  LocalDate,
  Task,
  TaskSourceReason,
  TaskSourceType,
  TaskType,
  TaskWithMare,
} from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

export type CreateTaskInput = {
  readonly id: string;
  readonly mareId: string;
  readonly taskType: TaskType;
  readonly title: string;
  readonly dueDate: LocalDate;
  readonly dueTime?: string | null;
  readonly notes?: string | null;
  readonly sourceType?: TaskSourceType;
  readonly sourceRecordId?: string | null;
  readonly sourceReason?: TaskSourceReason | null;
};

export type UpdateTaskInput = {
  readonly mareId: string;
  readonly taskType: TaskType;
  readonly title: string;
  readonly dueDate: LocalDate;
  readonly dueTime?: string | null;
  readonly notes?: string | null;
};

type TaskRow = {
  id: string;
  mare_id: string;
  task_type: TaskType;
  title: string;
  due_date: string;
  due_time: string | null;
  notes: string | null;
  status: Task['status'];
  completed_at: string | null;
  completed_record_type: Exclude<TaskSourceType, 'manual'> | null;
  completed_record_id: string | null;
  source_type: TaskSourceType;
  source_record_id: string | null;
  source_reason: TaskSourceReason | null;
  created_at: string;
  updated_at: string;
};

type TaskWithMareRow = TaskRow & {
  mare_name: string;
};

const TASK_SELECT_COLUMNS = `
  id,
  mare_id,
  task_type,
  title,
  due_date,
  due_time,
  notes,
  status,
  completed_at,
  completed_record_type,
  completed_record_id,
  source_type,
  source_record_id,
  source_reason,
  created_at,
  updated_at
`;

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    mareId: row.mare_id,
    taskType: row.task_type,
    title: row.title,
    dueDate: row.due_date,
    dueTime: row.due_time,
    notes: row.notes,
    status: row.status,
    completedAt: row.completed_at,
    completedRecordType: row.completed_record_type,
    completedRecordId: row.completed_record_id,
    sourceType: row.source_type,
    sourceRecordId: row.source_record_id,
    sourceReason: row.source_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskWithMareRow(row: TaskWithMareRow): TaskWithMare {
  return {
    ...mapTaskRow(row),
    mareName: row.mare_name,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (title.length === 0) {
    throw new Error('Task title is required.');
  }
  return title;
}

function normalizeDueTime(value: string | null | undefined): string | null {
  const dueTime = normalizeOptionalText(value);
  if (dueTime == null) {
    return null;
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    throw new Error('Task due time must be a valid HH:MM time.');
  }

  return dueTime;
}

function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

async function findOpenBreedingPregnancyCheckTask(
  breedingRecordId: string,
  db: RepoDb,
): Promise<{ id: string; due_date: string } | null> {
  return db.getFirstAsync<{ id: string; due_date: string }>(
    `
    SELECT id, due_date
    FROM tasks
    WHERE status = 'open'
      AND source_type = 'breedingRecord'
      AND source_record_id = ?
      AND source_reason = 'breedingPregnancyCheck'
    LIMIT 1;
    `,
    [breedingRecordId],
  );
}

export async function createTask(input: CreateTaskInput, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
    `
    INSERT INTO tasks (
      id,
      mare_id,
      task_type,
      title,
      due_date,
      due_time,
      notes,
      status,
      completed_at,
      completed_record_type,
      completed_record_id,
      source_type,
      source_record_id,
      source_reason,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.mareId,
      input.taskType,
      normalizeTitle(input.title),
      input.dueDate,
      normalizeDueTime(input.dueTime),
      normalizeOptionalText(input.notes),
      input.sourceType ?? 'manual',
      normalizeOptionalText(input.sourceRecordId),
      normalizeOptionalText(input.sourceReason),
      now,
      now,
    ],
  );

  emitDataInvalidation('tasks');
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
    `
    UPDATE tasks
    SET
      mare_id = ?,
      task_type = ?,
      title = ?,
      due_date = ?,
      due_time = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      input.mareId,
      input.taskType,
      normalizeTitle(input.title),
      input.dueDate,
      normalizeDueTime(input.dueTime),
      normalizeOptionalText(input.notes),
      now,
      id,
    ],
  );

  emitDataInvalidation('tasks');
}

export async function deleteTask(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.runAsync('DELETE FROM tasks WHERE id = ?;', [id]);
  emitDataInvalidation('tasks');
}

export async function completeTask(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
    `
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = ?,
      completed_record_type = NULL,
      completed_record_id = NULL,
      updated_at = ?
    WHERE id = ?;
    `,
    [now, now, id],
  );

  emitDataInvalidation('tasks');
}

export async function completeTaskFromRecord(
  id: string,
  completedRecordType: Exclude<TaskSourceType, 'manual'>,
  completedRecordId: string,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();

  await handle.runAsync(
    `
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = ?,
      completed_record_type = ?,
      completed_record_id = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [now, completedRecordType, completedRecordId, now, id],
  );

  emitDataInvalidation('tasks');
}

export async function getTaskById(id: string, db?: RepoDb): Promise<Task | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<TaskRow>(
    `
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    WHERE id = ?;
    `,
    [id],
  );

  return row ? mapTaskRow(row) : null;
}

export async function listOpenDashboardTasks(
  today: LocalDate,
  windowDays: number,
  db?: RepoDb,
): Promise<TaskWithMare[]> {
  const handle = await resolveDb(db);
  const dueThrough = addDaysToLocalDate(today, windowDays);
  const rows = await handle.getAllAsync<TaskWithMareRow>(
    `
    SELECT
      tasks.id,
      tasks.mare_id,
      tasks.task_type,
      tasks.title,
      tasks.due_date,
      tasks.due_time,
      tasks.notes,
      tasks.status,
      tasks.completed_at,
      tasks.completed_record_type,
      tasks.completed_record_id,
      tasks.source_type,
      tasks.source_record_id,
      tasks.source_reason,
      tasks.created_at,
      tasks.updated_at,
      mares.name AS mare_name
    FROM tasks
    INNER JOIN mares ON mares.id = tasks.mare_id
    WHERE tasks.status = 'open'
      AND tasks.due_date <= ?
      AND mares.deleted_at IS NULL
    ORDER BY
      tasks.due_date ASC,
      tasks.due_time IS NULL ASC,
      tasks.due_time ASC,
      mares.name ASC,
      tasks.title ASC,
      tasks.created_at ASC,
      tasks.id ASC;
    `,
    [dueThrough],
  );

  return rows.map(mapTaskWithMareRow);
}

export async function ensureBreedingPregnancyCheckTask(
  input: { id: string; mareId: string; breedingRecordId: string; dueDate: LocalDate },
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await findOpenBreedingPregnancyCheckTask(input.breedingRecordId, handle);
  if (existing) {
    return;
  }

  await createTask(
    {
      id: input.id,
      mareId: input.mareId,
      taskType: 'pregnancyCheck',
      title: 'Pregnancy check',
      dueDate: input.dueDate,
      sourceType: 'breedingRecord',
      sourceRecordId: input.breedingRecordId,
      sourceReason: 'breedingPregnancyCheck',
    },
    handle,
  );
}

export async function updateOpenBreedingPregnancyCheckTaskDueDate(
  breedingRecordId: string,
  dueDate: LocalDate,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await findOpenBreedingPregnancyCheckTask(breedingRecordId, handle);
  if (!existing) {
    return;
  }

  const now = new Date().toISOString();
  await handle.runAsync(
    `
    UPDATE tasks
    SET due_date = ?, updated_at = ?
    WHERE id = ?
      AND status = 'open';
    `,
    [dueDate, now, existing.id],
  );

  emitDataInvalidation('tasks');
}

export async function deleteOpenBreedingPregnancyCheckTask(
  breedingRecordId: string,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await findOpenBreedingPregnancyCheckTask(breedingRecordId, handle);
  if (!existing) {
    return;
  }

  await handle.runAsync(
    `
    DELETE FROM tasks
    WHERE id = ?
      AND status = 'open';
    `,
    [existing.id],
  );

  emitDataInvalidation('tasks');
}

export async function completeOpenBreedingPregnancyCheckTask(
  breedingRecordId: string,
  pregnancyCheckId: string,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await findOpenBreedingPregnancyCheckTask(breedingRecordId, handle);
  if (!existing) {
    return;
  }

  await completeTaskFromRecord(existing.id, 'pregnancyCheck', pregnancyCheckId, handle);
}
