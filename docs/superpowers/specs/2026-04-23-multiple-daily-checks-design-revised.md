# Multiple Daily Checks Per Day - Revised Design Spec

**Date:** 2026-04-23  
**Status:** Draft for review  
**Author:** Codex  
**Supersedes:** `docs/superpowers/specs/2026-04-23-multiple-daily-checks-design.md`

## Problem

`daily_logs` still enforces one row per mare per calendar date through the original `UNIQUE (mare_id, date)` constraint introduced in migration `001` and carried forward by later migrations. That prevents users from recording more than one reproductive check on the same day.

This is no longer adequate for mares that are checked multiple times in a day, especially around frozen AI timing. Users need to record within-day progression such as:

- follicle growth between morning and afternoon checks
- same-day heat and ovulation changes
- a later same-day ultrasound that should count as follow-up after an earlier ovulation finding

The prior draft captured the product intent, but it was written against an outdated view of this codebase. This revision is aligned to the current app state:

- migrations are registered inline in `src/storage/migrations/index.ts` and currently run through `023`
- backup schema is already `v6`
- the daily log wizard is now the real save surface
- dashboard and timeline consumers contain date-only ordering assumptions that need targeted fixes

## Goals

1. Allow multiple daily log entries for the same mare on the same `date`.
2. Capture a specific local clock time for each new check using `HH:MM` storage.
3. Preserve existing untimed legacy rows without backfilling guessed times.
4. Keep date-based downstream behavior intact where time does not materially change meaning.
5. Make fresh installs, upgrades, and backup restores converge on the same final schema and runtime behavior.

## Non-Goals

- No breeding, pregnancy, foaling, medication, or frozen semen schema changes.
- No ovulation-window inference UI such as "ovulated between 8 AM and 4 PM".
- No second "quick recheck" form; the existing wizard remains the only form surface.
- No per-check calendar dots; calendar markings stay grouped by day.
- No time-zone conversion feature; `time` remains a naive local wall-clock field, consistent with the rest of the app.
- No bulk backfill from `created_at`; existing logs remain untimed until a user edits them.

## Key Decisions

| Topic | Decision |
|---|---|
| Stored shape | Keep `date` and add nullable `time TEXT` in `HH:MM` format. |
| Legacy representation | Existing rows migrate to `time = NULL`. |
| New-row invariant | All newly created daily logs must have a valid non-null `time`. |
| DB uniqueness | Use two partial unique indexes: one for timed rows and one for untimed legacy rows. |
| Display model | Daily Logs tab groups by date and shows time on each card. |
| Alert behavior | Alert windows remain date-based, but same-day follow-up ordering becomes time-aware where needed. |
| Migration strategy | Add inline `migration024` in `src/storage/migrations/index.ts` and rebuild `daily_logs` to the current canonical schema plus `time`. |
| Backup version | Bump backup schema from `v6` to `v7`. |

## Architecture & Data Model

### Migration registration

Add a new inline migration in `src/storage/migrations/index.ts`:

- `id: 24`
- `name: '024_daily_logs_multiple_checks'`
- `requiresForeignKeysOff: true`
- `shouldSkip`: return `true` only when:
  - `daily_logs.time` exists
  - `idx_daily_logs_mare_date_time_unique` exists
  - `idx_daily_logs_mare_date_untimed_unique` exists

This follows the real migration system already used by the app. Do not add a standalone `002_*.sql` file and do not embed `BEGIN`, `COMMIT`, or `PRAGMA` statements inside the migration string; the runner already owns transaction boundaries and foreign-key toggling.

### Schema change

`migration024` rebuilds `daily_logs` from the current post-`021` schema, adds `time`, and replaces the old table-level unique constraint.

New `daily_logs` shape:

