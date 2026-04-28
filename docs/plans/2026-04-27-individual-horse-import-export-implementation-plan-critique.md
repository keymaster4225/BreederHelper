# Critique: Individual Horse Import / Export Implementation Plan

Date reviewed: 2026-04-27  
Reviewed document: `docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md`

## Executive Assessment

The plan has the right product instinct: a bounded horse-package flow is a better short-term answer than pretending this app has conflict-aware sync. The separation from full backup/restore is also correct. A horse package is additive, scoped, and user-facing in a very different way from a whole-database backup, so treating it as a sibling pipeline is directionally sound.

The plan is not implementation-ready yet. Its major risks are not in the UI work; they are in the format boundary, collision semantics, privacy scope, and validator strength. The most important issue is that the plan relies on `exportScope` as a safety marker, but the current backup validator rebuilds the envelope and drops unknown top-level fields. The second is that `INSERT OR IGNORE` does not mean "skip only if the primary key already exists"; it also suppresses other `UNIQUE` conflicts. That creates silent data loss and misleading import counts in exactly the cases where the user needs a trustworthy import summary.

I would approve the feature direction, but I would not start implementation until the blocking revisions below are folded into the plan.

## Blocking Revisions

### 1. The `exportScope` marker can disappear during validation

The plan says the presence of `exportScope` distinguishes a horse package from a full backup, and that `restoreBackup()` must refuse any envelope where `exportScope` is set (`implementation-plan.md:29-31`). That is the correct safety requirement.

The current validation path does not preserve unknown top-level fields. `validateBackupJson()` parses JSON and calls `validateBackup()` (`src/storage/backup/validate.ts:119-128`). `validateBackup()` then constructs a new `backup` object from known fields only (`src/storage/backup/validate.ts:193-266`) and returns that rebuilt object (`src/storage/backup/validate.ts:279-283`). `exportScope` is not included in that reconstructed value.

That means a guard implemented after validation against `validation.backup.exportScope` would not work. The full restore path currently validates first and immediately normalizes `validation.backup` (`src/storage/backup/restore.ts:91-103`). A horse package picked through "Restore From File" could therefore still look like a valid full backup if the guard is placed in the wrong spot.

Required plan change:

- Add a raw payload guard before `validateBackup()` strips unknown keys.
- For string candidates, parse once for the guard, then pass the parsed object to validation so the guard and validation inspect the same payload.
- For object candidates, inspect the original object before validation.
- Add a second UX guard in the full-restore prepare flow so the screen rejects a horse package before rendering a destructive restore preview.
- Add tests for both raw JSON string and object candidates passed to `restoreBackup()`.

Do not rely on making `exportScope` optional on `BackupEnvelopeV11` alone. The runtime validation behavior is the safety boundary, not the TypeScript shape.

### 2. `INSERT OR IGNORE` does not implement the stated collision policy

The plan states the conflict policy as: "If a row's PK exists, skip; otherwise insert" (`implementation-plan.md:13`). Later it proposes `INSERT OR IGNORE` because SQLite skips on primary-key or unique conflict and calls that "exactly skip-on-collision" (`implementation-plan.md:84`).

Those two statements are not equivalent.

This schema has several non-primary-key uniqueness constraints:

- `daily_logs` has unique `(mare_id, date, time)` for timed logs and unique `(mare_id, date)` for untimed logs (`src/storage/migrations/index.ts:1142-1148`).
- `uterine_flushes.daily_log_id` is unique (`src/storage/migrations/index.ts:1152-1155`).
- `tasks` has a partial unique index for open breeding pregnancy-check tasks by `source_record_id` (`src/storage/migrations/index.ts:1337-1341`).
- `foals.foaling_record_id` is unique in the earlier schema definition (`src/storage/migrations/index.ts:194-209`).

With `INSERT OR IGNORE`, a daily log with a new `id` but the same `(mare_id, date, time)` as an existing row would be counted as "skipped" even though the primary key did not collide. If that skipped daily log has uterine fluid or flush children, the children may then fail with foreign-key errors because their parent `daily_logs.id` was never inserted. If it has no children, it may be silently lost. Either outcome violates the user-facing policy and makes the inserted/skipped counts untrustworthy.

