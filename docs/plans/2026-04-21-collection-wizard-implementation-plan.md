# Collection Wizard Volume Rework Implementation Plan

**Date:** 2026-04-21  
**Status:** Ready for implementation  
**Source Spec:** `docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md`

## Goal

Implement the approved collection-wizard volume rework across storage, backup/restore, create flow, saved-collection edit flow, shipped dose-event editing, and linked on-farm breeding-record editing.

The finished app should:

- store collection targets instead of legacy dose-count planning fields
- enforce allocation by semen volume, not collection-level dose count
- let the wizard prefill shipped and on-farm rows from a live calculator
- keep saved collection edit as a single-page form with a read-only derived panel
- route all post-create on-farm edits through the linked breeding record while synchronizing the companion `usedOnSite` event
- migrate old installs and old backups into the new canonical shape

## Repo Fit

This plan is grounded in the current codebase:

- The route split already exists in `src/navigation/AppNavigator.tsx` as `CollectionCreateWizard` and `CollectionForm`.
- The current wizard shell and row editors already exist in `src/hooks/useCollectionWizard.ts`, `src/screens/CollectionWizardScreen.tsx`, and `src/screens/collection-wizard/*`, but they still implement the old dose-count model.
- Collection CRUD, shipment CRUD, and wizard save already live in dedicated repository files under `src/storage/repositories/`.
- Backup/restore already follows the explicit raw-row pattern in `src/utils/backup/*`.
- Stallion-side collection viewing and shipped-event editing already run through `src/screens/stallion-detail/CollectionsTab.tsx` and `DoseEventModal.tsx`.
- Mare-side breeding editing already runs through `src/screens/BreedingRecordFormScreen.tsx` and `src/storage/repositories/breedingRecords.ts`.

This work should extend those seams instead of creating parallel flows.

## Locked Implementation Assumptions

The spec is now sufficient for planning, but the calculator still needs exact formulas and display rules. This plan locks them for implementation:

- `rawMotileConcentrationMillionsPerMl = concentrationMillionsPerMl * (progressiveMotilityPercent / 100)`
- `semenPerDoseMl = targetMotileSpermMillionsPerDose / rawMotileConcentrationMillionsPerMl`
- `doseVolumeMl = targetMotileSpermMillionsPerDose / targetPostExtensionConcentrationMillionsPerMl`
- `extenderPerDoseMl = doseVolumeMl - semenPerDoseMl`
- `maxDoses = rawVolumeMl / semenPerDoseMl`
- All save-time math and cap checks use full precision.
- Display rounds mL values to 2 decimals.
- Approximate dose-count displays use 1 decimal.
- New shipped-row prefill is considered valid only when `semenPerDoseMl` is non-null and `extenderPerDoseMl >= 0`.
- New on-farm-row prefill is considered valid when `semenPerDoseMl` is non-null, even if shipped extender math is invalid.
- Step 3 must preserve one add-order allocation list. The hook should store one union draft list with stable client IDs, then split into shipped/on-farm payload arrays only at save time.
- Collection cards on stallion detail must stop rendering removed fields and instead show surviving collection inputs plus stored targets.

## Sub-Agent Execution Model

Use four implementation workers plus one integrator. Do not let workers overlap on write scopes.

### Integrator ownership

The main integrator owns:

- this plan document
- conflict resolution between workers
- any final export or routing cleanup not already claimed
- final verification and manual QA

### Worker A: Storage contracts, migration, and math

Worker A exclusively owns:

- `src/models/types.ts`
- `src/storage/migrations/index.ts`
- `src/storage/migrations/index.test.ts`
- `src/storage/repositories/index.ts`
- `src/storage/repositories/semenCollections.ts`
- `src/storage/repositories/semenCollections.test.ts`
- `src/storage/repositories/collectionDoseEvents.ts`
- `src/storage/repositories/collectionDoseEvents.test.ts`
- `src/storage/repositories/collectionWizard.ts`
- `src/storage/repositories/collectionWizard.test.ts`
- `src/storage/repositories/internal/collectionAllocation.ts`
- `src/storage/repositories/repositories.test.ts`
- `src/utils/collectionCalculator.ts`
- `src/utils/collectionCalculator.test.ts`
- `src/utils/collectionAllocation.ts`
- `src/utils/collectionAllocation.test.ts`

No other worker should edit those files.

### Worker B: Backup v3 and restore canonicalization

Worker B exclusively owns:

- `src/utils/backup/types.ts`
- `src/utils/backup/serialize.ts`
- `src/utils/backup/serialize.test.ts`
- `src/utils/backup/restore.ts`
- `src/utils/backup/restore.test.ts`
- `src/utils/backup/validate.ts`
- `src/utils/backup/validate.test.ts`
- `src/utils/backup/testFixtures.ts`
- `src/utils/backup/safetyBackups.test.ts`

No other worker should edit those files.

### Worker C: Wizard and collection-edit UI

Worker C exclusively owns:

- `src/hooks/useCollectionWizard.ts`
- `src/screens/CollectionWizardScreen.tsx`
- `src/screens/CollectionWizardScreen.screen.test.tsx`
- `src/screens/CollectionFormScreen.tsx`
- `src/screens/CollectionFormScreen.screen.test.tsx`
- `src/screens/collection-wizard/CollectionBasicsStep.tsx`
- `src/screens/collection-wizard/ProcessingDetailsStep.tsx`
- `src/screens/collection-wizard/DoseAllocationStep.tsx`
- `src/screens/collection-wizard/ReviewStep.tsx`
- `src/screens/collection-wizard/ShippedDoseRowEditor.tsx`
- `src/screens/collection-wizard/OnFarmMareRowEditor.tsx`

No other worker should edit those files.

### Worker D: Stallion detail, shipped modal, and breeding-record sync

Worker D exclusively owns:

- `src/storage/repositories/breedingRecords.ts`
- `src/storage/repositories/breedingRecords.test.ts` (new)
- `src/screens/BreedingRecordFormScreen.tsx`
- `src/screens/BreedingRecordFormScreen.screen.test.tsx`
- `src/screens/stallion-detail/CollectionsTab.tsx`
- `src/screens/stallion-detail/DoseEventModal.tsx`
- `src/screens/StallionDetailScreen.screen.test.tsx`

No other worker should edit those files.

## Delivery Order

### Wave 1: Foundation contracts

Run Worker A and Worker B first.

Worker A is the contract-setting wave. Worker C and Worker D should not start until Worker A has landed the final type shapes, utility signatures, migration SQL, and repository payloads.

Worker B can work in parallel with Worker A because its write set is isolated, but it must implement against Worker A's final row shapes from the source spec and rebase once Worker A lands.

### Wave 2: Product surfaces

Start Worker C and Worker D after Worker A lands.

Worker C depends on:

- new `SemenCollection` and `CollectionDoseEvent` shapes
- `deriveCollectionMath`
- `computeAllocationSummary`
- updated wizard save payload

Worker D depends on:

- updated dose-event columns and repo validations
- updated collection row shape
- volume-based cap helpers

Worker C and Worker D can run in parallel because their write sets are disjoint.

### Wave 3: Integration and verification

After all workers land, the integrator resolves any leftover mock/export fallout, runs the full verification suite, and performs manual QA.

## Task Breakdown

### Task 1: Worker A implements storage contracts, migration, and shared math

**Scope**

Rewrite the storage model from legacy collection-level dose planning to target-based collection planning plus per-dose event volumes.

**Implementation**

- Update `SemenCollection` and related input types to remove:
  - `totalVolumeMl`
  - `extenderVolumeMl`
  - `doseCount`
  - `doseSizeMillions`
- Add collection target fields:
  - `targetMotileSpermMillionsPerDose`
  - `targetPostExtensionConcentrationMillionsPerMl`
- Update `CollectionDoseEvent` and related input types to add:
  - `doseSemenVolumeMl`
  - `doseExtenderVolumeMl`
- Create `src/utils/collectionCalculator.ts` and implement the locked formulas above.
- Create `src/utils/collectionAllocation.ts` and return:
  - allocated semen mL
  - remaining mL
  - blank-volume row count
  - exceeded amount
  - within-cap flag
- Rewrite repo-level allocation assertions in `src/storage/repositories/internal/collectionAllocation.ts` from dose-count math to semen-volume math.
- Update `semenCollections.ts` CRUD to map new fields and reject lowering `raw_volume_ml` below already-allocated semen volume.
- Update `collectionDoseEvents.ts` CRUD to:
  - persist new volume columns
  - require semen + extender volumes for shipped rows
  - reject extender or non-1 dose count on `usedOnSite` rows
  - use volume-based cap checks when shipped rows are created or edited
- Update `collectionWizard.ts` to:
  - save the new collection target fields
  - save shipped row semen/extender volumes
  - save on-farm row semen volume with `dose_count = 1`
  - write on-farm breeding-record `volume_ml` from row `doseSemenVolumeMl`, not collection `rawVolumeMl`
  - run an in-transaction recompute of the volume cap before commit
