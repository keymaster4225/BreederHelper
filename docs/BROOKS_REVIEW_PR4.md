# Brooks-Lint Review

**Mode:** PR Review  
**Pull Request:** https://github.com/keymaster4225/BreederHelper/pull/4  
**Scope:** PR #4 vs `main`, 57 files, +4679/-452. Sampled high-risk areas because the PR is large.  
**Health Score:** 75/100

Not ready to merge: the daily-log follow-up path can save data and then fail to navigate, and dashboard tasks can surface soft-deleted mares.

## Findings

### Critical

**Change Propagation — Daily-log follow-up navigation is blocked**

Symptom: `src/screens/DailyLogWizardScreen.tsx` uses `navigation.replace('TaskForm', params)` for follow-up creation, but the same screen's `beforeRemove` guard blocks removals unless `allowScreenExitRef` is set. `saveAndAddFollowUp` saves the log first in `src/hooks/useDailyLogWizard.ts`, then calls the follow-up callback.

Source: Fowler — Shotgun Surgery / Change Propagation

Consequence: tapping `Save & Add Follow-up` on the daily log review step can persist the log, block the replace navigation, and move the wizard backward instead of opening `TaskForm`. A user can then save again and create duplicate logs.

Remedy: set `allowScreenExitRef.current = true` before follow-up `replace`, or route all successful exits through one helper that marks the wizard exit as intentional. Add a screen-level test for daily-log review `Save & Add Follow-up` navigating to `TaskForm`.

### Warning

**Domain Model Distortion — Tasks ignore mare soft deletion**

Symptom: `listMares()` excludes deleted mares by default in `src/storage/repositories/mares.ts`, but `listOpenDashboardTasks()` joins `mares` without `mares.deleted_at IS NULL` in `src/storage/repositories/tasks.ts`.

Source: Evans — Domain-Driven Design / Aggregate lifecycle

Consequence: open tasks for soft-deleted mares can remain visible on the dashboard and editable through task flows, even though the mare is hidden elsewhere.

Remedy: filter dashboard tasks to active mares, and add a repository test for a task belonging to a soft-deleted mare.

**Change Propagation — Two product changes are bundled into one large PR**

Symptom: the PR combines the persisted dashboard task subsystem with the sticky follow-up action bar refactor across 57 files.

Source: Brooks — Conceptual Integrity

Consequence: review and regression scope are high; the daily-log bug above is exactly the kind of cross-feature interaction this PR shape makes easy to miss.

Remedy: split sticky action bar work from the task data/dashboard work, or at minimum add integration coverage around each workflow save path before merge.

## Verification

Passed:

- `npm run typecheck`
- `npm run lint`
- `npm test -- src/storage/repositories/tasks.test.ts src/storage/backup/validate.test.ts src/storage/backup/restore.test.ts src/storage/backup/serialize.test.ts src/utils/tasks.test.ts`
- `npm run test:screen -- src/screens/DashboardScreen.screen.test.tsx src/hooks/useTaskForm.screen.test.tsx src/components/FormActionBar.screen.test.tsx src/hooks/useDailyLogWizard.screen.test.tsx src/hooks/useMedicationForm.screen.test.tsx src/hooks/useBreedingRecordForm.screen.test.tsx src/hooks/usePregnancyCheckForm.screen.test.tsx`

## Summary

The highest-priority fix is the daily-log follow-up navigation guard, because it can save records and leave the user in the wrong workflow. Typecheck, lint, focused unit tests, and focused screen tests all passed.
