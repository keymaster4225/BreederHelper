# Medication Log Timestamps Implementation Plan

**Date:** 2026-05-05
**Status:** Revised after adversarial review
**Roadmap Item:** `P1 - Medication log timestamps`

## Goal

Add local time-of-day capture to medication logs so same-day morning and evening
doses can be distinguished without changing date-based medication history,
calendar markings, or dashboard medication-gap logic.

The finished app should:

- require every new manual medication log to store an administration time
- preserve existing, restored, and imported legacy medication logs as untimed
- display medication date/time consistently in the Meds tab, timeline, and
  calendar day history
- sort same-day medication logs by explicit time, then stable metadata
- keep daily-log flush medication rows derived from their source daily log and
  inherit the source daily log time when available
- include medication time in full backup/restore and individual mare transfer
  exports
- restore older backups and v12 mare transfer packages with `time = NULL`

## Locked Decisions

- `MedicationLog.time` is `string | null` for backward compatibility.
- New manual medication logs require a valid administration time.
- New manual medication logs default to current local `HH:MM` using a lazy state
  initializer so time does not drift during re-renders.
- Medication time is naive local `HH:MM`, matching daily-log and breeding-record
  conventions. No timezone conversion is performed on display, backup, restore,
  or transfer.
- Editing an untimed legacy medication log may leave it untimed or add a time.
- Once a manual medication log has a time, the UI and hook do not allow clearing
  it back to `NULL`.
- Daily-log flush medication rows are derived rows owned by the daily log. Meds
  tab and timeline edit actions continue routing linked rows to `DailyLogForm`;
  user edits to linked medication rows are not supported or preserved.
- Linked flush medication rows inherit source daily log `date` and `time`.
  Legacy untimed source daily logs produce untimed linked medication rows.
- No uniqueness constraint is added for `(mare_id, date, time)` because multiple
  medications can legitimately be administered at the same time.
- Backup schema bumps from `v12` to `v13`.
- Individual mare transfer accepts current `v13` packages and legacy `v12`
  packages, normalizing missing medication time to `NULL`. Newer packages remain
  rejected.
- Untimed display is date-only. Timed display is `<date> at <time>`.
- `id DESC` is only a final display tiebreaker. IDs minted in the same
  millisecond can order by random suffix, which is acceptable for display only.

## Delivery Strategy

Implement in five waves on one feature branch:

1. Domain and shared time helpers
2. Schema and repository
3. Backup and mare transfer
4. Form and display UI
5. Tests and verification

## Task Breakdown

### Task 1: Add medication time helpers and types

**Files**

- Modify: `src/models/types.ts`
- Create: `src/utils/medicationLogTime.ts`
- Add tests: `src/utils/medicationLogTime.test.ts`

**Implementation**

- Add `time: string | null` to `MedicationLog`.
- Do not duplicate time parsing. `medicationLogTime.ts` should delegate to the
  existing `normalizeDailyLogTime`, `formatDailyLogTime`, and shared
  `ClockDisplayMode` conventions.
- Use `normalizeDailyLogTime` semantics for form and repository writes:
  - `"09:30"` accepted
  - `" 09:30 "` accepted and normalized to `"09:30"`
  - `"9:30"`, `"09:5"`, `"24:00"`, `"23:60"`, `"09:30:00"`, `""`, `null`,
    `undefined`, numbers, and booleans rejected or normalized to `null`
- Add helpers:
  - `normalizeMedicationLogTime(value: unknown): string | null`
  - `formatMedicationLogTime(time, displayMode): string`
  - `formatMedicationLogDateTime(log, displayMode): string`
  - `compareMedicationLogsDesc(a, b): number`
- Comparator order:
  - `date DESC`
  - timed rows before untimed rows
  - `time DESC`
  - `createdAt DESC`
  - `id DESC`

**Tests**

- Add per-key comparator tests for date, timed-vs-untimed, time, `createdAt`,
  and `id`.
