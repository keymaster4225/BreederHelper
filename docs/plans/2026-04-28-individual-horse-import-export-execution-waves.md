# Individual Horse Import / Export Execution Waves

> Date: 2026-04-28  
> Status: Execution breakdown for implementation  
> Source spec: `docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md`  
> Addendum: `docs/plans/import-export-addendum.md`

## Purpose

This document breaks the individual horse import/export feature into reviewable
implementation waves. The source implementation plan remains the behavioral
contract; this file is the execution runbook for sequencing, sub-agent use,
quality gates, and PR boundaries.

The feature should not be implemented as one large PR. It crosses the backup
restore guard, a new storage package format, deterministic export, strict
validation, fuzzy matching, ID remapping, transactional import, safety snapshots,
hooks, and screen flows. Each wave below should be independently reviewable and
should leave the app in a coherent state.

## Current Progress

- Current branch: `feature/individual-horse-import-export`.
- Wave 0 is complete: the source plan is decision-complete, the corrupted
  addendum was replaced with resolved decisions, and baseline checks passed.
- Wave 1 is complete: horse-transfer envelope types, strict v1 validation, full
  restore rejection, and backup-hook rejection are implemented and verified.
- Wave 2 is complete: deterministic mare/stallion export and horse-package file
  I/O are implemented and verified.
- Next wave: Wave 3, matching, preview, and import planning.
- No production import write path exists yet.

## Global Execution Rules

- Work on `feature/individual-horse-import-export` or a child branch of it.
- Do not push to GitHub without explicit user permission.
- Do not merge branch work directly into `main`; branch work must go through a PR.
- Never bypass or weaken a failing test. Drill to the root cause.
- Keep the existing full-database backup/restore behavior working throughout.
- Keep presentation components out of storage modules. Screen orchestration belongs
  in hooks under `src/hooks/`.
- Use one fresh implementation sub-agent per wave when the wave is delegated.
- Use a reviewer sub-agent after each implementation wave before committing.
- Workers must stay in their assigned write scope. If a necessary edit falls
  outside scope, stop and report it instead of expanding scope silently.
- Every worker must read `AGENTS.md`, the source implementation plan, and this
  execution plan before editing.

## Required Plan Hardening Before Code

Complete these source-plan clarifications before Wave 1 implementation. These
are small documentation edits, but they prevent divergent implementations.

- Add explicit foal-conflict summary behavior:
  - When an imported foal conflicts with an existing foal for the mapped
    foaling record, the import summary must surface rich lost-data context,
    including whether imported `milestones` and `igg_tests` differ from the
    destination row.
  - The summary must not collapse this to only "1 conflict".
- Pin fuzzy candidate threshold:
  - Use a normalized fuzzy score threshold of `>= 0.6`.
  - Fuzzy candidates remain suggestions only and never auto-match.
- Add round-trip determinism test requirement:
  - Exporting the same unchanged horse package twice should produce byte-identical
    JSON after normalizing `createdAt`.
- Clarify metadata consumers:
  - `app.version` and privacy flags are shown in import/export preview and summary
    copy; in v1 the privacy flags are always `true` and document redaction that
    already occurred.
- Specify schema mismatch copy:
  - If `dataSchemaVersion` is greater than the current backup schema version:
    `This horse package was created by a newer version of BreedWise. Update BreedWise and try again.`
  - If `dataSchemaVersion` is less than the current backup schema version:
    `This horse package uses an older BreedWise data format that cannot be imported by this version. Ask the sender to export it again from an updated app.`
- Confirm strict row-shape validation:
  - v1 validation rejects unknown table keys, missing table keys, missing row
    fields, and unknown row fields. It must not silently drop unexpected columns.
- Promote shared helper decision:
  - Extract reusable table specs and raw insert helpers when doing so prevents
    restore/import drift without forcing horse import through a fake full-backup
    envelope.
  - Any duplicated SQL left after Wave 4 must be listed as explicit tech debt.
- Confirm the open task unique predicate:
  - Use the schema predicate from `idx_tasks_open_breeding_preg_check_unique`:
    `status = 'open' AND source_type = 'breedingRecord' AND source_reason = 'breedingPregnancyCheck'`.

Quality gate:

- Source plan and this execution file agree on the above decisions.
- No code implementation starts until the hardening edits are complete.

## Sub-Agent Operating Model

Use sub-agents for bounded work with clear file ownership. Avoid parallel
implementation until write scopes are disjoint. Recommended roles:

- **Storage Contract Worker:** envelope types, strict validation, restore guard,
  schema mismatch copy, and backup-hook rejection.
- **Serializer Worker:** mare/stallion closure queries, privacy redaction,
  deterministic ordering, filenames, and share helpers.
- **Preview Planner Worker:** matching, fuzzy scoring, import preview, ID remap
  planning, and natural-key preflight classification.
- **Import Engine Worker:** transactional import, effective-data comparison,
  conflict summaries, safety snapshot timing, and invalidation.
- **UI Worker:** export actions, import flow, hooks, alerts, preview, candidate
  selection, cancellation, and final summary.
- **Reviewer Agent:** read-only spec compliance and code-quality review after
  each wave.

Reviewer prompt template:

```text
You are reviewing a completed wave of the BreedWise individual horse import/export implementation.

Work in: /home/keymaster4225/BreederHelper

Read first:
- AGENTS.md
- docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md
- docs/plans/import-export-addendum.md
- docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md

Review only. Do not edit files.

Check the completed changes against the wave scope, source spec, and quality gates.
Prioritize behavioral bugs, data-loss risks, broken import/export invariants,
backup-restore regressions, missing tests, and unclear user-facing failure copy.

Return:
- findings ordered by severity, with file/line references where possible
- missing test coverage
- whether this wave is safe to commit
```

## Wave 0: Plan Hardening And Baseline

Goal: lock ambiguous decisions and confirm the repo baseline before storage work.

Recommended owner: local lead or documentation worker.

Write scope:

- `docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md`
- `docs/plans/import-export-addendum.md`
- `docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md`

Tasks:

- Fold the addendum concerns into the implementation plan where they define
  behavior.
- Clean up or replace the duplicated/corrupted addendum text if the addendum is
  kept as an active reference.
- Record the task partial-index predicate from the migration.
- Run the baseline checks that are practical before code changes.

Targeted checks:

```bash
npm run typecheck
npm test -- src/storage/backup/validate.test.ts src/storage/backup/restore.test.ts
npm run test:screen -- DataBackupScreen.screen.test.tsx
```

Baseline results recorded on 2026-04-28:

- `npm run typecheck` passed.
- `npm test -- src/storage/backup/validate.test.ts src/storage/backup/restore.test.ts` passed: 55 tests across 2 files.
- `npm run test:screen -- DataBackupScreen.screen.test.tsx` passed: 4 screen tests.
- No baseline failures were found before feature code began.

Exit criteria:

- The source implementation plan is decision-complete.
- Baseline failures, if any, are documented before feature code begins.
- No production code changes are included in this wave.

## Wave 1: Format, Strict Validation, And Full-Restore Guard

Goal: make horse-transfer files distinguishable, reject them from destructive
full restore, and validate the v1 envelope strictly.

Recommended owner: Storage Contract Worker.

Dependencies:

- Wave 0 complete.

Write scope:

- Create `src/storage/horseTransfer/types.ts`
- Create `src/storage/horseTransfer/validate.ts`
- Create `src/storage/horseTransfer/index.ts`
- Modify `src/storage/backup/restore.ts`
- Modify `src/storage/backup/restore.test.ts`
- Modify `src/hooks/useDataBackup.ts`
- Modify relevant backup hook or screen tests only if needed for rejection copy

Implementation tasks:

- Define `HorseTransferEnvelopeV1`, `HorseTransferTablesV1`, preview/result
  primitives, row conflict reason types, and constants.
- Add `validateHorseTransferJson()` and `validateHorseTransfer()` with strict
  top-level discriminator/version/schema checks.
- Require every backup table key to exist and be an array.
- Reject unknown envelope keys and unknown row fields for v1.
- Add schema-version mismatch messages exactly as locked in Wave 0.
- Add the full-restore raw guard before `validateBackup()` or
  `validateBackupJson()` can normalize away unknown fields.
- For string candidates, parse once, check top-level `artifactType`, then pass
  the parsed object or original string into backup validation without changing
  existing full-backup behavior.
