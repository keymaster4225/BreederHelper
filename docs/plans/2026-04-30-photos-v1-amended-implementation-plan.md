# Photos V1 Amended Implementation Plan

Date: 2026-04-30
Status: Amended after Brooks-Lint plan review
Supersedes: `2026-04-26-photos-v1-implementation-plan.md`
Incorporates: `2026-04-26-photos-v1-adversarial-review-round-2.md`

## Brooks-Lint Plan Review

**Mode:** Plan Review
**Scope:** `docs/plans/2026-04-26-photos-v1-implementation-plan.md` plus `docs/plans/2026-04-26-photos-v1-adversarial-review-round-2.md`
**Artifact Type:** Combined Spec+Plan
**Readiness Score:** 25/100

Not ready to execute as written. The product shape is coherent, but the execution plan still has data-safety and compatibility gaps around binary archive I/O, current backup schema versioning, migration repair, and SQLite/filesystem coordination.

### Critical

**Migration, Rollback, And Data Safety Gap - Backup schema version is stale**
Symptom: The plan says Phase 3 will add backup schema v10, but the current repo already defines `BACKUP_SCHEMA_VERSION_V11` as current in `src/storage/backup/types.ts`.
Source: Software Engineering at Google - backward compatibility and sustainability
Consequence: Implementing photos as v10 would collide with existing backup semantics, confuse restore branching, and make v10/v11/v12 validation paths unreliable.
Remedy: Treat photos as the next backup schema after rebase. As of 2026-04-30 this is expected to be v12, but the plan must say "next backup version" and explicitly update `types.ts`, `tableSpecs.ts`, `serialize.ts`, `validate.ts`, `restore.ts`, `safetyBackups.ts`, `fileIO.ts`, `testFixtures.ts`, and related tests.

**Migration, Rollback, And Data Safety Gap - Archive write strategy is unproven**
Symptom: The plan depends on modern `expo-file-system` binary APIs and chunked `fflate` output, while the current app uses `expo-file-system/legacy` for backup text I/O and `expo-file-system` is pinned to `~55.0.16`.
Source: Code Complete - defensive programming and explicit error paths
Consequence: If append-mode binary writes are unavailable or buffered in JS heap, backup creation can OOM or silently regress to the rejected base64-in-JSON approach.
Remedy: Make Phase 0 a hard feasibility gate. Verify `expo-file-system/next` import path, `File.bytes()`, and append-style binary writes on iOS and Android with SDK 55 before adding feature work. If it fails, stop Photos V1 or rescope to a smaller explicit photo cap with user-visible storage warnings.

**Migration, Rollback, And Data Safety Gap - Consistency sweep can delete live writes**
Symptom: The implementation plan says to run a photo consistency sweep on app bootstrap and before backup/restore, but does not guard against photo writes that finalize files before their metadata transaction commits.
Source: Code Complete - defensive programming and explicit error paths
Consequence: A boot or foreground sweep can observe a valid in-flight finalized file as an orphan and delete user data.
Remedy: Gate app write paths until the boot sweep completes, and add an in-process photo storage mutex used by sweep, finalize, backup, restore, and cleanup. The sweep must also ignore files newer than 60 seconds as a second line of defense.

**Compatibility And API Contract Gap - Backup file I/O still assumes JSON**
Symptom: `src/storage/backup/fileIO.ts` hard-codes `.json`, `application/json`, and JSON-only document picking, while the plan introduces `.breedwisebackup` archives.
Source: Software Engineering at Google - Hyrum's Law and backward compatibility
Consequence: Users may be unable to pick archive backups on Android, share sheets may mislabel files, and safety snapshots may disappear from listing/pruning logic.
Remedy: Add explicit archive constants and MIME handling. Picker logic must accept both legacy JSON and archive backups, then validate by extension and content before restore. Safety snapshot listing must accept both extensions during the transition.

### Warning

**Execution Dependency Disorder - Migration predicates are underspecified**
Symptom: The plan says to add the next migration and indexes, but the round-2 review shows the project relies on `tableExists`, `hasColumn`, and `indexExists` skip predicates to canonicalize fresh and upgraded installs.
Source: Clean Architecture - Acyclic Dependencies Principle / dependency order
Consequence: Fresh and upgraded SQLite schemas can diverge, especially for the partial unique profile-photo index.
Remedy: Phase 1 must list the exact skip predicate: `tableExists(photo_assets)`, `tableExists(photo_attachments)`, `indexExists(idx_photo_attachments_owner_role_order)`, `indexExists(idx_photo_attachments_profile_unique)`, and any additional index names.

