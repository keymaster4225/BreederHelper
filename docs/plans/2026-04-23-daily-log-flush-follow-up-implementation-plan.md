# Daily Log Flush Follow-Up - Implementation Plan

**Date:** 2026-04-23  
**Status:** Ready for implementation  
**Source Spec:** `docs/plans/2026-04-23-daily-log-flush-follow-up-design.md`

## Goal

Implement same-visit uterine flush follow-up inside the existing daily log workflow by:

- extending the daily log data model with persisted flush procedure data
- generating linked medication logs from flush product rows
- preserving the daily log as the single editable source of truth
- keeping backup, timeline, calendar, medication history, and dashboard behavior consistent

The finished app should:

- ask for a required `Yes` or `No` flush decision whenever uterine fluid pockets are recorded
- show a `Flush` wizard step only when the breeder answers `Yes`
- persist flush procedure data and product rows under the source daily log
- regenerate linked medication logs whenever flush data changes
- reroute edits of linked medication rows back to `DailyLogForm`
- restore cleanly from both upgraded databases and pre-feature backups

## Repo Fit

This plan is grounded in the current codebase:

- Daily log persistence lives in `src/storage/repositories/dailyLogs.ts`.
- Uterine fluid child-row persistence already exists in `src/storage/repositories/uterineFluid.ts`.
- Medication persistence already exists in `src/storage/repositories/medications.ts`.
- The migration runner currently goes through migration `024` in `src/storage/migrations/index.ts`.
- Backup and restore contracts are explicit raw-row types in `src/storage/backup/types.ts`, with serializer, validator, and restore logic split across `serialize.ts`, `validate.ts`, and `restore.ts`.
- The daily log wizard flow is owned by:
  - `src/hooks/useDailyLogWizard.ts`
  - `src/hooks/dailyLogWizard/constants.ts`
  - `src/hooks/dailyLogWizard/types.ts`
  - `src/hooks/dailyLogWizard/mappers.ts`
  - `src/hooks/dailyLogWizard/validation.ts`
  - `src/screens/DailyLogWizardScreen.tsx`
  - `src/screens/daily-log-wizard/*`
- Mare detail and calendar consumers already load medication logs through:
  - `src/hooks/useMareDetailData.ts`
  - `src/hooks/useMareCalendarData.ts`
  - `src/screens/mare-detail/MedicationsTab.tsx`
  - `src/screens/mare-detail/TimelineTab.tsx`
  - `src/screens/MedicationFormScreen.tsx`
- Home screen dashboard data currently loads through `src/hooks/useHomeScreenData.ts`.
- SQLite-backed integration coverage already exists in:
  - `src/storage/migrations/index.test.ts`
  - `src/storage/repositories/dailyLogs.test.ts`
  - `src/storage/repositories/repositories.test.ts`
  - `src/storage/backup/*.test.ts`

This work should extend those seams rather than creating a parallel procedure system.

## Locked Implementation Assumptions

These are implementation decisions, not open questions:

- This phase is same-visit only.
- The flush decision only appears when at least one fluid pocket exists.
- `Base Solution` is required free text in phase 1.
- `Total Volume (mL)` is stored as a positive numeric value with up to one decimal place.
- A saline-only flush must still include one product row named `Saline`.
- `DailyLogDetail.uterineFlush` is `null` when no flush exists.
- `MedicationLog.sourceDailyLogId` is `null` for all manually created medication logs.
- Linked medication logs are derived data and are never edited independently.
- Generated medication log IDs do not need to survive regeneration.
- Flush-generated medication logs remain visible in Meds, Timeline, Calendar, and backups.
- Flush-generated medication logs are excluded from medication-gap alert heuristics.
- Backup schema bumps from `V7` to `V8`.
- The next schema migration is `025_daily_log_flush_follow_up`.

## Delivery Strategy

Implement in eight waves so contract-setting changes land before wizard and routing changes.

