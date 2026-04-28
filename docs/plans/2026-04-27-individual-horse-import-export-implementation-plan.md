# Individual Horse Import / Export — Implementation Plan

> Date: 2026-04-27  
> Status: Decision-complete after Wave 0 hardening  
> Roadmap entry: P1 under **Cloud backup & collaboration** (`ROADMAP.md:85-86`, `TODO:39`)

## Context

BreedWise currently has full-database backup/restore under `src/storage/backup/`. That pipeline is destructive on restore: it validates a backup, creates a safety snapshot, deletes every managed table, and reinserts all rows. It must continue working unchanged.

This feature adds a separate horse-transfer pipeline for a single mare or stallion. It is additive, scoped, and non-overwriting. It exists as a short-term handoff mechanism for vets, buyers, sellers, and second devices before true sync/conflict resolution exists.

Implementation must not use the full-backup envelope as the horse-transfer file. A distinct discriminator keeps full restore from accidentally treating a horse package as a database backup.

## Locked Behavior

- Import never overwrites existing rows.
- Fuzzy matches never auto-merge; they only offer user-selectable suggestions.
- Conflicting rows are preserved on the destination and reported with row-level reasons.
- Safety snapshot is created only after validation and user confirmation, immediately before the import transaction.
- Full backup restore must reject horse-transfer files before destructive restore preview or destructive restore execution.
- Foals travel only with dam/mare exports. There is no standalone foal export in v1.
- v1 rejects unsupported horse-transfer versions rather than trying implicit migration.

## Format

Create a new `src/storage/horseTransfer/` module with a dedicated v1 envelope:

```ts
export type HorseTransferEnvelopeV1 = {
  readonly artifactType: 'breedwise.horseTransfer';
  readonly transferVersion: 1;
  readonly dataSchemaVersion: typeof BACKUP_SCHEMA_VERSION_CURRENT;
  readonly createdAt: string;
  readonly app: {
    readonly name: 'BreedWise';
    readonly version: string;
  };
  readonly sourceHorse: {
    readonly type: 'mare' | 'stallion';
    readonly id: string;
    readonly name: string;
    readonly registrationNumber: string | null;
    readonly dateOfBirth: string | null;
  };
  readonly privacy: {
    readonly redactedContextStallions: boolean;
    readonly redactedDoseRecipientAndShipping: boolean;
  };
  readonly tables: HorseTransferTablesV1;
};
```

`HorseTransferTablesV1` uses the current raw backup row types from `src/storage/backup/types.ts` for table shape. All table arrays are present so validators/importers can reason consistently about empty scope.

`app.version` and the `privacy` flags are user-facing metadata. Import/export previews and summaries should show the app version when useful for troubleshooting and should use the privacy flags to explain redactions that already occurred. In v1, `redactedContextStallions` and `redactedDoseRecipientAndShipping` are always `true` for the package types where those redactions apply; they are not opt-in toggles.

Do not add speculative `photos: []` row fields in v1. Photo bytes and manifests remain out of scope until Photos V1 has a concrete schema.

### Full Restore Guard

`restoreBackup()` must reject any raw payload whose top-level `artifactType === 'breedwise.horseTransfer'` before calling `validateBackup()` or normalizing the backup. The current backup validator reconstructs a known-field backup object and drops unknown top-level fields, so checking after validation is unsafe.

Required guard behavior:

- For string candidates, parse once, check `artifactType`, then pass the parsed value to backup validation.
- For object candidates, check the original object before backup validation.
- Return `errorMessage: 'This file is a horse package. Use Settings > Backup & Restore > Import Horse.'`.
- `useDataBackup().prepareRestoreFromPickedFile()` should also reject horse-transfer files before showing the destructive restore preview.

## Module Layout

```
src/storage/horseTransfer/
  types.ts              // envelope, preview, result, conflict reason types
  serializeMare.ts      // exportMareTransfer(mareId)
  serializeStallion.ts  // exportStallionTransfer(stallionId, options?)
  validate.ts           // validateHorseTransferJson / validateHorseTransfer
  matching.ts           // exact/fuzzy match candidates and precedence
  preview.ts            // previewHorseImport(envelope)
  remap.ts              // ID map planning and FK rewrite helpers
  importHorse.ts        // importHorseTransfer(envelope, options)
  fileIO.ts             // filename creation, picker, share helpers
  index.ts              // public surface
```

