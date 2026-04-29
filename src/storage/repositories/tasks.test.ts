import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { createRepoDb, type SqlCall } from '@/test/repoDb';
import {
  completeOpenBreedingPregnancyCheckTask,
  completeTask,
  completeTaskFromRecord,
  createTask,
  deleteOpenBreedingPregnancyCheckTask,
  deleteTask,
  ensureBreedingPregnancyCheckTask,
  getTaskById,
  listDashboardTasks,
  listOpenDashboardTasks,
  updateOpenBreedingPregnancyCheckTaskDueDate,
  updateTask,
} from './tasks';

type TaskRow = {
  id: string;
  mare_id: string;
  task_type: 'dailyCheck' | 'medication' | 'breeding' | 'pregnancyCheck' | 'custom';
  title: string;
  due_date: string;
  due_time: string | null;
  notes: string | null;
  status: 'open' | 'completed';
  completed_at: string | null;
  completed_record_type: 'dailyLog' | 'medicationLog' | 'breedingRecord' | 'pregnancyCheck' | null;
  completed_record_id: string | null;
  source_type: 'manual' | 'dailyLog' | 'medicationLog' | 'breedingRecord' | 'pregnancyCheck';
  source_record_id: string | null;
  source_reason: 'manualFollowUp' | 'breedingPregnancyCheck' | null;
  created_at: string;
  updated_at: string;
};

type TaskWithMareRow = TaskRow & {
  mare_name: string;
};

type TaskMareRow = {
  name: string;
  deleted_at: string | null;
};

function createTaskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 'task-1',
    mare_id: 'mare-1',
    task_type: 'custom',
    title: 'Follow up',
    due_date: '2026-04-27',
    due_time: null,
    notes: null,
    status: 'open',
    completed_at: null,
    completed_record_type: null,
    completed_record_id: null,
    source_type: 'manual',
    source_record_id: null,
    source_reason: null,
    created_at: '2026-04-27T00:00:00.000Z',
    updated_at: '2026-04-27T00:00:00.000Z',
    ...overrides,
  };
}