**Change Propagation And Ownership Ambiguity - File service home is not concrete enough**
Symptom: The plan names hooks and repositories, but does not pin filesystem/archive code to an owned module path.
Source: A Philosophy of Software Design - information hiding
Consequence: Screens, hooks, repositories, and backup helpers may each learn file layout rules, creating scattered changes when storage layout evolves.
Remedy: Put all photo file layout, normalization, draft/finalize, URI resolution, deletion, and sweep logic under `src/storage/photoFiles/`. Screens consume hooks only.

**Verification Gap - Device and failure matrix is too vague**
Symptom: The plan lists final manual verification but does not name the binary archive spike outputs, disk-full behavior, downgrade behavior, or platform-specific HEIC and picker cases.
Source: How Google Tests Software - change coverage matched to risk
Consequence: The riskiest paths can pass happy-path tests while failing on real devices, older backup files, or low-storage conditions.
Remedy: Add Phase 0 and Phase 6 evidence requirements: iOS HEIC library asset, Android JPEG library asset, camera capture, denied permissions, limited library access, 100 x 2 MB archive stress, low-storage simulation/mocked `ENOSPC`, legacy JSON restore, archive restore, and clear rejection of future backup versions.

## Amended Source Of Truth

Photos V1 adds a reusable offline photo system for:

- Mare profile photos.
- Stallion profile photos.
- Daily log photo attachments.
- Camera capture and device library selection.
- App-owned JPEG masters and thumbnails.
- Full backup/restore of photo metadata and image files.
- A maximum of 12 photos per daily log.

V1 intentionally does not expose captions, pregnancy check photo UI, foaling record photo UI, pinch-to-zoom, exporting individual photos, or saving captured photos back to the device photo library.

The storage decision remains hybrid:

- SQLite owns metadata, owner links, ordering, limits, and restore validation.
- The app document directory owns image bytes.
- SQLite stores relative paths only.
- Backup archives contain `backup.json` plus binary image entries.

## Hard Gates

Implementation must not start beyond Phase 0 until these are true:

1. `expo-file-system/next` binary read/write APIs are proven on SDK 55.0.16 on iOS and Android.
2. Archive creation uses chunked output and incremental binary file writes. It must not build one full base64 archive string in memory.
3. A stress spike with 100 synthetic 2 MB JPEG-like files records peak JS heap below 150 MB, or the feature is rescoped before UI work starts.
4. The exact ZIP library API is documented. Preferred path is `fflate` `Zip` with streaming/chunk callbacks, not sync `zip()`.
5. Backup schema and migration numbers are assigned only after rebasing from `main`.
6. The boot consistency sweep is completed before photo write paths are reachable.

If any hard gate fails, stop and revise this plan before touching Phase 1.

## Architecture Decisions

### Dependencies

Install SDK-compatible native dependencies:

```bash
npx expo install expo-image-picker expo-image-manipulator
```

Add `fflate` only after the Phase 0 archive spike succeeds:

```bash
npm install --save fflate
```

Use `expo-file-system/next` only where the spike proves binary APIs work. Keep existing legacy JSON text helpers for legacy backup restore until deliberately migrated.

### Permissions

Update `app.json` plugins explicitly:

```json
[
  "expo-image-picker",
  {
    "cameraPermission": "BreedWise uses the camera so you can attach horse photos to records.",
    "photosPermission": "BreedWise lets you choose photos from your library to attach to horse records.",
    "microphonePermission": false
  }
]
```

Keep `app.config.js` merge behavior in mind because it appends `expo-localization`.

Do not request photo-library write permission in V1.

### Feature Flag

Add a non-literal feature flag helper under `src/config/featureFlags.ts`:

```ts
export const FEATURE_FLAGS = {
  photos: false as boolean,
};

export function isPhotosEnabled(): boolean {
  return FEATURE_FLAGS.photos;
}
```

Screen tests that cover photo UI must mock `isPhotosEnabled()` to return `true`. The final enable phase flips the default.

### Domain Types And Enums

Add enum values in `src/models/enums.ts`:

