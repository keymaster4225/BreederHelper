# Multiple Daily Checks Per Day Implementation Plan

**Date:** 2026-04-23  
**Status:** Ready for implementation  
**Source Spec:** `docs/superpowers/specs/2026-04-23-multiple-daily-checks-design-revised.md`

## Goal

Implement support for multiple same-day daily logs by adding a `time` field to `daily_logs`, enforcing a create-time timestamp invariant for new logs, preserving untimed legacy rows, and updating repository, backup, wizard, detail, timeline, and dashboard behavior so same-day checks are stored, rendered, and interpreted correctly.

The finished app should:

- allow multiple daily logs for the same mare and date when each timed entry is unique
- require a valid `HH:MM` time for all newly created daily logs
- preserve existing untimed rows as `time = NULL`
- show grouped same-day checks clearly in the mare detail and calendar history surfaces
- suppress or retain alerts correctly when the only difference between two logs is same-day ordering
- restore cleanly from both upgraded databases and pre-feature backups

## Repo Fit

This plan is grounded in the current codebase:

- Daily log storage already lives in `src/storage/repositories/dailyLogs.ts`.
- The migration system is inline in `src/storage/migrations/index.ts` and currently runs through migration `023`.
- Backup and restore logic already uses explicit raw-row contracts in `src/storage/backup/*`.
- The actual daily log save flow is owned by `src/hooks/useDailyLogWizard.ts` and rendered through `src/screens/DailyLogWizardScreen.tsx`.
- The mare detail and calendar surfaces already consume daily logs through:
  - `src/screens/mare-detail/DailyLogsTab.tsx`
  - `src/screens/mare-detail/TimelineTab.tsx`
  - `src/hooks/useMareCalendarData.ts`
  - `src/utils/dashboardAlertContext.ts`
  - `src/utils/dashboardAlertRules.ts`
- SQLite-backed integration coverage already exists in:
  - `src/storage/repositories/repositories.test.ts`
  - `src/storage/migrations/index.test.ts`

This work should extend those existing seams rather than creating a parallel daily-log system.

## Locked Implementation Assumptions

These are implementation decisions, not open questions:

- `DailyLog.time` becomes `string | null` and is non-optional in TypeScript.
- Storage format is naive local `HH:MM` only.
- Legacy rows remain untimed; no backfill from `created_at`.
- New rows must always be timed, even outside the wizard.
- DB uniqueness is enforced with two partial unique indexes:
  - `idx_daily_logs_mare_date_time_unique`
  - `idx_daily_logs_mare_date_untimed_unique`
- The repository enforces the create/update invariants before SQLite whenever possible.
- UI displays time in 12-hour format, storage remains 24-hour.
- Calendar dots remain per-day, not per-check.
- Dashboard alert windows remain date-based, but same-day ordering becomes time-aware.
- Backup schema bumps from `v6` to `v7`.

## Delivery Strategy

Implement in seven waves so contract-setting changes land before UI and backup consumers build against them.

### Wave 1: Foundation contracts

1. Add shared daily-log time utility and comparator.
2. Update domain types and test helper defaults.

### Wave 2: Schema and repository

3. Add `migration024` and migration coverage.
4. Update repository contracts, SQL, and integration tests.

### Wave 3: Backup and restore

5. Bump backup schema to `v7`.
6. Update serializer, validator, restore, fixtures, and backup tests.

### Wave 4: Wizard and form controls

7. Add `FormTimeInput`.
8. Extend wizard state, validation, hydration, payload building, and duplicate-time error mapping.
9. Update Basics and Review steps and screen tests.

### Wave 5: Detail and history consumers

10. Update Daily Logs tab grouping and time rendering.
11. Update timeline and selected-day calendar history ordering/rendering.

### Wave 6: Dashboard behavior

12. Make daily-log sorting time-aware in dashboard context.
13. Fix same-day follow-up and same-day ovulation suppression logic.

### Wave 7: Verification and QA

14. Sweep dev seeds and test factories.
15. Run full automated verification and manual regression QA.

## Task Breakdown

### Task 1: Add shared daily-log time utility and comparator

**Files**

- Create: `src/utils/dailyLogTime.ts`
- Create: `src/utils/dailyLogTime.test.ts`

**Implementation**

