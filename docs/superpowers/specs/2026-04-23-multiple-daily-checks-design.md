# Multiple Daily Checks Per Day — Design Spec

**Date:** 2026-04-23
**Status:** Approved (pending final user review)
**Author:** Patrick (with Claude)

## Problem

Today, `daily_logs` carries a hard `UNIQUE (mare_id, date)` constraint (see `src/storage/migrations/001_initial_schema.sql:45`). A mare can have at most one daily log per calendar day.

Users — especially those inseminating with frozen semen — need to record multiple checks within a single day. Getting the insemination as close to ovulation as possible is clinically critical, and a single daily entry cannot capture the progression of a follicle from morning to afternoon, nor pin down the window in which ovulation occurred.

## Goals

1. Allow multiple daily log entries per mare per calendar date.
2. Capture a specific clock time for each check, so users can see the within-day progression (e.g., follicle 38 mm at 8 AM, 41 mm at 4 PM) and narrow the ovulation window.
3. Preserve all existing date-based features (dashboard alerts, calendar grouping, pregnant-badge derivation, stallion/mare/foaling relationships) without regression.
4. Preserve existing data: legacy single-per-day logs must continue to work untouched.

## Non-Goals

- No breeding / pregnancy / foaling record changes — they remain date-based.
- No ovulation-window ("between 8 AM and 4 PM") display. The data supports this; no UI surfaces it in this feature.
- No separate "quick recheck" form. One wizard serves all checks; non-rechecked fields stay blank.
- No calendar-indicator or dashboard-alert changes. A day with three checks still shows one calendar dot and counts as "had a log that day" for stale-log alerts.
- No time-zone handling. Times are local/naive, matching the rest of the app.
- No backfill of legacy logs' `time` field — they remain NULL until a user explicitly edits one.

## Key Decisions (from brainstorming)

| Q | Decision |
|---|---|
| 1. Primary goal? | Both: time-of-day precision for ovulation **and** intraday progression of follicle/edema/fluid. |
| 2. Time entry? | Specific clock time, defaulting to "now" at creation. |
| 3. UI organization? | Grouped by date — a date header with each check as a card beneath. |
| 4. Form surface? | One wizard for all checks; existing "fields are optional" design absorbs rechecks. No separate quick form. |
| 5. Existing logs? | Leave `time` as NULL. No backfill. UI shows em dash for missing times. |
| 6. Schema shape? | Keep `date` column, add nullable `time` column. Replace `UNIQUE (mare_id, date)` with `UNIQUE (mare_id, date, time)`. |

## Architecture & Data Model

### Schema change

New migration `002_daily_log_time.sql`:

- Add `time TEXT` column to `daily_logs`, nullable.
- `CHECK (time IS NULL OR time GLOB '[0-2][0-9]:[0-5][0-9]')` validates 24-hour `HH:MM` format.
- Drop `UNIQUE (mare_id, date)`, replace with `UNIQUE (mare_id, date, time)`.

SQLite cannot drop a UNIQUE constraint in place. The migration uses the classic rename-and-recreate pattern:

```sql
PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

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
  right_ovary_ovulation INTEGER,
  right_ovary_follicle_state TEXT,
  right_ovary_follicle_measurements_mm TEXT,
  right_ovary_consistency TEXT,
  right_ovary_structures TEXT,
  left_ovary_ovulation INTEGER,
  left_ovary_follicle_state TEXT,
  left_ovary_follicle_measurements_mm TEXT,
  left_ovary_consistency TEXT,
  left_ovary_structures TEXT,
  uterine_tone_category TEXT,
  cervical_firmness TEXT,
  discharge_observed INTEGER,
  discharge_notes TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (mare_id, date, time),
  CHECK (date GLOB '????-??-??'),
  CHECK (time IS NULL OR time GLOB '[0-2][0-9]:[0-5][0-9]'),
  CHECK (teasing_score IS NULL OR teasing_score BETWEEN 0 AND 5),
  CHECK (edema IS NULL OR edema BETWEEN 0 AND 5)
);

INSERT INTO daily_logs_new (
  id, mare_id, date, time, teasing_score, right_ovary, left_ovary,
  ovulation_detected, edema, uterine_tone, uterine_cysts,
  right_ovary_ovulation, right_ovary_follicle_state,
  right_ovary_follicle_measurements_mm, right_ovary_consistency,
  right_ovary_structures, left_ovary_ovulation, left_ovary_follicle_state,
  left_ovary_follicle_measurements_mm, left_ovary_consistency,
  left_ovary_structures, uterine_tone_category, cervical_firmness,
  discharge_observed, discharge_notes, notes, created_at, updated_at
)
SELECT
  id, mare_id, date, NULL, teasing_score, right_ovary, left_ovary,
  ovulation_detected, edema, uterine_tone, uterine_cysts,
  right_ovary_ovulation, right_ovary_follicle_state,
  right_ovary_follicle_measurements_mm, right_ovary_consistency,
  right_ovary_structures, left_ovary_ovulation, left_ovary_follicle_state,
  left_ovary_follicle_measurements_mm, left_ovary_consistency,
  left_ovary_structures, uterine_tone_category, cervical_firmness,
  discharge_observed, discharge_notes, notes, created_at, updated_at
FROM daily_logs;

DROP TABLE daily_logs;
ALTER TABLE daily_logs_new RENAME TO daily_logs;

CREATE INDEX IF NOT EXISTS idx_daily_logs_mare_date
  ON daily_logs (mare_id, date DESC);

COMMIT;

PRAGMA foreign_keys = ON;
```

