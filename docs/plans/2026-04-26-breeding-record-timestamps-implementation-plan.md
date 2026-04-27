# Breeding Record Timestamps Implementation Plan

**Date:** 2026-04-26  
**Status:** Ready for implementation after adversarial review fixes  
**Roadmap Item:** `P1 - Breeding record timestamps`

## Goal

Add a local time field to breeding records so same-day services can be recorded,
displayed, selected, and sorted accurately without changing date-based
reproductive calculations.

The finished app should:

- require a time for newly created breeding records
- preserve existing legacy breeding records as untimed
- distinguish same-day breeding records in mare history, calendar day history,
  pregnancy and foaling record pickers, stallion history, and breeding event detail
- sort same-day breeding records by time where the app needs "latest" or
  chronological display behavior
- keep DPO, pregnancy windows, estimated foaling dates, and foaling linkage date
  calculations date-based
- restore older backups cleanly with untimed breeding records

## Repo Fit

This plan is grounded in the current codebase:

- Breeding record domain shape lives in `src/models/types.ts`.
- Breeding record persistence lives in `src/storage/repositories/breedingRecords.ts`.
- Migration state currently runs through migration `025_daily_log_flush_follow_up`.
- Backup schema currently runs through `BACKUP_SCHEMA_VERSION_V9`.
- Existing local time parsing and display behavior lives in `src/utils/dailyLogTime.ts`
  and `src/components/FormControls.tsx` through `FormTimeInput`.
- Clock preference display behavior is handled by `useClockDisplayMode` from
  `src/hooks/useClockPreference.tsx`.
- Breeding record create/edit UI is owned by:
  - `src/hooks/useBreedingRecordForm.ts`
  - `src/screens/BreedingRecordFormScreen.tsx`
- Breeding record consumers include:
  - `src/screens/mare-detail/BreedingTab.tsx`
  - `src/screens/mare-detail/TimelineTab.tsx`
  - `src/screens/BreedingEventDetailScreen.tsx`
  - `src/screens/stallion-detail/BreedingHistoryTab.tsx`
  - `src/hooks/useMareCalendarData.ts`
  - `src/hooks/usePregnancyCheckForm.ts`
  - `src/screens/PregnancyCheckFormScreen.tsx`
  - `src/hooks/useFoalingRecordForm.ts`
  - `src/screens/FoalingRecordFormScreen.tsx`
  - `src/utils/timelineEvents.ts`
  - `src/utils/dashboardAlertContext.ts`

This work should extend the existing daily-log time conventions instead of
creating a separate time format.

## Locked Implementation Assumptions

- `BreedingRecord.time` is `string | null`.
- Storage format is naive local `HH:MM`.
- Existing rows migrate with `time = NULL`.
- New breeding records require a valid `HH:MM` time.
- Editing an already timed record requires either a valid replacement time or an
  explicit confirmed clear to `NULL`.
- Editing any existing record may clear time back to `NULL`, but the UI must ask
  for confirmation before removing a previously saved time.
- The create form defaults time to the current local time.
- Collection-wizard on-farm allocation rows must capture their own event time;
  they must not silently stamp back-dated allocations with the current time.
- No database uniqueness constraint is added for `(mare_id, date, time)`.
- Same-day ties sort by `created_at DESC`, then `id DESC`.
- Date-based domain calculations remain date-only.
- All breeding record times are naive local times; backup/restore preserves the
  literal `HH:MM` string with no timezone conversion.
- Backup schema bumps from `v9` to `v10`.
- This feature owns backup `v10` in the current delivery sequence. The Photos V1
  plan currently refers to backup `v10`; if timestamps land first, Photos V1 must
  rebase to `v11`.
- There is no bulk backfill UX for legacy untimed records. Per-record edit is the
  only path to add a time to historical rows in this feature.

## Delivery Strategy

Implement in six waves so schema and backup contracts land before UI consumers
start depending on the new field. These waves are sequencing inside one feature
branch, not suggested PR boundaries. The form changes and display/order changes
must ship together so new records do not store time without rendering it.

1. Foundation contracts
2. Schema and repository
3. Backup and restore
4. Form UI and save flow
5. Display, selection labels, and ordering consumers
6. Verification and manual QA

## Task Breakdown

### Task 1: Add shared breeding time helpers

**Files**

