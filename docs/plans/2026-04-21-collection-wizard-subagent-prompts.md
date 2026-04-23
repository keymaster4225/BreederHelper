# Collection Wizard Volume Rework Sub-Agent Prompts

**Date:** 2026-04-21  
**Repo:** `/home/keymaster4225/BreederHelper`
**Primary spec:** `docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md`  
**Implementation plan:** `docs/plans/2026-04-21-collection-wizard-implementation-plan.md`

Use these prompts from fresh contexts. Each prompt is written to be copy-pasted directly into a new agent session.

## Run Order

1. Start **Worker A** and **Worker B** in parallel.
2. Wait for **Worker A** to land before starting **Worker C** and **Worker D**.
3. Start **Worker C** and **Worker D** in parallel after Worker A is complete.
4. Run the **Integrator** prompt after all four workers are complete.

## Shared Rules For All Workers

Every worker prompt already repeats the essentials, but all workers should follow these rules:

- Read `AGENTS.md` first.
- Read the source spec and implementation plan before changing code.
- You are **not alone in the codebase**. Do not revert other agents' edits. Adjust to them.
- Stay inside your assigned write scope. If you discover a required edit outside scope, stop and report it instead of freelancing.
- Use `apply_patch` for manual file edits.
- Run the targeted tests listed in your prompt if feasible.
- In your final response, list:
  - files changed
  - tests run
  - anything blocked or left for integration

## Worker A Prompt

```text
You are Worker A for the BreedWise collection wizard volume rework.

Work in: /home/keymaster4225/BreederHelper

Read first:
- /home/keymaster4225/BreederHelper/AGENTS.md
- /home/keymaster4225/BreederHelper/docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md
- /home/keymaster4225/BreederHelper/docs/plans/2026-04-21-collection-wizard-implementation-plan.md

You are not alone in the codebase. Other workers may be editing other files in parallel. Do not revert their changes. If you encounter edits from others, accommodate them.

Your write scope is exclusive. Edit only these files:
- /home/keymaster4225/BreederHelper/src/models/types.ts
- /home/keymaster4225/BreederHelper/src/storage/migrations/index.ts
- /home/keymaster4225/BreederHelper/src/storage/migrations/index.test.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/index.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/semenCollections.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/semenCollections.test.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/collectionDoseEvents.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/collectionDoseEvents.test.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/collectionWizard.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/collectionWizard.test.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/internal/collectionAllocation.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/repositories.test.ts
- /home/keymaster4225/BreederHelper/src/utils/collectionCalculator.ts
- /home/keymaster4225/BreederHelper/src/utils/collectionCalculator.test.ts
- /home/keymaster4225/BreederHelper/src/utils/collectionAllocation.ts
- /home/keymaster4225/BreederHelper/src/utils/collectionAllocation.test.ts

Do not edit anything else unless you are completely blocked, and if blocked report it instead of expanding scope.

Implement Task 1 from the implementation plan:
- migrate collection types from legacy dose-count fields to target fields
- add per-dose semen/extender volume fields to dose events
- implement collection calculator and allocation summary utils with the locked formulas from the plan
- convert repo-level cap enforcement from dose-count to semen-volume math
- update collection CRUD, dose-event CRUD, and wizard save to the new model
- ensure on-farm breeding records store volume from the row dose semen volume, not collection raw volume
- add migration 019
- preserve FK semantics exactly:
  - breeding_records.collection_id = ON DELETE RESTRICT
  - collection_dose_events.collection_id = ON DELETE CASCADE
  - collection_dose_events.breeding_record_id = ON DELETE CASCADE
- canonicalize legacy usedOnSite rows during migration and append the legacy-collapse note when prior dose_count > 1

Locked formulas:
- rawMotileConcentrationMillionsPerMl = concentrationMillionsPerMl * (progressiveMotilityPercent / 100)
- semenPerDoseMl = targetMotileSpermMillionsPerDose / rawMotileConcentrationMillionsPerMl
- doseVolumeMl = targetMotileSpermMillionsPerDose / targetPostExtensionConcentrationMillionsPerMl
- extenderPerDoseMl = doseVolumeMl - semenPerDoseMl
- maxDoses = rawVolumeMl / semenPerDoseMl

Implementation constraints:
- full precision for save-time math and cap checks
- new shipped rows require semen + extender volumes
- usedOnSite rows must always have dose_count = 1 and dose_extender_volume_ml = NULL
- null dose_semen_volume_ml is allowed only where the spec allows it

Run targeted verification if feasible:
- npm test -- src/storage/migrations/index.test.ts
- npm test -- src/storage/repositories/semenCollections.test.ts
- npm test -- src/storage/repositories/collectionDoseEvents.test.ts
- npm test -- src/storage/repositories/collectionWizard.test.ts
- npm test -- src/storage/repositories/repositories.test.ts
- npm test -- src/utils/collectionCalculator.test.ts src/utils/collectionAllocation.test.ts

In your final response:
- list changed files
- summarize what you implemented
- list tests run and results
- call out any blockers for Worker C, Worker D, or the integrator
```