Required plan change:

- Replace blanket `INSERT OR IGNORE` with explicit primary-key preflight.
- For each table, fetch destination IDs, insert only rows whose primary key is absent, and use regular `INSERT`.
- Treat non-PK unique conflicts as import errors with table-specific messages rather than "skips".
- Keep the skip count defined as "primary keys already present", not "SQLite changes was 0".
- Add a regression test where a package row has a new `daily_logs.id` but collides on `(mare_id, date, time)`; expected behavior should be a clear validation/import error, not silent skip.

This is the biggest semantic correction in the plan.

### 3. Scope validation is too weak for a portable import file

The plan's wrapper validation only asserts that `exportScope` exists, the primary row exists, stallion packages have mare-only tables empty, and mare packages have completed task pointers resolved (`implementation-plan.md:94-99`). That is not enough to prove the file is actually scoped to one horse.

For example, a full backup with an added `exportScope` could pass "primary row exists" while still containing every mare in the farm. Because the import is additive, that would import out-of-scope data rather than wiping the database, but it would still violate the product promise at `implementation-plan.md:8`.

Required plan change:

- Mare package validation should require exactly one mare row, and that row's `id` must equal `exportScope.primaryId`.
- Every mare-owned table row must point to that one mare: `tasks`, `daily_logs`, `breeding_records`, `medication_logs`, `pregnancy_checks`, and `foaling_records`.
- Foals must resolve through foaling records owned by the primary mare.
- Mare packages should require `collection_dose_events` and `frozen_semen_batches` to be empty unless the plan explicitly changes that scope.
- Mare-package stallions should be exactly the set referenced by included breeding records with non-null `stallion_id`.
- Mare-package semen collections should be exactly the set referenced by included breeding records with non-null `collection_id`.
- Stallion package validation should require exactly one stallion row, and that row's `id` must equal `exportScope.primaryId`.
- Stallion package `semen_collections` and `frozen_semen_batches` must all point to the primary stallion.
- Stallion package `collection_dose_events` must all point to included collections and must have `breeding_record_id === null`.
- Root mare/stallion rows should have `deleted_at === null`, matching the serializer's `deleted_at IS NULL` filters (`implementation-plan.md:58`, `implementation-plan.md:76`).

`validateBackup()` is still useful for row shape and internal FK integrity, but it is not a scope validator. The horse-package wrapper needs to be much stricter than the full-backup validator.

### 4. The privacy model is under-specified

The plan frames the feature as handing off a single horse's records "without exposing the whole farm's data" (`implementation-plan.md:8`). The current scope choices still expose sensitive adjacent data.

For mare exports, the plan includes full referenced stallion records (`implementation-plan.md:14`, `implementation-plan.md:60`). A full stallion row includes notes, pedigree fields, date of birth, AV preferences, and deleted state. That may be more than a vet, buyer, or seller needs for context.

For stallion exports, the plan includes all collection dose events (`implementation-plan.md:79`). Those rows include recipient names, phone numbers, street/city/state/zip, carrier service, container type, tracking number, notes, and event dates in the current backup row shape. That is customer/contact/shipping history, not merely stallion medical or inventory context.

Required plan change:

- Decide whether stallion exports include recipient/shipping details by default. I would default to excluding or redacting recipient contact fields unless the user explicitly chooses "Include shipment and recipient history."
- If full stallion context in mare exports is truly user-locked, add explicit preview copy listing the included context stallions.
- Add import/export preview copy that makes sensitive included record types visible before sharing.
- Add tests that enforce whichever redaction policy is chosen.

This is not polish. Once these JSON files are shared, over-exported private data cannot be recalled.

### 5. Additive import can attach new children to stale or mismatched existing parents

The user accepted "stale parent + new children" as a surface area (`implementation-plan.md:103`), and the plan warns when the root mare/stallion ID already exists (`implementation-plan.md:116`). That warning is too narrow.