- Create or modify: `src/utils/breedingRecordTime.ts`
- Modify if extracting shared logic: `src/utils/dailyLogTime.ts`
- Add tests: `src/utils/breedingRecordTime.test.ts`

**Implementation**

- Reuse the existing `HH:MM` normalization rules from `dailyLogTime`.
- Add helpers for breeding records:
  - `normalizeBreedingRecordTime(value: unknown): string | null`
  - `isBreedingRecordTime(value: string): boolean`
  - `formatBreedingRecordTime(time: string | null, displayMode?: '12h' | '24h'): string`
  - `formatBreedingRecordDateTime(record, displayMode): string`
  - `compareBreedingRecordsDesc(a, b): number`
- The comparator must sort:
  - `date DESC`
  - timed rows before untimed rows for the same date
  - `time DESC`
  - `createdAt DESC`
  - `id DESC`
- Avoid copying the time parser if a small shared base helper can keep daily-log
  and breeding-record behavior identical.

**Acceptance criteria**

- Breeding record time validation matches daily-log time validation.
- Display respects 12-hour and 24-hour modes.
- Untimed legacy records display cleanly as date-only or with an explicit
  `Untimed` label where the UI needs disambiguation.

**Suggested verification**

```bash
npm test -- src/utils/breedingRecordTime.test.ts
```

### Task 2: Update domain types and test factories

**Files**

- Modify: `src/models/types.ts`
- Modify test helpers that fabricate `BreedingRecord` objects

**Implementation**

- Add `time: string | null` to `BreedingRecord`.
- Update all local test factory helpers to provide `time: null` by default unless
  the test is specifically about ordering or display.
- Keep `calculateDaysPostBreeding`, `estimateFoalingDate`,
  `findMostRecentOvulationDate`, and pregnancy helper behavior date-based.

**Acceptance criteria**

- TypeScript forces all breeding record callsites and test helpers to acknowledge
  timed vs untimed records.
- No reproductive calculation starts depending on time.

### Task 3: Add migration `026_breeding_record_time`

**Files**

- Modify: `src/storage/migrations/index.ts`
- Modify: `src/storage/migrations/index.test.ts`

**Implementation**

- Add migration `026_breeding_record_time`.
- Add nullable `time TEXT` to `breeding_records`.
- Use the exact daily-log time `CHECK` shape from migration `024`, substituting
  the breeding record column name:

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

- Rebuild `breeding_records` if needed to enforce the check consistently across
  fresh installs and upgrades.
- Preserve all current columns and foreign keys:
  - `collection_id` references `semen_collections(id)` with
    `ON UPDATE CASCADE ON DELETE RESTRICT`
  - existing pregnancy and foaling references remain valid
- Replace the old date-only indexes with date/time indexes:
  - drop `idx_breeding_records_mare_date`
  - drop `idx_breeding_records_stallion_date`
  - create `idx_breeding_records_mare_date_time` on
    `(mare_id, date DESC, time DESC, created_at DESC, id DESC)`
  - create `idx_breeding_records_stallion_date_time` on
    `(stallion_id, date DESC, time DESC, created_at DESC, id DESC)`
- Add `shouldSkip` checks for the `time` column, both new indexes, and absence
  of the two superseded date-only indexes. Do not skip if the old indexes are
  still present.
- Migrate existing rows with `time = NULL`.

**Migration test coverage**

- Fresh install has the final `breeding_records` shape.
- Upgrade from `025` preserves all breeding rows.
- Upgraded rows have `time = NULL`.
- Invalid time strings fail the table constraint.
- Empty string time fails the table constraint.
- Both date/time indexes exist.
- The superseded date-only indexes no longer exist after the migration.
- `PRAGMA foreign_key_check` still passes.
- Fresh install and upgraded install converge on the same table definition.

**Acceptance criteria**

- Existing production data upgrades without losing breeding, pregnancy, foaling,
  or collection links.
- Migration can safely rerun or skip in partially upgraded local schemas.

**Suggested verification**

```bash
npm test -- src/storage/migrations/index.test.ts
```

### Task 4: Update breeding record repository contracts

**Files**

- Modify: `src/storage/repositories/breedingRecords.ts`
- Modify: `src/storage/repositories/breedingRecords.test.ts`
- Modify: `src/storage/repositories/repositories.test.ts`
- Modify fake DB row shapes in repository tests

