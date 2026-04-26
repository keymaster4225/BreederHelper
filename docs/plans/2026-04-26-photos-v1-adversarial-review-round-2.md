# Photos V1 — Adversarial Review, Round 2

Round-2 review of `2026-04-26-photos-v1-implementation-plan.md`, building on `2026-04-26-photos-v1-adversarial-review.md`. Two independent reviewers were dispatched in parallel: a **Reality Checker** (feasibility / evidence / hidden assumptions) and an **architect** (structural fit with the existing codebase). Findings below are net-new or push deeper on issues the round-1 review covered shallowly.

**Combined verdict: NEEDS WORK / NEEDS REWORK.** Both reviewers agreed: the plan is structurally sympathetic to the codebase but introduces a new persistence axis (binary files outside SQLite) on top of unproven SDK 55 APIs, without fully extending the established invariants.

---

## Critical blockers (both reviewers flagged — must close before Phase 1)

### B1. Migration ID rebase + predicate hazard

`src/storage/migrations/index.ts` is a 53 KB inline-TS array, last entry `025_daily_log_flush_follow_up` at line 1383. The plan currently treats migration ID assignment as a trivial rebase concern.

Required additions to Phase 1:
- Reserve a placeholder ID; coordinate with `feature/collection-wizard` and bottom-tabs Phases 3–5 immediately before opening the PR.
- List `tableExists` / `hasColumn` / `indexExists` predicates explicitly for `photo_assets`, `photo_attachments`, and the partial unique profile index. The existing pattern at lines 1310, 1316, 1332 is the template.
- Without `indexExists`, the partial unique `WHERE role = 'profile'` index will surface differently on fresh vs upgraded SQLite — direct violation of the *Canonicalize migrations across install paths* rule in CLAUDE.md.
- Acceptance criterion: `npm test -- migrations` passes after rebase, and `BACKUP_INSERT_ORDER` is updated in the same commit.

### B2. DocumentPicker / Sharing MIME hard-coded `application/json`

`src/storage/backup/fileIO.ts:64` (`Sharing.shareAsync` mimeType) and `fileIO.ts:73` (`DocumentPicker.getDocumentAsync` type) both hard-code `application/json`. Plan asserts dual acceptance of `.json` and `.breedwisebackup` but does not enumerate the file-IO updates.

Consequence: on Android, `.breedwisebackup` files are greyed out in the picker (not selectable). On iOS the share sheet routes archives through Mail with the wrong attachment handler.

Required: parameterize `shareFileIfAvailable` MIME, update `pickBackupFile` filter (likely `application/zip` or `*/*` plus extension check), update `MANUAL_BACKUP_PREFIX` / `JSON_EXTENSION` constants, and add a screen test that selects a `.breedwisebackup` file from the picker.

---

## Reality Checker — unique critical findings

### RC1. The `expo-file-system` modern `File` / `Directory` API the plan relies on is not what's installed

- **Symptom:** Plan §Architecture/Dependencies says "Use the modern `expo-file-system` `File`/`Directory` API… because it supports file objects, bytes, and streams."
- **Evidence:** `package.json:34` pins `"expo-file-system": "~55.0.16"`. The `File`/`Directory` object-oriented API ships behind `expo-file-system/next`, NOT the default import. Existing code uses `expo-file-system/legacy` (`src/storage/backup/fileIO.ts:2`). Neither the plan nor the repo references `/next`. There is no proof streaming/byte APIs (`File.bytes()`, `File.write(Uint8Array)`) work under SDK 55.0.16 specifically.
- **Consequence:** Phase 0 spike will burn time discovering the import path; if `/next` is incomplete on Android in 55.0.16 (it has been historically), the entire archive plan collapses back to base64 — exactly what this revision was designed to avoid.
- **Required fix:** Phase 0 must reference `expo-file-system/next` explicitly, run a 30-line spike calling `new File(uri).bytes()` on a 5 MB JPEG on both iOS and Android simulators, and document the exact import path in the plan before any other work. Add a fallback row: "If `/next` byte API is broken on 55.0.16, defer Photos V1 until SDK 56."

### RC2. `fflate` ZIP output is still a `Uint8Array` in JS heap

