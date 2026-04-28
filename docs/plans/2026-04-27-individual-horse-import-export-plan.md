# Individual Horse Import/Export Plan

Date: 2026-04-27  
Status: Proposed, revised after critique

## Summary

Add a separate horse-transfer feature alongside full backup/restore. It exports one mare or stallion to a JSON file, shares it through the OS share sheet, and imports it additively from Settings.

Mare exports include mare-owned history: daily logs, uterine fluid/flush data, breeding records, pregnancy checks, foaling records, foals, medications, and mare tasks. Stallion exports include stallion-owned profile, semen collections, frozen semen batches, and collection dose events.

Import never overwrites existing records. If a horse or child record already exists with materially different data, the destination row is preserved and the import reports a conflict with row-level reasons. The user must edit the destination manually or use full backup/restore for overwrite semantics.

## Key Changes

- Add `src/storage/horseTransfer/*` for partial export/import logic using raw SQLite rows, separate from full-replace backup restore.
- Add a dedicated `HorseTransferEnvelopeV1` JSON format with an explicit discriminator, not an overloaded backup envelope.
- Add export actions on mare and stallion detail screens using a share icon.
- Add a Settings entry for `Import Horse`, visually separated from destructive full restore.
- Reuse existing file APIs where practical, with filenames like `breedwise-mare-maple-v1-YYYYMMDD-HHmmss.json`.

## Envelope Shape

```ts
type HorseTransferEnvelopeV1 = {
  artifactType: 'breedwise.horseTransfer';
  transferVersion: 1;
  dataSchemaVersion: typeof BACKUP_SCHEMA_VERSION_CURRENT;
  createdAt: string;
  app: {
    name: 'BreedWise';
    version: string;
  };
  sourceHorse: {
    type: 'mare' | 'stallion';
    id: string;
    name: string;
    registrationNumber: string | null;
    dateOfBirth: string | null;
  };
  privacy: {
    redactedContextStallions: boolean;
    redactedDoseRecipientAndShipping: boolean;
  };
  tables: {
    mares: BackupMareRow[];
    stallions: BackupStallionRow[];
    daily_logs: BackupDailyLogRow[];
    uterine_fluid: BackupUterineFluidRow[];
    uterine_flushes: BackupUterineFlushRow[];
    uterine_flush_products: BackupUterineFlushProductRow[];
    breeding_records: BackupBreedingRecordRow[];
    pregnancy_checks: BackupPregnancyCheckRow[];
    foaling_records: BackupFoalingRecordRow[];
    foals: BackupFoalRow[];
    medication_logs: BackupMedicationLogRow[];
    tasks: BackupTaskRow[];
    semen_collections: BackupSemenCollectionRowV3[];
    collection_dose_events: BackupCollectionDoseEventRowV3[];
    frozen_semen_batches: BackupFrozenSemenBatchRow[];
  };
};
```

`artifactType` is the file discriminator. Full backup restore must reject any file with `artifactType: 'breedwise.horseTransfer'` before normal backup validation or destructive preview.

For v1, horse transfer accepts only `transferVersion === 1` and `dataSchemaVersion === BACKUP_SCHEMA_VERSION_CURRENT`. Newer transfer files are rejected with "This horse package was created by a newer version of BreedWise. Please update the app." Older transfer versions can be added later with explicit adapters.

## Export Scope

All serializer queries must use deterministic `ORDER BY` clauses. Stable exports make tests reliable and make two exports of the same data diffable.

Mare exports:

- Include exactly one `mares` row where `id = sourceHorse.id` and `deleted_at IS NULL`.
- Include mare-owned rows from `tasks`, `breeding_records`, `daily_logs`, `medication_logs`, `pregnancy_checks`, and `foaling_records`.
- Include `foals` reachable through included foaling records.
- Include `uterine_fluid`, `uterine_flushes`, and `uterine_flush_products` reachable through included daily logs.
- Include referenced context stallion rows for included breeding records with non-null `stallion_id`.
- Include referenced semen collection rows for included breeding records with non-null `collection_id`.
- Do not include `frozen_semen_batches` or `collection_dose_events` in mare packages.

Stallion exports:

- Include exactly one `stallions` row where `id = sourceHorse.id` and `deleted_at IS NULL`.
- Include `semen_collections` and `frozen_semen_batches` where `stallion_id = sourceHorse.id`.
- Include `collection_dose_events` reachable through included semen collections.
- Set every exported dose event `breeding_record_id` to `null`; mare breeding records are not part of a stallion package.
- Leave all mare-owned tables empty.

## Privacy Policy

The export preview must show the categories that will leave the device before the share sheet opens.

Default mare-package privacy:

