# Photos V1 Implementation Plan

Date: 2026-04-26  
Status: Proposed, revised after adversarial review  

## Summary

Photos V1 adds a reusable photo system to BreedWise while keeping the app offline-first and recoverable through backup/restore.

V1 exposes:

- Mare and stallion profile photos.
- Daily log photo attachments.
- Camera capture and device library selection.
- App-private full-size JPEG masters plus generated JPEG thumbnails.
- Full backup/restore of photo metadata and image files.
- A 12-photo limit per daily log.

V1 intentionally does not expose captions, pregnancy check photos, foaling photos, pinch-to-zoom, or saving captured photos back to the device photo library. The schema should allow those later without another redesign.

The adversarial review found two valid architectural holes in the first draft: base64 photos inside a single JSON backup are a memory cliff, and SQLite/photo-file writes need an explicit recovery model. This revision closes those by using a single backup archive file and a files-first persistence strategy with a boot-time consistency sweep.

## Product Decisions

- First exposed surfaces: mare profile photo, stallion profile photo, and daily log attachments.
- Future surfaces: pregnancy checks and foaling records reuse the same attachment model.
- Source options: users can take a photo or choose existing photos from the device library.
- File ownership: BreedWise copies and normalizes selected/captured photos into app-owned storage.
- Device library writes: captured photos are not saved back to the user's photo library in V1.
- Stored quality: keep a full-size app JPEG master plus a smaller JPEG thumbnail. Do not preserve byte-for-byte HEIC/PNG originals in V1.
- Daily log limit: maximum 12 attached photos per daily log.
- Captions: keep nullable caption storage for future use, but do not expose caption UI in V1.
- Backup format: new backups become a single `.breedwisebackup` archive containing `backup.json` plus image files. Restore continues to accept existing `.json` backups.

## Architecture

### Dependencies

Install SDK-compatible native dependencies with Expo, not raw `npm install` versions:

```bash
npx expo install expo-image-picker expo-image-manipulator
```

Use the modern `expo-file-system` `File`/`Directory` API for new binary photo/archive work because it supports file objects, bytes, and streams. Keep the existing `expo-file-system/legacy` backup helpers for legacy JSON text files until they are intentionally migrated.

Use a ZIP-compatible archive with a BreedWise-specific `.breedwisebackup` extension. Prefer `fflate` because it is pure JavaScript and avoids adding a native module to the Expo app. The implementation must use streaming or chunked archive APIs; it must not build one giant base64 string in memory.

Update `app.json` permission configuration explicitly. Do not rely on `expo-image-picker` plugin defaults because the default Android manifest includes microphone permission that V1 does not need.

Add `expo-image-picker` as an explicit config plugin entry:

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

Keep the existing `app.config.js` merge behavior in mind: plugin entries added to `app.json` flow through that config file.

Do not request photo-library write permission in V1.

### Feature Flag

Add a testable feature flag under `src/utils` or `src/config`:

```ts
export const FEATURE_FLAGS = {
  photos: false as boolean,
};

export function isPhotosEnabled(): boolean {
  return FEATURE_FLAGS.photos;
}
```

Do not use `export const ENABLE_PHOTOS = false`; a literal false makes photo paths unreachable for TypeScript, lint, and Jest. Screen tests that cover photo UI should mock `isPhotosEnabled()` to return `true`. The final enable phase flips the flag default.

### Data Model

Add two tables in the next available migration after rebasing onto `main`. Do not hard-code `026` in branch work; migrations are centralized and other feature branches may consume the next ID first.

`photo_assets` stores file metadata:

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

`photo_attachments` links assets to domain records:

- `id TEXT PRIMARY KEY`
- `photo_asset_id TEXT NOT NULL`
- `owner_type TEXT NOT NULL CHECK (owner_type IN ('mare', 'stallion', 'dailyLog', 'pregnancyCheck', 'foalingRecord'))`
- `owner_id TEXT NOT NULL`
- `role TEXT NOT NULL CHECK (role IN ('profile', 'attachment'))`
- `sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0)`
- `caption TEXT CHECK (caption IS NULL OR length(caption) <= 500)`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- FK `photo_asset_id` references `photo_assets(id)` with `ON UPDATE CASCADE ON DELETE RESTRICT`