- **Symptom:** Plan claims streaming/chunked archive output via `fflate`.
- **Evidence:** `fflate`'s sync `zip()` returns one `Uint8Array`; its async `zip()` is also fully buffered. Streaming via `Zip` + `ZipPassThrough` / `ZipDeflate` emits chunks via callback — but those chunks must be *written somewhere* incrementally. `expo-file-system/legacy.writeAsStringAsync` only accepts UTF-8 or Base64 strings (no `Uint8Array` append, no offset/append mode). `expo-file-system/next` may expose `File.write(bytes, { append: true })`, but see RC1 — unproven on SDK 55.0.16. If the plan falls back to building the full archive in memory, you've reinvented v9's OOM with extra steps.
- **Consequence:** The "no giant base64 string" acceptance criterion is met *only* if append-mode binary writes work end-to-end.
- **Required fix:** Phase 0 spike must measure peak JS heap when archiving 100 × 2 MB JPEGs. Set a hard ceiling (e.g. 150 MB peak) and document the exact `fflate` API used (`Zip` + chunked file append). If the fallback is in-memory, cap V1 at ~50 photos total and add a UI warning.

### RC3. The consistency sweep races every other repository — no concurrency guard

- **Symptom:** Plan §SQLite and Filesystem Consistency: "Run on app bootstrap and before backup/restore."
- **Evidence:** `useDailyLogWizard.ts` is 580 lines and persists asynchronously. `dailyLogs.ts:498, 616, 736` use `withTransactionAsync`. There is no global mutex. If the sweep runs at boot while a wizard save is mid-flight (e.g. user re-opens app to a wizard rehydrated from state), the sweep could observe a finalized file with no row yet (DB transaction in flight) and delete it — exactly the orphan rule applied to live data.
- **Consequence:** Silent data loss for a user who saves a daily log right as the app foregrounds, especially on Android where backgrounded JS can resume mid-transaction.
- **Required fix:** Sweep must (a) only run before any write paths are reachable (gate UI on sweep completion), or (b) ignore files newer than N seconds (e.g. 60s grace window), or (c) acquire an in-process write lock that all photo-writing repos honor. Plan currently picks none. Spec one and add a test: "Wizard mid-save during sweep does not lose finalized files."

### RC4. Fantasy claims requiring evidence

- **Claim:** "Prefer `fflate` because it is pure JavaScript and avoids adding a native module." `fflate` is not in `package.json`. No spike result is referenced. "Pure JS" does not equal "won't OOM in Hermes."
- **Claim:** "Restore continues to accept existing `.json` backups." `fileIO.ts:73` filter is `application/json` only; the picker won't surface `.breedwisebackup` (B2 above). Plan asserts dual acceptance without specifying picker-filter changes.
- **Claim:** Phase 4 acceptance "Profile photos survive app reload." Survival depends on the consistency sweep not deleting them — which races wizard saves (RC3). Asserted, not proven.
- **Claim:** `updated_at` and `created_at TEXT NOT NULL` without specifying date format. CLAUDE.md mandates `YYYY-MM-DD` for local dates and ISO for timestamps; plan does not bind which.
- **Claim:** Phase 6 "Manual verification confirms photos survive backup/restore" with no listed device matrix — no Android-Hermes vs JSC, no iOS HEIC source asset, no specified phone screen width.

### RC5. Missing scope that bites on day 1

1. **Migration repair / data-storage-hardening rule application.** Plan does not add `photo_*` to existing migration repair logic. Backups created on a fresh install may fail validation when restored to an upgraded install.
2. **Backup `caption` forward-compat.** Plan stores `caption TEXT` but no UI. Future v11 backup with captions restored to a v10 build needs defined behavior. Plan is silent.
3. **Storage quota / disk-full error handling.** `expo-image-manipulator` write to `documentDirectory` can fail with `ENOSPC`. Plan never specifies what the user sees when iOS reports "Disk Full" mid-archive.
4. **App reinstall.** iOS reinstall preserves `documentDirectory`; Android reinstall (depending on auto-backup config) does not. Plan does not call out that `auto_backup_rules.xml` (Android) and the iOS "App Data" inclusion list must be reviewed.
5. **Performance on a mare with many photos.** Plan caps daily logs at 12 photos; a heavy user has 50 daily logs × 12 = 600 thumbnails plus profile photos. Mare-detail tab queries joined with photo attachments have no index strategy spec for `owner_type='dailyLog' AND owner_id IN (...)`.
6. **Test mocks for `expo-image-picker` / `expo-image-manipulator`.** Plan §Phase 0 says "Add unconditional Jest mocks" but doesn't say where (`jest.setup.ts` is the existing convention). Forgetting this breaks every screen test that imports a screen with photo UI gated by `isPhotosEnabled()`.
7. **Restore validator vs. v10-on-v9 device.** Plan says v9 backups restore on v10 — but never says what happens if a user with a v10 archive tries to restore onto an older app build (downgrade). Reject explicitly with a clear message.

---

## Architect — unique critical findings