Critical care:

- `uterine_fluid_pockets` has an FK to `daily_logs(id)`. `PRAGMA foreign_keys = OFF` during the rename is required; the FK is preserved because the new table keeps the same `id` column as PK.
- Migration runner records this as applied in `schema_migrations` (existing pattern).
- `001_initial_schema.sql` stays unchanged. Both fresh installs (001 → 002) and upgrades (existing 001 + 002) converge on the same end state. This follows CLAUDE.md's "canonicalize migrations across install paths" rule.

### Type changes

`src/models/types.ts` — `DailyLog`:
- Add `time: string | null`. Format `"HH:MM"` 24-hour when present; NULL for legacy rows only.

Repository write input (`DailyLogWriteInput` in `src/storage/repositories/dailyLogs.ts`):
- Add optional `time?: string | null`. Not type-required (legacy edits can omit), but the wizard always supplies it on create.

### Uniqueness & legacy semantics

- **New logs** always have a non-null `time` (default = "now" at creation). No UI path produces a NULL-time log going forward.
- **Legacy logs** keep `time = NULL` until a user explicitly edits one and fills it in.
- SQLite treats `NULL != NULL` in UNIQUE. Two NULL-time logs on the same `(mare_id, date)` are technically allowed by the DB but unreachable in practice: legacy had exactly one per date, and new logs always set a time.

### Sorting

Preferred: `ORDER BY date DESC, time DESC NULLS LAST` (plus a `created_at DESC` tiebreaker).

If the bundled SQLite version lacks `NULLS LAST`, use the equivalent CASE fallback:

```sql
ORDER BY
  date DESC,
  CASE WHEN time IS NULL THEN 1 ELSE 0 END,
  time DESC,
  created_at DESC
```

On a day with a 4 PM check, an 8 AM check, and a legacy no-time check, the render order is: 4 PM → 8 AM → (no time).

### Consumers that do **not** change

All of these operate on date, not time:

- `findMostRecentOvulationDate` — returns the date of the most recent ovulation-detected check. Any check on that date with ovulation detected qualifies.
- `src/utils/dashboardAlerts.ts` — all thresholds (ovulation within 2 days, stale log 7 days, etc.) are date-based.
- Mare calendar — still groups events by date; multiple checks on one day = one indicator.
- `src/selectors/homeScreen.ts` pregnant-badge derivation — date-based.

## UI

### Daily Log Wizard — `BasicsStep.tsx`

- Keep existing `Date` field unchanged.
- Add a new `Time` field directly below, required (for new logs), 24-hour `HH:MM` stored format.
  - New wizard: defaults to the current local time.
  - Edit of timestamped log: loads the log's time.
  - Edit of legacy NULL-time log: starts blank; saving while blank preserves NULL.
- Input control: new `FormTimeInput` component wrapping `@react-native-community/datetimepicker` with `mode="time"`, mirroring the pattern of `FormDateInput`. Display in the user's local 12-hour format (e.g., `2:05 PM`); store internally as `HH:MM`.
- Needs `accessibilityLabel` per project convention.

### Daily Log Wizard — `ReviewStep.tsx`

- Show time alongside date in the summary line (e.g., `Apr 22, 2026 · 4:15 PM`).
- Legacy edit with NULL time shows just the date, no time.

### Mare Detail — `DailyLogsTab.tsx`

