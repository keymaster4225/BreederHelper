# Dashboard Tasks V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Dispatch one fresh implementer per task, then run spec-compliance review and code-quality review before moving on. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's inferred alerts with persisted mare tasks that users can create, complete, and launch into normal BreedWise workflows.

**Architecture:** Add a first-class `tasks` table, repository, backup contract, dashboard query, task UI, and workflow integration. The dashboard should show only persisted open tasks, while new breeding records automatically create a 14-day pregnancy-check task.

**Tech Stack:** Expo, React Native, TypeScript, SQLite via `expo-sqlite`, Vitest, Jest screen tests.

---

## Execution Rules

- [ ] Create or switch to an isolated branch/worktree before implementation.
- [ ] Do not push to GitHub without explicit user permission.
- [ ] Use one fresh subagent per task.
- [ ] After each task, run targeted tests.
- [ ] After each task, run a spec-compliance reviewer subagent.
- [ ] After each task, run a code-quality reviewer subagent.
- [ ] Fix and re-review until both reviewers approve.
- [ ] Commit each task after both reviews pass.
- [ ] Do not dispatch parallel implementation subagents because these tasks touch shared schema, navigation, and hooks.

---

## Task 1: Task Data Layer

**Files**
- Modify: `src/models/types.ts`
- Modify: `src/storage/migrations/index.ts`
- Modify: `src/storage/migrations/index.test.ts`
- Modify: `src/storage/dataInvalidation.ts`
- Create: `src/storage/repositories/tasks.ts`
- Create: `src/storage/repositories/tasks.test.ts`
- Modify: `src/storage/repositories/index.ts`

- [ ] **Step 1: Add task model types**

Add these exported types and interfaces to `src/models/types.ts` near the other core domain models:

```ts
export type TaskType = 'dailyCheck' | 'medication' | 'breeding' | 'pregnancyCheck' | 'custom';

export type TaskStatus = 'open' | 'completed';

export type TaskSourceType =
  | 'manual'
  | 'dailyLog'
  | 'medicationLog'
  | 'breedingRecord'
  | 'pregnancyCheck';

export type TaskSourceReason = 'manualFollowUp' | 'breedingPregnancyCheck';

export interface Task {
  id: UUID;
  mareId: UUID;
  taskType: TaskType;
  title: string;
  dueDate: LocalDate;
  dueTime: string | null;
  notes: string | null;
  status: TaskStatus;
  completedAt: ISODateTime | null;
  completedRecordType: Exclude<TaskSourceType, 'manual'> | null;
  completedRecordId: UUID | null;
  sourceType: TaskSourceType;
  sourceRecordId: UUID | null;
  sourceReason: TaskSourceReason | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TaskWithMare extends Task {
  mareName: string;
}
```

- [ ] **Step 2: Add the task invalidation domain**

In `src/storage/dataInvalidation.ts`, add `'tasks'` to `DataInvalidationDomain`.

- [ ] **Step 3: Add migration `027_tasks`**