- Add parity tests proving medication normalization matches
  `normalizeDailyLogTime` for representative valid and invalid inputs.
- Add display tests for 12-hour, 24-hour, and untimed date-only rendering.

### Task 2: Add migration `030_medication_log_time`

**Files**

- Modify: `src/storage/migrations/index.ts`
- Modify: `src/storage/migrations/index.test.ts`

**Implementation**

- Use `ALTER TABLE medication_logs ADD COLUMN time TEXT ...`; do not rebuild the
  table. This preserves existing `mares` and `daily_logs` foreign-key behavior
  without requiring `requiresForeignKeysOff`.
- Add the same `HH:MM | NULL` check used by daily logs and breeding records:

```sql
CHECK (
  time IS NULL OR (
    length(time) = 5
    AND substr(time, 3, 1) = ':'
    AND substr(time, 1, 2) BETWEEN '00' AND '23'
    AND substr(time, 4, 2) BETWEEN '00' AND '59'
  )
)
```

- Add an idempotent `ensureMedicationLogTimeColumn` helper for partial schemas.
- Keep `idx_medication_logs_mare_date` for existing date-based consumers.
- Keep `idx_medication_logs_source_daily_log_id`.
- Add `idx_medication_logs_mare_date_time` as an expression index matching the
  repository sort:

```sql
CREATE INDEX IF NOT EXISTS idx_medication_logs_mare_date_time
  ON medication_logs (
    mare_id,
    date DESC,
    (time IS NULL) ASC,
    time DESC,
    created_at DESC,
    id DESC
  );
```

- `shouldSkip` must require both the `time` column and
  `idx_medication_logs_mare_date_time`.

**Tests**

- Fresh install has the final column and indexes.
- Upgrade from pre-030 preserves rows and sets `time = NULL`.
- Running migrations twice is a no-op.
- Partial schema with column but missing index completes successfully.
- CHECK rejects invalid values such as `"25:00"`, `""`, `"09:30:00"`, and a
  non-digit malformed value such as `"ab:cd"`. If SQLite expression behavior
  makes the non-digit case hard to enforce in the table constraint, document
  repository and backup validation as the canonical enforcement layer and keep
  the DB CHECK as a coarse defensive guard.
- Existing date index and source-daily-log index remain present.

### Task 3: Update medication repositories and daily-log flush sync

**Files**

- Modify: `src/storage/repositories/medications.ts`
- Modify: `src/storage/repositories/dailyLogs.ts`
- Modify: `src/utils/devSeed.ts`
- Create: `src/storage/repositories/medications.test.ts`
- Modify: `src/storage/repositories/dailyLogs.test.ts`

**Implementation**

- Include `time` in medication row mapping, create input, update input, inserts,
  selects, and updates.
- Validate create/update time in the repository:
  - create requires valid time unless the caller is the linked flush sync path or
    an explicit legacy/import path
  - update preserves untimed legacy rows when omitted or `null`
  - update rejects clearing an already timed manual row back to `NULL`
- Repository list SQL must be explicit and match the comparator:

```sql
ORDER BY
  date DESC,
  time IS NULL ASC,
  time DESC,
  created_at DESC,
  id DESC
```

- Pass daily log `time` into `syncLinkedFlushMedicationLogs`.
- Linked flush sync remains delete-then-recreate. This is acceptable because
  linked medication logs are derived rows and are edited through the source daily
  log, not as independent medication records.
- Update preview/sample medication logs in `src/utils/devSeed.ts` with
  deterministic local `HH:MM` times so the new repository create contract does
  not break sample data seeding.
- Keep repository invalidation behavior unchanged.

**Tests**

- Manual create persists required time.
- Manual create rejects missing, blank, and malformed time.
- Timed update persists replacement time.
- Timed update rejects clearing to `NULL`.
- Untimed legacy update can remain untimed.
- Same-day rows sort with timed rows before untimed rows and later times first.
- Daily log create with N flush products creates N linked medication rows sharing
  daily log time.
- Daily log time update recreates linked medication rows with updated time.
- Untimed source daily logs produce untimed linked medication rows.