The `RESTRICT` delete is intentional: assets should only be removed after attachments are gone, so mistaken early deletes surface as FK errors.

Indexes and constraints:

- Index attachments by `(owner_type, owner_id, role, sort_order, created_at, id)`.
- Enforce one profile attachment per owner with a unique partial index where `role = 'profile'`.
- Do not make `sort_order` unique; reorder operations must renumber from zero, and list queries must tie-break by `sort_order`, `created_at`, then `id`.
- Enforce the 12-photo daily log attachment limit in repository/service logic.

Add domain types:

- `PhotoAsset`
- `PhotoAttachment`
- `PhotoOwnerType`
- `PhotoAttachmentRole`
- `PhotoSourceKind`

Do not add photo columns to `mares`, `stallions`, or `daily_logs`.

### File Storage

Store photo files under app-owned document storage:

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

Persist only relative paths in SQLite. Resolve them at runtime against `FileSystem.documentDirectory`.

Import normalization:

- Convert every selected/captured source to a JPEG master using `expo-image-manipulator`.
- Normalize EXIF orientation during conversion.
- Set a maximum master long edge of 2400 px.
- Start around JPEG quality `0.85`; retry lower quality or smaller dimensions if the master exceeds 2 MB.
- Reject the import with a clear message if it cannot be normalized under the file-size cap.
- Generate a thumbnail with longest edge around 512 px.

This means "master" is the full-size BreedWise copy, not a byte-for-byte source original. That tradeoff is deliberate to avoid HEIC display failures, huge backups, and inconsistent EXIF rotation across platforms.

### SQLite and Filesystem Consistency

SQLite and the document directory cannot be updated atomically together. Use this recovery model everywhere:

1. Write or finalize files first.
2. Insert/update SQLite metadata in a transaction second.
3. After commit, delete old unreferenced files as best effort.
4. On app bootstrap and before backup/restore, run a photo consistency sweep.

The consistency sweep must:

- Delete `photo-drafts/` directories older than 24 hours.
- Delete `photo-assets/` directories that have no `photo_assets` row.
- Delete attachment and asset metadata when the DB row points to missing `master.jpg` or `thumbnail.jpg`.
- Delete `photo_attachments` rows whose polymorphic owner no longer exists, then delete any newly orphaned `photo_assets` metadata/files.
- Never delete files that are still referenced by valid DB rows.

This bounds every crash case:

- If file finalization succeeds but DB insert fails, the next sweep removes orphan files.
- If DB commit succeeds but old file cleanup fails, the next sweep removes old unreferenced files.
- If restore writes new files but DB restore rolls back, the next sweep removes unreferenced restore files.
- If a user or OS removes image files but DB rows remain, the next sweep removes broken metadata and UI falls back cleanly.
- If a hard-deleted owner row is removed before photo cleanup completes, the next sweep removes dangling attachment metadata and any resulting orphan assets.

### Repositories and Hooks

Add `src/storage/repositories/photos.ts` and export it from the repository index.

Repository responsibilities:

- List profile photo for an owner.
- List attachment photos for an owner.
- Set or replace a profile photo.
- Clear a profile photo.
- Add daily log attachment photos.
- Replace daily log attachment ordering.
- Delete a single attachment.
- Bulk delete attachments for hard-deleted owners. V1 must wire this for daily logs, pregnancy checks, and foaling records because all three can be physically deleted while v10 can preserve those owner types.
- Delete orphaned `photo_assets` metadata after the last attachment is removed.
- Enforce the 12-photo daily log attachment limit.

Profile replace flow:

- Finalize the new asset files first.
- Inside one DB transaction, update the existing profile attachment in place when it exists; otherwise insert it.
- After commit, delete the old asset if no attachment references it.
- Add a repository test that replaces the same profile photo 50 times and asserts there is one profile attachment and no referenced-orphan metadata.

Soft delete policy:

- Soft-deleting mares or stallions keeps profile photos.
- Do not detach profile photos during soft delete.
- Bulk owner cleanup is used for hard deletes, including daily log, pregnancy check, and foaling record delete.
- If mare or stallion hard-delete behavior is added later, it must first delete their photo attachments inside the same owner-delete transaction.

Daily log save policy:

- Add a photo-aware save orchestration path rather than nesting transactions inside the current daily log save.
- For create/edit, finalize new files first, then run one SQLite transaction that saves the daily log and photo metadata together.
- If photo persistence fails, keep the user on the review step with staged photos intact and show a retryable error. Do not navigate away as if photos saved.
- If the daily log save fails after file finalization, the consistency sweep removes orphaned finalized files.

Add hooks under `src/hooks/`:

- `useProfilePhotoDraft` for mare/stallion form staging.
- `usePhotoDrafts` for daily log staged attachment add/remove/reorder.

Screens should call hooks, not repositories or file APIs directly.

## Backup and Restore

Bump backup schema from v9 to v10.

New backup artifact:

```text
breedwise-backup-v10-YYYYMMDD-HHmmss.breedwisebackup
  backup.json
  photo-assets/
    <photoAssetId>/
      master.jpg
      thumbnail.jpg
```

Safety snapshots use the same single-file archive model:

```text
breedwise-safety-backup-v10-YYYYMMDD-HHmmss.breedwisebackup
```

The `.breedwisebackup` file is a ZIP-compatible archive with a custom extension. `backup.json` remains human-readable inside the archive.

Restore compatibility:

- Continue accepting existing `.json` backups for schema v1-v9.
- Accept `.breedwisebackup` archives for schema v10+.
- The document picker should allow both JSON and BreedWise backup archive files.

Backup `backup.json` contains raw DB rows and photo file manifest entries, but not base64 image data. Photo files live as binary archive entries.

Add managed tables:

- `photo_assets`
- `photo_attachments`

Phase 3 must update all backup plumbing explicitly:

- `BACKUP_SCHEMA_VERSION_CURRENT`
- `BACKUP_TABLE_NAMES`
- `BACKUP_DELETE_ORDER`
- `BACKUP_INSERT_ORDER`
- raw row types
- serializer queries
- validator table requirements
- restore normalization and insert/delete order
- safety snapshot listing and pruning
- backup fixtures and tests

Restore behavior:

- Validate every v10 `photo_asset` has both archive file entries.
- Validate every attachment references an existing photo asset.
- Validate `mare`, `stallion`, `dailyLog`, `pregnancyCheck`, and `foalingRecord` owner references.
- Accept attachments for soft-deleted mares/stallions if the owner row exists; backups preserve hidden data.
- Accept `pregnancyCheck` and `foalingRecord` attachments even though V1 UI does not expose them; preserve them invisibly for forward compatibility.
- Because `pregnancyCheck` and `foalingRecord` rows are currently hard-deletable, their delete repositories and the consistency sweep must remove dangling photo attachments even though the UI does not expose those photo surfaces yet.
- Reject unknown owner types in v10. Future owner types require a new backup schema version.
- During restore, write photo files first to collision-free relative paths, then run the SQLite full-replace transaction with those rewritten paths.
- Do not delete old photo files before the DB transaction commits; old files become unreferenced and are removed by the consistency sweep.
- Emit full data invalidation after restore.

The old base64-in-JSON approach is rejected for V1 because realistic photo counts can OOM the JS runtime and create unusably large JSON files.

## UI Behavior

### Permissions

Camera denied:

- Show an alert explaining that camera access is needed to take photos.
- Offer `Open Settings` and `Cancel`.

Library denied or limited:

- Show an alert explaining that library access is needed to choose photos.
- Offer `Open Settings` and `Cancel`.
- If the limited library picker returns no usable assets, keep staged photos unchanged and show a non-destructive message.

Multi-select cap:

- Launch the library picker with `allowsMultipleSelection: true` and `selectionLimit` set to the remaining daily-log photo slots when the platform supports it.
- Request ordered selection where supported, such as `orderedSelection: true` on iOS 15+.
- If the picker still returns more photos than remaining slots, accept the returned assets in returned-array order up to the remaining limit. Do not promise tap-order preservation on platforms where the picker cannot provide it.
- Show a message such as `Added 7 photos. 1 was skipped because this daily log can have up to 12 photos.`