- Add `isDailyLogTime(value: string): boolean`.
- Add `normalizeDailyLogTime(value: unknown): string | null`.
  - trims whitespace
  - accepts only `HH:MM`
  - validates `00:00` through `23:59`
  - returns `null` instead of throwing
- Add `getCurrentTimeHHMM(): string`.
- Add `formatDailyLogTime(time: string | null): string`.
  - `16:15 -> 4:15 PM`
  - `null -> -`
- Add `compareDailyLogsDesc(a, b): number`.
  - `date DESC`
  - timed rows before untimed rows for the same day
  - `time DESC`
  - `createdAt DESC`
  - `id DESC`
- Add helper(s) for same-day ordering comparisons if that keeps dashboard logic simpler:
  - `isDailyLogAfter(a, b): boolean` or equivalent

**Acceptance criteria**

- One utility module owns all time parsing/formatting/comparison rules.
- The comparator can be reused by repository-adjacent code, timeline code, and alert code.
- Unit tests cover valid, invalid, trimmed, edge-hour, and null cases.

**Suggested verification**

- `npm test -- src/utils/dailyLogTime.test.ts`

### Task 2: Update domain types and test helper defaults

**Files**

- Modify: `src/models/types.ts`
- Modify: unit-test helper files that construct `DailyLog` objects

**Implementation**

- Add `time: string | null` to `DailyLog`.
- Let `DailyLogDetail` inherit it naturally.
- Keep `findMostRecentOvulationDate` date-based.
- Do not change public date semantics of pregnancy calculations.
- Sweep helper builders in test files and default fabricated logs to `time: null` unless the test is explicitly about ordering or display.

**Likely helper updates**

- `src/models/types.test.ts`
- `src/selectors/homeScreen.test.ts`
- `src/utils/calendarMarking.test.ts`
- `src/utils/dashboardAlerts.test.ts`
- `src/utils/dailyLogDisplay.test.ts`
- `src/utils/timelineEvents.test.ts`

**Acceptance criteria**

- TypeScript forces every caller to acknowledge timed vs untimed logs.
- No helper silently omits `time`.

### Task 3: Add migration024 for multiple daily checks

**Files**

- Modify: `src/storage/migrations/index.ts`
- Modify: `src/storage/migrations/index.test.ts`

**Implementation**

- Add new migration constant `migration024`.
- Register migration:
  - `id: 24`
  - `name: '024_daily_logs_multiple_checks'`
  - `requiresForeignKeysOff: true`
- Add `shouldSkip` predicate that checks:
  - `daily_logs.time` column exists
  - `idx_daily_logs_mare_date_time_unique` exists
  - `idx_daily_logs_mare_date_untimed_unique` exists
- Rebuild `daily_logs` from the current post-`021` canonical shape, not from `001`.
- Include all current columns and checks, plus:
  - `time TEXT`
  - time-format `CHECK`
  - `ovulation_detected` boolean `CHECK`
- Copy rows with:
  - `time = NULL`
  - `COALESCE(..., '[]')` for JSON text columns that are now `NOT NULL DEFAULT '[]'`
  - invalid `ovulation_detected` normalized to `NULL` if needed
- Drop the old table, rename the new table, then recreate:
  - `idx_daily_logs_mare_date`
  - `idx_daily_logs_mare_date_time_unique`
  - `idx_daily_logs_mare_date_untimed_unique`
- Do not embed `BEGIN`, `COMMIT`, or `PRAGMA` statements inside the migration body because the runner already does that.

**Migration test coverage**

- fresh install through `024` has the final table shape
- upgraded `023 -> 024` database preserves rows
- migrated rows land with `time = NULL`
- `uterine_fluid.daily_log_id` remains valid
- timed unique index exists
- untimed unique index exists
- `PRAGMA foreign_key_check` still passes
- fresh install and upgraded install converge on the same `daily_logs` definition

**Acceptance criteria**

- The app can upgrade an existing production database without losing daily logs or uterine fluid rows.
- Fresh installs and upgraded installs produce the same final schema.

**Suggested verification**

- `npm test -- src/storage/migrations/index.test.ts`

### Task 4: Update daily log repository contracts and SQL

**Files**