In `src/storage/migrations/index.ts`, add a new migration after the current last migration. If the repo has gained migrations after `026`, use the next available id and update names/tests accordingly.

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TEXT,
  completed_record_type TEXT,
  completed_record_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_record_id TEXT,
  source_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (task_type IN ('dailyCheck', 'medication', 'breeding', 'pregnancyCheck', 'custom')),
  CHECK (due_date GLOB '????-??-??'),
  CHECK (
    due_time IS NULL OR (
      length(due_time) = 5
      AND substr(due_time, 3, 1) = ':'
      AND substr(due_time, 1, 2) BETWEEN '00' AND '23'
      AND substr(due_time, 4, 2) BETWEEN '00' AND '59'
    )
  ),
  CHECK (TRIM(title) <> ''),
  CHECK (status IN ('open', 'completed')),
  CHECK (completed_record_type IS NULL OR completed_record_type IN ('dailyLog', 'medicationLog', 'breedingRecord', 'pregnancyCheck')),
  CHECK (source_type IN ('manual', 'dailyLog', 'medicationLog', 'breedingRecord', 'pregnancyCheck')),
  CHECK (source_reason IS NULL OR source_reason IN ('manualFollowUp', 'breedingPregnancyCheck')),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status = 'open' AND completed_at IS NULL)
  ),
  CHECK (
    (completed_record_type IS NULL AND completed_record_id IS NULL)
    OR (completed_record_type IS NOT NULL AND completed_record_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_open_due
  ON tasks (status, due_date ASC, due_time ASC, mare_id);

CREATE INDEX IF NOT EXISTS idx_tasks_source
  ON tasks (source_type, source_record_id, source_reason);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_open_breeding_preg_check_unique
  ON tasks (source_record_id)
  WHERE status = 'open'
    AND source_type = 'breedingRecord'
    AND source_reason = 'breedingPregnancyCheck';
```

Use `shouldSkip` to check `tableExists(db, 'tasks')`, `indexExists(db, 'idx_tasks_open_due')`, `indexExists(db, 'idx_tasks_source')`, and `indexExists(db, 'idx_tasks_open_breeding_preg_check_unique')`.

- [ ] **Step 4: Add repository row mapping and API**

Create `src/storage/repositories/tasks.ts` with row mapping and these exports:

```ts
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

export async function createTask(input: CreateTaskInput, db?: RepoDb): Promise<void>;
export async function updateTask(id: string, input: UpdateTaskInput, db?: RepoDb): Promise<void>;
export async function deleteTask(id: string, db?: RepoDb): Promise<void>;
export async function completeTask(id: string, db?: RepoDb): Promise<void>;
export async function completeTaskFromRecord(
  id: string,
  completedRecordType: Exclude<TaskSourceType, 'manual'>,
  completedRecordId: string,
  db?: RepoDb,
): Promise<void>;
export async function getTaskById(id: string, db?: RepoDb): Promise<Task | null>;
export async function listOpenDashboardTasks(
  today: LocalDate,
  windowDays: number,
  db?: RepoDb,
): Promise<TaskWithMare[]>;
export async function ensureBreedingPregnancyCheckTask(
  input: { id: string; mareId: string; breedingRecordId: string; dueDate: LocalDate },
  db?: RepoDb,
): Promise<void>;
export async function updateOpenBreedingPregnancyCheckTaskDueDate(
  breedingRecordId: string,
  dueDate: LocalDate,
  db?: RepoDb,
): Promise<void>;
export async function deleteOpenBreedingPregnancyCheckTask(
  breedingRecordId: string,
  db?: RepoDb,
): Promise<void>;
export async function completeOpenBreedingPregnancyCheckTask(
  breedingRecordId: string,
  pregnancyCheckId: string,
  db?: RepoDb,
): Promise<void>;
```

Repository behavior:
- Normalize blank optional strings to `null`.
- Validate `dueTime` with the same `HH:MM` shape as migrations.
- Emit `emitDataInvalidation('tasks')` after mutating operations.
- Generated-task helpers must also emit `tasks` invalidation when they insert, update, delete, or complete a task.
- `ensureBreedingPregnancyCheckTask` must be idempotent: if an open generated task already exists for `breedingRecordId`, return without inserting and without surfacing a unique-constraint error.
- `listOpenDashboardTasks(today, windowDays)` should include status `open` tasks where `due_date <= today + windowDays`, including overdue tasks before `today`.
- Join `mares` to return `mareName`.
- Sort SQL by `due_date ASC`, `due_time IS NULL ASC`, `due_time ASC`, `mares.name ASC`, `tasks.title ASC`, `tasks.created_at ASC`, `tasks.id ASC`.

- [ ] **Step 5: Export the repository**

Add `export * from './tasks';` to `src/storage/repositories/index.ts`.

- [ ] **Step 6: Write repository tests**

Create `src/storage/repositories/tasks.test.ts` covering:
- create and get task
- update task
- delete task
- manual complete
- complete from record
- dashboard query includes overdue, today, tomorrow, and day 14
- dashboard query excludes day 15
- timed tasks sort before untimed tasks on the same date
- due time sorts ascending
- unique generated breeding pregnancy-check task prevents duplicates
- `ensureBreedingPregnancyCheckTask` returns cleanly when an open generated task already exists
- generated helper updates only open generated task due date
- generated helper does not mutate completed task

- [ ] **Step 7: Write migration tests**

Add tests in `src/storage/migrations/index.test.ts` asserting:
- migration creates `tasks`
- migration creates all three indexes
- migration is skipped when table and indexes already exist

- [ ] **Step 8: Verify Task 1**

Run:

```powershell
npm.cmd test -- src/storage/migrations/index.test.ts src/storage/repositories/tasks.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all pass.

---

## Task 2: Backup And Restore Contract

**Files**
- Modify: `src/storage/backup/types.ts`
- Modify: `src/storage/backup/serialize.ts`
- Modify: `src/storage/backup/restore.ts`
- Modify: `src/storage/backup/validate.ts`
- Modify: `src/storage/backup/testFixtures.ts`
- Modify: `src/storage/backup/serialize.test.ts`
- Modify: `src/storage/backup/restore.test.ts`
- Modify: `src/storage/backup/validate.test.ts`
- Modify: `src/storage/backup/safetyBackups.test.ts`

- [ ] **Step 1: Add backup schema v11 types**

In `types.ts`:
- add `BACKUP_SCHEMA_VERSION_V11 = 11`
- set `BACKUP_SCHEMA_VERSION_CURRENT = BACKUP_SCHEMA_VERSION_V11`
- add `tasks` to `BACKUP_TABLE_NAMES`
- add `BackupTaskRow`
- add `BackupTablesV11`
- add `BackupEnvelopeV11`
- include v11 in `BackupEnvelope`

`BackupTaskRow` should mirror the SQL row:

```ts
export type BackupTaskRow = {
  readonly id: string;
  readonly mare_id: string;
  readonly task_type: TaskType;
  readonly title: string;
  readonly due_date: BackupLocalDate;
  readonly due_time: string | null;
  readonly notes: string | null;
  readonly status: TaskStatus;
  readonly completed_at: BackupIsoDateTime | null;
  readonly completed_record_type: Exclude<TaskSourceType, 'manual'> | null;
  readonly completed_record_id: string | null;
  readonly source_type: TaskSourceType;
  readonly source_record_id: string | null;
  readonly source_reason: TaskSourceReason | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};
```

- [ ] **Step 2: Update delete and insert order**

In `types.ts`:
- Add `tasks` before `mares` in `BACKUP_DELETE_ORDER`.
- Add `tasks` after `mares` in `BACKUP_INSERT_ORDER`.

- [ ] **Step 3: Serialize tasks**

In `serialize.ts`, add a query that selects all task columns ordered by `created_at ASC, id ASC`, and include `tasks` in the v11 envelope.

- [ ] **Step 4: Restore tasks**

In `restore.ts`:
- delete `tasks` in the correct order
- insert `tasks` after `mares`
- for old backup versions, normalize to `tasks: []`
- verify that restoring a v1-v10 backup into a v11 schema leaves the `tasks` table empty and does not create implicit backfill tasks

- [ ] **Step 5: Validate tasks**

In `validate.ts`:
- accept schema v11
- require `tasks` for schema v11
- validate each task row:
  - object shape
  - required ids
  - valid `YYYY-MM-DD` due date
  - nullable valid `HH:MM` due time
  - supported enum values
  - title is non-empty
  - timestamps exist
  - `completed_at` must be non-null when status is completed and null when open
  - completed record type/id are both null or both non-null
  - `mare_id` references an existing mare
- Do not validate source/completed polymorphic ids against owner tables.

- [ ] **Step 6: Update fixtures and tests**

Add one open task and one completed task to the current backup fixture.

Test:
- v11 serialize includes tasks
- v11 restore inserts tasks
- v11 validate accepts valid tasks
- v11 validate rejects invalid due time
- v11 validate rejects completed task without `completed_at`
- older backup versions still validate and restore with empty tasks
- a v10 backup imported into the v11 schema yields zero task rows

- [ ] **Step 7: Confirm safety snapshot coverage**

`src/storage/backup/safetyBackups.ts` should not need production changes because it calls `serializeBackup()` and `validateBackupJson()`. Keep this file unchanged unless implementation proves otherwise, and rely on `safetyBackups.test.ts` to verify the current schema version and task-inclusive envelope are accepted.

- [ ] **Step 8: Verify Task 2**

Run:

```powershell
npm.cmd test -- src/storage/backup/serialize.test.ts src/storage/backup/restore.test.ts src/storage/backup/validate.test.ts src/storage/backup/safetyBackups.test.ts
npm.cmd run typecheck
```

Expected: all pass.

---

## Task 3: Automatic Breeding Pregnancy-Check Tasks

**Files**
- Modify: `src/storage/repositories/breedingRecords.ts`
- Modify: `src/storage/repositories/pregnancyChecks.ts`
- Modify: `src/storage/repositories/breedingRecords.test.ts`
- Modify: `src/storage/repositories/pregnancyChecks.test.ts`
- Modify: `src/storage/repositories/repositories.test.ts` if integration coverage lives there

- [ ] **Step 1: Add UTC-safe date helper for generated task due date**

Use a small helper in `breedingRecords.ts` or a reusable utility if one already exists:

```ts
function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Create generated pregnancy-check task on breeding create**

In `createBreedingRecord`, after inserting `breeding_records`, create a task:

```ts
await ensureBreedingPregnancyCheckTask(
  {
    id: newId(),
    mareId: input.mareId,
    breedingRecordId: input.id,
    dueDate: addDaysToLocalDate(input.date, 14),
  },
  handle,
);
```

This call must be idempotent. If an open generated pregnancy-check task already exists for the breeding record, the helper should return without inserting.

Make the generated helper create:
- `taskType: 'pregnancyCheck'`
- `title: 'Pregnancy check'`
- `sourceType: 'breedingRecord'`
- `sourceRecordId: breedingRecordId`
- `sourceReason: 'breedingPregnancyCheck'`

Ensure the repository emits both `breedingRecords` and `tasks` invalidation.

- [ ] **Step 3: Update open generated task on breeding date edit**

In `updateBreedingRecord`, after the breeding update succeeds, call:

```ts
await updateOpenBreedingPregnancyCheckTaskDueDate(
  id,
  addDaysToLocalDate(input.date, 14),
  handle,
);
```

This should update only `due_date` and `updated_at` for an open generated task. Preserve title, notes, and due time.

- [ ] **Step 4: Delete open generated task on breeding delete**

In `deleteBreedingRecord`, before deleting the breeding row, call:

```ts
await deleteOpenBreedingPregnancyCheckTask(id, handle);
```

Delete only open generated tasks. Completed generated tasks should remain as history unless FK constraints require a different sequencing. If FK constraints block breeding deletion because linked records exist, keep existing delete-blocking behavior.

- [ ] **Step 5: Complete generated task on pregnancy-check create/update**

In `createPregnancyCheck`, after inserting the check:

```ts
await completeOpenBreedingPregnancyCheckTask(input.breedingRecordId, input.id, handle);
```

In `updatePregnancyCheck`, after updating the selected breeding record id:

```ts
await completeOpenBreedingPregnancyCheckTask(input.breedingRecordId, id, handle);
```

Set completion metadata:
- `completedRecordType: 'pregnancyCheck'`
- `completedRecordId: pregnancyCheckId`

If an edited pregnancy check moves from one breeding record to another, complete the generated task for the new selected breeding record only. Do not reopen a task for the original breeding record in v1.

- [ ] **Step 6: Document same-day breeding task behavior**

Two breeding records for the same mare on the same day should produce two generated pregnancy-check tasks because they have different `source_record_id` values. They may share the same title and due date; that is acceptable in v1, and the dashboard's mare/title/date ordering should keep them stable.

- [ ] **Step 7: Add tests**

Test:
- breeding create creates exactly one generated task due 14 days after breeding date
- duplicate helper calls do not create duplicate open generated tasks
- breeding date edit updates open generated task due date
- breeding date edit does not update completed generated task
- breeding delete removes open generated task
- pregnancy check create completes matching generated task
- pregnancy check update completes matching generated task for selected breeding record
- pregnancy check update does not reopen a task for the previous breeding record
- two same-day breeding records for one mare create two generated tasks with different `source_record_id` values
- deleting pregnancy check does not reopen a task

- [ ] **Step 8: Verify Task 3**

Run:

```powershell
npm.cmd test -- src/storage/repositories/breedingRecords.test.ts src/storage/repositories/pregnancyChecks.test.ts src/storage/repositories/tasks.test.ts
npm.cmd run typecheck
```

Expected: all pass.

---

## Task 4: Dashboard Data Replacement

**Files**
- Modify: `src/hooks/useDashboardData.ts`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/selectors/homeScreen.ts`
- Modify: `src/navigation/AppNavigator.integration.test.tsx`
- Modify/Create dashboard screen tests as needed

- [ ] **Step 1: Replace alert state with task state**

In `useDashboardData.ts`:
- remove `DashboardAlert` imports and `generateDashboardAlerts`
- remove `buildHomeDashboardInput` imports and calls
- add `TaskWithMare`
- add `listOpenDashboardTasks`
- return `tasks` instead of `alerts`
- include `tasks` invalidation domain
- keep total mares, pregnant mares, total stallions, loading, error, reload behavior

Use:

```ts
const today = toLocalDate(new Date());
const dashboardTasks = await listOpenDashboardTasks(today, 14);
```

- [ ] **Step 2: Stop loading data solely needed by inferred alerts**

Use this exact load policy:
- Keep `mares` and `stallions` for dashboard stats.
- Keep `dailyLogs`, `breedingRecords`, `pregnancyChecks`, and `foalingRecords` because `buildPregnantInfoMap` still needs them.
- Remove `medicationLogs` and `foals`; they were only needed by inferred dashboard alerts.

- [ ] **Step 3: Remove obsolete home dashboard selector**

In `src/selectors/homeScreen.ts`, remove:
- the `DashboardInput` import from `@/utils/dashboardAlerts`
- `MedicationLog` and `Foal` imports if they become unused
- `HomeScreenRecords`
- `buildHomeDashboardInput`

Keep `buildPregnantInfoMap` and `selectFilteredMares`.

- [ ] **Step 4: Update `DashboardScreen`**

Replace:

```ts
const { totalMares, pregnantMares, totalStallions, alerts, ... } = useDashboardData();
```

with:

```ts
const { totalMares, pregnantMares, totalStallions, tasks, ... } = useDashboardData();
```

Remove:
- the `DashboardAlert` import
- the existing `onAlertPress` callback and switch
- the `<DashboardSection alerts={alerts} onAlertPress={onAlertPress} collapsible={false} />` render path

The task tap handler will be implemented in Task 7, but for this task the dashboard should render task-section props that match Task 5's planned shape.

- [ ] **Step 5: Remove dashboard alert empty-state wording**

Change empty task wording to:

```tsx
<Text style={styles.caughtUpText}>All caught up! No tasks due soon.</Text>
```

- [ ] **Step 6: Update tests**

Update any mocks of `useDashboardData` to return `tasks`.

Add or update tests so:
- dashboard renders tasks from hook state
- dashboard no longer renders inferred alert titles when only old alert-producing records exist
- task invalidation reloads dashboard data

- [ ] **Step 7: Verify Task 4**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:screen
```

Expected: all pass.

---

## Task 5: Task Dashboard UI

**Files**
- Modify or replace: `src/components/DashboardSection.tsx`
- Modify or replace: `src/components/AlertCard.tsx`
- Create: `src/components/TaskCard.tsx` if cleaner
- Modify/Create component tests if the repo has component-test coverage for dashboard cards

- [ ] **Step 1: Define task card props**

Use props equivalent to:

```ts
type TaskCardProps = {
  readonly task: TaskWithMare;
  readonly today: LocalDate;
  readonly onPress: (task: TaskWithMare) => void;
  readonly onEdit: (task: TaskWithMare) => void;
  readonly onComplete: (task: TaskWithMare) => void;
};
```

- [ ] **Step 2: Add task due-label helper**

Create a helper near the component or in `src/utils/tasks.ts`:

```ts
function daysBetweenLocalDates(dateA: LocalDate, dateB: LocalDate): number {
  const first = new Date(`${dateA}T00:00:00Z`);
  const second = new Date(`${dateB}T00:00:00Z`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((first.getTime() - second.getTime()) / msPerDay);
}

export function formatTaskDueLabel(task: Pick<Task, 'dueDate' | 'dueTime'>, today: LocalDate): string {
  const daysUntilDue = daysBetweenLocalDates(task.dueDate, today);
  const overdueDays = Math.abs(daysUntilDue);
  const dateLabel =
    daysUntilDue < 0 ? `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}` :
    daysUntilDue === 0 ? 'Today' :
    daysUntilDue === 1 ? 'Tomorrow' :
    formatLocalDate(task.dueDate, 'MM-DD-YYYY');
  return task.dueTime ? `${dateLabel} at ${task.dueTime}` : dateLabel;
}
```

Do not use `calculateDaysPostBreeding` for task due labels; its breeding-specific signature makes the sign convention easy to misread.

- [ ] **Step 3: Replace alert config with task config**

Use icons:
- daily check: `stethoscope`
- medication: `pill`
- breeding: `heart`
- pregnancy check: `calendar-check`
- custom: `checkbox-marked-circle-outline`

Use existing theme colors, not a new palette.

- [ ] **Step 4: Render task controls**

Each card should show:
- checkbox icon button for complete
- mare name
- title
- due label
- edit icon
- chevron or card press affordance

Keep text single-line where appropriate and use `numberOfLines={1}` for compact rows.

- [ ] **Step 5: Update `DashboardSection` props**

Use:

```ts
interface DashboardSectionProps {
  readonly tasks: readonly TaskWithMare[];
  readonly today: LocalDate;
  readonly onTaskPress: (task: TaskWithMare) => void;
  readonly onTaskEdit: (task: TaskWithMare) => void;
  readonly onTaskComplete: (task: TaskWithMare) => void;
  readonly collapsible?: boolean;
}
```

Keep `MAX_VISIBLE_ALERTS` behavior but rename it to `MAX_VISIBLE_TASKS`.

- [ ] **Step 6: Wire manual complete**

The parent will pass a completion handler that calls `completeTask`. If completing fails, show `Alert.alert('Task update failed', message)`.

- [ ] **Step 7: Verify Task 5**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:screen
```

Expected: all pass.

---

## Task 6: Task Form

**Files**
- Modify: `src/navigation/AppNavigator.tsx`
- Create: `src/hooks/useTaskForm.ts`
- Create: `src/screens/TaskFormScreen.tsx`
- Create: `src/hooks/useTaskForm.screen.test.tsx` or equivalent hook/screen tests
- Modify: `src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Add `TaskForm` route**

In `RootStackParamList`, add:

```ts
TaskForm: {
  taskId?: string;
  mareId?: string;
  taskType?: TaskType;
  dueDate?: LocalDate;
  dueTime?: string | null;
  title?: string;
  sourceType?: TaskSourceType;
  sourceRecordId?: string;
  sourceReason?: TaskSourceReason;
} | undefined;
```

Add:

```tsx
<Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ title: 'Task' }} />
```

- [ ] **Step 2: Add task form hook state**

`useTaskForm` args:

```ts
type UseTaskFormArgs = {
  readonly taskId?: string;
  readonly initialMareId?: string;
  readonly initialTaskType?: TaskType;
  readonly initialDueDate?: LocalDate;
  readonly initialDueTime?: string | null;
  readonly initialTitle?: string;
  readonly sourceType?: TaskSourceType;
  readonly sourceRecordId?: string;
  readonly sourceReason?: TaskSourceReason;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};
```

The hook should:
- load mares for picker
- load task in edit mode
- default due date to today
- default title based on task type unless an explicit initial title exists
- validate mare, task type, non-empty title, valid due date, optional valid due time
- call `createTask`, `updateTask`, `completeTask`, `deleteTask`

- [ ] **Step 3: Add title defaults**

Use:

```ts
const TASK_DEFAULT_TITLES: Record<TaskType, string> = {
  dailyCheck: 'Check mare',
  medication: 'Give medication',
  breeding: 'Breed mare',
  pregnancyCheck: 'Pregnancy check',
  custom: '',
};
```

Custom tasks must have a user-entered title.

- [ ] **Step 4: Build `TaskFormScreen`**

Use existing form controls and patterns from other screens. Fields:
- mare picker
- task type picker/segmented options
- title input
- due date input/date picker pattern used elsewhere
- optional due time input
- notes input

Actions:
- primary save
- edit mode mark complete
- edit mode delete

- [ ] **Step 5: Add dashboard Add Task action**

On `DashboardScreen`, add an action button in the task section or near the empty task state:

```tsx
onPress={() => navigation.navigate('TaskForm')}
```

Use existing button/icon patterns.

- [ ] **Step 6: Tests**

Test:
- dashboard Add Task opens `TaskForm`
- creating a dashboard task with mare selected calls `createTask`
- workflow-prefilled task does not require changing mare
- edit mode hydrates existing task
- mark complete calls `completeTask`
- delete calls `deleteTask`

- [ ] **Step 7: Verify Task 6**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:screen
```

Expected: all pass. This does not prove workflow task-launch params yet; Task 7 owns those route and hook changes.

---

## Task 7: Open Work From Task

**Files**
- Modify: `src/navigation/AppNavigator.tsx`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/screens/DailyLogFormScreen.tsx`
- Modify: `src/screens/MedicationFormScreen.tsx`
- Modify: `src/screens/BreedingRecordFormScreen.tsx`
- Modify: `src/screens/PregnancyCheckFormScreen.tsx`
- Modify: `src/hooks/useDailyLogWizard.ts`
- Modify: `src/hooks/useMedicationForm.ts`
- Modify: `src/hooks/useBreedingRecordForm.ts`
- Modify: `src/hooks/usePregnancyCheckForm.ts`
- Modify related hook and screen tests

- [ ] **Step 1: Extend workflow route params**

Update `RootStackParamList`:

```ts
DailyLogForm: { mareId: string; logId?: string; taskId?: string; defaultDate?: LocalDate; defaultTime?: string | null };
MedicationForm: { mareId: string; medicationLogId?: string; taskId?: string; defaultDate?: LocalDate };
BreedingRecordForm: { mareId: string; breedingRecordId?: string; taskId?: string; defaultDate?: LocalDate; defaultTime?: string | null };
PregnancyCheckForm: { mareId: string; pregnancyCheckId?: string; breedingRecordId?: string; taskId?: string; defaultDate?: LocalDate };
```

- [ ] **Step 2: Add dashboard task press behavior**

In `DashboardScreen`, add:

```ts
const isTaskFuture = (task: TaskWithMare, today: LocalDate): boolean => task.dueDate > today;
```

On press:
- if future, `navigation.navigate('TaskForm', { taskId: task.id })`
- if custom, `navigation.navigate('TaskForm', { taskId: task.id })`
- otherwise open matching form with `taskId`, `mareId`, `defaultDate`, and `defaultTime` where supported

Mappings:
- `dailyCheck` -> `DailyLogForm`
- `medication` -> `MedicationForm`
- `breeding` -> `BreedingRecordForm`
- `pregnancyCheck` -> `PregnancyCheckForm`

- [ ] **Step 3: Add edit behavior**

Edit action always opens:

```ts
navigation.navigate('TaskForm', { taskId: task.id });
```

- [ ] **Step 4: Pass default dates/times to hooks**

Daily log:
- initialize date from `defaultDate` if provided and create mode
- initialize time from `defaultTime` if provided and create mode
- widen `UseDailyLogWizardArgs` to accept `taskId`, `defaultDate`, and `defaultTime`

Medication:
- initialize date from `defaultDate` if provided and create mode
- widen `UseMedicationFormArgs` to accept `taskId` and `defaultDate`

Breeding:
- initialize date from `defaultDate` if provided and create mode
- initialize time from `defaultTime` if provided and create mode
- widen `UseBreedingRecordFormArgs` to accept `taskId`, `defaultDate`, and `defaultTime`

Pregnancy check:
- initialize date from `defaultDate` if provided and create mode
- widen `UsePregnancyCheckFormArgs` to accept `taskId` and `defaultDate`

- [ ] **Step 5: Tests**

Test:
- due daily-check task opens daily log route
- due medication task opens medication route
- due breeding task opens breeding route
- due pregnancy-check task opens pregnancy check route
- future daily-check task opens task form instead of daily log
- edit action opens task form

- [ ] **Step 6: Verify Task 7**

Run:

```powershell
npm.cmd run typecheck
npm.cmd test -- src/hooks/useDailyLogWizard.screen.test.tsx src/hooks/navigationCallbackReloadGuards.screen.test.tsx src/hooks/usePregnancyCheckForm.screen.test.tsx
npm.cmd run test:screen
```

Expected: all pass.

---

## Task 8: Complete Task After Successful Record Save

**Files**
- Modify: `src/hooks/useDailyLogWizard.ts`
- Modify: `src/hooks/useMedicationForm.ts`
- Modify: `src/hooks/useBreedingRecordForm.ts`
- Modify: `src/hooks/usePregnancyCheckForm.ts`
- Modify: workflow screen files to pass `taskId`
- Modify related hook/screen tests

- [ ] **Step 1: Add task id args to workflow hooks**

Add `taskId?: string` to each relevant hook args type.

- [ ] **Step 2: Refactor save functions to know saved record id**

Pattern for create flows:

```ts
const id = existingId ?? newId();
await createRecord({ id, ...payload });
return id;
```

Pattern for edit flows:

```ts
await updateRecord(existingId, payload);
return existingId;
```

Do not change repository return types just to get the id; hooks already generate ids today.

For `useDailyLogWizard`, the saved record id is always the daily-log id. Uterine flush products or medication rows created as daily-log follow-up children do not get their own task-completion semantics in v1.

- [ ] **Step 3: Complete task only after save succeeds**

After successful record save and before navigation back, call:

```ts
await completeTaskFromRecord(taskId, completedRecordType, savedRecordId);
```

Use:
- daily log -> `completedRecordType: 'dailyLog'`
- medication -> `completedRecordType: 'medicationLog'`
- breeding -> `completedRecordType: 'breedingRecord'`
- pregnancy check -> `completedRecordType: 'pregnancyCheck'`

- [ ] **Step 4: Handle task-completion failure**

If record save succeeds but task completion fails:
- show `Alert.alert('Task update failed', message)`
- leave task open
- navigate back after the alert is dismissed because the record itself was saved successfully

- [ ] **Step 5: Tests**

For each workflow where practical:
- validation failure does not complete task
- repository save failure does not complete task
- successful save completes task with correct metadata
- task completion failure shows alert
- task completion failure still leaves the saved record in place and navigates back after the alert

- [ ] **Step 6: Verify Task 8**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:screen
```

Expected: all pass.

---

## Task 9: Save And Add Follow-Up Entryways

**Files**
- Modify: `src/screens/DailyLogWizardScreen.tsx`
- Modify: `src/hooks/useDailyLogWizard.ts`
- Modify: `src/screens/MedicationFormScreen.tsx`
- Modify: `src/hooks/useMedicationForm.ts`
- Modify: `src/screens/BreedingRecordFormScreen.tsx`
- Modify: `src/hooks/useBreedingRecordForm.ts`
- Modify: `src/screens/PregnancyCheckFormScreen.tsx`
- Modify: `src/hooks/usePregnancyCheckForm.ts`
- Modify tests for these screens/hooks

- [ ] **Step 1: Add save mode to each hook**

Expose a second save handler or a save option:

```ts
onSave: () => Promise<void>;
onSaveAndAddFollowUp: () => Promise<void>;
```

Implementation should share the same validation and save logic as normal save.

- [ ] **Step 2: Navigate to task form after successful save**

After successful save:

```ts
navigation.replace('TaskForm', {
  mareId,
  taskType: defaultFollowUpTaskType,
  sourceType,
  sourceRecordId: savedRecordId,
  sourceReason: 'manualFollowUp',
});
```

Source mappings:
- daily log -> `sourceType: 'dailyLog'`, default `taskType: 'dailyCheck'`
- medication -> `sourceType: 'medicationLog'`, default `taskType: 'medication'`
- breeding -> `sourceType: 'breedingRecord'`, default `taskType: 'pregnancyCheck'`
- pregnancy check -> `sourceType: 'pregnancyCheck'`, default `taskType: 'custom'`

- [ ] **Step 3: Add screen buttons**

Add secondary action label:

```text
Save & Add Follow-up
```

Place it near the primary save action using the existing button hierarchy. Keep primary save as the fastest/default action.

- [ ] **Step 4: Tests**

For each workflow:
- save-and-follow-up validates before save
- if validation fails, no navigation
- if save fails, no navigation
- if save succeeds, route is replaced with `TaskForm`
- source metadata and default task type are correct

- [ ] **Step 5: Verify Task 9**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run test:screen
```

Expected: all pass.

---

## Task 10: Cleanup And Final Verification

**Files**
- Modify unused dashboard alert utilities/tests only to mark them deprecated if no production references remain.
- Optionally modify: `src/utils/devSeed.ts`
- Optionally modify: `README.md`
- Optionally modify: `docs/agent/dashboard-and-onboarding.md`

- [ ] **Step 1: Remove inferred dashboard alert usage**

Run:

```powershell
rg -n "DashboardAlert|generateDashboardAlerts|dashboardAlerts|AlertCard|alerts" src
```

For any remaining references:
- remove if only used by old dashboard alerts
- keep if unrelated or still used by tests being intentionally preserved

- [ ] **Step 2: Keep old alert utilities as deprecated rollback code**

Do not delete the old alert utilities in this task. If no production code imports these files, add a short file-level `@deprecated` comment explaining they are retained temporarily as rollback/reference code after the persisted-task dashboard replacement:
- `src/utils/dashboardAlerts.ts`
- `src/utils/dashboardAlertRules.ts`
- `src/utils/dashboardAlertTypes.ts`
- `src/utils/dashboardAlertContext.ts`
- `src/utils/dashboardAlerts.test.ts`

Keep source and tests together. Deletion should be a separate follow-up commit after task-dashboard QA is stable.

- [ ] **Step 3: Update preview seed only if useful**

If updating `src/utils/devSeed.ts`, add one open task within the 14-day dashboard window. Do not add stale/noisy tasks that make preview data feel broken.

- [ ] **Step 4: Update docs only if touched behavior is documented there**

If updating docs:
- README should say dashboard tasks are persisted follow-ups, not inferred alerts.
- `docs/agent/dashboard-and-onboarding.md` should replace the old "dashboard alerts are derived" rule with the new task-system rule.

- [ ] **Step 5: Final verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd test -- src/storage/migrations/index.test.ts src/storage/repositories/tasks.test.ts src/storage/repositories/breedingRecords.test.ts src/storage/repositories/pregnancyChecks.test.ts src/storage/backup/serialize.test.ts src/storage/backup/restore.test.ts src/storage/backup/validate.test.ts src/storage/backup/safetyBackups.test.ts
npm.cmd run test:screen
npm.cmd run lint
```

Expected: all pass.

---

## Acceptance Criteria

- [ ] Dashboard shows only persisted open tasks, not inferred heat/stale-log/med-gap/IgG alerts.
- [ ] Users can create, edit, complete, and delete tasks.
- [ ] Tasks support due dates and optional due times.
- [ ] Optional due times sort correctly.
- [ ] Future tasks are visible but open task details, not record forms.
- [ ] Overdue open tasks have no lower-bound cutoff; a six-month-overdue task remains on the dashboard until completed or deleted.
- [ ] Due or overdue workflow tasks open the matching record form.
- [ ] Successful record save completes the launching task.
- [ ] New breeding records create a visible pregnancy-check task due 14 days later.
- [ ] Pregnancy-check save completes the generated breeding task.
- [ ] Completed tasks remain stored and backed up, but are hidden from the active dashboard.
- [ ] No existing records are backfilled into tasks.

## Assumptions

- No notifications in v1.
- No one-time backfill prompt.
- Foaling and foal reminders use `custom` in v1.
- Dashboard task window is 14 days inclusive.
- If migration ids changed before implementation starts, use the next migration id and update tests accordingly.