### Profile Photos

Mare and stallion detail headers:

- Use a 64x64 circular avatar at the leading edge of the header card.
- Put name and header actions to the right of the avatar.
- Keep the calendar button in the mare header's top-right action area.
- Let long names wrap within the text column without overlapping the avatar or action buttons.
- Place `Recipient` and `Pregnant` badges below the name/action row within the text column.
- Show initials fallback when no valid profile thumbnail exists.
- Tapping an existing profile photo opens the viewer; tapping initials does nothing.

Mare and stallion forms:

- Add a profile photo control near the top of the form.
- Actions: `Take Photo`, `Choose Photo`, and `Remove Photo`.
- New records can stage a profile photo before the domain record is saved.
- Edit records can replace or remove the existing profile photo.

### Daily Log Attachments

Daily log wizard:

- Add an optional Photos section to the final review step.
- Actions: `Take Photo` and `Choose Photos`.
- Show staged thumbnails.
- Allow deleting staged thumbnails.
- Allow reordering staged thumbnails.
- Renumber attachment `sort_order` values from zero on every reorder.

Daily log cards:

- Show a horizontal thumbnail strip when photos exist.
- Use fixed-size thumbnails around 56x56 px so 12 photos scroll horizontally on narrow phones.
- Keep existing daily log summary content unchanged when no photos exist.

Viewer:

- Open full-screen from profile or daily log thumbnails.
- Show the JPEG master with `resizeMode="contain"`.
- Include a visible close button with an accessibility label.
- Include loading and missing-file/error states.
- Support swiping between photos in the same daily log.
- Pinch-to-zoom is explicitly deferred to a follow-up.

Deleting a daily log:

- Delete related photo attachments inside the daily log delete transaction.
- Delete orphaned photo asset files after the transaction commits.
- Let the consistency sweep clean up if post-commit file deletion fails.

## Phased Implementation

### Phase 0: Dependencies, Flags, and Feasibility Spike

Goal: prepare the project and prove the archive strategy before committing screen work.

Implementation:

- Install SDK-compatible picker/manipulator packages with `npx expo install`.
- Add explicit `expo-image-picker` permission config to `app.json`, including `microphonePermission: false`.
- Add testable feature flag helper with `photos: false as boolean`.
- Add unconditional Jest mocks for `expo-image-picker`, `expo-image-manipulator`, and any new file/archive APIs used by screen tests.
- Add Vitest mocks or dependency-injected adapters for native file/image/archive APIs used by `src/**/*.test.ts`; the current Vitest config has no global setup file.
- Add `fflate` or an equivalent pure-JS ZIP library only after the spike confirms it works in Expo SDK 55.
- Spike archive creation/restore with representative binary files before Phase 3. If a single archive cannot be created without base64 memory cliffs, stop and revise the backup approach before exposing UI.

Acceptance:

- `npm run typecheck` passes.
- Existing unit and screen tests still pass.
- No photo UI is visible.
- The archive spike proves V1 backups do not require one giant base64 JSON string.

### Phase 1: Storage Foundation

Goal: add persistent photo metadata without any user-facing UI.

Implementation:

- Add the next available photo migration after rebasing from `main`.
- Add `photo_assets` and `photo_attachments`.
- Add owner type, role, source kind, JPEG MIME, dimension, caption length, and sort order constraints.
- Add indexes and partial unique profile constraint.
- Add model types.
- Add `photos` repository.
- Add repository tests for:
  - setting a profile photo,
  - replacing a profile photo 50 times,
  - clearing a profile photo,
  - adding ordered daily log attachments,
  - replacing attachment order with contiguous `0..n` values,
  - tie-break ordering when duplicate sort orders exist,
  - enforcing the 12-photo daily log limit,
  - deleting an attachment and orphaning cleanup,
  - bulk deleting daily log attachments,
  - bulk deleting pregnancy check and foaling record attachments preserved from restore.