```sql
CREATE TABLE daily_logs_new (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  teasing_score INTEGER,
  right_ovary TEXT,
  left_ovary TEXT,
  ovulation_detected INTEGER,
  edema INTEGER,
  uterine_tone TEXT,
  uterine_cysts TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  right_ovary_ovulation INTEGER
    CHECK (right_ovary_ovulation IS NULL OR right_ovary_ovulation IN (0, 1)),
  right_ovary_follicle_state TEXT
    CHECK (
      right_ovary_follicle_state IS NULL
      OR right_ovary_follicle_state IN (
        'notVisualized', 'small', 'medium', 'large', 'measured', 'postOvulatory'
      )
    ),
  right_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT '[]',
  right_ovary_consistency TEXT
    CHECK (
      right_ovary_consistency IS NULL
      OR right_ovary_consistency IN ('soft', 'moderate', 'firm', 'veryFirm')
    ),
  right_ovary_structures TEXT NOT NULL DEFAULT '[]',
  left_ovary_ovulation INTEGER
    CHECK (left_ovary_ovulation IS NULL OR left_ovary_ovulation IN (0, 1)),
  left_ovary_follicle_state TEXT
    CHECK (
      left_ovary_follicle_state IS NULL
      OR left_ovary_follicle_state IN (
        'notVisualized', 'small', 'medium', 'large', 'measured', 'postOvulatory'
      )
    ),
  left_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT '[]',
  left_ovary_consistency TEXT
    CHECK (
      left_ovary_consistency IS NULL
      OR left_ovary_consistency IN ('soft', 'moderate', 'firm', 'veryFirm')
    ),
  left_ovary_structures TEXT NOT NULL DEFAULT '[]',
  uterine_tone_category TEXT
    CHECK (
      uterine_tone_category IS NULL
      OR uterine_tone_category IN ('flaccid', 'moderate', 'tight')
    ),
  cervical_firmness TEXT
    CHECK (
      cervical_firmness IS NULL
      OR cervical_firmness IN ('soft', 'moderate', 'firm', 'closed')
    ),
  discharge_observed INTEGER
    CHECK (discharge_observed IS NULL OR discharge_observed IN (0, 1)),
  discharge_notes TEXT,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (
    time IS NULL
    OR time GLOB '[0-1][0-9]:[0-5][0-9]'
    OR time GLOB '2[0-3]:[0-5][0-9]'
  ),
  CHECK (teasing_score IS NULL OR teasing_score BETWEEN 0 AND 5),
  CHECK (edema IS NULL OR edema BETWEEN 0 AND 5),
  CHECK (ovulation_detected IS NULL OR ovulation_detected IN (0, 1))
);
```

Data copy behavior:

- Copy all existing rows into `daily_logs_new`.
- Set `time = NULL` for migrated rows.
- Preserve current `id` values so `uterine_fluid.daily_log_id -> daily_logs.id` remains valid.
- Coalesce legacy JSON text columns to their canonical defaults during copy:
  - `COALESCE(right_ovary_follicle_measurements_mm, '[]')`
  - `COALESCE(right_ovary_structures, '[]')`
  - `COALESCE(left_ovary_follicle_measurements_mm, '[]')`
  - `COALESCE(left_ovary_structures, '[]')`
- Normalize any invalid legacy `ovulation_detected` values to `NULL` during copy rather than letting the migration fail on a new `CHECK`.