- `PHOTO_OWNER_TYPE_VALUES = ['mare', 'stallion', 'dailyLog', 'pregnancyCheck', 'foalingRecord']`
- `PHOTO_ATTACHMENT_ROLE_VALUES = ['profile', 'attachment']`
- `PHOTO_SOURCE_KIND_VALUES = ['camera', 'library', 'imported']`

Add model types in `src/models/types.ts`:

- `PhotoAsset`
- `PhotoAttachment`
- `PhotoOwnerType`
- `PhotoAttachmentRole`
- `PhotoSourceKind`

Add `formatPhotoOwnerType` in `src/utils/outcomeDisplay.ts` so raw values like `dailyLog` do not leak into UI or future diagnostics.

### Data Model

Add the next available migration after rebasing from `main`. As of this review, the latest migration is `027_dashboard_tasks`; photos are expected to use `028`, but do not hard-code that until branch creation.

Create `photo_assets`:

- `id TEXT PRIMARY KEY`
- `master_relative_path TEXT NOT NULL`
- `thumbnail_relative_path TEXT NOT NULL`
- `master_mime_type TEXT NOT NULL CHECK (master_mime_type = 'image/jpeg')`
- `thumbnail_mime_type TEXT NOT NULL CHECK (thumbnail_mime_type = 'image/jpeg')`
- `width INTEGER NOT NULL CHECK (width > 0)`
- `height INTEGER NOT NULL CHECK (height > 0)`
- `file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0)`
- `source_kind TEXT NOT NULL CHECK (source_kind IN ('camera', 'library', 'imported'))`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Create `photo_attachments`:

- `id TEXT PRIMARY KEY`
- `photo_asset_id TEXT NOT NULL`
- `owner_type TEXT NOT NULL CHECK (owner_type IN ('mare', 'stallion', 'dailyLog', 'pregnancyCheck', 'foalingRecord'))`
- `owner_id TEXT NOT NULL`
- `role TEXT NOT NULL CHECK (role IN ('profile', 'attachment'))`
- `sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0)`
- `caption TEXT CHECK (caption IS NULL OR length(caption) <= 500)`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `FOREIGN KEY (photo_asset_id) REFERENCES photo_assets(id) ON UPDATE CASCADE ON DELETE RESTRICT`

Indexes:

- `idx_photo_attachments_owner_role_order` on `(owner_type, owner_id, role, sort_order, created_at, id)`.
- `idx_photo_attachments_asset_id` on `(photo_asset_id)`.
- `idx_photo_attachments_profile_unique` unique on `(owner_type, owner_id, role)` where `role = 'profile'`.

Migration skip predicate must require:

- `tableExists(db, 'photo_assets')`
- `tableExists(db, 'photo_attachments')`
- `indexExists(db, 'idx_photo_attachments_owner_role_order')`
- `indexExists(db, 'idx_photo_attachments_asset_id')`
- `indexExists(db, 'idx_photo_attachments_profile_unique')`

Do not add photo columns to `mares`, `stallions`, or `daily_logs`.

Persist timestamps as ISO date-time strings. Persist business dates, if any are added later, as canonical `YYYY-MM-DD`.

### File Storage

All photo file behavior lives under `src/storage/photoFiles/`.

Storage layout:

```text
FileSystem.documentDirectory/
  photo-assets/
    <storageId>/
      master.jpg
      thumbnail.jpg
  photo-drafts/
    <draftId>/
      master.jpg
      thumbnail.jpg
```

Only relative paths are stored in SQLite:

```text
photo-assets/<storageId>/master.jpg
photo-assets/<storageId>/thumbnail.jpg
```

Normalization rules:

- Convert camera/library/imported sources to JPEG with `expo-image-manipulator`.
- Normalize EXIF orientation during conversion.
- Cap master long edge at 2400 px.
- Start JPEG quality at `0.85`.
- Retry lower quality or smaller dimensions if master exceeds 2 MB.
- Reject with a clear retryable error if the file cannot be normalized under cap.
- Generate thumbnail with longest edge around 512 px.
- Do not preserve byte-for-byte HEIC/PNG originals in V1.

Disk-full or permission errors must keep staged photos in memory when possible and show a retryable error. Never navigate away as if photos saved.

### SQLite And Filesystem Consistency

SQLite and document storage are not atomic together. Use this model everywhere:

1. Acquire the photo storage mutex.
2. Write or finalize files first.
3. Insert/update SQLite metadata in one transaction second.
4. After commit, delete old unreferenced files as best effort.
5. Release the mutex.
6. Let the consistency sweep repair leftovers.