Acceptance:

- Migration tests cover fresh and upgraded schema paths.
- Repository tests pass.
- No screens import photo repositories directly.

### Phase 2: File Service and Consistency Sweep

Goal: make image files app-owned, normalized, relocatable, and recoverable.

Implementation:

- Add draft file creation under `photo-drafts/<draftId>/`.
- Normalize picked/captured assets into JPEG masters.
- Generate JPEG thumbnails.
- Enforce dimensions and size caps.
- Finalize drafts into collision-free `photo-assets/<storageId>/` directories.
- Resolve stored relative paths to runtime file URIs.
- Delete asset directories idempotently.
- Add the photo consistency sweep.
- Run the sweep on app bootstrap and before backup/restore.

Acceptance:

- Tests cover draft creation, finalization, relative URI resolution, idempotent delete, and missing-source error handling.
- Tests cover stale draft cleanup after 24 hours.
- Tests cover orphan file cleanup.
- Tests cover missing-file metadata cleanup.
- Tests cover dangling polymorphic owner cleanup for daily logs, pregnancy checks, and foaling records.
- Tests cover HEIC/PNG/JPEG inputs normalizing to JPEG output.
- SQLite stores relative paths only.

### Phase 3: Backup and Restore

Goal: make photos recoverable before exposing the feature.

Implementation:

- Add backup schema v10.
- Add archive backup writer/reader.
- Keep legacy JSON restore support for v1-v9.
- Add photo raw row types.
- Add photo tables to serialize/validate/restore.
- Add binary photo file manifest support.
- Include photo files in safety snapshots.
- Restore v1-v9 backups with empty photo tables/files.
- Restore v10 archives by writing files first, then replacing DB rows with rewritten relative paths.

Acceptance:

- Existing backup tests still pass after fixture updates.
- v10 archive round-trip restores photo rows and files.
- Validation fails for missing archive photo entries.
- Validation fails for broken photo asset references.
- Validation fails for owner references that do not exist.
- Restore from a v9 backup onto a device with photos wipes current DB photo rows and removes old photo files through the sweep.
- Restore accepts attachments for soft-deleted mares/stallions.
- Restore accepts and preserves `pregnancyCheck` and `foalingRecord` attachments.
- Safety snapshot tests include photo archive entries and pruning still keeps the latest 3 snapshots.

### Phase 4: Mare and Stallion Profile Photos

Goal: expose the first visible photo feature with a small surface area.

Implementation:

- Add shared profile photo picker component.
- Add `useProfilePhotoDraft`.
- Wire profile photo staging into `useEditMareForm`.
- Wire profile photo staging into `useStallionForm`.
- Render profile thumbnail or initials fallback in `MareDetailHeader`.
- Render profile thumbnail or initials fallback in `StallionDetailHeader`.
- Load profile photos through detail data hooks.
- Fall back to initials if the resolved thumbnail file is missing.

Acceptance:

- Screen tests cover thumbnail display and initials fallback.
- Screen tests cover add/replace/remove in mare form.
- Screen tests cover add/replace/remove in stallion form.
- Screen tests cover long names and badges with the avatar layout.
- Profile photos survive app reload through persisted DB/file state.
- Feature remains gated if daily log photos are not complete.

### Phase 5: Daily Log Attachments and Viewer

Goal: add multi-photo daily log support without disrupting the existing wizard.

Implementation:

- Add `usePhotoDrafts` for staged daily log photos.
- Add optional Photos section to the review step.
- Support camera and multi-select library add flows.
- Support staged delete and reorder.
- Persist daily log and photo metadata through one photo-aware DB transaction.
- Hydrate existing attachments on daily log edit.
- Show horizontal thumbnail strip on daily log cards.
- Add full-screen viewer with close, loading/error states, and same-log swipe navigation.
- Delete daily log photo attachments/assets during daily log delete.
- Delete restored-but-invisible pregnancy check and foaling record attachments/assets during those owner delete flows.

Acceptance:

- Existing no-photo daily log create/edit flows remain unchanged.
- Screen tests cover adding staged photos.
- Screen tests cover removing staged photos.
- Screen tests cover selecting 8 photos when 5 are already staged.
- Screen tests cover permission denied messaging for camera and library.
- Screen tests cover saved thumbnail rendering on a narrow phone width.
- Screen tests cover viewer open, close, loading, and missing-file states.
- Repository or integration tests cover daily log delete cleanup.

### Phase 6: Enable and Verify

Goal: expose the feature only after storage, files, backup, restore, and screens are safe.

Implementation:

- Set the photos feature flag default to true.
- Run:
  - `npm run typecheck`
  - `npm test`
  - `npm run test:screen`
  - `npm run lint`
- Manually verify on available simulators/devices:
  - camera capture,
  - photo library selection,
  - permission denied flows,
  - mare profile add/remove,
  - stallion profile add/remove,
  - daily log add/remove/reorder,
  - daily log delete cleanup,
  - manual backup archive creation,
  - full archive restore,
  - legacy JSON restore,
  - restored photo display.

Acceptance:

- All checks pass.
- Manual verification confirms photos survive backup/restore.
- Main remains releasable after the phase.

## Testing Checklist

Run before final handoff:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

High-risk scenarios to test carefully:

- Backup/restore with many photos.
- Restore from old v1-v9 JSON backups.
- Restore from v10 archive backups.
- Replace profile photo 50 times.
- Delete a daily log with photos.
- App killed during draft creation.
- Stale draft cleanup.
- Permission denied for camera or library.
- Limited or empty photo-library selection.
- Missing file on disk with valid DB metadata.
- HEIC original on iOS, rendered on Android after restore.
- Multi-select beyond the 12-photo limit.
- Daily log card thumbnail strip on a 320 px wide phone.
- Reorder produces contiguous `sort_order` values.

## Rollout Notes

- Do not expose photo UI before archive backup/restore supports photo files.
- Keep each phase small enough to merge independently.
- Other app work should branch from `main`; periodically merge or rebase `main` into the photos branch.
- Migration conflicts are likely because migrations are centralized in `src/storage/migrations/index.ts`; resolve those early when other feature branches add migrations.
- Phase 4 and Phase 5 code can merge behind the feature flag, but review/test paths must mock the flag on so the code is not dead.

## Review Resolution Notes

Valid adversarial review points incorporated here:

- JSON base64 backup memory risk: replaced with a single archive artifact.
- SQLite/filesystem atomicity: files-first writes plus consistency sweep.
- Profile replacement unique-index risk: update-in-place transaction and repeated-replace test.
- Soft-delete ambiguity: keep mare/stallion profile photos on soft delete.
- Polymorphic owner risk: owner type CHECK plus explicit restore validation.
- Future owner dangling risk: hard-delete cleanup and consistency sweep coverage for daily logs, pregnancy checks, and foaling records.
- Draft leaks: boot-time and pre-backup stale draft cleanup.
- Literal feature flag risk: testable non-literal boolean helper.
- HEIC/orientation risk: normalize all app masters and thumbnails to JPEG.
- Multi-select cap and permission behavior: explicit UI rules.
- Picker ordering risk: use platform-supported `selectionLimit`/ordered selection but only rely on returned-array order.
- Unneeded microphone permission risk: explicit image-picker config sets `microphonePermission: false`.
- Daily log save transaction risk: photo-aware save orchestration.
- Migration ID risk: next available ID after rebase.
- Backup schema churn: explicit Phase 3 file list.
- Native API testability risk: Jest mocks for screen tests plus Vitest mocks or injected adapters for unit tests.
- Safety snapshot scale: archive snapshots, not base64 JSON snapshots.
- Header layout and thumbnail overflow: fixed avatar and horizontal strips.
- Viewer expectations: close/loading/error/swipe in V1; pinch-to-zoom deferred.

## Follow-Up Features

After V1:

- Pregnancy check photo UI.
- Foaling record photo UI.
- Captions.
- Tags or categories.
- Pinch-to-zoom viewer.
- Export/share individual photos.
- Optional save-to-device-library setting.
- Settings storage indicator for photo disk usage.