### Wave 1: Docs and planning artifacts

1. Update the roadmap language.
2. Add the approved design doc.
3. Add this implementation plan.

### Wave 2: Domain and schema foundation

4. Add flush domain types and medication linkage fields.
5. Add migration `025`.
6. Add migration coverage for fresh installs, upgrades, and idempotence.

### Wave 3: Backup contract

7. Bump backup schema to `V8`.
8. Add the new flush tables and medication linkage to serialization, validation, and restore.

### Wave 4: Repository ownership and transactional sync

9. Add a dedicated `uterineFlushes.ts` repository.
10. Extend `dailyLogs.ts` to load, create, replace, and delete flush data.
11. Regenerate linked medication rows transactionally.

### Wave 5: Wizard state model

12. Replace static step assumptions with derived step descriptors.
13. Add flush decision state, flush draft state, validation, hydration, and payload mapping.
14. Add confirmation behavior before clearing persisted flush data.

### Wave 6: Wizard UI

15. Extend `UterusStep` with the required question.
16. Add `FlushStep.tsx`.
17. Add flush summary rendering in `ReviewStep`.

### Wave 7: Linked medication routing and downstream behavior

18. Reroute linked medication edits to `DailyLogForm`.
19. Add source labels to linked medication cards.
20. Guard direct access to linked medication logs in `MedicationForm`.
21. Exclude linked medication rows from dashboard medication-gap heuristics.

### Wave 8: Verification and QA

22. Add migration, backup, repository, hook, screen, and dashboard tests.
23. Run targeted verification, then the broader quality gates.

## Task Breakdown

### Task 1: Update planning docs first

**Files**

- Modify: `ROADMAP.md`
- Create: `docs/plans/2026-04-23-daily-log-flush-follow-up-design.md`
- Create: `docs/plans/2026-04-23-daily-log-flush-follow-up-implementation-plan.md`

**Implementation**

- Rename the roadmap item from `Fluid tracking` to `Fluid-triggered flush follow-up`.
- Remove the stale `feature/collection-wizard` warning from `ROADMAP.md`.
- Note in the roadmap or nearby docs that fluid pocket capture already shipped through the daily log wizard.
- Add the design doc before any code changes so implementation can reference a fixed spec.

**Acceptance criteria**

- The roadmap reflects the current product state and no longer points at stale branch guidance.
- The design doc and implementation plan are both present in `docs/plans/`.

### Task 2: Add domain types and migration `025`

**Files**

- Modify: `src/models/types.ts`
- Modify: `src/storage/migrations/index.ts`
- Modify: `src/storage/migrations/index.test.ts`

**Implementation**

- Add `UterineFlush` and `UterineFlushProduct` to `src/models/types.ts`.
- Extend `DailyLogDetail` with `uterineFlush: UterineFlush | null`.
- Extend `MedicationLog` with `sourceDailyLogId: UUID | null`.
- Add migration `025_daily_log_flush_follow_up`.
- Create table `uterine_flushes`.
- Create table `uterine_flush_products`.
- Alter `medication_logs` to add `source_daily_log_id`.
- Add an index on `medication_logs(source_daily_log_id)`.
- Ensure foreign keys remain restrictive and consistent with the existing relational model.
- Add migration tests for:
  - fresh schema contains both new flush tables
  - fresh schema contains `medication_logs.source_daily_log_id`
  - upgrade from `024` preserves existing data
  - rerunning migration logic is harmless

**Acceptance criteria**

- Fresh installs and upgraded installs converge on the same schema.
- `PRAGMA foreign_key_check` still passes after upgrade tests.
- Migration `025` is safe to run on real upgraded data.

**Suggested verification**

- `npm test -- src/storage/migrations/index.test.ts`

### Task 3: Bump backup schema to `V8`

**Files**

