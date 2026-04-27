# Individual Horse Import / Export — Implementation Plan

> Date: 2026-04-27
> Roadmap entry: P1 under **Cloud backup & collaboration** (`ROADMAP.md:85–86`, `TODO:39`)

## Context

ROADMAP.md lists this as a P1 in **Cloud backup & collaboration** (added 2026-04-27). It's a deliberately scoped short-term workaround before real multi-user sync (Stage 2–4 in the staged sync path). Use case: a vet, buyer, or seller hands off a single mare's or stallion's records between devices without exposing the whole farm's data and without committing the app to field-level conflict resolution.

Existing `src/storage/backup/` is full-DB-only: `serializeBackup` reads everything, `restoreBackup` deletes every managed table before insert. That pipeline must keep working unchanged. The new horse-package flow is a separate code path that selects a subset, writes a portable file, and imports additively.

User-locked decisions:
- **Conflict policy**: additive merge with skip-on-collision (`INSERT OR IGNORE`). If a row's PK exists, skip; otherwise insert. Re-importing the same mare is a no-op for the mare row but adds new child records since the original export.
- **Stallion in mare export**: include the full stallion record(s) referenced by mare's breedings as "context-only" — same skip-on-collision rule (existing stallions never overwritten).
- **Foal scope**: foals travel as part of the dam export only. No standalone foal export action.

## Format & file shape

Reuse the existing `BackupEnvelopeV11` (`src/storage/backup/types.ts:75–91`, `serialize.ts:37–413`) with one **optional** added field:

```ts
exportScope?: {
  type: 'mare' | 'stallion';
  primaryId: string;
  primaryName: string;  // for the import preview ("Importing mare 'Maple'")
}
```

Optional means `validateBackup()` still parses it. The presence of `exportScope` is the marker that distinguishes a horse package from a full backup.

**Critical safety check**: `restoreBackup()` (`src/storage/backup/restore.ts:87`) must refuse any envelope where `exportScope` is set, returning `errorMessage: 'This file is a horse package. Use Settings → Backup & Restore → Import Horse.'`. Without this, a user picking a horse package via the existing "Restore From File" button would wipe their DB.

