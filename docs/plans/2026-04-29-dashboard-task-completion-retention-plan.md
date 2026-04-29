# Dashboard Task Completion Retention Implementation Plan

## Goal

Change dashboard checkbox behavior so checking a task no longer makes it disappear immediately. A completed task should remain visible for 24 hours, render as checked, move below open tasks, and then naturally fall off the dashboard after the 24-hour retention window. The dashboard count badge must count open tasks only.

## Product Decisions

- The checkbox action completes the task immediately by setting `status = 'completed'` and `completed_at`.
- Completed tasks remain persisted in SQLite. Do not delete or physically archive task rows as part of this behavior.
- The dashboard shows:
  - open tasks due through the current dashboard window, preserving the existing 14-day due horizon
  - completed tasks whose `completed_at` is within the last 24 hours
- Completed tasks sort after every open task, regardless of due date.
- The dashboard count badge displays only open tasks.
- Completed task cards should be visually distinct:
  - checked checkbox icon
  - muted/card-complete styling
  - no edit pencil
  - content press should not launch the old workflow form
- No undo behavior in this first change. Reopening/completion history can be addressed later if needed.

## Current Behavior

`DashboardScreen` calls `completeTask(task.id)` from the task card checkbox. The mutation emits `tasks` invalidation, `useDashboardData` reloads, and `listOpenDashboardTasks(today, 14)` only returns `tasks.status = 'open'`. This is why the checked item disappears immediately.

Relevant files:

- `src/storage/repositories/tasks.ts`
- `src/hooks/useDashboardData.ts`
- `src/components/DashboardSection.tsx`
- `src/components/TaskCard.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/utils/tasks.ts`
- `src/storage/repositories/tasks.test.ts`
- `src/hooks/useDashboardData.screen.test.tsx`
- `src/screens/DashboardScreen.screen.test.tsx`

## Implementation Steps

### Step 1: Add a dashboard retention constant

Add a named constant for the retention window, preferably near dashboard data loading code:

```ts
const RECENTLY_COMPLETED_TASK_RETENTION_HOURS = 24;
```

Use milliseconds or an ISO cutoff helper internally, but keep the product duration obvious at the call site.

### Step 2: Replace the open-only dashboard repository query

In `src/storage/repositories/tasks.ts`, add a new repository function:

```ts
export async function listDashboardTasks(
  today: LocalDate,
  windowDays: number,
  completedSince: ISODateTime,
  db?: RepoDb,
): Promise<TaskWithMare[]>
```

Query rules:

- Include open tasks where `due_date <= today + windowDays`.
- Include completed tasks where `completed_at >= completedSince`.
- Continue excluding tasks for soft-deleted mares.
- Continue joining `mares` to populate `mareName`.
- Sort open tasks first, then recently completed tasks:

```sql
ORDER BY
  CASE WHEN tasks.status = 'open' THEN 0 ELSE 1 END ASC,
  tasks.due_date ASC,
  tasks.due_time IS NULL ASC,
  tasks.due_time ASC,
  mares.name ASC,
  tasks.title ASC,
  tasks.completed_at DESC,
  tasks.created_at ASC,
  tasks.id ASC
```

Keep `listOpenDashboardTasks` only if other call sites still need it. If the dashboard is the only call site, the old function can either delegate to the new one with an impossible completed cutoff or remain for test compatibility until the migration is complete.

### Step 3: Update dashboard data loading

In `src/hooks/useDashboardData.ts`:

- Import and call `listDashboardTasks` instead of `listOpenDashboardTasks`.
- Compute `completedSince` as `new Date(Date.now() - 24 hours).toISOString()`.
- Keep the existing 14-day due horizon for open tasks.
- Return the mixed `tasks` list as before so the UI can render both statuses.

Risk to avoid: do not use local-date arithmetic for the 24-hour cutoff. This cutoff is elapsed time from `completed_at`, which is already ISO timestamp based.

### Step 4: Add open task counting in the section component

In `src/components/DashboardSection.tsx`:

- Derive `openTaskCount = tasks.filter((task) => task.status === 'open').length`.
- Render `openTaskCount` in the count badge.
- Keep the section visible when `tasks.length > 0`, even if all visible tasks are recently completed.
- Keep `MAX_VISIBLE_TASKS = 8` unless the second dashboard issue changes that.
- Dense-list behavior is intentional: because the dashboard still renders the first 8 sorted tasks, recently completed tasks sort below open tasks and may fall below the visible slice when 8 or more open tasks remain.

