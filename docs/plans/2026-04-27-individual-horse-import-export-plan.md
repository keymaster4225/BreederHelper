# Individual Horse Import/Export Plan

Date: 2026-04-27  
Status: Proposed

## Summary

Add a separate horse-transfer feature alongside full backup/restore. It exports one mare or stallion to a JSON file, shares it through the OS share sheet, and imports it additively from Settings.

Mare exports include mare-owned history: daily logs, uterine fluid/flush data, breeding records, pregnancy checks, foaling records, foals, medications, and mare tasks. Stallion exports include stallion-owned data: profile, semen collections, collection dose events, and frozen semen batches. Stallion breeding history with mares is not exported in v1.

Import creates the horse if no match exists. If a match exists, it preserves the existing horse profile and adds only non-conflicting related records. Conflicting records are skipped and summarized.

## Key Changes

- Add `src/storage/horseTransfer/*` for partial export/import logic using raw SQLite rows, separate from full-replace backup restore.
- Add a `HorseTransferEnvelopeV1` JSON format:
  - `artifactType: "breedwise.horseTransfer"`
  - `schemaVersion: 1`
  - `horseType: "mare" | "stallion"`
  - `createdAt`, app metadata, source horse identity, table subsets, and lightweight reference hints.
- Add export actions on mare and stallion detail screens using a share icon.
- Add a Settings entry for `Import Horse`, opening a picker/preview screen before import.
- Reuse existing file APIs where practical, with filenames like `breedwise-mare-maple-v1-YYYYMMDD-HHmmss.json`.

## Import Behavior

- Horse matching:
  - Auto-match by exported internal ID.
  - Auto-match by exact non-empty registration number.
  - Auto-match by exact normalized name plus exact DOB when both are present.
  - Fuzzy/name-pattern matches are suggestions only and require user confirmation.
- Basic fuzzy matching:
  - Normalize case, punctuation, whitespace, and common suffix noise.
  - Score exact normalized equality, token containment, token overlap, and simple edit-distance/trigram similarity.
  - Example: `maple` and `maple rsf` should appear as a likely match, not auto-merge.
- Additive merge:
  - Existing horse profile fields are never overwritten.
  - Imported child IDs are preserved when unused.
  - If the horse matched by identity instead of ID, child foreign keys are remapped to the local horse ID.
  - Required-parent children are skipped when their parent is skipped or missing.
  - Optional links are nulled when the target cannot be mapped, preserving the record where safe.
- Conflict policy:
  - Same row ID with identical effective data: count as already present.
  - Same row ID with different data: skip as conflict.
  - Natural unique collisions, such as daily log mare/date/time or one foal per foaling record: skip as conflict.
  - Unexpected database failures abort the import transaction.
- Before applying an import, create a safety snapshot using the existing backup snapshot mechanism.

## Public Interfaces

- Storage APIs:
  - `exportHorseTransfer({ horseType, horseId }): Promise<HorseTransferEnvelopeV1>`
  - `validateHorseTransferJson(jsonText): ValidateHorseTransferResult`
  - `previewHorseImport(envelope): Promise<HorseImportPreview>`
  - `importHorseTransfer(envelope, options): Promise<HorseImportResult>`
- Hook APIs:
  - `useHorseExport()` for detail-screen export/share state.
  - `useHorseImport()` for file picking, preview, candidate selection, import execution, and summary state.
- Result types include inserted/skipped/already-present counts by table plus skip reasons.

## Test Plan

- Unit tests for transfer envelope validation, unsupported schema rejection, and malformed cross-table references.
- Repository/DB tests for mare export, stallion export, ID remapping, duplicate import idempotency, conflict skipping, foal attachment through foaling records, and safety snapshot creation.
- Matching tests for exact ID, registration number, exact name+DOB, and fuzzy suggestions like `maple` vs `maple rsf`.
- Screen tests for detail export actions, Settings import entry, preview confirmation, suggested-match selection, and final import summary.
- Run `npm run typecheck`, `npm test`, `npm run test:screen`, and `npm run lint`.

## Assumptions

- v1 uses JSON files, not a new binary/archive extension.
- v1 does not import stallion breeding history with mares.
- v1 does not overwrite existing horse profiles or conflicting records.
- Fuzzy matches never auto-merge; they only help the user choose an existing horse.