Filename stem: `breedwise-mare-<slug>-<YYYYMMDD-HHMMSS>.json` and `breedwise-stallion-<slug>-<ts>.json`. (Don't propagate the misnamed `breedwise-backup-v5-` stem from `serialize.ts` — current schema is v11.) MIME stays `application/json`.

Reserve `photos: []` arrays per entity in the export shape so Photos V1 (planned, not shipped — `docs/plans/2026-04-26-photos-v1-implementation-plan.md`) can land without breaking compat. Photo bytes are out of scope for v1.

## Module layout

New sibling directory `src/storage/horseExport/`:

```
src/storage/horseExport/
  types.ts             // HorsePackageEnvelope, HorseExportScope, HorsePackagePreview
  serializeMare.ts     // serializeMarePackage(mareId)
  serializeStallion.ts // serializeStallionPackage(stallionId)
  validate.ts          // validateHorsePackage() — wraps validateBackup, asserts scope
  importHorse.ts       // importHorsePackage(envelope, options) — additive insert, skip-on-collision
  fileIO.ts            // createMarePackageFileName / createStallionPackageFileName / pickHorsePackageFile
  index.ts             // public surface
```

All files target < 400 lines (CLAUDE.md convention). One small modification to `src/storage/backup/restore.ts`: add the `exportScope` guard near the top of `restoreBackup`.

## Mare-scope query plan (transitive closure)

Run inside one `db.withTransactionAsync` read transaction. Filter by mare ID. Output table arrays in `BACKUP_INSERT_ORDER` (`types.ts:75`):

1. `mares` — `WHERE id = ? AND deleted_at IS NULL` (throw `MareNotFoundError` on 0 rows).
2. `tasks` — `WHERE mare_id = ?`.
3. `stallions` — `WHERE id IN (SELECT DISTINCT stallion_id FROM breeding_records WHERE mare_id = ? AND stallion_id IS NOT NULL)` (context-only; emit even if `deleted_at` set — destination needs the row to satisfy FK).
4. `semen_collections` — `WHERE id IN (SELECT DISTINCT collection_id FROM breeding_records WHERE mare_id = ? AND collection_id IS NOT NULL)` (context-only).
5. `frozen_semen_batches` — **empty array.** Plan-agent verification: there is no `frozen_semen_batch_id` FK on `breeding_records`. Frozen straws are accounted via `breeding_records.collection_id` + free-text `straw_details` / `straw_volume_ml`. Batches are never reachable from mare side.
6. `breeding_records` — `WHERE mare_id = ?`.
7. `daily_logs` — `WHERE mare_id = ?`.
8. `uterine_fluid` — `WHERE daily_log_id IN (SELECT id FROM daily_logs WHERE mare_id = ?)`.
9. `uterine_flushes` — same `daily_log_id IN ...` subquery.
10. `uterine_flush_products` — `WHERE uterine_flush_id IN (SELECT id FROM uterine_flushes WHERE daily_log_id IN ...)`.
11. `medication_logs` — `WHERE mare_id = ?`.
12. `pregnancy_checks` — `WHERE mare_id = ?`.
13. `foaling_records` — `WHERE mare_id = ?`.
14. `foals` — `WHERE foaling_record_id IN (SELECT id FROM foaling_records WHERE mare_id = ?)`.
15. `collection_dose_events` — **empty array** for mare scope. Dose events are stallion-side accounting; importing them onto a different device for a mare you imported risks double-counting straw usage on the destination's stallion.

## Stallion-scope query plan

1. `stallions` — `WHERE id = ? AND deleted_at IS NULL`.
2. `semen_collections` — `WHERE stallion_id = ?`.
3. `frozen_semen_batches` — `WHERE stallion_id = ?`.
4. `collection_dose_events` — `WHERE collection_id IN (SELECT id FROM semen_collections WHERE stallion_id = ?)`. **At serialize time**, set every `breeding_record_id` to `null`. Reason: `collection_dose_events.breeding_record_id` is `ON DELETE CASCADE` (`migrations/index.ts:636`), and the referenced breeding belongs to a mare not in the stallion package. Keeping the original ID would silently re-bind the dose to whatever happens to share that ID on the destination.
5. All other tables: empty arrays.

## Additive-merge insert strategy

Use `INSERT OR IGNORE` per row inside one `db.withTransactionAsync`. Walk tables in `BACKUP_INSERT_ORDER` so every parent is inserted before its child. SQLite's `INSERT OR IGNORE` skips on PK or UNIQUE conflict, which is exactly skip-on-collision.

Per-table row counts: `db.runAsync` returns `{ changes }`. Sum changes per table to derive `inserted`; `skipped = providedRows - inserted`. That feeds the import-summary alert.

`tasks.source_record_id` is a soft TEXT pointer (no `FOREIGN KEY` clause); the existing restore tolerates inserting tasks before their referenced rows. Same applies here.

## Validation reuse

`validateBackup()` (`src/storage/backup/validate.ts`) already enforces FK integrity *within* the envelope — every `breeding_records.stallion_id` must appear in `tables.stallions`. That's exactly what a horse package needs (it self-includes referenced stallions/collections). **Reuse as-is.**

New thin wrapper `validateHorsePackage(input)`:
1. Calls `validateBackup(input)`.
2. Asserts `input.exportScope` is present and well-formed (`type` ∈ `'mare' | 'stallion'`, non-empty `primaryId` and `primaryName`).
3. Asserts `primaryId` row exists in `tables.mares` or `tables.stallions` per scope.
4. For stallion scope, asserts mare-only tables (`mares`, `daily_logs`, `uterine_*`, `breeding_records`, `pregnancy_checks`, `foaling_records`, `foals`, `medication_logs`, `tasks`) are empty arrays — sanity check against a mislabeled package.
5. For mare scope, asserts every non-null `tasks.completed_record_id` resolves to a row inside the package.

## Safety snapshot

Take a full `createSafetySnapshot()` (`src/storage/backup/safetyBackups.ts`) before every horse import. Storage cost is real but the user explicitly accepted "stale parent + new children" surface area; rollback safety is the floor. The existing 3-snapshot retention applies. Expose `skipSafetySnapshot: true` only for tests.

## UI surfaces

- **Mare detail**: add an Export icon (`accessibilityLabel="Export mare package"`) next to the existing calendar icon in `src/screens/mare-detail/MareDetailHeader.tsx:27–31`.
- **Stallion detail**: add an Export icon next to the existing pencil edit icon set via `navigation.setOptions({ headerRight })` in `src/screens/StallionDetailScreen.tsx:59–71`.
- **DataBackupScreen** (`src/screens/DataBackupScreen.tsx`): new "Import Horse" `SecondaryButton` alongside the existing "Restore From File" button. New hook `useHorseImport()` mirroring the structure of `useDataBackup()` (`src/hooks/useDataBackup.ts`).
- **Foal form**: no export action.

Export flow: tap icon → `serializeMarePackage(mareId)` / `serializeStallionPackage(stallionId)` → write to documents directory via existing `writeBackupFile` pattern in `src/storage/backup/fileIO.ts:50` → `Sharing.shareAsync(fileUri)` → success alert.

Import flow: tap "Import Horse" → `pickHorsePackageFile()` (wraps `DocumentPicker.getDocumentAsync`) → `validateHorsePackage()` → build `HorsePackagePreview { scope, primaryName, perTableCount, alreadyPresentCount }` (the `alreadyPresentCount` comes from a cheap `SELECT id FROM <table> WHERE id IN (...)` per table on the destination) → render preview card reusing the pattern in `DataBackupScreen.tsx:165–176` ("Importing mare 'Maple'. Insert 47 new rows. Skip 5 already present.") → confirm → `importHorsePackage()` → success alert with insert/skip counts.

If `alreadyPresentCount` for the root mare/stallion is > 0, surface a notice: "An entity with this ID already exists. If you have not previously imported this <mare/stallion>, the IDs may have collided." (`src/utils/id.ts` uses `Math.random().toString(36).slice(2,10)` — ~41 bits of randomness; the warning protects against the genuine-collision case where skip-on-collision would silently hide it.)

## Critical files

To **modify**:
- `src/storage/backup/restore.ts` — add `exportScope` guard at the top of `restoreBackup()`.
- `src/screens/mare-detail/MareDetailHeader.tsx` — Export icon.
- `src/screens/StallionDetailScreen.tsx` — Export icon in `headerRight`.
- `src/screens/DataBackupScreen.tsx` — "Import Horse" button + preview/confirm wiring.

To **create**:
- `src/storage/horseExport/{types,serializeMare,serializeStallion,validate,importHorse,fileIO,index}.ts`
- `src/hooks/useHorseExport.ts` (export action) and `src/hooks/useHorseImport.ts` (import flow).

To **read** (no edit):
- `src/storage/backup/types.ts:75–91` — reuse `BACKUP_INSERT_ORDER`.
- `src/storage/backup/serialize.ts` — pattern reference for table extraction.
- `src/storage/backup/validate.ts` — wrap, do not modify.
- `src/storage/backup/safetyBackups.ts` — reuse `createSafetySnapshot`.
- `src/storage/backup/fileIO.ts` — reuse `writeBackupFile`, `pickBackupFile` patterns.
- `src/storage/migrations/index.ts` — schema source of truth for FK rules.
- `src/utils/id.ts` — ID format (relevant for collision warning).

## Tests

New:
- `src/storage/horseExport/serializeMare.test.ts` — fixture: 1 mare, 2 daily logs (one with uterine fluid + flush + 2 products), 2 breedings to different stallions (one with collection), 1 pregnancy check, 1 foaling, 1 foal, 1 medication log, 1 task. Assert exact row sets per table; assert both stallions and the collection included; assert `frozen_semen_batches: []` and `collection_dose_events: []`.
- `src/storage/horseExport/serializeStallion.test.ts` — fixture: 1 stallion, 2 collections, 5 dose events (2 with `breeding_record_id`, 3 without). Assert all 5 included, the 2 with `breeding_record_id` have it nulled.
- `src/storage/horseExport/importHorse.test.ts` —
  - Round-trip: serialize mare → import into empty DB → re-serialize → assert byte-identical (modulo `createdAt`).
  - Idempotent re-import: import same package twice; second pass inserts 0 rows.
  - Additive merge: import mare → on source side add a new daily log → re-export → re-import to the destination that already has the original; assert exactly 1 row inserted.
  - Cross-stallion non-overwrite: destination stallion notes = "X"; import mare whose package contains the same stallion with notes = "Y"; assert destination still says "X".
- `src/storage/horseExport/validate.test.ts` — reject full backups (no `exportScope`); reject mare-package mislabeled with stallion-only data; reject `tasks.completed_record_id` pointing outside the package.
- `src/storage/backup/restore.test.ts` — extend with a test that `restoreBackup()` refuses any envelope with `exportScope` set.
- Screen tests: `MareDetailScreen.screen.test.tsx`, `StallionDetailScreen.screen.test.tsx`, `DataBackupScreen.screen.test.tsx` — happy path (tap export, file written / tap import, preview renders, confirm inserts) and error path (export fails / invalid file picked → alert). Every new icon-only button must have an `accessibilityLabel` (CLAUDE.md).

## Verification

End-to-end verification before declaring done:

1. `npm run typecheck && npm test && npm run test:screen && npm run lint` all green.
2. Run on Android emulator (`npm run android`):
   - Create mare "TestMare" with 2 daily logs, 1 breeding, 1 pregnancy check.
   - Tap Export on her detail screen → share sheet opens → save to documents.
   - In Settings → Backup & Restore → tap Import Horse → pick the file.
   - Verify preview shows correct counts.
   - Confirm import → see "Already exists" idempotent path; verify 0 rows inserted on second import.
   - Wipe DB (full restore from earlier snapshot) → re-import the package → verify mare and all children appear.
3. Cross-device manual smoke: install on a second emulator/device, transfer the JSON via email/Drive, import, verify the mare and children render correctly.
4. Try to pick a horse package via the **full backup** "Restore From File" path → assert clean rejection with the exportScope guard message; DB untouched.
5. Verify safety snapshot was created in `safety-snapshots/` after each import.

## Out of scope (deliberate)

- Photo bytes (waiting on Photos V1; reserve `photos: []` arrays only).
- Multi-mare bulk export (use full backup for that).
- True field-level merge (Stage 4 multi-user sync).
- Two-way sync / conflict-resolution UI.
- ID rewriting on collision (warn only).
- Cross-app or cross-vendor format.
- Foal-only export (foals travel with dam).
- Migration of horse packages across schema versions (the existing schemaVersion guard rejects future-versioned files).