- Breeding records are included because they are core mare history.
- Context stallion rows are redacted to the fields needed for display and FK safety: `id`, `name`, `breed`, `registration_number`, `date_of_birth`, timestamps, and `deleted_at`.
- Context stallion `sire`, `dam`, `notes`, and AV preference fields are set to `null`.

Default stallion-package privacy:

- Collection dose events are included for inventory/accounting context.
- Recipient and shipping details are redacted by default: `recipient` is set to `"Redacted"`, and `recipient_phone`, `recipient_street`, `recipient_city`, `recipient_state`, `recipient_zip`, `carrier_service`, `container_type`, `tracking_number`, and `notes` are set to `null`.
- A later opt-in export option may include full recipient/shipping history, but v1 defaults to redaction.

Tests must enforce the redaction policy.

## Matching Precedence

Import preview performs matching before any writes.

Auto-match candidates are evaluated in this order:

1. Exported internal ID.
2. Exact non-empty registration number, normalized by trim/case folding.
3. Exact normalized name plus exact DOB when both DOBs are present.

If a higher-precedence rule finds one target but lower-precedence identity fields contradict it, the result is ambiguous and requires user confirmation. Examples: ID matches mare A but registration matches mare B; registration matches mare B but name+DOB matches mare C; ID matches a soft-deleted row; ID matches an active row whose name, DOB, and registration all disagree.

Fuzzy/name-pattern matches are suggestions only. They never auto-merge.

Fuzzy matching spec:

- Normalize by lowercasing, trimming, collapsing whitespace, removing punctuation/apostrophes, and removing common stable suffix tokens only when they appear as final tokens: `farm`, `farms`, `ranch`, `rsf`, `llc`, `inc`, `sr`, `jr`.
- Disqualify fuzzy candidates when both sides have non-empty registration numbers and they differ.
- Disqualify fuzzy candidates when both sides have DOBs and they differ.
- Score candidates with exact normalized equality, token containment, token overlap, and edit-distance/trigram-style similarity.
- Show candidates above the chosen implementation threshold as suggestions. Multiple candidates are listed for explicit user selection; zero candidates defaults to "create new horse."

## ID Mapping And Conflict Policy

The import builds an in-memory ID map before inserting.

Primary horse mapping:

- If the user confirms an existing match, map `sourceHorse.id` to the destination horse ID.
- If no match exists and the exported ID is unused, insert the horse with the exported ID.
- If no match exists but the exported ID is already used by any active or soft-deleted row, generate a new ID and remap every child FK in the envelope.

Child ID handling:

- If an imported child ID is unused, preserve it.
- If an imported child ID exists and belongs to the same mapped ownership chain, compare effective data.
- If an imported child ID exists but belongs to a different horse or different mapped parent, generate a new ID and update every downstream FK in the import envelope before insert.
- ID equality alone is never sufficient to call a row already present; the ownership chain must also match.

Effective-data comparison:

- Exclude only metadata drift fields `created_at` and `updated_at`.
- Include `deleted_at`; deletion divergence is a conflict.
- Compare nullable fields strictly.
- Canonicalize JSON-text columns before comparison, including foal `milestones`, foal `igg_tests`, daily-log follicle measurement JSON, and ovary structure JSON.
- A same-ID/same-owner row with equal effective data counts as already present.
- A same-ID/same-owner row with different effective data is a conflict and is not overwritten.

Natural unique conflicts:

- Daily-log unique conflicts on mapped `(mare_id, date, time)` with a different row ID are conflicts, not already-present rows.
- A foal conflict on mapped `foaling_record_id` with a different row ID is a conflict.
- A uterine flush conflict on mapped `daily_log_id` with a different row ID is a conflict.
- Task partial unique conflicts for open breeding pregnancy-check tasks are conflicts unless effective data proves the task is already present.

Required-parent children are skipped only when preserving them would violate integrity. The result must include row-level skip/conflict reasons and dependent-row fallout, for example: "Daily log 2026-04-15 conflicted, so 1 uterine fluid row and 1 flush product were not imported."

Optional links are nulled when the target cannot be safely mapped. For example, if a mare-package context stallion ID collides with an unrelated destination stallion, the breeding record is preserved with `stallion_id = null`, `stallion_name` set to the exported stallion name, and `collection_id = null`.

## Scope Validation

Validation must prove the package is scoped; it must not trust the serializer.

Mare package validation:

- `sourceHorse.type === 'mare'`.
- `tables.mares.length === 1` and the row ID equals `sourceHorse.id`.
- The root mare row has `deleted_at === null`.
- Every row in `tasks`, `daily_logs`, `breeding_records`, `medication_logs`, `pregnancy_checks`, and `foaling_records` points to the root mare.
- Every `foals` row reaches the root mare through an included foaling record.
- Every `uterine_fluid`, `uterine_flushes`, and `uterine_flush_products` row reaches the root mare through included daily-log/flush chains.
- `collection_dose_events` and `frozen_semen_batches` are empty.
- Context stallions are exactly the set referenced by included breeding records with non-null `stallion_id`.
- Semen collections are exactly the set referenced by included breeding records with non-null `collection_id`, and each collection belongs to the referenced stallion.

Stallion package validation:

- `sourceHorse.type === 'stallion'`.
- `tables.stallions.length === 1` and the row ID equals `sourceHorse.id`.
- The root stallion row has `deleted_at === null`.
- All mare-owned tables are empty.
- Every included semen collection and frozen semen batch points to the root stallion.
- Every included dose event points to an included semen collection.
- Every included dose event has `breeding_record_id === null`.

Task pointer validation:

- For mare packages, non-null `completed_record_type/completed_record_id` must resolve to a row inside the package.
- Non-manual `source_type/source_record_id` must resolve to a row inside the package or be rejected; v1 does not import orphan task pointers.

## Import Flow And Failure Semantics

1. Pick JSON file.
2. Validate discriminator, version, row shape, cross-table references, and scope.
3. Build preview: matched horse state, fuzzy suggestions, per-table row counts, new/already-present/conflict estimates, privacy flags present in the file, and "import never overwrites existing data" copy.
4. User confirms target horse or create-new path.
5. Create safety snapshot.
6. Run one SQLite transaction for ID mapping and inserts.
7. Emit `emitDataInvalidation('all')` after successful import.
8. Refresh safety snapshot list.
9. Show import summary with inserted/already-present/conflict counts and row-level skip reasons.

Cancellation and validation failure do not create safety snapshots. If the transaction fails after snapshot creation, the import rolls back and the UI reports that a safety snapshot was created before the failed attempt.

## UI Notes

- Mare detail: add a share/export icon with `accessibilityLabel="Export mare package"`.
- Stallion detail: add a share/export icon with `accessibilityLabel="Export stallion package"`.
- Settings/Data Backup screen: show `Import Horse` as an additive import action, visually and textually distinct from `Restore From File`, which replaces all local data.
- Export preview: disclose included tables and privacy redactions before opening the share sheet.
- Import preview: disclose target match, create-new/remap behavior, non-overwrite policy, safety-snapshot promise, and estimated conflicts.

Filename slug rule: lowercase, ASCII alphanumeric words joined by hyphens, collapse repeated hyphens, trim to 48 chars, and use `horse` if the result is empty.

## Public Interfaces

- Storage APIs:
  - `exportHorseTransfer({ horseType, horseId }): Promise<HorseTransferEnvelopeV1>`
  - `validateHorseTransferJson(jsonText): ValidateHorseTransferResult`
  - `previewHorseImport(envelope): Promise<HorseImportPreview>`
  - `importHorseTransfer(envelope, options): Promise<HorseImportResult>`
- Hook APIs:
  - `useHorseExport()` for detail-screen export/share state.
  - `useHorseImport()` for file picking, preview, candidate selection, import execution, and summary state.
- Result types include inserted, already-present, skipped, and conflict counts by table plus row-level reasons.

## Test Plan

- Unit tests for discriminator validation, unsupported version rejection, exact scope validation, malformed cross-table references, privacy redaction, and filesystem-safe slugs.
- Matching tests for precedence conflicts: ID vs registration, registration vs name+DOB, ID match with contradictory identity fields, and fuzzy suggestions like `maple` vs `maple rsf`.
- Repository/DB tests for mare export, stallion export, deterministic ordering, ID remapping, duplicate import idempotency, natural unique conflicts, foal attachment through foaling records, task pointer integrity, safety snapshot creation, and data invalidation.
- Collision tests where an imported child ID already exists under another horse; expected behavior is rewrite-and-insert under the correct mapped parent.
- Conflict-summary tests where a parent conflict drops dependent rows and the summary names the parent and dependent fallout.
- Screen tests for detail export actions, Settings import entry, export preview, import preview confirmation, suggested-match selection, cancellation, invalid-file handling, and final import summary.
- Run `npm run typecheck`, `npm test`, `npm run test:screen`, and `npm run lint`.

## Assumptions

- v1 uses JSON files, not a new binary/archive extension.
- v1 does not import stallion breeding history with mares.
- v1 never overwrites existing horse profiles or conflicting records.
- v1 defaults to privacy redaction for context stallions and stallion dose recipient/shipping fields.
- Fuzzy matches never auto-merge; they only help the user choose an existing horse.