The boot sweep must complete before the app exposes photo write paths. Backup and restore must also acquire the photo storage mutex before sweeping or writing archive files.

The sweep must:

- Delete `photo-drafts/` directories older than 24 hours.
- Ignore any `photo-assets/` directory newer than 60 seconds.
- Delete `photo_attachments` rows before deleting referenced `photo_assets` rows.
- Follow the same effective delete order as backup teardown.
- Delete `photo-assets/` directories that have no `photo_assets` row.
- Delete attachment and asset metadata when metadata points to missing `master.jpg` or `thumbnail.jpg`.
- Delete attachments whose owner no longer exists, then delete newly orphaned assets and files.
- Never delete files still referenced by valid DB rows.

## Phased Implementation

### Phase 0: Feasibility, Dependencies, And Test Seams

Goal: prove binary archive feasibility and install only safe prerequisites.

Tasks:

- Create a temporary spike under `scripts/spikes/photos-archive-spike.ts` or an equivalent throwaway file that is not shipped.
- Verify `expo-file-system/next` imports and binary reads/writes on iOS and Android.
- Verify append-style binary archive writes using the chosen ZIP library.
- Measure peak JS heap while archiving 100 x 2 MB representative files.
- Install `expo-image-picker` and `expo-image-manipulator` with Expo.
- Add `expo-image-picker` app config with `microphonePermission: false`.
- Add `src/config/featureFlags.ts`.
- Add unconditional Jest mocks in `jest.setup.ts` for `expo-image-picker`, `expo-image-manipulator`, and any new file/archive APIs.
- Add dependency-injected adapters or per-test Vitest mocks for native file/image/archive APIs. Do not rely on a global Vitest setup file unless one is added deliberately.
- Add an architecture note to this plan or a spike result section documenting the exact import paths and archive API.

Acceptance:

- `npm run typecheck` passes.
- `npm test` passes.
- `npm run test:screen` passes.
- No photo UI is visible.
- Spike evidence records platform, API, archive strategy, heap result, and fallback decision.

Stop condition:

- If binary append writes or heap limits fail, do not start Phase 1.

### Phase 1: Storage Foundation

Goal: add photo metadata safely with no user-facing UI.

Tasks:

- Rebase from `main`.
- Assign the next migration ID only after rebase.
- Add `photo_assets` and `photo_attachments`.
- Add skip predicates using `tableExists` and `indexExists` for both tables and all photo indexes.
- Add enum values in `src/models/enums.ts`.
- Add model types in `src/models/types.ts`.
- Add formatter and tests in `src/utils/outcomeDisplay.ts`.
- Add `src/storage/repositories/photos.ts`.
- Export repository functions through the existing repository index.

Repository responsibilities:

- List profile photo for one owner.
- List attachment photos for one owner.
- Set or replace a profile photo.
- Clear a profile photo.
- Add daily log attachment photos.
- Replace daily log attachment ordering with contiguous `0..n` values.
- Delete one attachment.
- Bulk delete attachments for hard-deleted owners.
- Delete orphaned `photo_assets` metadata after the last attachment is removed.
- Enforce the 12-photo daily log limit.

Tests:

- Fresh migration creates both tables and indexes.
- Upgraded migration creates both tables and indexes.
- Migration skip predicate does not over-apply on an already canonical schema.
- Setting a profile photo.
- Replacing the same profile photo 50 times leaves one profile attachment.
- Clearing a profile photo.
- Adding ordered daily log attachments.
- Replacing attachment order.
- Tie-break order for duplicate `sort_order`.
- Enforcing the 12-photo daily log limit.
- Deleting an attachment and orphan cleanup.
- Bulk deleting daily log, pregnancy check, and foaling record attachments.
- Backup fixture preserves `source_kind = 'imported'` even though V1 UI does not create it.

Acceptance:

- `npm test -- migrations` passes if that filter exists; otherwise the full `npm test` migration suite passes.
- Repository tests pass.
- No screen imports `@/storage/repositories/photos` directly.

### Phase 2: Photo File Service And Consistency Sweep

Goal: make files app-owned, normalized, relocatable, and recoverable.

Tasks:

- Add `src/storage/photoFiles/paths.ts`.
- Add `src/storage/photoFiles/normalize.ts`.
- Add `src/storage/photoFiles/drafts.ts`.
- Add `src/storage/photoFiles/assets.ts`.
- Add `src/storage/photoFiles/sweep.ts`.
- Add `src/storage/photoFiles/mutex.ts`.
- Add draft creation under `photo-drafts/<draftId>/`.
- Normalize camera/library/imported source files into JPEG masters.
- Generate thumbnails.
- Finalize drafts into collision-free `photo-assets/<storageId>/` directories.
- Resolve stored relative paths to runtime `file://` URIs.
- Delete asset directories idempotently.
- Run boot sweep before photo write paths are reachable.
- Run sweep before backup and restore under the photo mutex.

Tests:

- Draft creation.
- Finalization.
- Relative URI resolution.
- Idempotent delete.
- Missing source error.
- Stale draft cleanup after 24 hours.
- Orphan file cleanup.
- Missing-file metadata cleanup deletes attachments before assets.
- Files newer than 60 seconds are not swept as orphans.
- Dangling owner cleanup for daily logs, pregnancy checks, and foaling records.
- HEIC/PNG/JPEG inputs normalize to JPEG output through mocks or adapter tests.
- Disk-full failures surface a retryable error and do not write DB metadata.

Acceptance:

- SQLite stores relative paths only.
- Sweep cannot run concurrently with finalize, backup, or restore.
- Existing no-photo app flows are unchanged.

### Phase 3: Backup And Restore Archives

Goal: make photos recoverable before exposing any UI.

Tasks:

- Rebase from `main`.
- Add the next backup schema version. As of this review the expected version is v12, not v10.
- Keep restore support for legacy v1-v11 JSON backups.
- Add `.breedwisebackup` archive constants.
- Update `src/storage/backup/fileIO.ts` so manual and safety backup naming supports archive files.
- Parameterize `shareFileIfAvailable` MIME and title.
- Update `pickBackupFile` to allow archive selection and legacy JSON selection, then validate extension/content before restore.
- Update `src/storage/backup/types.ts`:
  - Add `photo_assets` and `photo_attachments` table names.
  - Add raw row types.
  - Add the next `BackupTablesVNext` type.
  - Add `photo_assets` before `photo_attachments` in `BACKUP_INSERT_ORDER`.
  - Add `photo_attachments` before `photo_assets` in `BACKUP_DELETE_ORDER`.
- Update `src/storage/backup/tableSpecs.ts`.
- Update `src/storage/backup/serialize.ts` to write `backup.json` plus binary photo entries.
- Update `src/storage/backup/validate.ts` to validate archive manifest entries, row references, owner references, MIME, dimensions, captions, and unsupported future schema versions.
- Update `src/storage/backup/restore.ts` to write photo files to collision-free paths first, then replace DB rows inside one transaction using backup insert order.
- Update `src/storage/backup/safetyBackups.ts` to list and prune both `.json` and `.breedwisebackup` during the transition.
- Add a checked-in tiny JPEG fixture, for example a 1x1 byte literal in `testFixtures.ts`.
- Add clear downgrade behavior: older app versions cannot restore newer archive versions; current app rejects future versions with a user-safe message.

Validation rules:

- Every `photo_asset` must have both master and thumbnail archive entries.
- Every `photo_attachment.photo_asset_id` must reference a `photo_assets` row.
- Every attachment owner must exist, except soft-deleted mares/stallions are valid owners.
- Attachment role must match owner constraints: `profile` only for mare/stallion in V1; `attachment` for daily logs and restored future owners.
- Captions are accepted and preserved as nullable text even though no V1 UI edits them.

Tests:

- Existing backup tests still pass.
- Legacy JSON v1-v11 restore still works.
- Archive round trip restores photo rows and files.
- Missing archive file entry fails validation.
- Broken photo asset reference fails validation.
- Broken owner reference fails validation.
- Restore from legacy JSON onto a device with photos removes current photo rows and leaves old files for sweep cleanup.
- Safety snapshots list and prune mixed `.json` and `.breedwisebackup` files.
- Document picker can select `.breedwisebackup` and `.json`.
- Share uses archive MIME for archive backups and JSON MIME for legacy JSON where applicable.

Acceptance:

- No photo UI is exposed until archive backup/restore tests pass.
- Backup and restore acquire the photo mutex.

### Phase 4: Mare And Stallion Profile Photos

Goal: expose the smallest visible surface after backup safety exists.

Tasks:

