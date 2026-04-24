# Daily Log Flush Follow-Up - Design

**Date:** 2026-04-23  
**Status:** Approved

## Summary

BreedWise should extend the existing daily log wizard so uterine fluid pockets can immediately capture whether a uterine flush was performed during that same visit. If the breeder answers `Yes`, the wizard collects flush details and product rows. The daily log remains the source of truth. Medication logs created from flush products are generated artifacts, not independently edited treatment records.

This phase is intentionally same-visit only. It does not schedule future treatments, create reminders, or introduce a new standalone procedure workflow.

## Core Decisions

- Rename the roadmap item from `Fluid tracking` to `Fluid-triggered flush follow-up`.
- Do not create a new standalone flush record flow outside the daily log wizard in this phase.
- Only show the flush follow-up when at least one uterine fluid pocket exists on the daily log.
- Require an explicit `Yes` or `No` answer before the uterus step can advance when fluid pockets exist.
- Insert a dedicated `Flush` step between `Uterus` and `Review` only when the answer is `Yes`.
- Keep the daily log as the canonical record. Flush-generated medication logs are derived from flush products.
- Do not allow direct editing of linked medication logs. Editing must route back to the source daily log.
- Do not add a new timeline event type. Generated medication logs continue to appear as medication entries.
- Do not extend daily log cards with flush details in phase 1.

## Product Scope

### In scope

- Same-visit flush follow-up inside the daily log wizard.
- Persisted flush procedure data and repeatable product rows.
- Automatic generation of linked medication logs from flush products.
- Backup and restore support for the new flush tables and medication linkage.
- Review and edit routing that sends linked medication edits back to the daily log wizard.

### Out of scope

- Future planned flushes or treatment reminders.
- Auto-scheduling follow-up medication records.
- A separate flush date or time distinct from the parent daily log.
- A dedicated flush card in `DailyLogsTab`.
- A new alert category specifically for flushes.
- Manual editing of generated medication logs.

## User Flow

### Wizard entry and branching

1. The breeder enters the daily log as usual.
2. In the `Uterus` step, if no fluid pockets are present, the flow behaves exactly as it does today.
3. If one or more fluid pockets are present, the step shows a required question:
   - `Was a uterine flush performed during this visit?`
4. If the breeder answers `No`, the wizard continues directly to `Review`.
5. If the breeder answers `Yes`, the wizard inserts a `Flush` step before `Review`.

### Flush step content

The `Flush` step captures:

- `Base Solution` - required free text
- `Total Volume (mL)` - required positive numeric value with up to one decimal place
- `Notes` - optional procedure-level notes
- `Products` - at least one row, each with:
  - product name
  - dose
  - optional row note

The product picker should reuse the existing medication entry pattern and include `Custom`. A saline-only flush is represented by a required product row named `Saline`.

### Review step

When flush data exists, `Review` shows a dedicated `Flush` section with an edit action that jumps back to the `Flush` step.

### Edit behavior

- If an existing daily log already has persisted flush data, edit mode defaults the flush decision to `Yes`.
- If a daily log has fluid pockets but no persisted flush, edit mode defaults the decision to `No`.
- If the breeder removes all fluid pockets or flips the answer from `Yes` to `No` after flush data already exists, the app must confirm before clearing the flush draft and linked generated-medication state.

## Data Model

### Domain types

Add new domain types in `src/models/types.ts`:

- `UterineFlush`
- `UterineFlushProduct`

Extend existing types:

- `DailyLogDetail` gains `uterineFlush: UterineFlush | null`
- `MedicationLog` gains `sourceDailyLogId: UUID | null`

### SQLite tables

Add a new migration `025_daily_log_flush_follow_up` that introduces:

#### `uterine_flushes`

- `id TEXT PRIMARY KEY`
- `daily_log_id TEXT NOT NULL UNIQUE`
- `base_solution TEXT NOT NULL`
- `total_volume_ml REAL NOT NULL`
- `notes TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- foreign key to `daily_logs(id)` with `ON UPDATE CASCADE ON DELETE RESTRICT`

#### `uterine_flush_products`

- `id TEXT PRIMARY KEY`
- `uterine_flush_id TEXT NOT NULL`
- `product_name TEXT NOT NULL`
- `dose TEXT NOT NULL`
- `notes TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- foreign key to `uterine_flushes(id)` with `ON UPDATE CASCADE ON DELETE RESTRICT`

### Medication linkage

Alter `medication_logs` to add:

- `source_daily_log_id TEXT NULL`
- foreign key to `daily_logs(id)` with `ON UPDATE CASCADE ON DELETE RESTRICT`

Also add an index on `source_daily_log_id` so linked medication regeneration and routing checks stay efficient.

## Persistence Ownership