### A1. Backup pipeline gaps (binary photos)

The plan addresses backup conceptually but misses concrete extensions per CLAUDE.md ("extend the backup pipeline under `src/storage/backup/`"):

- **`BACKUP_INSERT_ORDER` / `BACKUP_DELETE_ORDER`** in `src/storage/backup/types.ts:50-82` — `photo_assets` must come *before* `photo_attachments` in INSERT (FK dependency), reverse for DELETE. Current arrays are 14 entries; V10 will be 16. List both arrays explicitly in Phase 3.
- **`BackupTablesV10` discriminator** — V10 *adds* tables, so `BackupTablesV10 = BackupTablesV9 & { photo_assets: ...; photo_attachments: ... }` and `validate.ts` needs a v9-vs-v10 branch. Reference the existing pattern in `validate.ts` to avoid invention.
- **Safety snapshot model change** — `safetyBackups.ts:36-66` (`listSafetySnapshots`) iterates files ending in `.json`. Plan switches to `.breedwisebackup` archives, which means `listSafetySnapshots` must accept *both* extensions during the v9→v10 transition window, or eligible v9 snapshots become invisible.
- **Round-trip test fixture missing** — Plan lists v10 archive round-trip (Phase 3 acceptance) but does not require a *fixture* in `testFixtures.ts` containing real photo bytes. Without that fixture, the round-trip test devolves to mocks. Specify a binary fixture (a 1×1 JPEG byte literal, ~125 bytes) checked into the repo.
- **Restore order vs FK** — Plan says "files first, then DB" (good for atomicity) but doesn't say that *within* the SQLite transaction, the order matches `BACKUP_INSERT_ORDER`: owners → `photo_assets` → `photo_attachments`.

### A2. Consistency sweep delete order vs `ON DELETE RESTRICT`

CLAUDE.md FK rule: `ON DELETE RESTRICT`. The sweep's "delete metadata when DB row points to missing file" rule violates RESTRICT if any attachment still references the asset. The sweep must delete attachments *first*, then assets — same order as `BACKUP_DELETE_ORDER`. Plan should explicitly say "the consistency sweep follows the same delete order as backup teardown."

### A3. Enum location and formatter

- `PhotoOwnerType`, `PhotoAttachmentRole`, `PhotoSourceKind` must live in `src/models/enums.ts` per CLAUDE.md ("All domain enums live in `src/models/enums.ts`"). Plan says "Add domain types" without specifying the file.
- Add `formatPhotoOwnerType` in `src/utils/outcomeDisplay.ts` so `'dailyLog'` never leaks to the UI in any future "Photos" hub.
- `source_kind` includes `'imported'` (forward-compat); add a unit test that asserts a backup containing `source_kind = 'imported'` round-trips even though no UI generates it in V1.

### A4. File service layering

Plan introduces a file service in Phase 2 but never says where it lives. Per the CLAUDE.md rule that screens must access repos via hooks, file-system access from screens should also go through hooks. Recommend `src/storage/photoFiles/` (analogous to `src/storage/backup/`) consumed by `src/hooks/usePhotoDrafts.ts`. State this explicitly.

---

## Storage decision validated

Filesystem + SQLite metadata (relative paths) is the right call — both reviewers confirm:

- **SQLite blob is wrong.** `expo-sqlite` blob handling on RN forces base64 encoding through the JS bridge — same memory cliff. Backup serialization (`serialize.ts:36-386` does `getAllAsync` per table) would materialize all blobs into JS heap.
- **Filesystem-only (no SQLite metadata) is wrong.** No way to enforce FK semantics, sort order, or owner relationships, and the consistency sweep would have nothing to reconcile.
- **Hybrid (chosen) is correct.** Relative-path persistence is essential for backup portability across devices — absolute `file://` URIs would make backups non-restorable on a different install.

---

## Recommended Phase 0 hard-gate

Before any Phase 1 work begins, Phase 0 must complete and document:

1. `expo-file-system/next` import path verified on SDK 55.0.16, both iOS and Android.
2. `new File(uri).bytes()` and `File.write(bytes, { append: true })` (or equivalent) proven against a 5 MB JPEG on both platforms.
3. Peak JS heap measurement during archive of 100 × 2 MB JPEGs, with a hard ceiling (suggested: 150 MB).
4. `fflate` API choice locked (`Zip` + chunked file append) and added to `package.json` only after the spike succeeds.
5. Documented fallback: if `/next` byte API is incomplete, defer Photos V1 until SDK 56 OR cap V1 at ~50 photos with explicit UI warning.

If any item in Phase 0 fails, Phase 1 does not begin.