- Modify: `src/storage/backup/types.ts`
- Modify: `src/storage/backup/serialize.ts`
- Modify: `src/storage/backup/restore.ts`
- Modify: `src/storage/backup/validate.ts`
- Modify: `src/storage/backup/testFixtures.ts`
- Modify: `src/storage/backup/serialize.test.ts`
- Modify: `src/storage/backup/restore.test.ts`
- Modify: `src/storage/backup/validate.test.ts`

**Implementation**

- Add `BACKUP_SCHEMA_VERSION_V8`.
- Make `BACKUP_SCHEMA_VERSION_CURRENT = V8`.
- Add `uterine_flushes` and `uterine_flush_products` to backup table-name lists and insert/delete ordering.
- Extend backup row types for:
  - `BackupUterineFlushRow`
  - `BackupUterineFlushProductRow`
  - `BackupMedicationLogRow.source_daily_log_id`
- Serialize the two new flush tables.
- Serialize `medication_logs.source_daily_log_id`.
- Restore V8 data exactly.
- Normalize older backups by defaulting:
  - missing flush tables to `[]`
  - missing `source_daily_log_id` to `null`
- Add validation rules for:
  - non-empty `base_solution`
  - positive `total_volume_ml`
  - non-empty `product_name`
  - non-empty `dose`

**Acceptance criteria**

- V8 backups round-trip flush data exactly.
- V1-V7 backups still restore without manual migration steps.
- Invalid flush rows are rejected during validation instead of being restored partially.

**Suggested verification**

- `npm test -- src/storage/backup/serialize.test.ts`
- `npm test -- src/storage/backup/restore.test.ts`
- `npm test -- src/storage/backup/validate.test.ts`

### Task 4: Add uterine flush repository support

**Files**

- Create: `src/storage/repositories/uterineFlushes.ts`
- Modify: `src/storage/repositories/index.ts`
- Add tests near: `src/storage/repositories/uterineFluid.test.ts` or a new `uterineFlushes.test.ts`

**Implementation**

- Mirror the current child-table repository style used for uterine fluid rows.
- Add typed row mappers for flush and product tables.
- Add:
  - `getByDailyLogId(dailyLogId, db?)`
  - `replaceByDailyLogId(dailyLogId, input, db?)`
  - `deleteByDailyLogId(dailyLogId, db?)`
- Keep all helpers transaction-friendly by accepting the repo DB handle pattern already used in sibling repositories.
- Ensure `replaceByDailyLogId` fully replaces both the parent flush row and all child product rows.

**Acceptance criteria**

- The flush repository can load, replace, and delete complete flush payloads in a passed transaction.
- No orphaned product rows remain after replacement or deletion.

### Task 5: Extend `dailyLogs.ts` with flush ownership and linked medication regeneration

**Files**

- Modify: `src/storage/repositories/dailyLogs.ts`
- Modify: `src/storage/repositories/dailyLogs.test.ts`
- Modify: `src/storage/repositories/repositories.test.ts`
- Modify: `src/storage/dataInvalidation.ts` if any new or reused invalidation handling is needed

**Implementation**

- Extend `DailyLogCreateInput` and `DailyLogUpdateInput` with `uterineFlush?: ReplaceUterineFlushInput | null`.
- Load `uterineFlush` inside `getDailyLogById`.
- On create:
  - write the daily log parent
  - write uterine fluid rows
  - write flush data
  - generate medication logs from flush products
  - do all of the above in one transaction
- On update:
  - treat `uterineFlush === undefined` as preserve
  - treat `uterineFlush === null` as delete
  - treat a flush object as replace
- On any save where flush data is replaced or removed:
  - delete all medication logs with `source_daily_log_id = dailyLogId`
  - recreate them from the current flush products
  - do that inside the same transaction
- On delete:
  - delete linked medication logs
  - delete flush product rows
  - delete flush row
  - delete uterine fluid rows
  - delete daily log row
- Emit both `dailyLogs` and `medicationLogs` invalidation events after successful create, update, and delete.

**Acceptance criteria**