function compareDashboardRows(a: TaskWithMareRow, b: TaskWithMareRow): number {
  return (
    compareTaskStatus(a.status, b.status) ||
    a.due_date.localeCompare(b.due_date) ||
    compareNullableDueTimes(a.due_time, b.due_time) ||
    a.mare_name.localeCompare(b.mare_name) ||
    a.title.localeCompare(b.title) ||
    compareNullableIsoDateTimeDesc(a.completed_at, b.completed_at) ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function compareTaskStatus(a: TaskRow['status'], b: TaskRow['status']): number {
  const rank = (value: TaskRow['status']) => (value === 'open' ? 0 : 1);
  return rank(a) - rank(b);
}

function compareNullableDueTimes(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a.localeCompare(b);
}

function compareNullableIsoDateTimeDesc(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return b.localeCompare(a);
}

function createTaskRepoHarness() {
  const mares = new Map<string, TaskMareRow>([
    ['mare-1', { name: 'Bella', deleted_at: null }],
    ['mare-2', { name: 'Aster', deleted_at: null }],
  ]);
  const tasks = new Map<string, TaskRow>();

  function assertUniqueOpenGeneratedTask(candidate: TaskRow): void {
    if (
      candidate.status !== 'open' ||
      candidate.source_type !== 'breedingRecord' ||
      candidate.source_reason !== 'breedingPregnancyCheck'
    ) {
      return;
    }

    for (const row of tasks.values()) {
      if (
        row.status === 'open' &&
        row.source_type === 'breedingRecord' &&
        row.source_reason === 'breedingPregnancyCheck' &&
        row.source_record_id === candidate.source_record_id
      ) {
        throw new Error('UNIQUE constraint failed: tasks.source_record_id');
      }
    }
  }

  const db = createRepoDb({
    onRun(call) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.startsWith('insert into tasks')) {
        const [
          id,
          mareId,
          taskType,
          title,
          dueDate,
          dueTime,
          notes,
          sourceType,
          sourceRecordId,
          sourceReason,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          TaskRow['mare_id'],
          TaskRow['task_type'],
          string,
          string,
          string | null,
          string | null,
          TaskRow['source_type'],
          string | null,
          TaskRow['source_reason'],
          string,
          string,
        ];
        const row = createTaskRow({
          id,
          mare_id: mareId,
          task_type: taskType,
          title,
          due_date: dueDate,
          due_time: dueTime,
          notes,
          source_type: sourceType,
          source_record_id: sourceRecordId,
          source_reason: sourceReason,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        assertUniqueOpenGeneratedTask(row);
        tasks.set(id, row);
        return;
      }

      if (stmt.startsWith('update tasks') && stmt.includes('set due_date = ?')) {
        const [dueDate, updatedAt, id] = params as [string, string, string];
        const existing = tasks.get(id);
        if (existing?.status === 'open') {
          tasks.set(id, { ...existing, due_date: dueDate, updated_at: updatedAt });
        }
        return;
      }

      if (stmt.startsWith('update tasks') && stmt.includes('completed_record_type = null')) {
        const [completedAt, updatedAt, id] = params as [string, string, string];
        const existing = tasks.get(id);
        if (existing) {
          tasks.set(id, {
            ...existing,
            status: 'completed',
            completed_at: completedAt,
            completed_record_type: null,
            completed_record_id: null,
            updated_at: updatedAt,
          });
        }
        return;
      }

      if (stmt.startsWith('update tasks') && stmt.includes('completed_record_type = ?')) {
        const [completedAt, completedRecordType, completedRecordId, updatedAt, id] = params as [
          string,
          TaskRow['completed_record_type'],
          string,
          string,
          string,
        ];
        const existing = tasks.get(id);
        if (existing) {
          tasks.set(id, {
            ...existing,
            status: 'completed',
            completed_at: completedAt,
            completed_record_type: completedRecordType,
            completed_record_id: completedRecordId,
            updated_at: updatedAt,
          });
        }
        return;
      }

      if (stmt.startsWith('update tasks')) {
        const [mareId, taskType, title, dueDate, dueTime, notes, updatedAt, id] = params as [
          string,
          TaskRow['task_type'],
          string,
          string,
          string | null,
          string | null,
          string,
          string,
        ];
        const existing = tasks.get(id);
        if (existing) {
          tasks.set(id, {
            ...existing,
            mare_id: mareId,
            task_type: taskType,
            title,
            due_date: dueDate,
            due_time: dueTime,
            notes,
            updated_at: updatedAt,
          });
        }
        return;
      }

      if (stmt.startsWith('delete from tasks')) {
        tasks.delete(params[0] as string);
      }
    },

    onGetFirst<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (
        stmt.includes('from tasks') &&
        stmt.includes('source_record_id = ?') &&
        stmt.includes("source_reason = 'breedingpregnancycheck'")
      ) {
        const [breedingRecordId] = params as [string];
        const row = Array.from(tasks.values()).find(
          (task) =>
            task.status === 'open' &&
            task.source_type === 'breedingRecord' &&
            task.source_record_id === breedingRecordId &&
            task.source_reason === 'breedingPregnancyCheck',
        );
        return (row ? { id: row.id, due_date: row.due_date } : null) as T | null;
      }

      if (stmt.includes('from tasks') && stmt.includes('where id = ?')) {
        return (tasks.get(params[0] as string) as T | undefined) ?? null;
      }

      return null;
    },

    onGetAll<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.includes('from tasks') && stmt.includes('inner join mares')) {
        const [dueThrough, completedSince] = params as [string, string];
        return Array.from(tasks.values())
          .filter((task) => {
            if (task.status === 'open') {
              return task.due_date <= dueThrough;
            }
            if (task.status === 'completed') {
              return task.completed_at != null && task.completed_at >= completedSince;
            }
            return false;
          })
          .filter((task) => (
            stmt.includes('mares.deleted_at is null')
              ? mares.get(task.mare_id)?.deleted_at == null
              : true
          ))
          .map<TaskWithMareRow>((task) => ({
            ...task,
            mare_name: mares.get(task.mare_id)?.name ?? '',
          }))
          .sort(compareDashboardRows) as T[];
      }

      return [];
    },
  });

  return { db, mares, tasks };
}