- For object candidates, check the original object before backup validation.
- Add hook-level rejection in `useDataBackup().prepareRestoreFromPickedFile()`
  so the destructive restore preview is never shown for a horse package.

Quality gates:

```bash
npm test -- src/storage/backup/restore.test.ts src/storage/backup/validate.test.ts
npm run test:screen -- DataBackupScreen.screen.test.tsx
npm run typecheck
```

Wave 1 verification recorded on 2026-04-28:

- `npm run typecheck` passed.
- `npm test -- src/storage/backup/restore.test.ts src/storage/backup/validate.test.ts src/storage/horseTransfer/validate.test.ts` passed: 68 tests across 3 files.
- `npm run test:screen -- DataBackupScreen.screen.test.tsx useDataBackup.screen.test.tsx` passed: 5 screen/hook tests across 2 files.
- `npm run lint` passed as an extra check.

Required tests:

- Full restore rejects horse-transfer JSON string.
- Full restore rejects horse-transfer object candidate.
- `prepareRestoreFromPickedFile()` rejects horse-transfer files before preview.
- Horse validator rejects non-horse JSON, unsupported `transferVersion`,
  mismatched `dataSchemaVersion`, missing tables, unknown tables, missing row
  fields, and unknown row fields.
- Horse validator emits newer/older schema mismatch copy.

Exit criteria:

- Destructive full restore cannot preview or execute a horse-transfer file.
- Full backup restore tests still pass.
- No export/import write path exists yet.

## Wave 2: Deterministic Export And File I/O

Goal: produce valid, deterministic mare and stallion horse packages without
implementing import.

Recommended owner: Serializer Worker.

Dependencies:

- Wave 1 complete.

Write scope:

- Create `src/storage/horseTransfer/serializeMare.ts`
- Create `src/storage/horseTransfer/serializeStallion.ts`
- Create `src/storage/horseTransfer/fileIO.ts`
- Modify `src/storage/horseTransfer/index.ts`
- Modify `src/storage/horseTransfer/types.ts` only for export result types
- Add `src/storage/horseTransfer/serializeMare.test.ts`
- Add `src/storage/horseTransfer/serializeStallion.test.ts`
- Add focused file helper tests if local patterns warrant them

Implementation tasks:

- Serialize all mare-package rows in one read transaction.
- Serialize all stallion-package rows in one read transaction.
- Use deterministic `ORDER BY` clauses for every table query.
- Export mare closure exactly as specified:
  - root mare, tasks, breeding records, daily logs, uterine rows, medication
    logs, pregnancy checks, foaling records, linked foals, context stallions,
    and referenced semen collections
  - empty `frozen_semen_batches` and `collection_dose_events`
- Redact context stallions by default:
  - keep stable display/FK fields
  - set `sire`, `dam`, `notes`, and AV fields to `null`
  - include referenced soft-deleted context stallions
- Export stallion closure exactly as specified:
  - root stallion, semen collections, frozen semen batches, and reachable dose
    events
  - empty mare-owned tables
- Redact stallion dose events by default:
  - set `breeding_record_id` to `null`
  - set `recipient = 'Redacted'`
  - null recipient phone/address, carrier, container, tracking, and notes
- Set `privacy.redactedContextStallions` and
  `privacy.redactedDoseRecipientAndShipping` consistently with package type.
- Implement filename stems and slugging rules.
- Implement share/picker helpers without reusing backup-specific user copy.

Quality gates:

```bash
npm test -- src/storage/horseTransfer/serializeMare.test.ts src/storage/horseTransfer/serializeStallion.test.ts
npm test -- src/storage/backup/restore.test.ts
npm run typecheck
```

Wave 2 verification recorded on 2026-04-28:

- `npm test -- src/storage/horseTransfer/serializeMare.test.ts src/storage/horseTransfer/serializeStallion.test.ts src/storage/horseTransfer/fileIO.test.ts src/storage/backup/restore.test.ts` passed: 27 tests across 4 files.
- `npm run typecheck` passed.
- Reviewer finding about the `fileIO` public export was resolved by lazy-loading
  Expo file/share/picker modules so the storage barrel remains safe for backup
  restore tests.

Required tests:

- Mare export includes the exact closure and no extra horse-owned rows.
- Mare export includes redacted context stallions and referenced collections.
- Mare export leaves stallion-owned inventory tables empty.
- Stallion export includes exact stallion closure.
- Stallion export nulls `breeding_record_id` on dose events.
- Stallion export redacts recipient/shipping fields.
- Both exports produce deterministic ordering.
- Round-trip determinism: unchanged export JSON is byte-identical after
  normalizing `createdAt`.
- Filename slugging lowercases, collapses hyphens, caps at 48 chars, and falls
  back to `horse`.

Exit criteria:

- Exported packages validate with Wave 1 validation.
- Import remains unavailable.
- Backup restore guard still rejects exported horse packages.

## Wave 3: Matching, Preview, And Import Planning

Goal: preview an import, compute match candidates, classify ambiguities, and plan
ID remapping before any database writes.

Recommended owner: Preview Planner Worker.

Dependencies:

- Wave 2 complete.

Write scope:

- Create `src/storage/horseTransfer/matching.ts`
- Create `src/storage/horseTransfer/preview.ts`
- Create `src/storage/horseTransfer/remap.ts`
- Modify `src/storage/horseTransfer/types.ts`
- Modify `src/storage/horseTransfer/index.ts`
- Add `src/storage/horseTransfer/matching.test.ts`
- Add `src/storage/horseTransfer/preview.test.ts`
- Add `src/storage/horseTransfer/remap.test.ts`

Implementation tasks:

- Implement exact match precedence:
  - exported internal ID
  - exact non-empty normalized registration number
  - exact normalized name plus exact DOB when both DOBs are present
- Mark import ambiguous if exact rules point to different destination horses.
- Require confirmation when ID matches but lower-precedence identity fields all
  contradict the import.
- Treat soft-deleted ID matches as ambiguous.
- Implement fuzzy normalization:
  - lowercasing, trimming, whitespace collapse, punctuation/apostrophe removal
  - drop final suffix tokens `farm`, `farms`, `ranch`, `rsf`, `llc`, `inc`,
    `sr`, `jr`
- Disqualify fuzzy candidates when both registration numbers are present and
  differ.
- Disqualify fuzzy candidates when both DOBs are present and differ.
- Use fuzzy threshold `>= 0.6`.
- Keep fuzzy suggestions as suggestions only; never auto-match.
- Build preview counts, estimated conflicts, redaction notices, and safety
  snapshot promise copy.
- Build an import plan without opening a write transaction:
  - root create-new vs existing match
  - source ID preservation vs remap
  - child ID preservation, already-present classification, conflict
    classification, and safe rewrites
  - context stallion and semen collection link handling
- Preflight natural unique keys:
  - daily logs by mapped `(mare_id, date, time)`
  - uterine flushes by mapped `daily_log_id`
  - foals by mapped `foaling_record_id`
  - open breeding pregnancy-check tasks using the schema predicate

Quality gates:

```bash
npm test -- src/storage/horseTransfer/matching.test.ts src/storage/horseTransfer/preview.test.ts src/storage/horseTransfer/remap.test.ts
npm run typecheck
```

Required tests:

- Exact ID, registration, and name+DOB precedence.
- Conflicting exact-match signals become ambiguous.
- Soft-deleted ID match is ambiguous.
- ID match with identity contradictions requires confirmation.
- Fuzzy suggestions meet threshold and never auto-match.
- Fuzzy suggestions disqualify mismatched registration numbers and DOBs.
- Create-new with unused source ID plans ID preservation.
- Create-new with source ID collision plans root/child remap.
- Existing-match import plans child FKs to local root.
- Child ID collision under unrelated ownership plans rewrite.
- Natural unique conflicts are classified before insert planning.
- Context stallion collision plans custom stallion text and unsafe collection
  nulling.

Exit criteria:

- UI could show a safe import preview from this wave alone.
- No import transaction or inserts are implemented yet.

## Wave 4: Transactional Import Engine

Goal: execute a confirmed import without overwriting existing rows, while
preserving conflicts and producing row-level summaries.

Recommended owner: Import Engine Worker.

Dependencies:

- Wave 3 complete.

Write scope:

- Create `src/storage/horseTransfer/importHorse.ts`
- Modify `src/storage/horseTransfer/remap.ts` only as required by execution
- Modify `src/storage/horseTransfer/types.ts`
- Modify `src/storage/horseTransfer/index.ts`
- Modify or extract shared helpers from `src/storage/backup/restore.ts` only if
  needed to avoid duplicate insert drift
- Add `src/storage/horseTransfer/importHorse.test.ts`
- Add or update shared insert/table-spec tests if helpers are extracted

Implementation tasks:

- Accept only a validated envelope and an explicit import option:
  - confirmed existing match, or
  - create-new path
- Create safety snapshot only after validation, preview/match confirmation, and
  import-plan construction.
- Expose `skipSafetySnapshot: true` only for tests.
- Run all inserts in one SQLite transaction.
- Use regular `INSERT`, not blanket `INSERT OR IGNORE`.
- Preflight destination PKs and known natural unique keys.
- Rewrite IDs and downstream FKs according to the import plan.
- Compare effective data for same-ID/same-ownership rows:
  - exclude only `created_at` and `updated_at`
  - include `deleted_at`
  - compare canonicalized JSON-text fields
- Preserve destination rows on conflicts.
- Report inserted, already-present, skipped, and conflict counts by table.
- Include row-level reasons for every non-inserted row.
- Explicitly report cascade skips when a parent conflict drops dependent rows.
- Explicitly report rich foal conflict details for differing milestones and IgG
  history.
- Preserve breeding records when context stallion links are unsafe by setting
  `stallion_id = null`, `stallion_name` to exported name, and `collection_id = null`.
- Emit `emitDataInvalidation('all')` after successful transaction.
- Refresh safety snapshot list in the hook/UI wave, not inside storage.

Quality gates:

```bash
npm test -- src/storage/horseTransfer/importHorse.test.ts
npm test -- src/storage/backup/restore.test.ts src/storage/backup/safetyBackups.test.ts
npm run typecheck
```

Required tests:

- Create-new with unused source ID preserves ID.
- Create-new with source ID collision remaps root and child FKs.
- Existing-match import remaps child FKs to local root.
- Child ID collision under unrelated horse rewrites and inserts.
- Daily-log natural unique conflict reports conflict, not already-present.
- Foal natural conflict reports rich-data conflict, including milestones and IgG
  differences.
- Idempotent re-import inserts zero rows and reports already-present rows.
- Same-ID different effective data reports conflict.
- Context stallion collision preserves breeding as custom stallion and nulls
  unsafe collection link.
- Successful import emits `emitDataInvalidation('all')`.
- Cancellation and validation failure do not create safety snapshots.
- Confirmed import creates safety snapshot before writes.
- Failed transaction rolls back and reports whether a safety snapshot was created.

Exit criteria:

- Storage-level import/export is complete.
- No UI flow is required to exercise import in tests.
- Full backup restore still passes its regression suite.

## Wave 5: Hooks And UI Integration

Goal: expose export/import through BreedWise UI without mixing presentation and
storage responsibilities.

Recommended owner: UI Worker.

Dependencies:

- Wave 4 complete.

Write scope:

- Create `src/hooks/useHorseExport.ts`
- Create `src/hooks/useHorseImport.ts`
- Modify `src/screens/mare-detail/MareDetailHeader.tsx`
- Modify `src/screens/StallionDetailScreen.tsx`
- Modify `src/screens/stallion-detail/StallionDetailHeader.tsx` if the header
  owns the edit/action buttons in the current code shape
- Modify `src/screens/DataBackupScreen.tsx`
- Modify `src/screens/MareDetailScreen.screen.test.tsx`
- Modify `src/screens/StallionDetailScreen.screen.test.tsx`
- Modify `src/screens/DataBackupScreen.screen.test.tsx`
- Modify navigation/test mocks only if required by the existing test harness

Implementation tasks:

- Add mare export icon beside the calendar action with accessibility label
  `Export mare package`.
- Add stallion export icon beside edit with accessibility label
  `Export stallion package`.
- Implement export hook behavior:
  - serialize package
  - create filename
  - write JSON
  - share using horse-package copy
  - report success/failure alerts
- Add `Import Horse` as an additive DataBackupScreen action visually distinct
  from destructive `Restore From File`.