**Implementation**

- Add `time` to `BreedingRecordRow`.
- Map `row.time` to `BreedingRecord.time`.
- Add `time?: string | null` to create and update input types.
- `createBreedingRecord` must reject `null`, empty, whitespace-padded, or
  invalid time. Explicit rejected examples: `''`, `'8:00'`, `'08:00 '`, and
  `'24:00'`.
- `updateBreedingRecord` should:
  - load the existing row
  - reject invalid provided time
  - allow `time = NULL` for any existing row only when the caller intentionally
    passes `null`
  - rely on the form layer to confirm clearing a previously saved time
- Include `time` in every SELECT, INSERT, and UPDATE statement.
- Update list ordering:
  - all breeding records
  - by mare
  - by stallion
  - legacy stallion-name matches
- SQL ordering must match the shared comparator's sort tuple:
  - `ORDER BY date DESC, time DESC, created_at DESC, id DESC`
- This intentionally relies on SQLite's `DESC` ordering placing `NULL` after
  non-null time values. Add a repository test that compares SQL result order to
  `compareBreedingRecordsDesc` for the same records.

**Acceptance criteria**

- Repository reads and writes preserve time.
- New records cannot be created untimed through repository APIs.
- Existing rows can be intentionally cleared or preserved as untimed during edit.
- Same-day list queries return later timed records first.
- SQL list order and the in-memory comparator produce the same order for
  timed-late, timed-early, untimed-newer, and untimed-older same-day records.

**Suggested verification**

```bash
npm test -- src/storage/repositories/breedingRecords.test.ts
npm test -- src/storage/repositories/repositories.test.ts
```

### Task 5: Update generated and seeded breeding record writes

**Files**

- Modify: `src/storage/repositories/collectionWizard.ts`
- Modify: `src/storage/repositories/collectionWizard.test.ts`
- Modify: `src/hooks/useCollectionWizard.ts`
- Modify: `src/screens/collection-wizard/OnFarmMareRowEditor.tsx`
- Modify: `src/screens/CollectionWizardScreen.screen.test.tsx`
- Modify: `src/utils/devSeed.ts`
- Modify any other direct `createBreedingRecord` callers

**Implementation**

- Any user-facing creation path that creates a breeding record must supply a
  valid local `HH:MM` time.
- Extend collection-wizard on-farm allocation drafts with `eventTime`.
- The on-farm row editor must render a time input next to the event date.
- Default `eventTime` to the current local time only when the row's `eventDate`
  is today.
- For back-dated on-farm rows, leave `eventTime` blank and require the user to
  choose the actual event time before save.
- Persist `eventTime` into the linked breeding record created by
  `insertOnFarmAllocation`.
- Do not use the collection save timestamp, app current time, or collection date
  as a hidden substitute for an allocation's event time.
- Dev seed data should use deterministic fixture times.
- Repository tests should use deterministic fixture times.

**Acceptance criteria**

- No production breeding-record create path, including direct collection-wizard
  inserts, writes a new row without time.
- Collection wizard on-farm breeding records use the user-selected allocation
  time, including for back-dated rows.
- Tests do not depend on the actual current time unless intentionally testing
  defaulting behavior.

### Task 6: Bump backup schema to `v10`

**Files**

- Modify: `src/storage/backup/types.ts`
- Modify: `src/storage/backup/serialize.ts`
- Modify: `src/storage/backup/restore.ts`
- Modify: `src/storage/backup/validate.ts`
- Modify: `src/storage/backup/testFixtures.ts`
- Modify backup tests under `src/storage/backup/*.test.ts`

**Implementation**

- Add `BACKUP_SCHEMA_VERSION_V10`.
- Set `BACKUP_SCHEMA_VERSION_CURRENT = BACKUP_SCHEMA_VERSION_V10`.
- Mirror the existing daily-log backup type evolution:
  - rename the current no-time shape to `BackupBreedingRecordRowLegacy`
  - add `BackupBreedingRecordRowV10 = BackupBreedingRecordRowLegacy & { readonly time: string | null }`
  - make `BackupBreedingRecordRow` alias the current V10 row shape
  - keep `BackupTablesV1` through `BackupTablesV9` pointing at
    `BackupBreedingRecordRowLegacy`
  - add `BackupTablesV10` with `breeding_records:
    readonly BackupBreedingRecordRowV10[]`
  - add `BackupEnvelopeV10`