Keep screen orchestration in hooks:

- `src/hooks/useHorseExport.ts`
- `src/hooks/useHorseImport.ts`

Presentation components should not import storage modules directly.

## Serialization

All export queries must run inside one read transaction and must specify deterministic `ORDER BY` clauses. Prefer ordering that matches `serializeBackup()` where practical.

### Mare Scope

Source mare must satisfy `id = ? AND deleted_at IS NULL`; otherwise throw `MareNotFoundError`.

Include:

1. `mares`: exactly the source mare.
2. `tasks`: `WHERE mare_id = ?`.
3. `breeding_records`: `WHERE mare_id = ?`.
4. `daily_logs`: `WHERE mare_id = ?`.
5. `uterine_fluid`: rows reachable through included daily logs.
6. `uterine_flushes`: rows reachable through included daily logs.
7. `uterine_flush_products`: rows reachable through included uterine flushes.
8. `medication_logs`: `WHERE mare_id = ?`.
9. `pregnancy_checks`: `WHERE mare_id = ?`.
10. `foaling_records`: `WHERE mare_id = ?`.
11. `foals`: rows reachable through included foaling records.
12. Context `stallions`: exactly stallions referenced by included breeding records with non-null `stallion_id`.
13. Context `semen_collections`: exactly collections referenced by included breeding records with non-null `collection_id`.

Empty:

- `frozen_semen_batches`
- `collection_dose_events`

Context stallion privacy redaction is required by default. Export context stallion rows with stable display/FK fields only: `id`, `name`, `breed`, `registration_number`, `date_of_birth`, timestamps, and `deleted_at`. Set `sire`, `dam`, `notes`, and AV fields to `null`.

If a referenced context stallion was soft-deleted, include the redacted row anyway so breeding FK validation can succeed. The root mare itself may not be deleted.

### Stallion Scope

Source stallion must satisfy `id = ? AND deleted_at IS NULL`; otherwise throw `StallionNotFoundError`.

Include:

1. `stallions`: exactly the source stallion.
2. `semen_collections`: `WHERE stallion_id = ?`.
3. `frozen_semen_batches`: `WHERE stallion_id = ?`.
4. `collection_dose_events`: rows reachable through included semen collections.

For every exported dose event:

- Set `breeding_record_id` to `null`.
- Redact recipient/shipping fields by default: `recipient = 'Redacted'`; `recipient_phone`, `recipient_street`, `recipient_city`, `recipient_state`, `recipient_zip`, `carrier_service`, `container_type`, `tracking_number`, and `notes` become `null`.

All mare-owned tables are empty.

## Filename And Sharing

Filename stems:

- `breedwise-mare-<slug>-v1-<YYYYMMDD-HHMMSS>.json`
- `breedwise-stallion-<slug>-v1-<YYYYMMDD-HHMMSS>.json`

Slug rule: lowercase, ASCII alphanumeric words joined with hyphens, repeated hyphens collapsed, max 48 characters, fallback `horse`.

Do not reuse backup-specific share copy. Horse package sharing should use dialog title/copy like "Share horse package".

## Validation

Validation has four layers:

1. JSON parsing and discriminator/version checks.
2. Row shape checks for every table.
3. Existing backup-style cross-table integrity where applicable.
4. Horse-transfer scope checks.

For v1, reject unless:

- `artifactType === 'breedwise.horseTransfer'`
- `transferVersion === 1`
- `dataSchemaVersion === BACKUP_SCHEMA_VERSION_CURRENT`
- `app.name === 'BreedWise'`
- `sourceHorse` is well-formed
- every table key exists and is an array

Schema mismatch copy is exact:

- If `dataSchemaVersion` is greater than the current backup schema version: `This horse package was created by a newer version of BreedWise. Update BreedWise and try again.`
- If `dataSchemaVersion` is less than the current backup schema version: `This horse package uses an older BreedWise data format that cannot be imported by this version. Ask the sender to export it again from an updated app.`

Strict v1 row-shape validation rejects unknown top-level envelope keys, missing top-level envelope keys, unknown table keys, missing table keys, missing row fields, and unknown row fields. It must not silently drop unexpected fields or columns.

### Mare Scope Rules

- `sourceHorse.type === 'mare'`.
- `tables.mares.length === 1`.
- The only mare row ID equals `sourceHorse.id`.
- The root mare has `deleted_at === null`.
- Every `tasks`, `daily_logs`, `breeding_records`, `medication_logs`, `pregnancy_checks`, and `foaling_records` row points to the root mare.
- Every foal reaches the root mare through an included foaling record.
- Every uterine fluid/flush/product row reaches the root mare through included daily-log and flush chains.
- `collection_dose_events` and `frozen_semen_batches` are empty.
- Included context stallions equal exactly the non-null stallion IDs referenced by included breeding records.
- Included semen collections equal exactly the non-null collection IDs referenced by included breeding records, and each collection belongs to the referenced stallion.

### Stallion Scope Rules

- `sourceHorse.type === 'stallion'`.
- `tables.stallions.length === 1`.
- The only stallion row ID equals `sourceHorse.id`.
- The root stallion has `deleted_at === null`.
- Mare-owned tables are empty: `mares`, `daily_logs`, `uterine_fluid`, `uterine_flushes`, `uterine_flush_products`, `breeding_records`, `pregnancy_checks`, `foaling_records`, `foals`, `medication_logs`, and `tasks`.
- Every semen collection and frozen semen batch points to the root stallion.
- Every dose event points to an included semen collection.
- Every dose event has `breeding_record_id === null`.

### Task Pointer Rules

For mare packages:

- Non-null `completed_record_type/completed_record_id` must resolve to an included row of the corresponding type.
- Non-manual `source_type/source_record_id` must resolve to an included row of the corresponding type.
- v1 rejects orphan task pointers instead of importing them as soft broken links.

## Matching

`previewHorseImport()` computes match state before writes.

Exact match precedence:

1. Exported internal ID.
2. Exact non-empty registration number after trim/case normalization.
3. Exact normalized name plus exact DOB when both DOBs are present.

If different rules point to different destination horses, mark the import as ambiguous and require user selection. If ID matches but lower-precedence identity fields all contradict the import, also require confirmation. Soft-deleted ID matches are ambiguous; they do not auto-create or auto-merge.

Fuzzy suggestions:

- Normalize by lowercasing, trimming, collapsing whitespace, removing punctuation/apostrophes, and dropping common final suffix tokens: `farm`, `farms`, `ranch`, `rsf`, `llc`, `inc`, `sr`, `jr`.
- Disqualify when both registration numbers are present and differ.
- Disqualify when both DOBs are present and differ.
- Score exact normalized equality, token containment, token overlap, and edit-distance/trigram-style similarity.
- Include only fuzzy candidates with normalized score `>= 0.6`.
- Fuzzy candidates are shown only as suggestions; they never auto-match.

## Import Planning And ID Remapping

Build an import plan before opening the SQLite transaction.

Primary horse:

- Confirmed existing match maps `sourceHorse.id` to the destination horse ID.
- Create-new with unused source ID preserves the source ID.
- Create-new with source ID already used by any active or soft-deleted row generates a new ID and remaps all child FKs.

Children:

- Unused imported child IDs are preserved.
- Existing child ID plus same mapped ownership chain triggers effective-data comparison.
- Existing child ID plus different ownership chain generates a new child ID and updates every downstream FK in the in-memory envelope.
- ID equality alone never proves a row is already present.

Context links:

- If a mare-package context stallion ID maps safely to the same destination stallion, keep the link.
- If the context stallion ID collides with a different destination stallion, preserve the breeding record by setting `stallion_id = null`, `stallion_name` to the exported stallion name, and `collection_id = null`.
- If a semen collection cannot be safely mapped to the same context stallion, null the optional `collection_id` link on the breeding record.