- Modify: `src/storage/repositories/dailyLogs.ts`
- Modify: `src/storage/repositories/dailyLogs.test.ts`
- Modify: `src/storage/repositories/repositories.test.ts`

**Implementation**

- Add `time` to `DailyLogRow`.
- Add `time` to select columns and `mapDailyLogRow`.
- Split write contracts:
  - `DailyLogCreateInput` with required `time: string`
  - `DailyLogUpdateInput` with `time?: string | null`
- Update `createDailyLog`:
  - require `time`
  - validate with `normalizeDailyLogTime`
  - throw clear repo error if missing or invalid
- Update `updateDailyLog`:
  - preserve existing `time` on `undefined`
  - allow `null` only when the existing row is already untimed
  - reject clearing a timed row back to `null`
  - reject invalid time before SQLite
- Add `time` to INSERT and UPDATE SQL.
- Add time-aware ordering to:
  - `listAllDailyLogs`
  - `listDailyLogsByMare`
- Use SQL ordering equivalent to:

```sql
ORDER BY
  date DESC,
  CASE WHEN time IS NULL THEN 1 ELSE 0 END ASC,
  time DESC,
  created_at DESC,
  id DESC
```

- Keep existing ovulation, uterine-fluid, and invalidation behavior intact.

**Repository unit test coverage**

- `normalizeDailyLogTime`
- create rejects missing time
- create rejects invalid time
- update preserves existing timed value on `undefined`
- update allows untimed legacy row to stay untimed
- update allows untimed legacy row to gain time
- update rejects clearing timed row to `null`

**SQLite integration test coverage**

- same mare/date with different times is allowed
- same mare/date/time is rejected
- ordering for:
  - `16:00`
  - `08:00`
  - legacy `NULL`
- read-back includes `time`

**Acceptance criteria**

- Repository behavior enforces the spec even when future callers bypass the wizard.
- Sorting is stable for mixed timed and untimed rows.

**Suggested verification**

- `npm test -- src/storage/repositories/dailyLogs.test.ts`
- `npm test -- src/storage/repositories/repositories.test.ts`

### Task 5: Bump backup schema to v7 and update backup row shape

**Files**

- Modify: `src/storage/backup/types.ts`
- Modify: `src/storage/backup/testFixtures.ts`

**Implementation**

- Add `BACKUP_SCHEMA_VERSION_V7`.
- Set `BACKUP_SCHEMA_VERSION_CURRENT = BACKUP_SCHEMA_VERSION_V7`.
- Add `time: string | null` to the daily-log backup row type.
- Keep pre-`v7` envelope types for restore compatibility.
- Update backup fixtures to include `time` where appropriate.
- Ensure old fixture variants still model missing `time` cleanly.

**Acceptance criteria**

- Backup types reflect the real post-feature persisted shape.
- Fixtures support both old and new schema versions.

### Task 6: Update backup serializer, validator, and restore flow

**Files**

- Modify: `src/storage/backup/serialize.ts`
- Modify: `src/storage/backup/serialize.test.ts`
- Modify: `src/storage/backup/validate.ts`
- Modify: `src/storage/backup/validate.test.ts`
- Modify: `src/storage/backup/restore.ts`
- Modify: `src/storage/backup/restore.test.ts`
- Modify: `src/storage/backup/safetyBackups.test.ts`

**Implementation**

- `serialize.ts`
  - include `time` in the daily-log query
  - prefer deterministic ordering that matches app ordering closely enough for test stability
- `validate.ts`
  - for `v7`, validate `time` as `null` or valid `HH:MM`
  - for `v1-v6`, allow time to be absent
  - keep existing row-shape and FK validations intact
- `restore.ts`
  - when restoring old backups without `time`, insert `NULL`
  - when restoring `v7`, insert validated `time`
  - update the `INSERT INTO daily_logs` column list and values to include `time`
- Ensure backup round-trip does not invent times for older payloads.

**Backup test coverage**

- timed daily log survives serialize -> validate -> restore
- `v6 -> v7` restore inserts `time = NULL`
- invalid time is rejected during validation
- restore SQL includes `time`

**Acceptance criteria**

- Backup behavior is forward-compatible with the new schema and backward-compatible with older files.

**Suggested verification**

- `npm test -- src/storage/backup/serialize.test.ts src/storage/backup/restore.test.ts src/storage/backup/validate.test.ts src/storage/backup/safetyBackups.test.ts`