- Serialize `breeding_records.time`.
- Restore `breeding_records.time`.
- Add `normalizePreV10BreedingRecordRow` in `restore.ts` and normalize backups
  `v1` through `v9` with `time: null`.
- Add `time` to the `insertBreedingRecord` SQL column list, placeholder list,
  and parameter array in `src/storage/backup/restore.ts`.
- Validate `v10` breeding rows:
  - valid `HH:MM`
  - or `null`
- Keep `BACKUP_INSERT_ORDER` and `BACKUP_DELETE_ORDER` unchanged because this
  feature adds a column, not a table.

**Acceptance criteria**

- New backups preserve breeding record times.
- Older backups restore with untimed breeding records.
- Invalid `v10` time values are rejected before restore.
- V1 through V9 envelope types do not claim to contain a breeding-record `time`
  field.
- A V9 backup containing two same-day breeding records restores both as untimed,
  and subsequent edits can preserve `NULL` for each.

**Suggested verification**

```bash
npm test -- src/storage/backup/serialize.test.ts
npm test -- src/storage/backup/restore.test.ts
npm test -- src/storage/backup/validate.test.ts
```

### Task 7: Add time to the breeding record form hook

**Files**

- Modify: `src/hooks/useBreedingRecordForm.ts`
- Modify: `src/hooks/useBreedingRecordForm.screen.test.tsx`

**Implementation**

- Add `time` state.
- In create mode, initialize `time` to `getCurrentTimeHHMM()`.
- In edit mode, hydrate `time` from `record.time ?? ''`.
- Track whether the loaded record originally had a time.
- Add a validation error field for `time`.
- Create mode requires a valid time.
- Edit mode accepts either a valid time or an intentional clear to `NULL`.
- If a loaded timed record is saved with blank time, show a confirmation prompt
  before clearing the saved time.
- Legacy untimed records can be saved blank without an extra confirmation.
- Pass normalized time to create and update repository calls.

**Acceptance criteria**

- Create form payloads include a valid time.
- Edit form payloads preserve legacy `NULL` when the user leaves a legacy record
  untimed.
- Timed records cannot be accidentally cleared without confirmation.
- Timed records cannot be saved with malformed time values.

### Task 8: Add time to the breeding record form screen

**Files**

- Modify: `src/screens/BreedingRecordFormScreen.tsx`
- Modify: `src/screens/BreedingRecordFormScreen.screen.test.tsx`

**Implementation**

- Import `FormTimeInput`.
- Render a `Time` field near the `Date` field.
- Mark the field required in create mode.
- In edit mode, allow clearing or leaving blank. The hook owns confirmation when
  a previously timed record is cleared.
- Use `accessibilityLabel="Select breeding time"` for the time input.

**Acceptance criteria**

- Users can select a breeding time in the same 12h / 24h style used elsewhere.
- Save and delete behavior remain unchanged.
- Existing locked on-farm allocation messaging remains intact.

### Task 9: Update labels and detail display

**Files**

- Modify: `src/screens/mare-detail/BreedingTab.tsx`
- Modify: `src/hooks/useBreedingEventDetail.ts`
- Modify: `src/screens/BreedingEventDetailScreen.tsx`
- Modify: `src/screens/stallion-detail/BreedingHistoryTab.tsx`
- Modify: `src/screens/PregnancyCheckFormScreen.tsx`
- Modify: `src/hooks/useFoalingRecordForm.ts` or `src/screens/FoalingRecordFormScreen.tsx`
- Modify related hook and screen tests

**Implementation**

- Display date plus time on breeding cards.
- Add a `Time` row to breeding event detail when `record.time` exists.
- Ensure `useBreedingEventDetail` loads and exposes `record.time` through the
  normal `BreedingRecord` object; update tests that fixture the loaded record.
- Make pregnancy-check picker labels and foaling-record picker labels use the
  exact shared format:
  - timed: `04-26-2026 9:30 AM - Brego (Frozen AI)`
  - 24-hour preference: `04-26-2026 09:30 - Brego (Frozen AI)`
  - untimed: `04-26-2026 - Brego (Frozen AI) - Untimed`
- If two picker options still have the same label after date, time, stallion, and
  method are applied, append a stable suffix in sorted order:
  - ` - Record 1`
  - ` - Record 2`