## Worker B Prompt

```text
You are Worker B for the BreedWise collection wizard volume rework.

Work in: /home/keymaster4225/BreederHelper

Read first:
- /home/keymaster4225/BreederHelper/AGENTS.md
- /home/keymaster4225/BreederHelper/docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md
- /home/keymaster4225/BreederHelper/docs/plans/2026-04-21-collection-wizard-implementation-plan.md

You are not alone in the codebase. Other workers may be editing other files in parallel. Do not revert their changes. If you encounter edits from others, accommodate them.

Your write scope is exclusive. Edit only these files:
- /home/keymaster4225/BreederHelper/src/utils/backup/types.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/serialize.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/serialize.test.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/restore.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/restore.test.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/validate.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/validate.test.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/testFixtures.ts
- /home/keymaster4225/BreederHelper/src/utils/backup/safetyBackups.test.ts

Do not edit anything else unless you are completely blocked, and if blocked report it instead of expanding scope.

Implement Task 2 from the implementation plan:
- bump backup schema to v3
- update semen_collections and collection_dose_events backup row shapes to the new persisted columns
- keep v2 support only for restore compatibility
- update serializer to emit target fields and per-dose volume fields
- update restore so v2 -> v3 canonicalizes legacy usedOnSite rows exactly like migration 019:
  - dose_count = 1
  - dose_extender_volume_ml = NULL
  - dose_semen_volume_ml = NULL
  - append the legacy-collapse note when prior dose_count > 1
- update validator to enforce the new v3 shapes
- replace dose-count cap validation with volume-based validation
- enforce usedOnSite => dose_extender_volume_ml = NULL and dose_count = 1
- remove any misleading round-trip preservation claim for unknown v3 row keys
- update backup fixtures and tests to v3

Important:
- Your code must line up with the final persisted shapes defined by Worker A.
- If Worker A has already landed, rebase your assumptions to their final field names and SQL shape before finishing.
- Do not change files outside your scope to compensate for mismatches. Report them.

Run targeted verification if feasible:
- npm test -- src/utils/backup/serialize.test.ts
- npm test -- src/utils/backup/restore.test.ts
- npm test -- src/utils/backup/validate.test.ts
- npm test -- src/utils/backup/safetyBackups.test.ts

In your final response:
- list changed files
- summarize what you implemented
- list tests run and results
- call out any dependencies on Worker A or blockers for the integrator
```

## Worker C Prompt