describe('tasks repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and gets a task', async () => {
    const { db } = createTaskRepoHarness();

    await createTask(
      {
        id: 'task-1',
        mareId: 'mare-1',
        taskType: 'dailyCheck',
        title: '  Recheck follicle  ',
        dueDate: '2026-04-27',
        dueTime: '08:30',
        notes: '  ',
      },
      db,
    );

    const task = await getTaskById('task-1', db);

    expect(task).toMatchObject({
      id: 'task-1',
      mareId: 'mare-1',
      taskType: 'dailyCheck',
      title: 'Recheck follicle',
      dueDate: '2026-04-27',
      dueTime: '08:30',
      notes: null,
      status: 'open',
      sourceType: 'manual',
    });
    expect(emitDataInvalidation).toHaveBeenCalledWith('tasks');
  });

  it('updates a task and validates due time', async () => {
    const { db } = createTaskRepoHarness();
    await createTask({
      id: 'task-1',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Follow up',
      dueDate: '2026-04-27',
    }, db);

    await expect(
      updateTask('task-1', {
        mareId: 'mare-1',
        taskType: 'custom',
        title: 'Follow up',
        dueDate: '2026-04-28',
        dueTime: '24:00',
      }, db),
    ).rejects.toThrow('Task due time must be a valid HH:MM time.');

    await updateTask('task-1', {
      mareId: 'mare-2',
      taskType: 'medication',
      title: 'Give Regumate',
      dueDate: '2026-04-29',
      dueTime: '09:15',
      notes: 'AM dose',
    }, db);

    expect(await getTaskById('task-1', db)).toMatchObject({
      mareId: 'mare-2',
      taskType: 'medication',
      title: 'Give Regumate',
      dueDate: '2026-04-29',
      dueTime: '09:15',
      notes: 'AM dose',
    });
  });

  it('deletes a task', async () => {
    const { db } = createTaskRepoHarness();
    await createTask({
      id: 'task-1',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Follow up',
      dueDate: '2026-04-27',
    }, db);

    await deleteTask('task-1', db);

    expect(await getTaskById('task-1', db)).toBeNull();
  });

  it('completes a task manually', async () => {
    const { db } = createTaskRepoHarness();
    await createTask({
      id: 'task-1',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Follow up',
      dueDate: '2026-04-27',
    }, db);

    await completeTask('task-1', db);

    expect(await getTaskById('task-1', db)).toMatchObject({
      status: 'completed',
      completedRecordType: null,
      completedRecordId: null,
    });
    expect((await getTaskById('task-1', db))?.completedAt).toEqual(expect.any(String));
  });

  it('completes a task from a record', async () => {
    const { db } = createTaskRepoHarness();
    await createTask({
      id: 'task-1',
      mareId: 'mare-1',
      taskType: 'pregnancyCheck',
      title: 'Pregnancy check',
      dueDate: '2026-04-27',
    }, db);

    await completeTaskFromRecord('task-1', 'pregnancyCheck', 'preg-check-1', db);

    expect(await getTaskById('task-1', db)).toMatchObject({
      status: 'completed',
      completedRecordType: 'pregnancyCheck',
      completedRecordId: 'preg-check-1',
    });
  });

  it('lists dashboard tasks including overdue through day 14 and excluding day 15', async () => {
    const { db } = createTaskRepoHarness();
    const seeds = [
      createTaskRow({ id: 'overdue', due_date: '2026-04-26', title: 'Overdue' }),
      createTaskRow({ id: 'today', due_date: '2026-04-27', title: 'Today' }),
      createTaskRow({ id: 'tomorrow', due_date: '2026-04-28', title: 'Tomorrow' }),
      createTaskRow({ id: 'day-14', due_date: '2026-05-11', title: 'Day 14' }),
      createTaskRow({ id: 'day-15', due_date: '2026-05-12', title: 'Day 15' }),
      createTaskRow({ id: 'completed', due_date: '2026-04-27', status: 'completed', completed_at: '2026-04-27T12:00:00.000Z' }),
    ];
    for (const seed of seeds) {
      await createTask({
        id: seed.id,
        mareId: seed.mare_id,
        taskType: seed.task_type,
        title: seed.title,
        dueDate: seed.due_date,
        dueTime: seed.due_time,
        notes: seed.notes,
        sourceType: seed.source_type,
        sourceRecordId: seed.source_record_id,
        sourceReason: seed.source_reason,
      }, db);
    }
    await completeTask('completed', db);

    const result = await listOpenDashboardTasks('2026-04-27', 14, db);

    expect(result.map((task) => task.id)).toEqual(['overdue', 'today', 'tomorrow', 'day-14']);
    expect(result.map((task) => task.mareName)).toEqual(['Bella', 'Bella', 'Bella', 'Bella']);
  });

  it('lists dashboard tasks including recently completed items and excluding stale completions', async () => {
    const { db, tasks } = createTaskRepoHarness();
    tasks.set('open-overdue', createTaskRow({ id: 'open-overdue', due_date: '2026-04-25', title: 'Open overdue' }));
    tasks.set('open-today', createTaskRow({ id: 'open-today', due_date: '2026-04-27', title: 'Open today' }));
    tasks.set('open-day-15', createTaskRow({ id: 'open-day-15', due_date: '2026-05-12', title: 'Open day 15' }));
    tasks.set(
      'completed-recent',
      createTaskRow({
        id: 'completed-recent',
        status: 'completed',
        completed_at: '2026-04-27T09:59:00.000Z',
        title: 'Completed recent',
      }),
    );
    tasks.set(
      'completed-stale',
      createTaskRow({
        id: 'completed-stale',
        status: 'completed',
        completed_at: '2026-04-27T09:58:59.999Z',
        title: 'Completed stale',
      }),
    );

    const result = await listDashboardTasks('2026-04-27', 14, '2026-04-27T09:59:00.000Z', db);

    expect(result.map((task) => task.id)).toEqual(['open-overdue', 'open-today', 'completed-recent']);
    expect(result[2]).toMatchObject({ status: 'completed' });
  });

  it('keeps record-completed tasks on the dashboard during the completed retention window', async () => {
    const { db } = createTaskRepoHarness();
    await createTask({
      id: 'linked-task',
      mareId: 'mare-1',
      taskType: 'breeding',
      title: 'Breed mare',
      dueDate: '2026-04-27',
    }, db);

    await completeTaskFromRecord('linked-task', 'breedingRecord', 'breeding-1', db);
    const completedAt = (await getTaskById('linked-task', db))?.completedAt;
    expect(completedAt).toEqual(expect.any(String));

    const result = await listDashboardTasks('2026-04-27', 14, completedAt!, db);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'linked-task',
      status: 'completed',
      completedRecordType: 'breedingRecord',
      completedRecordId: 'breeding-1',
    });
  });

  it('excludes dashboard tasks for soft-deleted mares', async () => {
    const { db, mares } = createTaskRepoHarness();
    mares.set('mare-deleted', { name: 'Retired Mare', deleted_at: '2026-04-26T12:00:00.000Z' });
    await createTask({
      id: 'active-mare-task',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Active mare task',
      dueDate: '2026-04-27',
    }, db);
    await createTask({
      id: 'deleted-mare-task',
      mareId: 'mare-deleted',
      taskType: 'custom',
      title: 'Deleted mare task',
      dueDate: '2026-04-27',
    }, db);

    const result = await listOpenDashboardTasks('2026-04-27', 14, db);

    expect(result.map((task) => task.id)).toEqual(['active-mare-task']);
    expect(db.getAllCalls[0]?.normalizedSql).toContain('mares.deleted_at is null');
  });

  it('sorts timed dashboard tasks before untimed tasks and by due time ascending', async () => {
    const { db } = createTaskRepoHarness();
    await createTask({
      id: 'untimed',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Untimed',
      dueDate: '2026-04-27',
    }, db);
    await createTask({
      id: 'late',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Late',
      dueDate: '2026-04-27',
      dueTime: '16:00',
    }, db);
    await createTask({
      id: 'early',
      mareId: 'mare-1',
      taskType: 'custom',
      title: 'Early',
      dueDate: '2026-04-27',
      dueTime: '08:00',
    }, db);

    const result = await listOpenDashboardTasks('2026-04-27', 14, db);

    expect(result.map((task) => task.id)).toEqual(['early', 'late', 'untimed']);
  });

  it('prevents duplicate open generated breeding pregnancy-check tasks', async () => {
    const { db } = createTaskRepoHarness();
    const input = {
      id: 'task-1',
      mareId: 'mare-1',
      taskType: 'pregnancyCheck' as const,
      title: 'Pregnancy check',
      dueDate: '2026-05-11',
      sourceType: 'breedingRecord' as const,
      sourceRecordId: 'breeding-1',
      sourceReason: 'breedingPregnancyCheck' as const,
    };

    await createTask(input, db);

    await expect(createTask({ ...input, id: 'task-2' }, db)).rejects.toThrow(
      'UNIQUE constraint failed: tasks.source_record_id',
    );
  });

  it('returns cleanly when ensuring an existing open generated breeding pregnancy-check task', async () => {
    const { db } = createTaskRepoHarness();
    await ensureBreedingPregnancyCheckTask({
      id: 'task-1',
      mareId: 'mare-1',
      breedingRecordId: 'breeding-1',
      dueDate: '2026-05-11',
    }, db);
    vi.mocked(emitDataInvalidation).mockClear();

    await ensureBreedingPregnancyCheckTask({
      id: 'task-2',
      mareId: 'mare-1',
      breedingRecordId: 'breeding-1',
      dueDate: '2026-05-11',
    }, db);

    expect(db.findRunCalls({ operation: 'insert', table: 'tasks' })).toHaveLength(1);
    expect(emitDataInvalidation).not.toHaveBeenCalled();
  });

  it('updates only the open generated breeding pregnancy-check task due date', async () => {
    const { db } = createTaskRepoHarness();
    await ensureBreedingPregnancyCheckTask({
      id: 'open-task',
      mareId: 'mare-1',
      breedingRecordId: 'breeding-1',
      dueDate: '2026-05-11',
    }, db);
    await createTask({
      id: 'completed-task',
      mareId: 'mare-1',
      taskType: 'pregnancyCheck',
      title: 'Pregnancy check',
      dueDate: '2026-05-11',
      sourceType: 'breedingRecord',
      sourceRecordId: 'breeding-1',
      sourceReason: 'breedingPregnancyCheck',
    }, db).catch(() => undefined);

    await updateOpenBreedingPregnancyCheckTaskDueDate('breeding-1', '2026-05-12', db);

    expect(await getTaskById('open-task', db)).toMatchObject({ dueDate: '2026-05-12' });
  });

  it('does not mutate completed generated breeding pregnancy-check tasks', async () => {
    const { db, tasks } = createTaskRepoHarness();
    tasks.set('completed-task', createTaskRow({
      id: 'completed-task',
      task_type: 'pregnancyCheck',
      due_date: '2026-05-11',
      status: 'completed',
      completed_at: '2026-05-11T12:00:00.000Z',
      source_type: 'breedingRecord',
      source_record_id: 'breeding-1',
      source_reason: 'breedingPregnancyCheck',
    }));
    vi.mocked(emitDataInvalidation).mockClear();

    await updateOpenBreedingPregnancyCheckTaskDueDate('breeding-1', '2026-05-12', db);
    await deleteOpenBreedingPregnancyCheckTask('breeding-1', db);
    await completeOpenBreedingPregnancyCheckTask('breeding-1', 'preg-check-1', db);

    expect(await getTaskById('completed-task', db)).toMatchObject({
      dueDate: '2026-05-11',
      status: 'completed',
      completedRecordId: null,
    });
    expect(emitDataInvalidation).not.toHaveBeenCalled();
  });
});