Mare packages also carry context stallions and semen collections. If a referenced stallion or collection ID already exists on the destination, the parent row will be skipped, but new breeding records can still attach to that existing parent. In normal re-imports this is desirable. In rare ID collisions or stale context imports, it can bind new child rows to an unrelated or outdated parent.

Required plan change:

- Extend preview warnings beyond the root entity. Show already-present counts for context stallions and semen collections.
- For any already-present context row, consider comparing a small fingerprint of stable display fields (`name`, `registration_number`, `collection_date`, etc.) and warn if the destination differs.
- At minimum, surface "Some referenced stallion/collection records already exist and will not be updated."

This keeps the user-locked non-overwrite policy, but makes the consequence visible.

### 6. Schema-version policy is inconsistent

The plan defines horse packages as `BackupEnvelopeV11` plus `exportScope` (`implementation-plan.md:19-29`) and says package schema migration is out of scope (`implementation-plan.md:178`). But `validateBackup()` accepts schema versions 1 through 11 (`src/storage/backup/validate.ts:136-163`) and normal full restore later normalizes older backup shapes.

Horse import cannot simply accept whatever `validateBackup()` accepts unless `importHorsePackage()` also normalizes legacy envelopes before inserting. The proposed horse import path is built around current table arrays, including `tasks`, `uterine_flushes`, `time`, and current collection row shapes.

Required plan change:

- Either reject horse packages whose `schemaVersion !== BACKUP_SCHEMA_VERSION_CURRENT`, or explicitly normalize them with the same kind of logic full restore uses.
- Since this is a new feature, rejecting non-current horse packages is simpler and defensible.
- Add a validation test proving older schema packages with `exportScope` are rejected with a clear message.

## Design Gaps And Refinements

### Deterministic ordering is required but not specified

The tests propose byte-identical round trips modulo `createdAt` (`implementation-plan.md:145`), but the query plan mostly lists `WHERE` clauses without `ORDER BY` (`implementation-plan.md:58-72`, `implementation-plan.md:76-80`). SQLite row order is not a contract.

The serializer should specify deterministic ordering for every table, ideally matching `serializeBackup()` where reasonable. If exact byte comparison remains a test goal, also normalize or ignore `exportScope.primaryName` if later edits rename the horse.

### Task pointer validation should cover source pointers too

The plan validates `tasks.completed_record_id` for mare packages (`implementation-plan.md:99`) but explicitly waves off `tasks.source_record_id` as soft (`implementation-plan.md:88`). Soft does not mean irrelevant. Imported tasks with orphaned source pointers can confuse dashboard behavior and future task de-duplication, especially because open breeding pregnancy-check tasks have a unique source index.

The horse-package validator should map both `completed_record_type/completed_record_id` and `source_type/source_record_id` to the correct included table when the type is non-manual. If the referenced row is not in scope, either reject the package or null the pointer by design. Do not silently preserve orphan pointers.

### Import must invalidate app data

Full restore emits `emitDataInvalidation('all')` after database changes (`src/storage/backup/restore.ts:129`). The horse-import plan does not mention invalidation after additive import. Without it, already-mounted screens can show stale lists until focus or app restart.

The plan should require either `emitDataInvalidation('all')` after successful import or a documented set of targeted invalidation events that covers mares, stallions, records, tasks, collections, frozen batches, and dashboard state.

### Safety snapshot behavior needs failure semantics

The plan correctly requires a safety snapshot before every horse import (`implementation-plan.md:101-103`). It should also state:

- Validation failure must not create a safety snapshot.
- User cancellation must not create a safety snapshot.
- Import failure after snapshot creation should report that a snapshot was created, if that is useful to recovery.
- The import hook should refresh the snapshot list after successful import.

### Reusing SQL by copy will create backup drift

The proposed `src/storage/horseExport/importHorse.ts` will need insert SQL for every managed table. Copying the insert helpers from `restore.ts` would immediately create a second raw persistence surface that can drift on the next schema change. The same risk exists for serializer column projections copied from `serialize.ts`.

A better implementation shape is:

- Extract shared table writer specs or raw insert helpers from backup restore into an internal backup module.
- Let full restore call them with strict regular inserts.
- Let horse import call them only after primary-key preflight, still using regular inserts.
- Extract shared select column lists where doing so materially reduces drift.

The full restore behavior can remain unchanged while still avoiding a parallel copy of the schema.

### `photos: []` is premature as a per-row extension

The plan reserves `photos: []` arrays per entity (`implementation-plan.md:35`). Because the current backup validator ignores unknown row fields, this probably will not break validation. But it also means the field is not meaningfully typed or validated, and it may pre-commit Photos V1 to a row-embedded shape before that feature has landed.

Safer options:

- Omit photo placeholders from v1 horse packages.
- Or add a typed top-level `media`/`attachments` manifest with an explicit version and empty arrays.

Do not add unvalidated per-row fields just for speculative compatibility.

### UI state should keep full restore and horse import separate

`DataBackupScreen` currently has one pending full-restore preview state through `useDataBackup()`. Adding horse import to the same screen is fine, but the state machines should be separate enough that a pending full restore and pending horse import cannot both be active.

The screen should also visually separate destructive full restore from additive horse import. Putting "Import Horse" next to "Restore From File" is convenient, but the copy must make clear that one replaces the database and the other adds records.

### Sharing copy and file helpers should use horse-package language

The plan says export writes via the existing backup file pattern and calls `Sharing.shareAsync()` (`implementation-plan.md:112`). If it reuses `shareFileIfAvailable()`, the dialog title is currently "Share backup" in `src/storage/backup/fileIO.ts`. Horse packages should say "Share horse package" or the specific horse type. This is a small but important trust detail because users distinguish backups from shareable record packages.

## Test Plan Additions

The proposed tests are a good base, especially the full-restore guard and non-overwrite checks (`implementation-plan.md:141-151`). Add these before implementation is considered done:

- `restoreBackup()` rejects horse packages passed as raw JSON strings before normalizing the backup.
- `restoreBackup()` rejects horse packages passed as object candidates.
- Full-restore file preparation rejects a horse package before showing the destructive restore preview.
- `validateHorsePackage()` rejects a full backup with a forged `exportScope` and extra mares.
- `validateHorsePackage()` rejects a mare package with extra unreferenced stallions or semen collections.
- `validateHorsePackage()` rejects a stallion package with extra stallions.
- `validateHorsePackage()` rejects a stallion package where any dose event still has `breeding_record_id`.
- Import rejects a non-PK unique conflict, such as same mare/date/time daily log with a different row ID.
- Import rejects or intentionally rewrites orphan `tasks.source_record_id` and `tasks.completed_record_id` pointers.
- Successful import emits data invalidation.
- Validation failure and cancellation do not create safety snapshots.
- Safety snapshot is created before a confirmed import and the snapshot list refreshes afterward.
- Export ordering is deterministic across repeated serializations of the same data.
- Stallion export privacy behavior is tested, especially recipient/shipping fields if redaction is chosen.

## Suggested Plan Patch Summary

I would revise the implementation plan around these concrete decisions:

1. Keep `exportScope` as the marker, but guard on the raw parsed payload before calling `validateBackup()`.
2. Define `HorsePackageEnvelope` as a separate type rather than making `BackupEnvelopeV11` broadly carry an optional package marker.
3. Reject non-current package schema versions for v1.
4. Replace `INSERT OR IGNORE` with primary-key preflight plus regular inserts.
5. Make scope validation prove exact mare/stallion package closure, not just row-shape validity.
6. Decide and document the privacy policy for full stallion rows and dose-event recipient/shipping fields.
7. Add deterministic `ORDER BY` clauses to every package query.
8. Share raw insert/select schema surfaces with backup restore/serialize where practical.
9. Add import invalidation and explicit safety-snapshot failure semantics.
10. Expand tests around forged package scope, non-PK unique conflicts, marker preservation, and privacy.

The plan's product boundary is good. The implementation boundary needs to be sharper before this becomes safe to ship.