- Use the shared display helper so labels are consistent.
- Preserve date-only display for legacy untimed cards where there is no ambiguity,
  but picker labels must always include `Untimed` for untimed records.

**Acceptance criteria**

- Same-day breeding records can be visually distinguished before selecting one.
- Duplicate same-day/same-time breeding picker labels are still distinguishable.
- Legacy untimed records still render without looking broken.
- No raw `HH:MM` formatting leaks into 12-hour preference screens.

### Task 10: Update timeline, calendar, and dashboard ordering

**Files**

- Modify: `src/utils/timelineEvents.ts`
- Modify: `src/hooks/useMareCalendarData.ts`
- Modify: `src/utils/dashboardAlertContext.ts`
- Modify: `src/utils/calendarMarking.ts` only if the existing implementation
  depends on breeding event ordering internally
- Modify related tests:
  - `src/utils/timelineEvents.test.ts`
  - `src/utils/calendarMarking.test.ts`
  - `src/utils/dashboardAlerts.test.ts`

**Implementation**

- Timeline sorting should use breeding time when comparing two breeding events on
  the same date.
- Calendar selected-day breeding lists should render later timed services before
  earlier timed services, with untimed legacy rows last.
- Dashboard `breedingRecordsDesc` should use the shared breeding comparator so
  "latest breeding" is time-aware.
- Calendar date dots remain day-based; do not add separate dot behavior for time.
- Add a calendar marking test proving two breeding records on one date still
  produce the correct day marker/dot behavior.

**Acceptance criteria**

- Multiple same-day breeding records are shown in a predictable order.
- Dashboard follow-up alert logic chooses the later same-day breeding record.
- Calendar marking behavior remains unchanged except for selected-day order.

### Task 11: Update downstream tests and fixtures

**Files**

- Modify test helpers across:
  - `src/selectors/*.test.ts`
  - `src/utils/*.test.ts`
  - `src/screens/*.screen.test.tsx`
  - `src/hooks/*.screen.test.tsx`
  - repository tests

**Implementation**

- Add `time: null` to generic fabricated breeding records.
- Use explicit times in tests that assert ordering, labels, or latest-record
  behavior.
- Add repository validation tests for `time = ''`, `time = '8:00'`,
  `time = '08:00 '`, and `time = '24:00'`.
- Add migration tests for `time = ''` and `time = '24:00'` failing the database
  `CHECK`.
- Add backup tests for a same-day pair in a V9 backup restoring to V10 with both
  records untimed.
- Add picker-label tests for:
  - timed same-day records
  - mixed timed and untimed records
  - duplicate base labels receiving `Record 1` / `Record 2` suffixes
- Update snapshots or text expectations that previously expected date-only
  breeding labels.

**Acceptance criteria**

- Test changes reflect the new contract instead of weakening assertions.
- There are explicit tests for same-day disambiguation.

### Task 12: Full verification and manual QA

**Automated verification**

Run:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

**Manual QA**

1. Create two breeding records for the same mare on the same date with different
   times.
2. Confirm the mare Breeding tab shows both records with distinct times and later
   time first.
3. Open the mare calendar for that date and confirm selected-day history is
   time-aware.
4. Open the breeding event detail screen and confirm the time appears in the
   summary.
5. Add a pregnancy check and confirm the breeding picker distinguishes the
   same-day records.
6. Add a foaling record and confirm the breeding picker distinguishes the
   same-day records.
7. Open the stallion detail breeding history and confirm linked records include
   date/time.
8. Edit a timed breeding record, clear the time, confirm the clear prompt, and
   confirm the record displays as untimed.
9. Create an on-farm allocation through the collection wizard with a back-dated
   event date and confirm the wizard requires an explicit allocation time.
10. Restore a pre-`v10` backup and confirm legacy records load as untimed.
11. Create a new backup and restore it, then confirm breeding record times survive.

## Non-Goals

- Do not change pregnancy or foaling date calculations to use time.
- Do not add same-day duplicate prevention.
- Do not add reminders, notifications, or auto-scheduled events.
- Do not add frozen semen straw consumption in this feature.
- Do not add bulk backfill UX for historical untimed records.
- Do not modify Photos V1 in this plan. This feature owns backup `v10` if it is
  implemented first; Photos V1 must rebase its backup schema to `v11`.