### Task 4: Update backup, restore, validation, and mare transfer

**Files**

- Modify: `src/storage/backup/types.ts`
- Modify: `src/storage/backup/serialize.ts`
- Modify: `src/storage/backup/restore.ts`
- Modify: `src/storage/backup/validate.ts`
- Modify backup fixtures and tests
- Modify: `src/storage/horseTransfer/types.ts`
- Modify: `src/storage/horseTransfer/serializeMare.ts`
- Modify: `src/storage/horseTransfer/validate.ts`
- Modify: `src/storage/horseTransfer/importHorse.ts`
- Modify: `src/storage/horseTransfer/remap.ts`
- Modify horse transfer import/remap/validate/serialize tests as needed

**Implementation**

- Add `BACKUP_SCHEMA_VERSION_V13` and set current schema to `v13`.
- Introduce a legacy medication row type without `time` for `v8` through `v12`
  backups and a current medication row type with `time`.
- Extend restore's current-shape union to include `v13`.
- Update `normalizeMedicationLogRow` so missing `time` from `v8` through `v12`
  normalizes to `null`.
- Serialize `time` in full backups and order by the explicit date/time sort.
- Validate medication `time` only for `v13+`. For `v13`, accept `HH:MM` and
  `null`; reject `""`, `"11:5"`, `"25:00"`, `"abc"`, `"09:30:00"`, number,
  boolean, and `undefined`.
- Do not reject unknown future keys inside medication row objects when the schema
  version itself is supported. Unknown keys are ignored at SQL insert boundaries.
- Update mare transfer to emit medication `time`.
- Loosen mare transfer validation to accept `dataSchemaVersion` `v12` or `v13`.
  Normalize v12 medication rows to `time = null`; keep newer-version rejection.
- Thread the source `dataSchemaVersion` into horse-transfer table validation
  instead of validating all accepted packages as the current shape. Normalize v12
  medication rows before exact current-key validation, backup-table validation,
  remapping, preview, or SQL insert planning so missing `time` cannot leak as
  `undefined`.
- Ensure `validateCurrentBackupTables` or an equivalent horse-transfer-specific
  validation path evaluates medication `time` using the accepted transfer schema
  version: v12 rows may omit `time`; v13 rows must include `time` and pass the
  v13 medication-time rules.
- Ensure horse transfer import/remap passes `time` through all medication row
  paths.

**Tests**

- Current v13 backup serialize/restore/re-serialize preserves medication time.
- v12 backup restore writes medication `time = NULL`.
- Older supported backup fixture restore still works.
- Backup validation accepts `time: "09:30"` and `time: null`.
- Backup validation rejects malformed medication times with a structured error.
- Supported backup with an unknown medication row key still validates/restores.
- Mare transfer export/import preserves medication time.
- v12 mare transfer package imports with medication `time = NULL`.
- v13 mare transfer validation accepts `time: "09:30"` and `time: null`, and
  rejects malformed values such as `"25:00"`, `"09:30:00"`, and `undefined`.
- Missing `time` in a legacy transfer row does not leak `undefined` into DB calls.

### Task 5: Update medication form and history displays

**Files**

- Modify: `src/hooks/useMedicationForm.ts`
- Modify: `src/screens/MedicationFormScreen.tsx`
- Modify: `src/screens/mare-detail/MedicationsTab.tsx`
- Create: `src/screens/mare-detail/MedicationsTab.screen.test.tsx`
- Modify: `src/screens/mare-detail/TimelineTab.tsx`
- Modify: `src/utils/timelineEvents.ts`
- Modify screen/hook tests

**Implementation**

- Add `time` state to the medication form.
- Default create mode using a lazy initializer: `getCurrentTimeHHMM()`.
- Hydrate edit mode from `record.time ?? ''` and track whether the loaded record
  had time.