After rename, recreate indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_daily_logs_mare_date
  ON daily_logs (mare_id, date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_time_unique
  ON daily_logs (mare_id, date, time)
  WHERE time IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_untimed_unique
  ON daily_logs (mare_id, date)
  WHERE time IS NULL;
```

Why partial unique indexes instead of `UNIQUE (mare_id, date, time)`:

- they preserve the intended `NULL` semantics for legacy rows
- they prevent two untimed rows on the same day
- they avoid relying on "unreachable in practice" behavior

### Type changes

`src/models/types.ts`

- Add `time: string | null` to `DailyLog`
- Add `time: string | null` to `DailyLogDetail` through inheritance

This field should be non-optional in TypeScript so every caller has to account for timed and untimed rows explicitly.

### Repository input contracts

Split the write contract instead of keeping one overly-permissive type:

- `DailyLogCreateInput`
  - same fields as today
  - `time: string` required
- `DailyLogUpdateInput`
  - same fields as today
  - `time?: string | null`

Repository rules:

- `createDailyLog` throws before SQLite if `time` is missing or invalid
- `updateDailyLog`
  - preserves existing `time` when `time === undefined`
  - accepts `time = null` only when the existing row is already untimed
  - rejects `time = null` for rows that already have a time
  - rejects invalid `HH:MM` values before SQLite

This prevents new untimed rows from being created outside the wizard, including through seeds, tests, or future call sites.

## Shared Utilities

Add a focused utility module, preferably `src/utils/dailyLogTime.ts`, for logic shared across repository and UI code:

- `isDailyLogTime(value: string): boolean`
- `normalizeDailyLogTime(value: unknown): string | null`
- `getCurrentTimeHHMM(): string`
- `formatDailyLogTime(time: string | null): string`
  - `16:15 -> 4:15 PM`
  - `null -> -`
- `compareDailyLogsDesc(a, b): number`
  - `date DESC`
  - timed rows before untimed rows on the same date
  - `time DESC`
  - `createdAt DESC`
  - `id DESC` final tiebreaker

This comparator is important because the app sorts some daily logs in memory, not just in SQL.

## Repository, Hooks, and Data Flow

### Repository

`src/storage/repositories/dailyLogs.ts`

- Add `time` to `DailyLogRow`
- Add `time` to select columns, row mapping, insert SQL, and update SQL
- Use `normalizeDailyLogTime` for both create and update validation
- Export or locally define a reusable SQL `ORDER BY` fragment equivalent to:

```sql
ORDER BY
  date DESC,
  CASE WHEN time IS NULL THEN 1 ELSE 0 END ASC,
  time DESC,
  created_at DESC,
  id DESC
```

- Apply that ordering to:
  - `listAllDailyLogs`
  - `listDailyLogsByMare`

### Wizard state

`src/hooks/useDailyLogWizard.ts` and `src/hooks/dailyLogWizard/*`

- Add `time` to wizard state
- Add `time` to basics-step errors
- Initialization rules:
  - create: default to `getCurrentTimeHHMM()`
  - edit timed row: load saved time
  - edit untimed legacy row: start blank
- Validation rules:
  - create: `time` required and must be valid
  - edit timed row: `time` required and must be valid
  - edit untimed legacy row: blank is allowed, otherwise value must be valid
- Include `time` in `hydrateDailyLogWizardRecord`
- Include `time` in `buildDailyLogPayload`

### Duplicate-time error handling

The save logic already lives in `useDailyLogWizard`, not in `DailyLogFormScreen`.

On save:

- if the repository throws a missing/invalid time error:
  - set `errors.basics.time`
  - jump back to step 0
- if SQLite throws a unique constraint on either new daily-log uniqueness index:
  - set `errors.basics.time = 'A check already exists for this mare at this time. Adjust the time and try again.'`
  - jump back to step 0
- generic unexpected save failures still use `Alert.alert`

`src/screens/DailyLogFormScreen.tsx` remains a pass-through wrapper.

## UI

### `FormTimeInput`

Add `FormTimeInput` to `src/components/FormControls.tsx`.

Behavior:

- wraps `@react-native-community/datetimepicker` with `mode="time"`
- stores `HH:MM`
- displays `h:mm A`
- has `accessibilityLabel`
- supports a `clearable` mode only for untimed legacy edit flows

### Daily Log Wizard - Basics step

`src/screens/daily-log-wizard/BasicsStep.tsx`

- Keep existing `Date` field
- Add `Time` directly below `Date`
- Show validation error under the field
- Use label copy that makes the legacy case clear when editing an untimed row:
  - normal create/edit: required
  - legacy untimed edit: optional

### Daily Log Wizard - Review step

`src/screens/daily-log-wizard/ReviewStep.tsx`

- Basics summary becomes:
  - `Date: 2026-04-22`
  - `Time: 4:15 PM`
  - `Teasing: 3`
- untimed legacy row shows `Time: -`

### Mare Detail - Daily Logs tab

`src/screens/mare-detail/DailyLogsTab.tsx`

- Group logs by `date`
- Each date group renders a header once
- Each card title becomes the formatted time
- untimed legacy cards render `-`
- card body remains unchanged
- "Add Daily Log" button remains the only add action

### Mare Calendar and day history

Calendar dots remain unchanged:

- multiple checks on one day still produce one dot per event type per day

Selected-day history needs a small but real update:

- `src/screens/mare-detail/TimelineTab.tsx` should render daily-log-derived cards with time visible so same-day checks are distinguishable
- when two daily-log events share a date, sort those daily-log events using `compareDailyLogsDesc`
- keep existing date/type ordering for cross-type events because breeding, foaling, pregnancy checks, and medications still have no time field

## Downstream Behavior

### Consumers that remain date-based

These do not need semantic changes:

- `findMostRecentOvulationDate`
- pregnancy calculations derived from ovulation date
- pregnant-badge derivation on the home screen
- stale-log thresholds based on latest log `date`
- calendar dot grouping by day

### Consumers that need ordering fixes

These should stay date-based in meaning, but become time-aware when comparing two logs on the same date:

#### Dashboard alert context

`src/utils/dashboardAlertContext.ts`

- replace generic `sortByDateDesc` usage for `dailyLogsDesc`
- use `compareDailyLogsDesc` for daily logs only

#### Recent ovulation alert

`src/utils/dashboardAlertRules.ts`

Current behavior only treats later-date logs as follow-up. That is insufficient once same-day rechecks exist.

Revised rule:

- the alert still triggers from an ovulation-detected log within the existing date window
- any later daily log for that mare counts as follow-up if:
  - `log.date > ovulationLog.date`, or
  - `log.date === ovulationLog.date` and it sorts later via `compareDailyLogsDesc`

#### Heat activity alert

Also in `src/utils/dashboardAlertRules.ts`

Revised rule:

- heat remains based on `teasingScore >= 4` or `edema >= 4`
- ovulation suppression must treat a later same-day ovulation log as "after heat" even when the dates match

This keeps the alert logic date-based in its windows while fixing same-day false positives.

## Backup and Restore

### Version bump

Current backup schema is already `v6`. This feature bumps it to `v7`.

Files:

- `src/storage/backup/types.ts`
- `src/storage/backup/serialize.ts`
- `src/storage/backup/restore.ts`
- `src/storage/backup/validate.ts`
- `src/storage/backup/testFixtures.ts`
- related backup tests

### Backup row shape

Add `time: string | null` to the daily-log backup row.

### Serialize

Include `time` in daily-log export queries and keep output deterministic. Daily log export ordering should match app ordering as closely as practical.

### Restore

Restore behavior:

- `v1` through `v6`: if `time` is absent, restore `time = NULL`
- `v7`: validate and restore `time`

### Validate

Validation rules:

- `time` may be `null`
- otherwise must be valid `HH:MM`

## Seeds and Fixtures

`createDailyLog` will require time for all new rows, so every non-legacy creator must be updated.

At minimum:

- `src/utils/devSeed.ts`
- SQLite-backed repository tests that create daily logs
- all fixture helpers that construct `DailyLog` objects in unit tests

Add at least one same-day seed example for preview/demo data so the feature is visible in manual QA.

## Edge Cases

1. **Duplicate same-minute create**
   - second create with the same `mare_id`, `date`, and `time` is rejected
   - wizard shows inline time-field error

2. **Legacy untimed row left blank on edit**
   - allowed
   - saves with `time = NULL`

3. **Legacy untimed row gets a time**
   - allowed
   - uniqueness checked against timed rows on the same day

4. **Timed row cleared back to blank**
   - not allowed
   - UI should not offer this path
   - repository rejects explicit `null`

5. **Same-day follow-up after ovulation**
   - later same-day check suppresses "recent ovulation" reminder

6. **Same-day ovulation after earlier heat**
   - later same-day ovulation suppresses stale heat-only alerting for that date

7. **Old backups**
   - restore to untimed rows without manufacturing fake times

## Testing Plan

### Migration tests

`src/storage/migrations/index.test.ts`

- fresh-install path through `024` yields:
  - `daily_logs.time`
  - partial unique indexes for timed and untimed rows
- upgrade path from an existing `023` database with daily logs and uterine fluid rows:
  - preserves all rows
  - migrates all old rows to `time = NULL`
  - preserves `uterine_fluid.daily_log_id`
- `PRAGMA foreign_key_check` still passes after migration

### Repository integration tests

Use the real SQLite-backed repository test file for actual uniqueness behavior:

`src/storage/repositories/repositories.test.ts`

- allows two logs for the same mare/date with different times
- rejects duplicate mare/date/time
- rejects create without time before SQLite
- preserves `NULL` time on legacy-style update
- updates untimed legacy row to a real time
- returns same-day logs in expected order

### Repository unit tests

`src/storage/repositories/dailyLogs.test.ts`

- `normalizeDailyLogTime`
- row mapping for `time`
- explicit repository validation branches

### Wizard tests

Add focused tests around the real owner of the save logic:

- `src/hooks/useDailyLogWizard.test.ts` or equivalent hook-level test
  - create initializes time to now
  - edit timed row loads time
  - edit untimed row stays blank
  - duplicate-time save maps error to `errors.basics.time`

### Screen tests

- `src/screens/DailyLogFormScreen.screen.test.tsx`
  - Basics step renders Time field
  - Review step shows formatted time
  - mocked hook error renders under Time field
- `src/screens/MareDetailScreen.screen.test.tsx`
  - Daily Logs tab groups by date
  - same-day cards show distinct times
  - untimed legacy row shows `-`
- `src/screens/MareCalendarScreen.screen.test.tsx` or timeline tests
  - selected day with two same-day daily logs renders both with visible times

### Alert and timeline tests

- `src/utils/dashboardAlerts.test.ts`
  - same-day later check counts as follow-up after ovulation
  - same-day later ovulation suppresses heat-only alert
- `src/utils/timelineEvents.test.ts`
  - same-day daily log ordering stays stable and visible

### Backup tests

- serialize/restore round-trip with timed daily log
- `v6 -> v7` restore preserves `time = NULL`
- invalid time rejected during restore validation

### Test-factory updates

Because `DailyLog.time` becomes non-optional in TypeScript, update helper builders that fabricate `DailyLog` objects. At minimum this touches tests under:

- `src/models/types.test.ts`
- `src/selectors/homeScreen.test.ts`
- `src/utils/calendarMarking.test.ts`
- `src/utils/dashboardAlerts.test.ts`
- `src/utils/dailyLogDisplay.test.ts`
- `src/utils/timelineEvents.test.ts`

Default these builders to `time: null` unless a test needs an explicit time.

## Files Expected To Change

### New

- `src/utils/dailyLogTime.ts`
- test file for the new utility, if split out

### Modified

- `src/storage/migrations/index.ts`
- `src/storage/migrations/index.test.ts`
- `src/models/types.ts`
- `src/storage/repositories/dailyLogs.ts`
- `src/storage/repositories/dailyLogs.test.ts`
- `src/storage/repositories/repositories.test.ts`
- `src/hooks/useDailyLogWizard.ts`
- `src/hooks/dailyLogWizard/types.ts`
- `src/hooks/dailyLogWizard/validation.ts`
- `src/hooks/dailyLogWizard/mappers.ts`
- `src/components/FormControls.tsx`
- `src/screens/daily-log-wizard/BasicsStep.tsx`
- `src/screens/daily-log-wizard/ReviewStep.tsx`
- `src/screens/mare-detail/DailyLogsTab.tsx`
- `src/screens/mare-detail/TimelineTab.tsx`
- `src/screens/DailyLogFormScreen.screen.test.tsx`
- `src/screens/MareDetailScreen.screen.test.tsx`
- `src/screens/MareCalendarScreen.screen.test.tsx`
- `src/utils/dashboardAlertContext.ts`
- `src/utils/dashboardAlertRules.ts`
- `src/utils/dashboardAlerts.test.ts`
- `src/utils/timelineEvents.ts`
- `src/utils/timelineEvents.test.ts`
- `src/storage/backup/types.ts`
- `src/storage/backup/serialize.ts`
- `src/storage/backup/restore.ts`
- `src/storage/backup/validate.ts`
- `src/storage/backup/testFixtures.ts`
- backup test files
- `src/utils/devSeed.ts`
- test builders that construct `DailyLog` values

## Rollout Order

1. Add shared time utility and type changes.
2. Implement `migration024` and migration tests.
3. Update repository contracts and integration tests.
4. Update backup schema to `v7` and restore/validate coverage.
5. Update wizard state, validation, and save-error mapping.
6. Add `FormTimeInput` and wire Basics/Review steps.
7. Update Daily Logs tab and same-day timeline rendering.
8. Fix dashboard same-day ordering behavior.
9. Update seeds and test factories.
10. Run `npm run typecheck`, `npm test`, `npm run test:screen`, and `npm run lint`.

## Success Criteria

- A user can save multiple daily logs for the same mare and date as long as each timed entry is unique.
- New daily logs cannot be created without a valid time.
- Existing legacy rows remain untimed until edited.
- Daily Logs tab shows same-day checks grouped under one date header with visible times.
- Selected-day calendar history distinguishes same-day checks.
- Same-day later checks correctly count as follow-up in dashboard alerts.
- Backups restore consistently across pre-`v7` and `v7` payloads.
- Fresh installs and upgraded installs converge on the same final `daily_logs` schema and index set.

## Invariants Preserved

- `date` storage remains canonical `YYYY-MM-DD`.
- `uterine_fluid.daily_log_id -> daily_logs.id` remains intact.
- pregnancy, breeding, foaling, and medication records remain date-only.
- `findMostRecentOvulationDate` still returns a date, not a time.
- calendar dots remain deduplicated per day and event type.
