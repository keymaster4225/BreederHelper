# Plan Review: Dashboard Tasks V1

**Reviewing:** [2026-04-27-dashboard-tasks-v1-implementation-plan.md](./2026-04-27-dashboard-tasks-v1-implementation-plan.md)
**Reviewer:** Claude (Opus 4.7)
**Date:** 2026-04-26

Overall the plan is well-structured and covers the main risks. A few correctness issues, gaps, and risk-area observations follow. References below tie back to the seven risk areas raised by the user.

---

## Verified against codebase

- ✅ Latest migration is `026_breeding_record_time` ([src/storage/migrations/index.ts:1492-1503](../../src/storage/migrations/index.ts#L1492-L1503)). `027_tasks` is the right id.
- ✅ Backup is currently at v10 ([src/storage/backup/types.ts:29-30](../../src/storage/backup/types.ts#L29-L30)). v11 is correct.
- ✅ `breeding_records` already has `time` (mig 026). Plan's `defaultTime` plumbing matches the existing form.
- ✅ `pregnancyChecks` has `breedingRecordId`; `completeOpenBreedingPregnancyCheckTask(input.breedingRecordId, …)` is reachable.
- ✅ Existing `useDashboardData` ([src/hooks/useDashboardData.ts:58-83](../../src/hooks/useDashboardData.ts#L58-L83)) does need to keep `dailyLogs / breedingRecords / pregnancyChecks / foalingRecords` for `buildPregnantInfoMap` — plan correctly hedges this in Task 4 Step 2.

---

## Correctness issues to fix

1. **Type/DB drift on `completedRecordType`** (Task 1 Step 1). The interface declares `completedRecordType: TaskSourceType | null`, which permits `'manual'`, but the migration CHECK rejects `'manual'`. Tighten the type to `Exclude<TaskSourceType, 'manual'> | null` (matches the `completeTaskFromRecord` signature already in the plan).

2. **`calculateDaysPostBreeding` reuse is misleading** (Task 5 Step 2). Its signature is `(checkDate, breedingDate)` and returns `checkDate - breedingDate` ([src/models/types.ts:371-379](../../src/models/types.ts#L371-L379)). Calling it as `(task.dueDate, today)` yields `dueDate - today`, which gives the *opposite* sign convention from "days post". The math happens to work for the formatter, but the call reads wrong and is fragile if anyone touches the helper. The plan's escape-hatch ("use a small UTC-safe `daysBetweenLocalDates` instead") should be the default, not the alternative. Also "Overdue by 1 days" needs singular/plural handling.

3. **Idempotency contract for `ensureBreedingPregnancyCheckTask`** (Task 1 Step 4 / Task 3 Step 2). The plan relies on the partial unique index to prevent duplicates, but doesn't say what the helper does when one already exists. Two callers will hit this: `createBreedingRecord`, and any retry path. Specify: "if an open generated task already exists for `breedingRecordId`, return without inserting" — don't let a UNIQUE-violation surface as an error.

4. **`emitDataInvalidation` for both domains** (Task 3 Step 2). Plan says the breeding repo should emit both `breedingRecords` and `tasks`. Make sure each generated-task helper inside `tasks.ts` *also* emits `tasks` so the dashboard refreshes on direct task mutations.

5. **`buildHomeDashboardInput` cleanup** (Task 4). Plan removes `generateDashboardAlerts` but doesn't explicitly call out removing the now-unused `buildHomeDashboardInput` import. Add it.

---

## Risk-area gaps

### 1. Migration / backups
Plan covers this well, but missing:
- `src/storage/backup/safetyBackups.ts` is listed for tests but not for production code changes. Verify whether it needs to enumerate new tables; if not, say so explicitly.
- **Restore migration path**: when restoring a v1–v10 backup, the new `tasks` table exists (migrations always run first) but is empty. Plan says "normalize to `tasks: []`" — good. Add an explicit test that v10 backup imported into a v11 schema yields zero tasks (no implicit backfill — matches the acceptance criterion).

### 2. Route contracts
- ⚠️ **Type-drift gap.** Task 7 adds `taskId` / `defaultDate` / `defaultTime` to four route param types but only mentions modifying the form *screens*. Each form's `useXxxForm` hook reads `route.params` (or a typed args object) — if the hook arg types aren't widened in the same task, typecheck will fail mid-PR. List each hook's args type in Task 7's "Files".
- Task 7 verify step runs `typecheck` and `test:screen` but not `npm test` over the hook unit tests. Add it.

### 3. Save orchestration
- The plan's "return id" pattern (Task 8 Step 2) avoids double-save, good. But **`useDailyLogWizard` is multi-step** and may persist follow-up records (medications, etc.). "Saved record id" is ambiguous — pin it to the daily-log id and document that follow-up children don't carry their own task semantics in v1.
- Task 8 Step 4's "show alert and then navigate back" is a defensible choice but breaks the existing implicit invariant that a failed mutation keeps the user on the form. Make sure tests assert the chosen behavior; otherwise reviewers will flip it.

### 4. Generated breeding task lifecycle
- ✅ Create / edit-date / delete / complete all covered.
- ⚠️ **Edge case missing**: what if the user *edits a pregnancy check's `breedingRecordId`* to point at a different breeding? The current update path completes the *new* breeding's open generated task (Task 3 Step 5) but doesn't reopen the *original* breeding's task. Either accept that (document it) or reopen.
- ⚠️ **Race**: if two breeding records on the same day for the same mare are created, each gets its own open task (different `source_record_id`). That's probably correct, but worth stating in Task 3 explicitly because two tasks titled "Pregnancy check" with the same due date will look like duplicates on the dashboard.
- ✅ "No backfill" is in Acceptance Criteria.

### 5. Dashboard replacement
- Task 4 says to remove the inferred alert switch in `DashboardScreen` but doesn't enumerate the existing `onAlertPress` callback at [src/screens/DashboardScreen.tsx:92](../../src/screens/DashboardScreen.tsx#L92) and the `<DashboardSection alerts={…}` render at line 249. Spell those out so the implementer doesn't leave dead code.
- Task 4 Step 2 should be more decisive: `medicationLogs` and `foals` *can* be removed (no longer needed); the others must stay. Replace the conditional language with a yes/no list.

### 6. Future tasks
- ✅ `isTaskFuture` gate is correct — future tasks open `TaskForm` instead of record forms, which sidesteps future-dated validation in record forms (e.g. daily-log date validators).
- ⚠️ **Overdue-by-N-days has no upper bound.** Plan's `listOpenDashboardTasks` includes any open task with `due_date <= today + 14`, with no lower bound. A six-month-overdue task will sit on the dashboard forever. That may be intentional (don't hide work), but call it out in Acceptance Criteria so it doesn't read as a bug later.

### Other
- **Typecheck after Task 6, before Task 7.** Adding a new `TaskForm` route while leaving `dueTime` / `taskId` off the workflow routes won't fail typecheck, but the navigation calls in Task 7 will. Ordering is fine; just note that the Task 6 verify step is *not* a green light for the workflow forms.
- **Lint pass** only runs at the very end (Task 10). Consider running it after Task 1 too — repository file scaffolding catches the most lint nits.

---

## Challenge: deleting alert utilities in Task 10 — too aggressive?

Lean toward **keeping them in Task 10 as `// @deprecated` and deleting them in a follow-up commit on the same branch**, for these reasons:

- The alert utilities (`dashboardAlerts.ts`, `dashboardAlertRules.ts`, etc.) are pure functions with their own test files. Leaving them unused costs nothing at runtime but preserves a rollback path if QA finds a regression in the task flow during the same review cycle.
- The risk of "stale behavior being maintained accidentally" is real but small: nothing imports them after Task 4, and the test files are isolated. A `@deprecated` tag plus a TODO comment with a date kills any ambiguity.
- A separate cleanup commit means the diff for the *task system* PR stays focused on additions, which is friendlier to review than a PR that simultaneously adds 3,000 lines of task code and deletes 800 lines of alert code.
- If you do delete in Task 10, at minimum delete *both* the source and test files in the same commit — half-deleted (source removed, test left) is the worst state.

So: not too aggressive in principle, but the plan's "Step 2: Decide whether to delete" is too soft. Pick one of (delete-all-now / mark-deprecated-now-delete-later) and commit to it.

---

## Summary

Plan is **largely correct and complete**. Required fixes before execution:
- Type tightening on `completedRecordType`.
- The `calculateDaysPostBreeding` misuse — replace with a `daysBetweenLocalDates` helper.
- Idempotency wording for `ensureBreedingPregnancyCheckTask`.
- Explicit hook-args updates in Task 7's file list.

Minor polish:
- Dashboard cleanup specificity (enumerate `onAlertPress` and the `<DashboardSection>` render site).
- Overdue-window note in Acceptance Criteria.
- Decisive call on the Task 10 deletion strategy.