- Group cards by `date`. Each group has a small date header (e.g., `Apr 22, 2026`) styled with existing `spacing` and `colors.textSecondary` tokens — no new theme work.
- Individual check card **title** becomes the time (e.g., `4:15 PM`) instead of the date. Legacy no-time cards show `—` (em dash) as the title.
- Existing card body (teasing, edema, ovulation badge, ovary summaries, uterus summary) unchanged.
- Edit pencil still navigates to `DailyLogForm` with `{ mareId, logId }`.
- "Add Daily Log" button at top of tab unchanged — just creates another check. No "there is already a check today" banner; multi-check is the point.

### Mare Calendar

- No visual change. Still one indicator per day regardless of check count.

### Home screen dashboard alerts

- No change. All alerts remain date-based.

## Repository, Hooks, Data Flow

### Repository (`src/storage/repositories/dailyLogs.ts`)

- `DailyLogRow`: add `time: string | null`.
- `DailyLogWriteInput`: add `time?: string | null`.
- Add `time` to `DAILY_LOG_SELECT_COLUMNS`, insert column list, update column list, and mapping in `mapDailyLogRow`.
- Update `ORDER BY` in `listAllDailyLogs` and `listDailyLogsByMare` per the sorting rule above.
- Add `normalizeTime(value: unknown): string | null` helper: trims, validates `HH:MM` shape, returns `null` for invalid. Never throws.

### Hook (`src/hooks/useDailyLogWizard.ts` and `src/hooks/dailyLogWizard/*`)

- Add `time` to wizard state alongside `date`.
- Initialization:
  - New wizard: current local time as `HH:MM`.
  - Edit of timestamped log: that log's `time`.
  - Edit of legacy log: `null` / empty.
- Validation: time required on create; optional on legacy edit.
- Pass `time` to `createDailyLog` / `updateDailyLog`.

### Backup pipeline (`src/storage/backup/`)

Bump backup schema to **v6** (current is v5 per commit `71df4d5`).

- `types.ts`: add `time: string | null` to the daily-log backup shape; bump version.
- `serialize.ts`: include `time` in serialized output.
- `restore.ts`: accept `time`; validate shape; write NULL if missing. Forward-compatible: v5 backups restore into v6 code with `time = NULL`.
- `validate.ts`: validate `HH:MM` format when present.
- `safetyBackups.ts`: covered by schema bump.
- `testFixtures.ts`: update fixtures.
- `*.test.ts`: round-trip, validation, cross-version (v5 → v6 restore).

### Display helpers

`src/utils/dates.ts` (or sibling):

- `formatTimeDisplay(time: string | null): string` — `"16:15"` → `"4:15 PM"`, `null` → `"—"`.
- `getCurrentTimeHHMM(): string` — current local time as `HH:MM`.

## Edge Cases & Error Handling

1. **Duplicate timestamp collision.** User creates a log at `4:15 PM`, then within the same minute taps "Add Daily Log" again — wizard defaults to `4:15 PM`, save fails on `UNIQUE (mare_id, date, time)`. The form screen save handler detects the unique-constraint error and surfaces an inline message on the **time field**: *"A check already exists for this mare at this time. Adjust the time and try again."*
2. **Legacy NULL-time edit, time left blank.** Allowed. Save preserves NULL. No warning.
3. **Legacy NULL-time edit, user fills in a time.** Allowed. If another log for that `(mare, date, time)` exists, save fails with the same duplicate-time message.
4. **Wizard-level date change that collides.** User changes date and another check already exists at that mare/date/time. Same duplicate-time error, still anchored to the time field (time is the disambiguator once date changes).
5. **Sorting with mixed legacy + new logs on the same date.** Timestamped checks first (newest → oldest), legacy no-time check last. Tiebreaker on two NULL times: `created_at DESC`.

No other new error paths. Time-format validation at the DB layer via the `CHECK` constraint is the safety net; the UI picker prevents invalid input in the happy path.

## Testing Plan

### Repository tests (`src/storage/repositories/dailyLogs.test.ts`)

- `createDailyLog` accepts two logs on same mare+date with different times.
- `createDailyLog` rejects two logs with same mare+date+time (unique constraint fires).
- `createDailyLog` rejects invalid time formats (`25:99`, `8`, `"morning"`).
- `updateDailyLog` can set time on a legacy NULL-time log.
- `listDailyLogsByMare` returns logs ordered `date DESC, time DESC`, with NULL-time last within a date group.
- `normalizeTime`: `"08:00"` → `"08:00"`, `"  08:00  "` → `"08:00"`, `"invalid"` → `null`.

### Hook tests (`src/hooks/useDailyLogWizard.*`)