## Effective Data And Conflicts

Effective comparison excludes only `created_at` and `updated_at`.

It includes:

- `deleted_at` differences
- all domain fields
- nullable fields with strict equality
- canonicalized JSON-text fields such as foal `milestones`, foal `igg_tests`, daily-log follicle measurements, and ovary structures

Outcomes:

- Same ID, same ownership chain, same effective data: already present.
- Same ID, same ownership chain, different effective data: conflict; destination row is preserved.
- Natural unique conflict with different row ID: conflict; destination row is preserved.
- Unexpected DB error: abort transaction.

Natural unique conflicts that must be detected and reported before insert:

- `daily_logs` mapped `(mare_id, date, time)` conflicts.
- `uterine_flushes` mapped `daily_log_id` conflicts.
- `foals` mapped `foaling_record_id` conflicts.
- `tasks` partial unique conflicts for open breeding pregnancy-check tasks, using the schema predicate from `idx_tasks_open_breeding_preg_check_unique`: `status = 'open' AND source_type = 'breedingRecord' AND source_reason = 'breedingPregnancyCheck'`.

Do not implement blanket `INSERT OR IGNORE`. It suppresses non-PK conflicts and makes skipped counts lie. Instead:

1. Preflight destination primary keys and known natural unique keys.
2. Rewrite IDs where safe.
3. Classify already-present/conflict/skipped rows.
4. Insert only planned-new rows with regular `INSERT`.

Import result must include inserted, already-present, skipped, and conflict counts by table plus row-level reasons. If a parent conflict drops dependent rows, report the cascade explicitly.

Foal conflicts need rich lost-data context. When an imported foal conflicts with an existing foal for the mapped foaling record, the summary must state that the destination foal was preserved and report whether imported `milestones` and `igg_tests` differ from the destination row. The UI must not collapse this case to only "1 conflict."

## Safety, Transactions, And Invalidation

Import flow:

1. Pick file.
2. Validate file.
3. Build preview and match candidates.
4. User confirms target/create-new path.
5. Create safety snapshot.
6. Run one SQLite transaction for planned inserts.
7. Emit `emitDataInvalidation('all')`.
8. Refresh safety snapshot list.
9. Show import summary.

Cancellation and validation failure do not create safety snapshots. If import fails after snapshot creation, the transaction rolls back and the UI reports that a safety snapshot was created before the failed attempt.

Expose `skipSafetySnapshot: true` only for tests.

## UI Surfaces

- **Mare detail**: add a share/export icon beside the calendar action in `src/screens/mare-detail/MareDetailHeader.tsx`; accessibility label `Export mare package`.
- **Stallion detail**: add a share/export icon beside edit in `src/screens/StallionDetailScreen.tsx`; accessibility label `Export stallion package`.
- **DataBackupScreen**: add `Import Horse` as an additive action, visually distinct from destructive `Restore From File`.
- **Foal form**: no export action.

Export preview should show horse name/type, included record categories, and privacy redactions. Import preview should show target match/create-new state, fuzzy suggestions if any, estimated row counts, estimated conflicts, safety-snapshot promise, and explicit copy: "Importing never overwrites existing data."

## Critical Files

To modify:

- `src/storage/backup/restore.ts` — raw `artifactType` guard before backup validation.
- `src/hooks/useDataBackup.ts` — reject horse-transfer files before destructive restore preview.
- `src/screens/mare-detail/MareDetailHeader.tsx` — export action.
- `src/screens/StallionDetailScreen.tsx` — export action.
- `src/screens/DataBackupScreen.tsx` — additive import entry, preview, and summary.

To create:

- `src/storage/horseTransfer/{types,serializeMare,serializeStallion,validate,matching,preview,remap,importHorse,fileIO,index}.ts`
- `src/hooks/useHorseExport.ts`
- `src/hooks/useHorseImport.ts`

Shared helper decision:

- Extract reusable table specs and raw insert helpers from `src/storage/backup/restore.ts` when doing so prevents full restore and horse import from drifting, but do not force horse import through a fake full-backup envelope.
- Consider shared raw select column lists from `src/storage/backup/serialize.ts` where doing so reduces schema drift without over-abstracting.
- Consider shared row-shape and cross-table validation helpers from `src/storage/backup/validate.ts`; do not fake a full backup envelope with synthetic settings just to reuse `validateBackup()`.
- Any duplicated restore/import SQL left after Wave 4 must be listed as explicit tech debt.

## Tests

Storage tests:

- `validate.test.ts`
  - rejects non-horse-transfer JSON
  - rejects unsupported `transferVersion`
  - rejects newer and older mismatched `dataSchemaVersion` values with the exact schema mismatch copy
  - rejects malformed table shapes
  - rejects unknown envelope keys, missing table keys, unknown table keys, missing row fields, and unknown row fields
  - rejects tampered mare package with multiple mares
  - rejects stallion package with mare-owned rows
  - rejects orphan task source/completed pointers
  - enforces dose-event `breeding_record_id === null`
- `serializeMare.test.ts`
  - exports exact mare closure
  - includes redacted context stallions and referenced collections
  - keeps `frozen_semen_batches` and `collection_dose_events` empty
  - produces deterministic ordering
  - exporting the same unchanged mare package twice produces byte-identical JSON after normalizing `createdAt`
- `serializeStallion.test.ts`
  - exports exact stallion closure
  - nulls dose-event `breeding_record_id`
  - redacts recipient/shipping fields
  - produces deterministic ordering
  - exporting the same unchanged stallion package twice produces byte-identical JSON after normalizing `createdAt`
- `matching.test.ts`
  - ID, registration, name+DOB precedence
  - conflicting exact-match signals become ambiguous
  - fuzzy suggestions use normalized score threshold `>= 0.6`
  - fuzzy suggestions never auto-match
- `importHorse.test.ts`
  - create-new with unused source ID preserves ID
  - create-new with source ID collision remaps root and child FKs
  - existing-match import remaps child FKs to local root
  - child ID collision under unrelated horse rewrites and inserts
  - natural daily-log unique conflict reports conflict, not already-present
  - foal natural conflict reports rich-data conflict, including whether `milestones` and `igg_tests` differ
  - idempotent re-import inserts 0 rows and reports already-present
  - same-ID different effective data reports conflict
  - context stallion collision preserves breeding as custom stallion and nulls unsafe collection link
  - successful import emits `emitDataInvalidation('all')`
  - cancellation/validation failure do not create safety snapshots
  - confirmed import creates safety snapshot before writes
- `src/storage/backup/restore.test.ts`
  - full restore rejects horse-transfer JSON string
  - full restore rejects horse-transfer object candidate

Screen tests:

- `MareDetailScreen.screen.test.tsx` — export action calls hook, success and failure alerts.
- `StallionDetailScreen.screen.test.tsx` — export action calls hook, success and failure alerts.
- `DataBackupScreen.screen.test.tsx` — import entry, invalid file, preview, fuzzy candidate selection, confirm import, cancel with no snapshot, final summary, and full-restore rejection of horse package.

## Verification

Before declaring done:

1. `npm run typecheck`
2. `npm test`
3. `npm run test:screen`
4. `npm run lint`
5. Android manual smoke:
   - Export mare with daily logs, breeding, pregnancy check, foaling, foal, medication, and task.
   - Import into same DB and confirm idempotent already-present summary.
   - Import into clean DB and verify full mare history renders.
   - Import into DB with a conflicting daily log and verify conflict details.
   - Try horse package through full restore and verify clean rejection with DB untouched.
   - Export stallion and verify recipient/shipping redaction in JSON.
6. Cross-device smoke: transfer JSON to another emulator/device, import, verify records and summary.

## Out Of Scope

- Photo bytes or photo manifests.
- Multi-mare bulk export.
- True field-level merge.
- Two-way sync.
- Automatic overwrite/update of destination rows.
- Cross-app/cross-vendor format.
- Foal-only export.
- Legacy horse-transfer version adapters beyond explicit v1/current-schema acceptance.