- Add `src/hooks/useProfilePhotoDraft.ts`.
- Add a shared profile photo picker component under `src/components/`.
- Wire profile photo staging into mare form hooks.
- Wire profile photo staging into stallion form hooks.
- Render profile thumbnail or initials fallback in mare detail header.
- Render profile thumbnail or initials fallback in stallion detail header.
- Load profile photos through detail data hooks.
- Open the viewer when tapping an existing profile photo.
- Keep initials non-interactive when no photo exists.

Tests:

- Thumbnail display.
- Initials fallback.
- Add, replace, remove in mare form.
- Add, replace, remove in stallion form.
- Long names and badges do not overlap avatar layout.
- Profile photos survive app reload through DB/file state.
- Missing thumbnail falls back cleanly.

Acceptance:

- Feature flag remains false by default unless daily log photos are complete.
- Screens do not import repositories or photo file APIs directly.

### Phase 5: Daily Log Attachments And Viewer

Goal: add multi-photo daily log support without changing no-photo wizard behavior.

Tasks:

- Add `src/hooks/usePhotoDrafts.ts`.
- Add optional Photos section to the daily log wizard review step.
- Support camera add flow.
- Support library multi-select with `selectionLimit` set to remaining slots where supported.
- Accept returned assets in returned-array order up to remaining slots.
- Show a clear skipped-count message when selection exceeds the remaining daily-log slots.
- Support staged delete and reorder.
- Persist daily log and photo metadata through one photo-aware DB transaction after file finalization.
- Hydrate existing attachments when editing a daily log.
- Show fixed-size horizontal thumbnail strip on daily log cards.
- Add full-screen viewer with close, loading, missing-file, and same-log swipe navigation.
- Delete daily log photo attachments/assets during daily log delete.
- Delete restored-but-invisible pregnancy check and foaling record attachments/assets during those owner delete flows.

Tests:

- Existing no-photo daily log create/edit flows remain unchanged.
- Add staged photos.
- Remove staged photos.
- Select 8 photos when 5 are already staged.
- Permission denied messaging for camera and library.
- Limited or empty library selection keeps staged photos unchanged.
- Saved thumbnail rendering on 320 px width.
- Viewer open, close, loading, missing-file, and swipe states.
- Daily log delete cleanup.
- Pregnancy check and foaling hard-delete cleanup for restored attachments.

Acceptance:

- Daily log photo limit is enforced in repository/service logic, not only UI.
- If photo persistence fails, the user stays on the review step with staged photos intact.

### Phase 6: Enable And Verify

Goal: expose photos only after storage, files, backup, restore, and screens are proven.

Tasks:

- Set `FEATURE_FLAGS.photos` default to true.
- Run all quality gates.
- Manually verify available iOS and Android targets.

Required commands:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

Expected command result:

- All commands exit 0.
- No test is skipped to bypass a photo failure.

Manual verification matrix:

- iOS camera capture.
- Android camera capture.
- iOS HEIC library selection.
- Android JPEG library selection.
- Permission denied for camera.
- Permission denied for library.
- Limited or empty photo-library selection.
- Mare profile add, replace, remove.
- Stallion profile add, replace, remove.
- Daily log add, remove, reorder.
- Daily log delete cleanup.
- Manual archive backup creation.
- Full archive restore on a clean install.
- Legacy JSON restore.
- Future schema restore rejection message using a crafted fixture.
- Restored photo display.
- Missing file fallback.
- Low-storage or mocked `ENOSPC` import/archive failure.

Acceptance:

- Main remains releasable.
- Photos survive backup/restore.
- Legacy backups remain restorable.
- Future backup versions are rejected before destructive restore work.

## Rollout Notes

- Keep each phase independently reviewable.
- Merge storage and backup safety before UI exposure.
- Migration conflicts are expected because `src/storage/migrations/index.ts` is centralized.
- Backup schema conflicts are expected because `src/storage/backup/types.ts` is centralized.
- Phase 4 and Phase 5 may merge behind the feature flag, but tests must mock the flag on.
- Do not push or merge branch work without explicit user permission.

## Phase 0 Execution Notes

Started on branch `photos-v1-phase-0`.

Status as of 2026-04-30:

- Branch created from the current dirty `main` worktree without discarding existing local changes.
- Installed SDK-compatible `expo-image-picker@~55.0.19` and `expo-image-manipulator@~55.0.15` with `npx expo install`.
- Added the `expo-image-picker` config plugin to `app.json` with camera and photo-library permission copy and `microphonePermission: false`.
- Added `src/config/featureFlags.ts` with `FEATURE_FLAGS.photos` defaulting to `false`.
- Added unconditional Jest mocks for `expo-image-picker`, `expo-image-manipulator`, and the root `expo-file-system` binary API surface in `jest.setup.ts`.
- Added `scripts/spikes/photos-archive-spike.ts` as the Phase 0 runtime spike artifact. It is not included in the normal TypeScript project include set.
- Fixed `useDashboardData` to load on mount and guard concurrent reloads after the navigator smoke test exposed that the dashboard could remain on its spinner if focus-based reload did not fire under native-stack screen tests.

Current local evidence:

- `expo-file-system@55.0.16` contains `node_modules/expo-file-system/next.ts`, but `expo-file-system/package.json` does not export `./next`.
- `require.resolve('expo-file-system/next')` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- The SDK 55 binary APIs are available from the root `expo-file-system` export: `File`, `Directory`, `Paths`, `File.bytes()`, `File.write(Uint8Array, { append: true })`, `File.open()`, and `FileHandle.writeBytes()`.
- Phase 0 spike code must therefore use `import { Directory, File, Paths } from 'expo-file-system'`, not `expo-file-system/next`.
- `fflate` is not installed yet. Keep it out of app dependencies until the append-write and memory spike passes on real iOS and Android targets.
- Local Node/package inspection cannot prove native iOS and Android file behavior. The remaining hard-gate evidence must come from running `scripts/spikes/photos-archive-spike.ts` in an Expo runtime on both platforms.

Verification completed:

- `npm run typecheck` passed.
- `npm test` passed: 50 test files, 526 tests.
- `npm run test:screen` passed: 39 suites, 209 tests.
- `npm run lint` passed.
- Standalone TypeScript check for `scripts/spikes/photos-archive-spike.ts` passed.

Device runtime spike evidence:

- Android runtime result recorded on 2026-04-30 from `adb logcat` with tag `PHOTOS_ARCHIVE_SPIKE_RESULT`.
- Android passed the binary round-trip, append-write, and 100 x 2 MB heap gate: `streamedBytesWritten` was `209715200`, `peakJsHeapBytes` was `8890536`, and `passed` was `true`.
- Raw Android result:

```json
{
  "platform": "android",
  "fileSystemImportPath": "expo-file-system",
  "bytesRoundTrip": true,
  "appendWrite": true,
  "streamedBytesWritten": 209715200,
  "peakJsHeapBytes": 8890536,
  "fallbackDecision": "Proceed only if this passes on both iOS and Android and peak JS heap remains below 150 MB.",
  "passed": true
}
```

- iOS Simulator runtime result recorded on 2026-05-01 from `docs/iostest.md`.
- The iOS Simulator run is accepted as satisfying the iOS side of the Phase 0 archive feasibility gate.
- iOS Simulator passed the binary round-trip, append-write, and 100 x 2 MB heap gate: `streamedBytesWritten` was `209715200`, `peakJsHeapBytes` was `7001904`, and peak JS heap was `6.7 MiB`.
- Raw iOS Simulator result:

```json
{
  "platform": "ios",
  "fileSystemImportPath": "expo-file-system",
  "bytesRoundTrip": true,
  "appendWrite": true,
  "streamedBytesWritten": 209715200,
  "peakJsHeapBytes": 7001904,
  "fallbackDecision": "Proceed only if this passes on both iOS and Android and peak JS heap remains below 150 MB.",
  "streamedMiB": 200,
  "peakJsHeapMiB": 6.7,
  "heapLimitMiB": 150
}
```

Phase 0 archive feasibility gate:

- Cleared for Android and accepted iOS Simulator coverage.
- Both recorded runs pass binary round trips, append writes, and peak JS heap below 150 MB.

Fallback decision:

- Continue Phase 0 prerequisites using root `expo-file-system` imports.
- Phase 1 may begin after the remaining non-archive Phase 0 prerequisites are complete.

## Follow-Up Features

- Pregnancy check photo UI.
- Foaling record photo UI.
- Captions UI.
- Tags or categories.
- Pinch-to-zoom viewer.
- Export/share individual photos.
- Optional save-to-device-library setting.
- Settings storage indicator for photo disk usage.