- A flush-backed daily log never exists without its matching generated medication rows after a successful save.
- Clearing or changing flush data always refreshes linked medication logs.
- Delete order respects existing restrictive foreign keys.

**Suggested verification**

- `npm test -- src/storage/repositories/dailyLogs.test.ts`
- `npm test -- src/storage/repositories/repositories.test.ts`

### Task 6: Define and centralize generated medication mapping

**Files**

- Modify: `src/storage/repositories/dailyLogs.ts`
- Modify: `src/storage/repositories/medications.ts`
- Modify: `src/utils/medications.ts` if shared helpers make note formatting or product presets cleaner

**Implementation**

- Add `source_daily_log_id` row mapping and CRUD support to `src/storage/repositories/medications.ts`.
- Ensure linked medication rows map as:
  - `mareId = dailyLog.mareId`
  - `date = dailyLog.date`
  - `medicationName = productName`
  - `dose = dose`
  - `route = 'intrauterine'`
  - `sourceDailyLogId = dailyLogId`
- Build a short, consistent note summary that includes:
  - base solution
  - total volume in mL
  - product note when present
- Add `Saline` to `PREDEFINED_MEDICATIONS`.
- Keep the existing manual `Add Medication` flow unchanged for non-linked rows.

**Acceptance criteria**

- Each flush product becomes one medication log.
- Saline-only flushes can be represented without special-case schema.
- Manual medication entries are not altered by the new linkage field.

### Task 7: Refactor the wizard step model for conditional steps

**Files**

- Modify: `src/hooks/dailyLogWizard/constants.ts`
- Modify: `src/hooks/dailyLogWizard/types.ts`
- Modify: `src/hooks/dailyLogWizard/mappers.ts`
- Modify: `src/hooks/dailyLogWizard/validation.ts`
- Modify: `src/hooks/dailyLogWizard/mappers.test.ts`
- Modify: `src/hooks/dailyLogWizard/validation.test.ts`
- Modify: `src/hooks/useDailyLogWizard.ts`
- Modify: `src/hooks/useDailyLogWizard.screen.test.tsx`

**Implementation**

- Replace the fixed `DAILY_LOG_WIZARD_STEPS` assumption with derived step descriptors or equivalent computed step state.
- Keep the base step order:
  - `Basics`
  - `Right Ovary`
  - `Left Ovary`
  - `Uterus`
  - `Review`
- Insert `Flush` between `Uterus` and `Review` only when the flush decision is `Yes`.
- Add wizard state:
  - `flushDecision: 'yes' | 'no' | null`
  - `DailyLogWizardFlushDraft`
  - `DailyLogWizardFlushProductDraft`
- Add hydration rules:
  - create mode with fluid pockets defaults to `null`
  - edit mode with persisted flush defaults to `yes`
  - edit mode with fluid pockets but no flush defaults to `no`
- Add payload rules:
  - no fluid pockets means no flush decision and no flush payload
  - decision `no` means `uterineFlush: null` only when clearing persisted data
  - decision `yes` maps the draft into repository input
- Add confirmation behavior before clearing existing flush data when:
  - all fluid pockets are removed
  - decision flips from `Yes` to `No`

**Acceptance criteria**

- Step count changes dynamically and remains internally consistent.
- Hydration, validation, and payload-building all agree on when flush data exists.
- Users cannot accidentally discard persisted flush data without confirmation.

**Suggested verification**

- `npm test -- src/hooks/dailyLogWizard/mappers.test.ts`
- `npm test -- src/hooks/dailyLogWizard/validation.test.ts`
- `npm test -- src/hooks/useDailyLogWizard.screen.test.tsx`

### Task 8: Build the `Uterus` and `Flush` step UI

**Files**