- Add migration `019_collection_wizard_volume_rework` in `src/storage/migrations/index.ts`.
- Rebuild `semen_collections` without the dropped columns.
- Add new nullable per-dose columns to `collection_dose_events`.
- Preserve FK semantics exactly as locked in the spec:
  - `breeding_records.collection_id` uses `ON DELETE RESTRICT`
  - `collection_dose_events.collection_id` uses `ON DELETE CASCADE`
  - `collection_dose_events.breeding_record_id` uses `ON DELETE CASCADE`
- Canonicalize legacy `usedOnSite` rows during migration:
  - `dose_count = 1`
  - `dose_extender_volume_ml = NULL`
  - `dose_semen_volume_ml = NULL`
  - append the legacy-collapse note when prior `dose_count > 1`

**Acceptance criteria**

- Fresh installs and upgraded installs land on the same final schema.
- No repo or migration code still references removed collection columns.
- Save-time allocation enforcement is volume-based everywhere.
- Legacy `usedOnSite` rows are canonical after migration.

**Suggested verification**

- `npm test -- src/storage/migrations/index.test.ts`
- `npm test -- src/storage/repositories/semenCollections.test.ts`
- `npm test -- src/storage/repositories/collectionDoseEvents.test.ts`
- `npm test -- src/storage/repositories/collectionWizard.test.ts`
- `npm test -- src/storage/repositories/repositories.test.ts`
- `npm test -- src/utils/collectionCalculator.test.ts src/utils/collectionAllocation.test.ts`

### Task 2: Worker B implements backup v3 and restore canonicalization

**Scope**

Bring backup/restore up to the new schema and keep restore semantics aligned with migration semantics.

**Implementation**

- Bump backup schema to v3 in `src/utils/backup/types.ts`.
- Replace legacy `semen_collections` and `collection_dose_events` row shapes with the new persisted columns.
- Keep v2 types for restore-path compatibility only.
- Update `serialize.ts` to export:
  - collection targets
  - per-dose semen/extender volumes
- Update `restore.ts` so v2 restore:
  - drops removed fields
  - inserts target fields as `NULL`
  - canonicalizes legacy `usedOnSite` rows exactly like migration `019`
  - appends the same legacy-collapse note when prior `dose_count > 1`
- Update `validate.ts` to:
  - validate new v3 row shapes
  - replace dose-count cap validation with volume-based validation
  - enforce `usedOnSite => dose_extender_volume_ml = NULL and dose_count = 1`
  - keep FK checks intact
- Remove any misleading claim that unknown v3 row keys survive restore/serialize round trips.
- Update test fixtures and all backup tests to v3.

**Acceptance criteria**

- v3 backups serialize and restore the new row shape directly.
- v2 backups restore into the same canonical shape that migration `019` produces.
- Backup validation rejects over-allocated collections and malformed `usedOnSite` rows.

**Suggested verification**

- `npm test -- src/utils/backup/serialize.test.ts`
- `npm test -- src/utils/backup/restore.test.ts`
- `npm test -- src/utils/backup/validate.test.ts`
- `npm test -- src/utils/backup/safetyBackups.test.ts`

### Task 3: Worker C rewrites the wizard and saved-collection edit UI

**Scope**

Replace the old dose-count wizard behavior with the new calculator-driven volume model, and rebuild saved-collection edit around collection targets plus a derived read-only panel.

**Implementation**

- Replace split wizard state that assumes collection-level dose planning.
- Store a single ordered allocation draft list with stable client IDs and row kind (`shipped` or `usedOnSite`).
- Keep conversion to `shippedRows[]` and `onFarmRows[]` at save time only.
- Update Step 1 to collect:
  - collection date
  - raw volume
  - concentration
  - motility
- Remove Step 1 collection-level notes and legacy dose fields.
- Rebuild Step 2 as the live calculator:
  - pinned chips for Step 1 values
  - target motile sperm per dose
  - target post-extension concentration
  - extender type
  - notes
  - derived panel using `deriveCollectionMath`
  - non-blocking warning rendering for negative extender and target-exceeds-capacity
- Rebuild Step 3 to show:
  - semen-used / remaining summary from `computeAllocationSummary`
  - blank-volume row count info
  - uncapped message when `rawVolumeMl` is blank
  - one add-order allocation list
- Rebuild `ShippedDoseRowEditor` to collect:
  - shipment address/contact fields
  - ship date
  - `doseSemenVolumeMl`
  - `doseExtenderVolumeMl`
  - `doseCount`
  - tracking number
  - notes
  - derived row totals