- Implement import hook behavior:
  - pick file
  - validate
  - build preview
  - expose exact/ambiguous/fuzzy target state
  - accept create-new or confirmed existing match
  - confirm import
  - refresh safety snapshots
  - expose final summary
- Import preview must show:
  - horse name/type
  - redaction notices from privacy flags
  - estimated row counts
  - estimated conflicts
  - fuzzy suggestions, if any
  - safety snapshot promise
  - exact copy: `Importing never overwrites existing data.`
- Import summary must show row-level conflict/skipped reasons in a scannable
  format, including rich foal conflict details.
- Do not add foal-only export UI.

Quality gates:

```bash
npm run test:screen -- MareDetailScreen.screen.test.tsx StallionDetailScreen.screen.test.tsx DataBackupScreen.screen.test.tsx
npm run typecheck
```

Required tests:

- Mare export action calls the export hook.
- Mare export success and failure alerts render.
- Stallion export action calls the export hook.
- Stallion export success and failure alerts render.
- DataBackupScreen shows `Import Horse` separately from restore.
- Invalid horse package shows validation error.
- Horse package selected through full restore shows clean rejection and no
  destructive preview.
- Import preview renders counts, redaction notices, safety copy, and no-overwrite
  copy.
- Fuzzy candidate selection can be confirmed.
- Create-new path can be confirmed.
- Canceling import creates no safety snapshot.
- Final summary renders inserted, already-present, skipped, and conflict counts.

Exit criteria:

- Feature is usable from the app UI.
- Screen tests cover main success, cancel, and failure paths.
- Storage modules are only called through hooks, not directly from presentation
  components.

## Wave 6: Final Integration, Manual Smoke, And PR Readiness

Goal: prove the whole feature works end to end and is ready for review.

Recommended owner: local lead plus Reviewer Agent.

Dependencies:

- Wave 5 complete.

Tasks:

- Run full automated checks.
- Run manual Android smoke.
- Run cross-device JSON transfer smoke.
- Have a reviewer agent perform final source-spec compliance review.
- Commit only after automated checks and review findings are resolved.

Full automated checks:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

Manual Android smoke:

- Export mare with daily logs, breeding, pregnancy check, foaling, foal,
  medication, and task.
- Import that package into the same DB and verify idempotent already-present
  summary.
- Import that package into a clean DB and verify full mare history renders.
- Import into a DB with a conflicting daily log and verify conflict details.
- Try a horse package through full restore and verify clean rejection with DB
  untouched.
- Export stallion and inspect JSON to verify recipient/shipping redaction.

Cross-device smoke:

- Transfer exported JSON to another emulator or device.
- Import the package.
- Verify imported records render in the expected mare or stallion screens.
- Verify the final summary matches imported/already-present/conflict outcomes.

Final reviewer checklist:

- Full backup restore cannot accept horse packages.
- Horse import never overwrites destination rows.
- Fuzzy matches never auto-merge.
- Safety snapshot timing matches the source spec.
- Row-level conflict summaries are specific enough for user trust.
- Unsupported horse-transfer versions and schema mismatches fail with actionable
  copy.
- UI copy distinguishes non-destructive horse import from destructive full
  restore.

Exit criteria:

- All automated checks pass or any unrelated baseline failures are documented.
- Manual smoke results are recorded in the PR description.
- Reviewer agent has no blocking findings.

## Suggested Worker Prompts

Use these as starting prompts for fresh sub-agent sessions. Adjust file scopes if
prior waves legitimately moved shared helpers, but keep scopes explicit.

### Storage Contract Worker Prompt

```text
You are the Storage Contract Worker for BreedWise individual horse import/export.

Work in: /home/keymaster4225/BreederHelper

Read first:
- AGENTS.md
- docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md
- docs/plans/import-export-addendum.md
- docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md

You are not alone in the codebase. Do not revert edits made by others. Stay in
your assigned write scope.

Implement Wave 1 only: format types, strict validation, and full-restore guard.

Write scope:
- src/storage/horseTransfer/types.ts
- src/storage/horseTransfer/validate.ts
- src/storage/horseTransfer/index.ts
- src/storage/backup/restore.ts
- src/storage/backup/restore.test.ts
- src/hooks/useDataBackup.ts
- related hook/screen tests only if needed for horse-package rejection copy

Run targeted checks from Wave 1 if feasible.

Final response must list changed files, tests run, and any blockers.
```