```text
You are Worker C for the BreedWise collection wizard volume rework.

Do not start until Worker A has landed. Your task depends on Worker A's final type shapes, collection calculator, allocation summary util, and updated wizard save payload.

Work in: /home/keymaster4225/BreederHelper

Read first:
- /home/keymaster4225/BreederHelper/AGENTS.md
- /home/keymaster4225/BreederHelper/docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md
- /home/keymaster4225/BreederHelper/docs/plans/2026-04-21-collection-wizard-implementation-plan.md

You are not alone in the codebase. Other workers may be editing other files in parallel. Do not revert their changes. If you encounter edits from others, accommodate them.

Your write scope is exclusive. Edit only these files:
- /home/keymaster4225/BreederHelper/src/hooks/useCollectionWizard.ts
- /home/keymaster4225/BreederHelper/src/screens/CollectionWizardScreen.tsx
- /home/keymaster4225/BreederHelper/src/screens/CollectionWizardScreen.screen.test.tsx
- /home/keymaster4225/BreederHelper/src/screens/CollectionFormScreen.tsx
- /home/keymaster4225/BreederHelper/src/screens/CollectionFormScreen.screen.test.tsx
- /home/keymaster4225/BreederHelper/src/screens/collection-wizard/CollectionBasicsStep.tsx
- /home/keymaster4225/BreederHelper/src/screens/collection-wizard/ProcessingDetailsStep.tsx
- /home/keymaster4225/BreederHelper/src/screens/collection-wizard/DoseAllocationStep.tsx
- /home/keymaster4225/BreederHelper/src/screens/collection-wizard/ReviewStep.tsx
- /home/keymaster4225/BreederHelper/src/screens/collection-wizard/ShippedDoseRowEditor.tsx
- /home/keymaster4225/BreederHelper/src/screens/collection-wizard/OnFarmMareRowEditor.tsx

Do not edit anything else unless you are completely blocked, and if blocked report it instead of expanding scope.

Implement Task 3 from the implementation plan:
- remove the old dose-count collection planning behavior from the wizard
- rebuild Step 1 around collection date, raw volume, concentration, and motility
- rebuild Step 2 as the live calculator with:
  - target motile sperm per dose
  - target post-extension concentration
  - extender type
  - notes
  - derived math panel
  - non-blocking warnings
- rebuild Step 3 around semen-volume allocation summaries, blank-volume messaging, and a single add-order allocation draft list
- store one union draft list with stable client IDs, then split into shippedRows/onFarmRows only at save time
- rebuild shipped-row editor with dose semen volume, dose extender volume, dose count, and derived row totals
- rebuild on-farm-row editor with mare, breeding date, optional dose semen volume, and notes; no editable dose count
- implement calculator-based row prefill rules exactly as locked in the implementation plan
- rebuild Step 4 review around the new sections and totals
- guard Next/Save with volume-based overflow checks
- rebuild CollectionFormScreen to remove old fields and show new target fields plus a read-only derived panel

Locked assumptions from the plan:
- display rounds mL values to 2 decimals
- approximate dose-count displays use 1 decimal
- shipped prefill is valid only when semenPerDoseMl is non-null and extenderPerDoseMl >= 0
- on-farm prefill is valid when semenPerDoseMl is non-null, even if shipped extender math is invalid

Run targeted verification if feasible:
- npm test -- src/screens/CollectionWizardScreen.screen.test.tsx
- npm test -- src/screens/CollectionFormScreen.screen.test.tsx

In your final response:
- list changed files
- summarize what you implemented
- list tests run and results
- call out any assumptions you had to align to Worker A's landed contracts
```

## Worker D Prompt