- Rebuild `OnFarmMareRowEditor` to collect:
  - mare
  - breeding date
  - optional `doseSemenVolumeMl`
  - notes
  - no editable `doseCount`
- Implement calculator-based prefill:
  - shipped rows get semen + extender prefill only when both are valid
  - on-farm rows get semen prefill when semen is valid
  - existing rows do not mutate when calculator targets change
- Rebuild Step 4 review to reflect the new sections and totals.
- Guard Next/Save with the volume-based overflow check, not dose-count overflow.
- Rebuild `CollectionFormScreen.tsx` to:
  - remove old fields
  - show new collection target fields
  - keep raw collection inputs
  - render a read-only derived panel backed by `deriveCollectionMath`

**Acceptance criteria**

- The wizard no longer references removed collection columns anywhere.
- Step transitions, prefill rules, and save guards follow the updated spec.
- Saved collection edit shows the new target fields and derived panel without dose-event editing.

**Suggested verification**

- `npm test -- src/screens/CollectionWizardScreen.screen.test.tsx`
- `npm test -- src/screens/CollectionFormScreen.screen.test.tsx`

### Task 4: Worker D updates stallion detail, shipped modal, and breeding-record sync

**Scope**

Bring the post-save editing surfaces into alignment with the new model.

**Implementation**

- Update `breedingRecords.ts` so a breeding record linked to a companion `usedOnSite` event:
  - updates the companion event in the same transaction
  - mirrors `date`, `volume_ml`, and `notes`
  - reruns the allocation cap check when `volume_ml` changes
  - blocks:
    - changing `method` away from `freshAI`
    - clearing `collection_id`
    - switching `collection_id` to a different collection
- Create `src/storage/repositories/breedingRecords.test.ts` to cover the new linked-on-farm contract without colliding with Worker A's repository test files.
- Update `BreedingRecordFormScreen.tsx` so linked on-farm records:
  - allow editing date, volume, concentration, motility, and notes
  - disable or otherwise block the method/collection changes that the repo now rejects
  - continue to route delete through the existing breeding-record delete path
- Update `CollectionsTab.tsx` to:
  - stop rendering removed collection-level fields
  - render the new stored targets on collection cards
  - render shipped row semen/extender totals
  - render on-farm semen-only info or "not recorded"
- Update `DoseEventModal.tsx` so shipped-event edit/create supports:
  - `doseSemenVolumeMl`
  - `doseExtenderVolumeMl`
  - volume-based validation
  - per-row total display
- Keep `DoseEventModal` shipped-only.
- Preserve press-through navigation from `usedOnSite` cards to the linked breeding record.

**Acceptance criteria**

- Mare-side editing is the only post-create edit path for on-farm allocations.
- Shipped-event modal and stallion-detail cards show the new row-level volume model.
- Linked on-farm edits sync correctly and respect the cap.

**Suggested verification**

- `npm test -- src/storage/repositories/breedingRecords.test.ts`
- `npm test -- src/screens/BreedingRecordFormScreen.screen.test.tsx`
- `npm test -- src/screens/StallionDetailScreen.screen.test.tsx`

## Integrator Finalization

After all four workers land, the integrator should:

- reconcile any repo export fallout in `src/storage/repositories/index.ts` only if Worker A has not already done it
- touch `src/navigation/AppNavigator.tsx` only if route or title fallout remains
- update `src/navigation/AppNavigator.integration.test.tsx` if screen mocks changed shape
- fix any stale partial mocks that still reference removed collection fields
- run the full verification suite

## Final Verification

Run:

- `npm run typecheck`
- `npm test`
- `npm run test:screen`
- `npm run lint`

Manual smoke on device:

- create a collection with calculator targets but no rows
- create a collection with shipped rows and confirm semen-volume cap enforcement
- create a collection with one on-farm row with recorded semen volume
- create a collection with one on-farm row with blank semen volume
- edit a shipped dose event from stallion detail
- open a linked on-farm breeding record and edit date, volume, and notes
- confirm blocked method/collection changes on linked on-farm breeding records
- edit a saved collection and confirm the derived panel updates live
- restore a v2 backup fixture path and confirm canonicalized `usedOnSite` data

## Completion Criteria

The feature is complete when all of the following are true:

- no runtime or test code still depends on removed collection-level fields
- volume-based cap enforcement is active in wizard save, shipped dose-event edit, collection edit, and linked on-farm breeding-record edit
- shipped and on-farm rows render and edit with the new volume semantics
- migration and restore both canonicalize legacy `usedOnSite` data the same way
- full typecheck, unit tests, screen tests, and lint pass