- New wizard initializes `time` to current local time in `HH:MM`.
- Edit of timestamped log loads its time.
- Edit of legacy log initializes time to `null` / empty.
- Basics-step validation: time required on create, optional on legacy edit.

### Screen tests

- `DailyLogFormScreen.screen.test.tsx`: happy-path save including time; duplicate-time error rendered inline on time field.
- `MareDetailScreen.screen.test.tsx` (or the Daily Logs tab test): renders date-grouped cards with time in card title; legacy log renders with em-dash.

### Backup tests (`src/storage/backup/*.test.ts`)

- Round-trip: log with time survives serialize → restore intact.
- Forward-compat: v5 backup restores into v6 code with all logs having `time = NULL`.
- Validation: invalid time format rejected at restore.

### Migration tests (`src/storage/migrations/index.test.ts`)

- Fresh-install path (001 + 002) produces a schema with `time` column and `UNIQUE (mare_id, date, time)`.
- Upgrade path (existing 001-only DB + 002) reaches the same end state with all rows carrying `time = NULL`.
- `uterine_fluid_pockets` FKs remain intact after the rename-and-recreate.

## Files Touched

### New
- `src/storage/migrations/002_daily_log_time.sql`

### Modified
- `src/models/types.ts` — `DailyLog.time`.
- `src/storage/repositories/dailyLogs.ts` — column plumbing, `normalizeTime`, sort.
- `src/storage/repositories/dailyLogs.test.ts` — multi-check, uniqueness, ordering, validation.
- `src/storage/migrations/index.test.ts` — fresh vs upgrade parity.
- `src/hooks/useDailyLogWizard.ts` — time state / init / validation.
- `src/hooks/dailyLogWizard/*` — any sub-module that owns basics-step state.
- `src/components/FormControls.tsx` — new `FormTimeInput`.
- `src/screens/daily-log-wizard/BasicsStep.tsx` — render time field.
- `src/screens/daily-log-wizard/ReviewStep.tsx` — show time in summary.
- `src/screens/mare-detail/DailyLogsTab.tsx` — grouped rendering, time title.
- `src/screens/DailyLogFormScreen.tsx` — duplicate-time error wiring.
- `src/screens/DailyLogFormScreen.screen.test.tsx` — happy path + collision.
- `src/screens/MareDetailScreen.screen.test.tsx` — grouped rendering, em-dash legacy.
- `src/utils/dates.ts` — `formatTimeDisplay`, `getCurrentTimeHHMM`.
- `src/storage/backup/types.ts` — schema v6, shape extension.
- `src/storage/backup/serialize.ts`, `restore.ts`, `validate.ts`, `safetyBackups.ts`, `testFixtures.ts` — add `time`.
- `src/storage/backup/*.test.ts` — round-trip, forward-compat, validation.
- `src/utils/devSeed.ts` — add same-day multi-check seed examples.

## Rollout Order

1. Schema + migration + repository layer (with tests).
2. Backup schema bump + round-trip tests.
3. Type additions.
4. `FormTimeInput` + wizard hook + basics/review steps (with tests).
5. `DailyLogsTab` grouped rendering (with tests).
6. Form-screen collision error handling.
7. Dev seed update.
8. Final `npm run typecheck`, `npm test`, `npm run test:screen`, `npm run lint`.

## Success Criteria

- A user can create two or more daily logs for the same mare on the same date, each with a distinct time.
- Each check's time is captured at creation (default "now") and is editable.
- Mare Detail → Daily Logs tab shows checks grouped by date, newest-first within each day.
- Legacy logs display without a time (em dash), are editable, and can optionally gain a time via edit.
- Duplicate `(mare, date, time)` tuples are rejected with an inline, user-readable error on the time field.
- Restoring a pre-v6 backup yields the same end state (all logs NULL-time) as a fresh install that ran `002` against no existing data.
- No regressions in dashboard alerts, mare calendar, pregnant-badge derivation, or foaling/pregnancy/breeding flows — all still operate on date.

## Invariants Preserved

- Follicle measurements, ovary structures: unchanged. Time has no effect on these.
- Ovulation booleans (left/right/global): unchanged. A day with any check that has ovulation-detected = true is still an ovulation day.
- `uterine_fluid_pockets.daily_log_id → daily_logs.id` FK remains intact through the rename-and-recreate migration.
- Enum-as-`'Other'` display convention, `@/*` alias, date storage format `YYYY-MM-DD`, and icon-only button `accessibilityLabel` requirements all respected.