- Modify: `src/screens/daily-log-wizard/UterusStep.tsx`
- Create: `src/screens/daily-log-wizard/FlushStep.tsx`
- Modify: `src/screens/daily-log-wizard/ReviewStep.tsx`
- Modify: `src/screens/DailyLogWizardScreen.tsx`
- Add or modify screen coverage in:
  - `src/screens/DailyLogFormScreen.screen.test.tsx`
  - `src/screens/DailyLogWizardScreen.tsx` related tests if present

**Implementation**

- Show the required yes/no question only when fluid pockets exist.
- Keep existing uterus behavior unchanged when no fluid pockets exist.
- Add `FlushStep` with:
  - required `Base Solution`
  - required numeric `Total Volume (mL)`
  - optional notes
  - repeatable product rows
- Reuse the medication entry pattern for product rows:
  - predefined medication picker plus `Custom`
  - required dose text
  - optional row notes
- Make `DailyLogWizardScreen` render dynamic labels such as `Step 5 of 6` when the `Flush` step is present.
- Add a `Flush` review section with an edit action that jumps to the flush step.

**Acceptance criteria**

- The wizard only shows the flush UI when it is relevant.
- The flush step enforces required fields before the user can review or save.
- The review summary is sufficient to verify what will be saved.

### Task 9: Update linked medication routing and medication-form guardrails

**Files**

- Modify: `src/screens/mare-detail/MedicationsTab.tsx`
- Modify: `src/screens/mare-detail/TimelineTab.tsx`
- Modify: `src/screens/MedicationFormScreen.tsx`
- Modify: `src/hooks/useMedicationForm.ts`
- Modify tests near:
  - `src/screens/MedicationFormScreen.screen.test.tsx`
  - `src/screens/mare-detail/TimelineTab.screen.test.tsx`
  - a new `MedicationsTab` test if needed

**Implementation**

- In `MedicationsTab` and `TimelineTab`, if `sourceDailyLogId` is present:
  - route the edit action to `DailyLogForm` with `logId = sourceDailyLogId`
  - do not route to `MedicationForm`
- Show a compact source label on linked cards:
  - `Source: Daily log flush`
- In `MedicationFormScreen` or `useMedicationForm`, detect linked medication rows loaded directly by ID.
- Redirect linked rows back to the source daily log instead of allowing direct edit.

**Acceptance criteria**

- Linked medication rows are understandable to the user and never look like free-edit manual medications.
- Direct deep-link or stale navigation into a linked medication row fails safe by returning the user to the daily log flow.

### Task 10: Keep calendar, timeline, and dashboard behavior consistent

**Files**

- Modify: `src/hooks/useMareDetailData.ts` if detail hydration needs the new field on medication logs
- Modify: `src/hooks/useMareCalendarData.ts` only if filtering or source labels need extra data handling
- Modify: `src/hooks/useHomeScreenData.ts`
- Modify: `src/utils/dashboardAlerts.ts`
- Modify: `src/utils/calendarMarking.ts` only if source-linked medication tests need explicit coverage
- Modify: `src/utils/timelineEvents.ts` only if source-linked medication labels surface there
- Modify tests:
  - `src/utils/dashboardAlerts.test.ts`
  - `src/utils/calendarMarking.test.ts`
  - `src/utils/timelineEvents.test.ts`

**Implementation**

- Ensure linked medication rows remain visible in existing medication-driven history surfaces.
- Exclude rows with `sourceDailyLogId != null` from medication-gap heuristics.
- Keep manual medication log behavior unchanged.
- Preserve current timeline and calendar medication dot behavior without introducing a new event type.

**Acceptance criteria**

- Flush-generated medication rows appear where normal medication rows appear today.
- Dashboard medication-gap alerts are still driven only by manual medication history.

### Task 11: Add focused test coverage

**Files**