- Validate time with `normalizeMedicationLogTime`.
- New records require time.
- Timed existing records require time.
- Untimed legacy records may remain untimed.
- The screen should not expose a clear action for new or timed records. Blank
  validation remains as a defensive hook/repository contract and should be tested
  at hook/repository level.
- Add `FormTimeInput` after Date with label `Time`, placeholder
  `Select administration time`, and accessibility label
  `Medication administration time`.
- If the user changes Date away from the initial default date before saving, keep
  the selected time but show no automatic conversion; this is a known naive local
  time limitation and matches breeding-record behavior.
- Save normalized `time`.
- Meds tab and timeline card titles:
  - timed: `<date> at <formatted time>`
  - untimed: `<date>`
- Wire `useClockDisplayMode()` into both MedicationsTab and TimelineTab
  medication cards.
- Update `buildTimelineEvents` so medication-vs-medication comparisons use
  `compareMedicationLogsDesc`.
- MareCalendarScreen day history reuses TimelineTab, so it inherits the same
  medication date/time rendering.
- `calendarMarking` and task source links require no behavior change.

**Tests**

- `useMedicationForm` create mode defaults to mocked current `HH:MM`.
- `useMedicationForm` rejects blank time for new records.
- `useMedicationForm` hydrates timed edits and saves replacement time.
- `useMedicationForm` allows untimed legacy edits to remain untimed.
- MedicationFormScreen renders the time field with accessibility label.
- MedicationsTab renders timed rows as date/time and untimed rows as date-only.
- MedicationsTab same-day rows display in comparator order.
- TimelineTab renders medication date/time in 12-hour and 24-hour modes.
- TimelineTab orders same-day medication events by medication comparator.
- MareCalendarScreen day detail shows the same medication card title behavior.
- Linked flush medication edit buttons still route to `DailyLogForm`.
- Use fake timers in hook and screen tests that assert default current time.
- Avoid adding or updating snapshots unless explicitly reviewed.

## Verification

Run targeted tests first, then standard gates:

```bash
npm test -- src/utils/medicationLogTime.test.ts
npm test -- src/storage/repositories/medications.test.ts src/storage/repositories/dailyLogs.test.ts
npm test -- src/storage/migrations/index.test.ts
npm test -- src/storage/backup/serialize.test.ts src/storage/backup/restore.test.ts src/storage/backup/validate.test.ts
npm test -- src/storage/horseTransfer
npm run test:screen -- MedicationFormScreen MedicationsTab TimelineTab MareCalendarScreen
npm test
npm run test:screen
npm run typecheck
npm run lint
```

Manual QA:

- Create a medication log and verify time defaults to current local time.
- Change time and save; confirm Meds tab, timeline, and calendar day history
  show `<date> at <time>`.
- Create two same-day medication logs at morning/evening times and confirm order.
- Edit a timed medication log and confirm clearing back to untimed is blocked.
- Edit a legacy untimed medication log and confirm it can remain date-only.
- Toggle 12-hour/24-hour clock preference and confirm medication displays update.
- Create or edit a daily log flush with products and confirm linked medication
  rows show the daily log time and edit actions route to DailyLogForm.
- Export and restore a v13 backup; confirm medication times survive.
- Restore a v12 backup; confirm medication times are `NULL`.
- Export/import a mare package; confirm medication times survive.
- Import a v12 mare package; confirm medication times are `NULL`.
- Attempt restore with medication `time: "garbage"` and confirm structured
  validation failure.

## Review Resolutions

- SQL ordering is explicit with `time IS NULL ASC`; no implicit SQLite NULL
  ordering is relied on.
- The old medication date index is kept for date-based consumers, while a new
  expression index supports date/time sorting.
- Migration uses `ALTER TABLE ADD COLUMN`, not rebuild.
- Backup `v13` and legacy `v8` through `v12` medication row normalization are
  explicit.
- Mare transfer version handling is loosened only for `v12` legacy packages, with
  v12 rows normalized before exact current-key validation and import planning.
- Linked flush medication logs remain derived and not independently editable.
- New timed medication logs cannot be cleared back to untimed.