```text
You are Worker D for the BreedWise collection wizard volume rework.

Do not start until Worker A has landed. Your task depends on Worker A's updated dose-event columns, volume-based cap helpers, and final collection row shape.

Work in: /home/keymaster4225/BreederHelper

Read first:
- /home/keymaster4225/BreederHelper/AGENTS.md
- /home/keymaster4225/BreederHelper/docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md
- /home/keymaster4225/BreederHelper/docs/plans/2026-04-21-collection-wizard-implementation-plan.md

You are not alone in the codebase. Other workers may be editing other files in parallel. Do not revert their changes. If you encounter edits from others, accommodate them.

Your write scope is exclusive. Edit only these files:
- /home/keymaster4225/BreederHelper/src/storage/repositories/breedingRecords.ts
- /home/keymaster4225/BreederHelper/src/storage/repositories/breedingRecords.test.ts
- /home/keymaster4225/BreederHelper/src/screens/BreedingRecordFormScreen.tsx
- /home/keymaster4225/BreederHelper/src/screens/BreedingRecordFormScreen.screen.test.tsx
- /home/keymaster4225/BreederHelper/src/screens/stallion-detail/CollectionsTab.tsx
- /home/keymaster4225/BreederHelper/src/screens/stallion-detail/DoseEventModal.tsx
- /home/keymaster4225/BreederHelper/src/screens/StallionDetailScreen.screen.test.tsx

Do not edit anything else unless you are completely blocked, and if blocked report it instead of expanding scope.

Implement Task 4 from the implementation plan:
- update breedingRecords.ts so linked on-farm breeding records synchronize their companion usedOnSite event in the same transaction
- mirror:
  - breeding_records.date -> collection_dose_events.event_date
  - breeding_records.volume_ml -> collection_dose_events.dose_semen_volume_ml
  - breeding_records.notes -> collection_dose_events.notes
- rerun the collection allocation cap check when linked on-farm volume_ml changes
- block for linked on-farm records:
  - changing method away from freshAI
  - clearing collection_id
  - switching collection_id to a different collection
- add src/storage/repositories/breedingRecords.test.ts to cover the linked on-farm contract
- update BreedingRecordFormScreen.tsx so linked on-farm records expose only edits consistent with the new repo rules
- update CollectionsTab.tsx to remove rendering of deleted collection-level fields and show new stored targets and row-level volume info
- update DoseEventModal.tsx so shipped events can create/edit dose semen volume and dose extender volume with volume-based validation and per-row totals
- keep DoseEventModal shipped-only
- preserve press-through navigation from usedOnSite cards to the linked breeding record

Run targeted verification if feasible:
- npm test -- src/storage/repositories/breedingRecords.test.ts
- npm test -- src/screens/BreedingRecordFormScreen.screen.test.tsx
- npm test -- src/screens/StallionDetailScreen.screen.test.tsx

In your final response:
- list changed files
- summarize what you implemented
- list tests run and results
- call out any integration risks for Worker C or the integrator
```

## Integrator Prompt

```text
You are the integrator for the BreedWise collection wizard volume rework.

Work in: /home/keymaster4225/BreederHelper

Do not start until Worker A, Worker B, Worker C, and Worker D have all landed.

Read first:
- /home/keymaster4225/BreederHelper/AGENTS.md
- /home/keymaster4225/BreederHelper/docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md
- /home/keymaster4225/BreederHelper/docs/plans/2026-04-21-collection-wizard-implementation-plan.md
- the final messages/results from Workers A, B, C, and D

You are not alone in the codebase. Do not revert worker changes unless a direct conflict makes it necessary and you fully understand why.

Your job:
- inspect the landed worker changes
- resolve cross-worker fallout without redoing their owned tasks
- fix stale exports, mocks, and integration wiring if still needed
- touch AppNavigator only if route/title fallout remains
- update AppNavigator integration coverage if mocks or screen contracts changed
- fix any stale partial mocks that still reference removed collection-level fields
- run the full verification suite
- perform the manual QA checklist from the implementation plan if feasible

Expected commands:
- npm run typecheck
- npm test
- npm run test:screen
- npm run lint

Manual smoke targets:
- create collection with calculator targets and no rows
- create shipped allocations and confirm semen-volume cap enforcement
- create on-farm allocation with recorded semen volume
- create on-farm allocation with blank semen volume
- edit a shipped dose event
- edit a linked on-farm breeding record
- confirm blocked method/collection changes on linked on-farm breeding records
- edit a saved collection and confirm derived panel behavior
- restore a v2 backup path and confirm canonicalized usedOnSite rows

In your final response:
- list changed files
- summarize integration fixes
- list full verification results
- list any residual risk or follow-up work
```