### Serializer Worker Prompt

```text
You are the Serializer Worker for BreedWise individual horse import/export.

Work in: /home/keymaster4225/BreederHelper

Read first:
- AGENTS.md
- docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md
- docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md

You are not alone in the codebase. Do not revert edits made by others. Stay in
your assigned write scope.

Do not start unless Wave 1 is complete.

Implement Wave 2 only: deterministic mare/stallion export and horse package file
helpers. Do not implement import preview or import writes.

Write scope:
- src/storage/horseTransfer/serializeMare.ts
- src/storage/horseTransfer/serializeStallion.ts
- src/storage/horseTransfer/fileIO.ts
- src/storage/horseTransfer/index.ts
- src/storage/horseTransfer/types.ts only for export result types
- src/storage/horseTransfer/serializeMare.test.ts
- src/storage/horseTransfer/serializeStallion.test.ts

Run targeted checks from Wave 2 if feasible.

Final response must list changed files, tests run, and any blockers.
```

### Preview Planner Worker Prompt

```text
You are the Preview Planner Worker for BreedWise individual horse import/export.

Work in: /home/keymaster4225/BreederHelper

Read first:
- AGENTS.md
- docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md
- docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md

You are not alone in the codebase. Do not revert edits made by others. Stay in
your assigned write scope.

Do not start unless Waves 1 and 2 are complete.

Implement Wave 3 only: exact/fuzzy matching, import preview, ID remap planning,
and natural-key preflight classification. Do not create safety snapshots or write
imported rows.

Write scope:
- src/storage/horseTransfer/matching.ts
- src/storage/horseTransfer/preview.ts
- src/storage/horseTransfer/remap.ts
- src/storage/horseTransfer/types.ts
- src/storage/horseTransfer/index.ts
- src/storage/horseTransfer/matching.test.ts
- src/storage/horseTransfer/preview.test.ts
- src/storage/horseTransfer/remap.test.ts

Run targeted checks from Wave 3 if feasible.

Final response must list changed files, tests run, and any blockers.
```

### Import Engine Worker Prompt

```text
You are the Import Engine Worker for BreedWise individual horse import/export.

Work in: /home/keymaster4225/BreederHelper

Read first:
- AGENTS.md
- docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md
- docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md

You are not alone in the codebase. Do not revert edits made by others. Stay in
your assigned write scope.

Do not start unless Wave 3 is complete.

Implement Wave 4 only: transactional import engine, effective-data comparison,
conflict summaries, safety snapshot timing, and invalidation.

Write scope:
- src/storage/horseTransfer/importHorse.ts
- src/storage/horseTransfer/remap.ts only as required by execution
- src/storage/horseTransfer/types.ts
- src/storage/horseTransfer/index.ts
- src/storage/backup/restore.ts only for shared helper extraction if needed
- src/storage/horseTransfer/importHorse.test.ts
- shared helper tests only if helpers are extracted

Run targeted checks from Wave 4 if feasible.

Final response must list changed files, tests run, and any blockers.
```

### UI Worker Prompt

```text
You are the UI Worker for BreedWise individual horse import/export.

Work in: /home/keymaster4225/BreederHelper

Read first:
- AGENTS.md
- docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md
- docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md

You are not alone in the codebase. Do not revert edits made by others. Stay in
your assigned write scope.

Do not start unless Wave 4 is complete.

Implement Wave 5 only: hooks and UI integration for export/import. Do not change
storage import semantics except to fix integration bugs reported by tests.

Write scope:
- src/hooks/useHorseExport.ts
- src/hooks/useHorseImport.ts
- src/screens/mare-detail/MareDetailHeader.tsx
- src/screens/StallionDetailScreen.tsx
- src/screens/stallion-detail/StallionDetailHeader.tsx if that component owns
  the current action buttons
- src/screens/DataBackupScreen.tsx
- src/screens/MareDetailScreen.screen.test.tsx
- src/screens/StallionDetailScreen.screen.test.tsx
- src/screens/DataBackupScreen.screen.test.tsx
- navigation/test mocks only if required by existing test harness

Run targeted checks from Wave 5 if feasible.

Final response must list changed files, tests run, and any blockers.
```