Flush persistence belongs under `src/storage/repositories/`.

Recommended repository seams:

- new module: `src/storage/repositories/uterineFlushes.ts`
- `getByDailyLogId(dailyLogId, db?)`
- `replaceByDailyLogId(dailyLogId, input, db?)`
- `deleteByDailyLogId(dailyLogId, db?)`

`dailyLogs.ts` remains the parent owner of the full transaction:

- create daily log parent row
- write uterine fluid rows
- write flush row and product rows
- delete and recreate generated medication rows

That work must happen inside one transaction so the daily log, flush, fluid, and linked medication state never drift apart.

## Generated Medication Mapping

Each flush product row creates exactly one medication log.

Generated medication logs use:

- `mareId = dailyLog.mareId`
- `date = dailyLog.date`
- `medicationName = productName`
- `dose = dose`
- `route = 'intrauterine'`
- `sourceDailyLogId = dailyLog.id`

Generated medication notes should include:

- the flush base solution
- the total flush volume in mL
- the product row note when present

Example note shape:

- `Flush: Lactated Ringers, 1000 mL`
- `Flush: Lactated Ringers, 1000 mL. Product note: retained fluid follow-up`

Generated medication log IDs do not need to be stable across daily log updates. It is acceptable to delete and recreate them whenever flush data changes.

## Delete And Replace Semantics

### Daily log create

If the payload contains flush data:

- create the flush row
- create all product rows
- create linked medication logs

### Daily log update

`uterineFlush` follows tri-state semantics:

- `undefined` means preserve the existing persisted flush
- `null` means remove the flush and all linked generated medication logs
- object means replace the flush and product rows, then regenerate medication logs

### Daily log delete

Delete in this order inside the same transaction:

1. linked medication logs
2. flush product rows
3. flush row
4. uterine fluid rows
5. daily log row

## Backup And Restore

Backup schema must bump from `V7` to `V8`.

`V8` adds:

- `uterine_flushes`
- `uterine_flush_products`
- `medication_logs.source_daily_log_id`

Older backups must still restore cleanly by normalizing:

- missing flush tables to empty arrays
- missing `source_daily_log_id` to `null`

Validation rules for backup import should reject:

- empty `base_solution`
- non-positive `total_volume_ml`
- empty `product_name`
- empty `dose`

Validation should also enforce V8 cross-table references:

- each `uterine_flushes.daily_log_id` references an existing daily log
- each `uterine_flush_products.uterine_flush_id` references an existing uterine flush
- each non-null `medication_logs.source_daily_log_id` references an existing daily log

## UI And Routing Behavior

### Medications tab and timeline

Flush-generated medication rows stay visible in:

- `MedicationsTab`
- `TimelineTab`
- `MareCalendarScreen`
- backups and restores

These rows should show a small source indicator such as:

- `Source: Daily log flush`

If `sourceDailyLogId` is present, tapping the edit icon should navigate to:

- `DailyLogForm` with that `logId`

instead of navigating to `MedicationForm`.

### Direct medication form guard

If a linked medication log is opened directly in `MedicationFormScreen` or `useMedicationForm`, the screen should redirect back to the source daily log rather than allowing direct edit.

## Dashboard Behavior

Flush-generated medication logs must be excluded from medication-gap heuristics on the dashboard. Manual medication entries should continue to behave exactly as they do now.

No new flush-specific dashboard card is introduced in this phase.

## Validation Rules

- Flush follow-up is only available when at least one fluid pocket exists.
- The uterus step cannot advance until the breeder answers `Yes` or `No` when fluid pockets exist.
- If the answer is `No`, no flush payload is saved.
- If the answer is `Yes`, the `Flush` step becomes required.
- `Base Solution` is required.
- `Total Volume (mL)` is required and must be positive with up to one decimal place.
- At least one product row is required.
- Every product row requires both `productName` and `dose`.
- Product row notes are optional.
- Procedure-level notes are optional.

## Acceptance Scenarios

- A daily log with no fluid pockets behaves exactly as it does today.
- A daily log with fluid pockets cannot leave the uterus step until the breeder answers the flush question.
- Answering `No` skips the `Flush` step and saves no flush data.
- Answering `Yes` inserts `Flush` before `Review` and requires valid flush data before save.
- Editing an existing flush-backed daily log hydrates the stored flush and product rows.
- Changing an existing flush decision from `Yes` to `No` prompts before clearing persisted flush data.
- Saving a flush-backed daily log creates one generated medication log per product row.
- Updating flush products regenerates linked medication logs.
- Deleting the daily log removes the linked medication rows and flush rows in the same transaction.
- Linked medication entries route back to the source daily log for edits.
- Older backups restore with no flush data and `sourceDailyLogId = null`.