- Modify or add tests across:
  - `src/storage/migrations/index.test.ts`
  - `src/storage/backup/*.test.ts`
  - `src/storage/repositories/dailyLogs.test.ts`
  - `src/storage/repositories/repositories.test.ts`
  - `src/hooks/dailyLogWizard/*.test.ts`
  - `src/hooks/useDailyLogWizard.screen.test.tsx`
  - `src/screens/MedicationFormScreen.screen.test.tsx`
  - `src/screens/mare-detail/TimelineTab.screen.test.tsx`
  - `src/utils/dashboardAlerts.test.ts`

**Coverage targets**

- Migration:
  - fresh schema contains flush tables and medication linkage
  - upgrade through `025` preserves existing data
  - rerun is harmless
- Backup:
  - V8 serialize includes flush tables and `source_daily_log_id`
  - V8 restore round-trips exactly
  - V1-V7 restore with empty flush tables and null medication linkage
  - validation rejects invalid flush fields
- Repository:
  - create daily log with flush creates flush rows and linked medication rows
  - update replaces flush rows and linked medication rows
  - clear flush deletes linked medication rows
  - delete daily log deletes linked medication rows, flush rows, and fluid rows first
  - invalidation emits both `dailyLogs` and `medicationLogs`
- Hook and mapper:
  - hydration loads persisted flush data
  - create mode with fluid pockets requires a flush decision
  - edit mode with fluid pockets but no persisted flush defaults to `No`
  - dynamic steps appear and disappear correctly
  - clearing existing flush data requires confirmation
- Screen and routing:
  - uterus step only shows the question when fluid pockets exist
  - `Yes` inserts `Flush`
  - `No` skips `Flush`
  - flush step blocks save when required fields are missing
  - review step shows flush summary
  - linked medication cards route to `DailyLogForm`
  - direct linked-medication access redirects safely
- Dashboard:
  - linked flush-generated medication rows do not trigger medication-gap alerts
  - manual medication logs behave exactly as before

## Dependency Notes

- Do not start wizard UI changes before the repository contract is stable.
- Do not implement medication rerouting without first adding `source_daily_log_id` mapping to the medication repository.
- Do not treat generated medication logs as editable rows anywhere in the UI.
- Keep flush persistence as a child of `dailyLogs.ts`; do not create a separate screen-level save path.
- Keep manual medication creation untouched except for handling the new nullable linkage field.

## Suggested Verification Order

1. `npm run typecheck`
2. `npm test -- src/storage/migrations/index.test.ts`
3. `npm test -- src/storage/backup/serialize.test.ts`
4. `npm test -- src/storage/backup/restore.test.ts`
5. `npm test -- src/storage/backup/validate.test.ts`
6. `npm test -- src/storage/repositories/dailyLogs.test.ts`
7. `npm test -- src/storage/repositories/repositories.test.ts`
8. `npm test -- src/hooks/dailyLogWizard/mappers.test.ts`
9. `npm test -- src/hooks/dailyLogWizard/validation.test.ts`
10. `npm test -- src/hooks/useDailyLogWizard.screen.test.tsx`
11. `npm test -- src/screens/MedicationFormScreen.screen.test.tsx`
12. `npm test -- src/utils/dashboardAlerts.test.ts`
13. `npm test`
14. `npm run test:screen`
15. `npm run lint`

## Manual QA Checklist

- Create a daily log with no fluid pockets and confirm the flow is unchanged.
- Create a daily log with fluid pockets and confirm the flush question becomes required.
- Answer `No` and confirm there is no flush step and no linked medication rows after save.
- Answer `Yes`, enter flush data, and confirm one medication row appears per product.
- Edit the daily log, change the flush products, and confirm linked medication rows regenerate.
- Edit the daily log, switch from `Yes` to `No`, and confirm a destructive-clear warning appears.
- Open the Meds tab and confirm linked rows show `Source: Daily log flush`.
- Tap edit on a linked medication row and confirm it opens the daily log wizard.
- Attempt to open a linked medication row directly and confirm it redirects safely.
- Confirm flush-generated medication rows still appear in timeline and calendar history.
- Confirm medication-gap alerts ignore linked flush-generated rows.