### Task 7: Extend wizard state, hydration, validation, and save error mapping

**Files**

- Modify: `src/hooks/useDailyLogWizard.ts`
- Modify: `src/hooks/dailyLogWizard/types.ts`
- Modify: `src/hooks/dailyLogWizard/validation.ts`
- Modify: `src/hooks/dailyLogWizard/mappers.ts`
- Create: `src/hooks/useDailyLogWizard.test.ts` or equivalent focused hook test

**Implementation**

- Add `time` state alongside `date`.
- Add `time?: string` to `BasicsErrors`.
- Update create initialization:
  - `date = today`
  - `time = getCurrentTimeHHMM()`
- Update edit initialization:
  - timed row loads saved time
  - untimed row loads blank/null
- Extend `validateBasics` to support mode-sensitive rules:
  - create: time required
  - timed edit: time required
  - untimed legacy edit: blank allowed, otherwise must be valid
- Update `hydrateDailyLogWizardRecord` to include time.
- Update `buildDailyLogPayload` to include time.
- Update save error handling in `useDailyLogWizard`:
  - map missing/invalid time errors to `errors.basics.time`
  - detect duplicate-time SQLite failures by index/constraint message
  - set inline time-field error
  - jump back to step `0`
- Keep generic non-validation errors on `Alert.alert`.

**Hook test coverage**

- create flow gets default time
- timed edit hydrates time
- untimed edit keeps blank time
- duplicate-time save error maps to basics time error and sends user to step 0
- invalid create without time never reaches repository save

**Acceptance criteria**

- The real save owner, `useDailyLogWizard`, fully owns the new error path.
- There is no duplicate-time logic misplaced in the pass-through screen wrapper.

### Task 8: Add FormTimeInput and wire wizard UI

**Files**

- Modify: `src/components/FormControls.tsx`
- Modify: `src/screens/daily-log-wizard/BasicsStep.tsx`
- Modify: `src/screens/daily-log-wizard/ReviewStep.tsx`
- Modify: `src/screens/DailyLogFormScreen.screen.test.tsx`

**Implementation**

- Add `FormTimeInput` in `FormControls.tsx`.
  - use `@react-native-community/datetimepicker`
  - `mode="time"`
  - store `HH:MM`
  - display `h:mm A`
  - allow clear only when requested
  - include `accessibilityLabel`
- Update `BasicsStep`:
  - render `Time` under `Date`
  - show error text under the time field
  - pass through `clearable` only for untimed legacy edit flows
- Update `ReviewStep`:
  - show `Time: <formatted>`
  - show `Time: -` for untimed rows
- Update the screen test to assert:
  - Basics step includes the time field
  - Review step renders time
  - mocked hook time error is visible

**Acceptance criteria**

- The wizard presents time as a first-class part of the Basics step.
- Review makes the timestamp explicit before save.

**Suggested verification**

- `npm test -- src/screens/DailyLogFormScreen.screen.test.tsx`

### Task 9: Update Daily Logs tab grouping and time rendering

**Files**

- Modify: `src/screens/mare-detail/DailyLogsTab.tsx`
- Modify: `src/screens/MareDetailScreen.screen.test.tsx`

**Implementation**

- Group daily logs by `date`.
- Render one date header per group.
- Render each card title as formatted time instead of date.
- Show `-` for untimed legacy rows.
- Keep card body contents unchanged:
  - teasing
  - edema
  - ovulation badge
  - ovary summaries
  - uterus summary
- Keep edit routing unchanged.
- Keep top add button unchanged.

**Test coverage**

- two same-day logs render under one header
- time titles are distinct and ordered newest-first
- untimed legacy row renders last with `-`

**Acceptance criteria**

- Same-day checks are visually understandable in the primary daily-log surface.

### Task 10: Update timeline events and selected-day calendar history

**Files**

- Modify: `src/utils/timelineEvents.ts`
- Modify: `src/utils/timelineEvents.test.ts`
- Modify: `src/screens/mare-detail/TimelineTab.tsx`
- Modify: `src/screens/MareCalendarScreen.screen.test.tsx`

**Implementation**