### Step 5: Render completed cards differently

In `src/components/TaskCard.tsx`:

- Derive `isCompleted = task.status === 'completed'`.
- Checkbox icon:
  - open: `checkbox-blank-outline`
  - completed: `checkbox-marked-circle-outline`
- Accessibility label:
  - open: `Complete ${task.title}`
  - completed: `Completed ${task.title}`
- Disable completion press for completed tasks to avoid repeated `completeTask()` calls.
- Hide or disable the edit pencil for completed tasks.
- Disable workflow/content press for completed tasks, or make it a no-op with an accessibility label that clearly identifies it as completed.
- Add muted visual treatment for completed cards:
  - lower title/content opacity or use `colors.onSurfaceVariant`
  - lighter left border/accent
  - optional struck-through title only if it remains readable on mobile

Do not add explanatory in-app copy about the 24-hour behavior in this pass.

### Step 6: Keep dashboard navigation limited to open tasks

In `src/screens/DashboardScreen.tsx`:

- Guard `onTaskPress` and `onTaskEdit` so completed tasks do nothing if pressed.
- Guard `onTaskComplete` so completed tasks do not call `completeTask` again.
- Preserve existing routing behavior for open tasks:
  - future/custom task -> task form
  - due/overdue workflow tasks -> matching workflow form

### Step 7: Update repository tests

In `src/storage/repositories/tasks.test.ts`:

- Add tests for `listDashboardTasks`.
- Cover inclusion of:
  - open overdue/today/day-14 tasks
  - completed task completed 23h59m ago
- Cover exclusion of:
  - open day-15 task
  - completed task completed more than 24h ago
  - soft-deleted mare tasks
- Cover sorting:
  - all open tasks before completed tasks
  - open task sort remains due date/time/mare/title based
  - completed task sort is stable and uses recent completion after open grouping

Update the repository harness dashboard query branch to model both open and recently completed rows.

### Step 8: Update hook tests

In `src/hooks/useDashboardData.screen.test.tsx`:

- Mock `listDashboardTasks` instead of `listOpenDashboardTasks`.
- Assert it is called with:
  - `today`
  - `14`
  - an ISO completed cutoff string
- Keep the invalidation test to ensure completed-task mutation reloads dashboard data.

Use a loose ISO assertion for `completedSince`; do not make this test depend on exact milliseconds.

### Step 9: Update screen/component tests

In `src/screens/DashboardScreen.screen.test.tsx`:

- Existing completion test should still assert open checkbox calls `completeTask('task-1')`.
- Add a completed task fixture.
- Assert completed task:
  - renders with checked/completed accessibility label
  - does not call `completeTask` when its checkbox is pressed
  - does not navigate to workflow/task form when content is pressed
  - does not show the edit pencil, or edit press is disabled if the implementation keeps the control visible
- Add an assertion that the count badge shows open task count, not total visible task count. If there is one open task and one recently completed task, the badge should show `1`.

If querying the badge text is ambiguous, add a targeted accessibility label to the count badge container such as `1 open task`.

### Step 10: Quality gates

Run targeted tests first:

```bash
npm test -- src/storage/repositories/tasks.test.ts
npm run test:screen -- src/hooks/useDashboardData.screen.test.tsx src/screens/DashboardScreen.screen.test.tsx
```

Then run the standard gates before handoff:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

## Risks And Checks

- The dashboard title says `Today's Tasks`, but it already includes future tasks within 14 days. This plan does not rename it.
- Recently completed tasks should not be counted as work remaining.
- Keeping completed tasks persisted preserves backup/export semantics and avoids an offline cleanup job.
- If completed tasks are included solely by `completed_at`, a task due far in the future but completed now will remain visible for 24 hours. That matches the checkbox feedback goal.
- There is no schema migration required.

## Acceptance Criteria

- Checking an open dashboard task immediately changes the card to checked/completed instead of removing it.
- The completed card moves below all open tasks.
- The completed card disappears from dashboard results after 24 hours based on `completed_at`.
- The dashboard count badge counts open tasks only.
- Completed dashboard cards cannot be completed repeatedly and do not launch workflow forms.
- Existing open task navigation behavior remains unchanged.
- Targeted repository, hook, and screen tests pass.