- Keep timeline event types unchanged.
- Update timeline sorting so:
  - `date DESC` still leads
  - when two daily-log-derived events are on the same date, they respect `compareDailyLogsDesc`
  - cross-type ordering still follows the existing type-priority model
- Update `TimelineTab` heat and ovulation cards so daily-log events display time, not only date, when useful.
- Ensure selected-day calendar history can distinguish two same-day daily-log-derived events.

**Test coverage**

- same-day heat and ovulation events from different log times stay stable
- selected day with multiple same-day checks renders both visibly

**Acceptance criteria**

- Calendar day history no longer collapses same-day checks into visually indistinguishable cards.

### Task 11: Make dashboard daily-log sorting and same-day follow-up logic time-aware

**Files**

- Modify: `src/utils/dashboardAlertContext.ts`
- Modify: `src/utils/dashboardAlertRules.ts`
- Modify: `src/utils/dashboardAlerts.test.ts`

**Implementation**

- Replace date-only sorting for `dailyLogsDesc` with `compareDailyLogsDesc`.
- Update recent ovulation rule:
  - same-day later log counts as follow-up
  - later date still counts as follow-up
- Update heat activity rule:
  - same-day later ovulation should suppress a heat-only alert
  - later-date ovulation should still suppress as before
- Keep window thresholds date-based.
- Do not change alert kinds or navigation targets.

**Test coverage**

- morning ovulation + afternoon same-day recheck suppresses recent-ovulation reminder
- morning heat + afternoon same-day ovulation suppresses heat alert
- old date-based cases still pass

**Acceptance criteria**

- Alert semantics remain the same except where same-day ordering should clearly matter.

### Task 12: Update dev seeds and sweep all remaining test fallout

**Files**

- Modify: `src/utils/devSeed.ts`
- Modify: any remaining failing test files from the type sweep

**Implementation**

- Update all `createDailyLog` seed calls to pass `time`.
- Add at least one same-day multi-check scenario to the dev data.
- Sweep any final TypeScript/test fallout caused by:
  - new required create input time
  - new `DailyLog.time` field
  - changed ordering assumptions

**Acceptance criteria**

- Preview and local sample data exercise the new feature.
- No stale tests rely on one-log-per-day assumptions unless that is the explicit scenario being tested.

## Final Verification

Run the normal quality gates after all feature work is complete:

- `npm run typecheck`
- `npm test`
- `npm run test:screen`
- `npm run lint`

## Manual QA Checklist

Run through these cases on device/emulator after tests pass:

1. Create a new daily log for today and confirm time defaults to the current local time.
2. Create a second log for the same mare and date with a different time; confirm both save.
3. Try to save a second log with the same mare/date/time; confirm inline time-field error.
4. Edit a timed row and change only the time; confirm ordering updates correctly.
5. Edit a legacy untimed row and leave time blank; confirm it stays untimed.
6. Edit a legacy untimed row and add a time; confirm it reorders correctly within the day.
7. Verify the Daily Logs tab groups same-day rows under one date header.
8. Verify the selected-day calendar history shows both same-day checks distinctly.
9. Verify same-day follow-up suppresses the recent-ovulation alert.
10. Verify same-day later ovulation suppresses the heat-only alert.
11. Create a backup, inspect that timed daily logs round-trip through restore, and confirm older backup fixtures still restore as untimed rows.

## Risk Checkpoints

These are the highest-risk parts of the implementation and should be verified before moving on:

- **Migration correctness:** rebuilding `daily_logs` without losing `uterine_fluid` links
- **Repository invariants:** preventing new untimed rows from being created anywhere outside migration/restore paths
- **Backup compatibility:** preserving old restore behavior while adding `time`
- **Same-day alert semantics:** not regressing existing date-window behavior while fixing same-day ordering
- **Test fallout:** widespread helper builders will need a coordinated sweep once `DailyLog.time` becomes mandatory

## Definition of Done

The feature is complete when:

- migration `024` is in place and tested
- repository create/update/list semantics match the revised spec
- backup schema is `v7` with restore compatibility for earlier versions
- the daily log wizard fully supports time entry and duplicate-time errors
- mare detail, timeline, and calendar day history clearly show same-day checks
- dashboard alerts handle same-day follow-up correctly
- seeds and tests are updated
- typecheck, unit tests, screen tests, and lint all pass
