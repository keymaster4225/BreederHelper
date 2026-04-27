# Adversarial Review: Photos V1 Implementation Plan

**Reviewing:** `docs/plans/2026-04-26-photos-v1-implementation-plan.md`
**Date:** 2026-04-26

**Verdict:** Solid product framing and a sensible phase order, but the plan papers over the hardest part of the feature — the fact that photo bytes live on disk while photo metadata lives in SQLite, and the two have no atomic glue. As written, several normal-day workflows (replace profile photo, restore from backup, kill the app while picking) leave the device in inconsistent states. There are also at least three places where the plan ships a real architectural decision as a hand-wavy bullet ("base64-in-JSON backup", "ENABLE_PHOTOS as a `const`", "expo-file-system/legacy") that should be defended before any code is written. Below: ~18 substantive issues, plus test-coverage gaps and design pushback.

---

## Substantive issues (must address before coding)

### 1. SQLite ↔ filesystem atomicity is undefined and broken in every direction
The plan mixes two persistence stores (SQLite and the document directory) but never picks an ordering or a recovery model.

For **single-photo create** (e.g. profile photo save):
- If the row is inserted first and the file write then fails (or the app is killed), the DB has a row pointing at a missing file. The viewer renders nothing and the orphan never goes away.
- If the file is written first and the INSERT then fails, the file orphans.

For **restore** the picture is worse. The current flow (`restore.ts:106-109`) wraps row replacement in `db.withTransactionAsync`. The plan adds two new side-effecting verbs — "Create the safety snapshot before deleting existing photo files" and "Delete old photo files during restore" — without saying when they happen relative to the SQLite transaction. There are at least three orderings, all bad:

| Order | What happens if it crashes after step N |
|---|---|
| (a) write photo files → DB transaction → (commit) | crash after files = orphan files; crash mid-transaction = files exist but no rows |
| (b) DB transaction → (commit) → write photo files | crash after commit = rows exist but no files (rendering breaks for every restored photo) |
| (c) delete old files → write new files → DB transaction | crash after deleting = lost old photos AND no new photos visible (worst case: the safety snapshot is the only copy) |

The plan should pick one and describe the recovery story. Minimum viable: "files first, then DB; on next boot, scan `photo-assets/` for directories with no `photo_assets` row and delete." That at least bounds the orphan problem.

### 2. Base64 photos in a single JSON envelope is a memory cliff, not a roadmap problem
Plan says "embed photo file payloads as base64" and treats per-asset chunking / archive format as a "follow-up." But the V1 design itself is the failure surface:

- `serializeBackup()` returns one `BackupEnvelopeV9` object that gets `JSON.stringify(...)` to a single string before `FileSystem.writeAsStringAsync` (`safetyBackups.ts:24`, `fileIO.ts:49-51`).
- A single 4032×3024 iPhone JPEG is ~3 MB; base64-encoded it is ~4 MB. A user with the maximum the plan allows — 12 photos × even just 30 daily logs × originals + thumbnails — is north of 1 GB held as a single string in JS heap, with another full copy in the JNI bridge during write. Hermes will OOM before that.
- `safetyBackups.ts` keeps `MAX_SAFETY_SNAPSHOTS = 3`. So the device must accommodate three of these blobs simultaneously, in addition to the live photo files.
- Manual backup is shared via `Sharing.shareAsync` (`fileIO.ts:57-69`) using `application/json` MIME. iOS Mail caps attachments around 25 MB; the sharing target rejects silently or the iOS share sheet never opens.
- The plan's own testing checklist lists "Large photos and multiple-photo selection" but not "backup/restore at the upper end of the 12-photo cap across many daily logs." That's the load profile this design fails on.

This needs either (a) a hard per-asset size cap on import (downscale > 2 MB), (b) a per-photo binary side-file written next to the JSON, or (c) accepting the v1 scope only goes up to small sets and putting a backup-size warning in the UI. As-is the plan ships a footgun.

### 3. Replacing a profile photo will violate the unique partial index unless wrapped in a transaction
Plan: "Enforce one profile attachment per owner with a unique partial index where `role = 'profile'`." Good for integrity. But the consequence is that the obvious implementation of "Set or replace a profile photo" — INSERT new, then DELETE old — fails the constraint. The implementation must either DELETE-then-INSERT inside a transaction, or UPDATE the existing row's `photo_asset_id`. Plan should pick:

- DELETE-then-INSERT requires generating a new attachment id and rewriting any UI that holds the old id (none in V1, but a forward-compat tax).
- UPDATE-in-place keeps the attachment id stable (preferable for diff-friendly backups) but means the old `photo_asset_id` row needs to be cleaned up *after* the update — exactly the orphan-cleanup the plan says to do "after the last attachment is removed." That cleanup must be transactional with the UPDATE or step 1 happens again.

Plan needs one paragraph on the exact replace flow, including the orphan-cleanup ordering, and a repository test that does it 50 times in a row to catch index/orphan leaks.

### 4. Mares and stallions are soft-deleted; the plan's bulk-delete repository verb has no caller
- `softDeleteMare` (`mares.ts:146`) and `softDeleteStallion` (`stallions.ts:181`) only set `deleted_at`. There is no hard-delete in the codebase today.
- The plan lists "Bulk delete attachments for an owner" as a repository responsibility — but nothing in V1 *calls* it for mares or stallions, because the only delete path is soft. So either the repo verb is dead code in V1 (cut it), or the plan needs to specify what soft-delete should do to the photo: keep it (and pay the disk cost forever) or null it out (and lose data if a future "restore deleted" feature is built).
- For daily logs (which *are* hard-deleted, `dailyLogs.ts:736-746`), bulk-delete makes sense and the plan says "Delete daily log photo attachments/assets during daily log delete." But this needs to happen *inside* the existing `deleteDailyLog` transaction (`dailyLogs.ts:738`) or you re-introduce the inconsistency from issue 1. Plan doesn't say.

Pick one of: "soft-delete is opaque to photos, bulk-delete is dead code in V1, keep it for V2", or "soft-delete also detaches the profile photo" (and accept the data loss). Don't leave it implicit.

### 5. Restore doesn't account for soft-deleted owners or unexposed owner types
Plan: "Validate exposed owner references for `mare`, `stallion`, and `dailyLog`." Two gaps:

- **Soft-deleted owners.** Restore replaces all rows from a backup, including soft-deleted mares (`restore.ts` already preserves `deleted_at` — `insertMare`, line 234). If the backup contains a profile-photo attachment for a soft-deleted mare, the validator currently passes (the mare exists), the file gets written, and it then renders nowhere because the mare is hidden. Pure waste of disk, undetectable by the user. Validator should either reject these or skip them with a warning.
- **`pregnancyCheck` / `foalingRecord` owner types in a v10 payload.** Plan says these are valid in the schema for forward-compat but not exposed in V1. Does a v10 restore *accept* attachments for those owner types (silently store them, invisible until V2) or *reject* them (forced upgrade)? Plan implies the former by saying "Only `mare`, `stallion`, and `dailyLog` are exposed in V1" but the validator language says "validate exposed owner references" — which sounds like rejecting unexposed ones. Pick one. If accept, write an explicit test for "v10 backup with a foaling-record photo restores cleanly on a V1 build, photo is invisible but stored."

### 6. The polymorphic `owner_id` has no FK; SQLite will not save you
Plan: "Supported `owner_type` values in V1: mare, stallion, dailyLog, pregnancyCheck, foalingRecord." `photo_attachments.owner_id` is `TEXT NOT NULL` and references nothing. That's the standard polymorphic pattern; it's fine; but it means:

- If repository code has a bug that orphans the parent record (e.g. deletes a mare hard in some future feature without cleaning up attachments), the photos sit there forever with no FK to catch it.
- The plan's CHECK constraint mentioned only on `source_kind` (`'camera' | 'library'`) and on `role` (`'profile' | 'attachment'`). There is **no CHECK constraint on `owner_type`**. A typo in code stores `'mae'` and SQLite happily persists it. Either add a CHECK with all 5 valid values (and accept the migration cost when you add a 6th) or document why you won't. As written, the schema is more permissive than the validator, and there's a guaranteed class of bugs that will only surface on backup-validate, not on insert.
- Forward-compat for unknown `owner_type`: like the JSON-column rule in CLAUDE.md ("preserve unknown keys rather than stripping them"), the plan should say what restore does with a future `owner_type` like `'foal'` in a v11 backup loaded onto a v10 build. Reject the whole backup? Skip just the row? Plan doesn't say.

### 7. Drafts under `photo-drafts/<draftId>/` will leak; the cleanup trigger is undefined
Plan: "Stale draft cleanup." When? On boot? On every form open? Periodically? It matters:

- New-mare flow: user picks a photo, kills app before saving. `photo-drafts/<id>/original.jpg` and `thumbnail.jpg` are on disk forever. With a 12-photo daily log workflow, a single abandoned save can leak ~50 MB.
- The plan never says the file service knows what's "live" vs "dead." It needs a registry — either the draft id is stamped with a timestamp and anything older than X is GC'd, or the form must persist a "drafts in flight" record so reboot recovery can finish or roll back.
- The relevant precedent in this codebase is `safetyBackups.cleanupOldSafetySnapshots` (`safetyBackups.ts:68-77`) — best-effort, runs on snapshot create. That pattern won't catch leaks if no new photo flow runs.

Pick: "cleanup runs on bootstrap, deletes anything in `photo-drafts/` older than 24 h" + a unit test, and write it down.

### 8. ENABLE_PHOTOS as `export const ENABLE_PHOTOS = false` doesn't compose with the testing strategy
Plan: `ENABLE_PHOTOS = false`. Two problems:

- TypeScript narrows `if (ENABLE_PHOTOS)` blocks to unreachable when the constant is literal `false`. ESLint with `@typescript-eslint/no-unreachable-code` (or just `no-constant-condition`) will fire, and any types referenced only inside those blocks become "declared but unused." Phase 0 acceptance "`npm run typecheck` passes" depends on whether you accept that warning suppression or write the flag as a non-literal `as boolean`. Plan should say.
- For Phase 4 / 5, the screen tests that render photo UI need the flag flipped. With a literal `const`, the only way is `jest.mock('@/featureFlags', () => ({ ENABLE_PHOTOS: true }))` per test file. That's mechanical churn, easy to forget, and screen tests that incidentally render a screen with photo UI will not exercise the photo code path because the constant is statically false. Plan should specify the override mechanism *and* whether photo paths in screen tests run with the flag on or off.
- Worth considering: a runtime flag stored in AsyncStorage so internal/QA builds can flip it. Costs little, makes the manual verification in Phase 6 actually testable.

### 9. `expo-file-system/legacy` does not have a clean binary-write API; HEIC is not addressed at all
Plan: "Continue using `expo-file-system/legacy` because the existing backup/file code already uses it." Fine for the JSON envelope. But:

- `legacy.writeAsStringAsync` requires either `EncodingType.UTF8` (default) or `EncodingType.Base64`. To get a photo's bytes onto disk for the backup envelope, you do `readAsStringAsync(uri, { encoding: Base64 })` which materializes the entire base64 string in memory. See issue 2.
- iOS `expo-image-picker` returns HEIC originals by default (`MediaType.Photos` with `quality: 1`). React Native `<Image>` on Android cannot render HEIC. The plan says "Tapping a thumbnail opens a simple full-screen image viewer using the original file." On Android the user opens the viewer and sees a black screen.
- Plan stores `original_mime_type` but doesn't constrain it (no CHECK), doesn't normalize (no force-JPEG-on-import), and doesn't say what the viewer does with unsupported types. Either force JPEG conversion at import (via `ImageManipulator.manipulateAsync` with `format: SaveFormat.JPEG` and no transforms) or store both original and a JPEG fallback. Pick.
- EXIF orientation: `ImageManipulator.manipulateAsync` *usually* normalizes; legacy `Image` rendering *usually* respects the EXIF flag. But you'll get one platform combination where the original renders rotated and the thumbnail renders correct. Plan should state the normalization assumption and add a test fixture with a rotated source.

### 10. Multi-select + the 12-photo cap interaction is unspecified
Plan: "Choose Photos" plural + "Enforce 12 photos per daily log with a clear alert or inline message."

Concrete cases the plan punts on:
- User has 5 staged. Hits "Choose Photos." iOS picker doesn't let you cap selection; the user picks 8. Now you have 13. Truncate to 12 (which 12?), reject all 8, or accept up to the cap and toast about the rest? Plan: shrug.
- User on iOS 17+ has Limited Photo Access. Plan never mentions this mode. The picker only shows the subset they previously granted. If they want to add a photo not in the subset, the flow is "go to Settings > BreedWise > Photos > All" — completely outside the app. Plan should at least cover the empty-picker case.
- User denies camera or library permission. Plan testing checklist lists "Permission denied" but the *behavior* is unspecified (re-prompt? show an alert? open settings? hide the affordance?).

Pick rules and write them down. The implementer will guess otherwise.

### 11. Daily log save + photo attach is two operations and they aren't transactional
`useDailyLogWizard.save` (`useDailyLogWizard.ts:419-473`) calls `createDailyLog(...)` then immediately `onGoBack()`. The plan inserts photo persistence between create and goBack:

- `createDailyLog` already wraps its inserts in `withTransactionAsync` (`dailyLogs.ts:738-743` shows the pattern for delete; create follows the same shape). expo-sqlite does not nest transactions cleanly.
- If photo persistence fails after the daily log row is committed, the user sees "saved" but has a daily log with zero attached photos and no error. The reverse is also possible — staged drafts need to be promoted only after the create transaction commits.
- Plan should specify: (a) is photo persistence inside the daily-log transaction (probably no, because it crosses DB + filesystem), or (b) outside (and thus needs explicit "if photo persistence fails, what?" UX — toast and let user re-edit? rollback the daily log?)

### 12. Migration ID 026 is not guaranteed; concurrent feature branches own un-allocated IDs
Plan calls the migration `026_photos`. Today the highest is `025_daily_log_flush_follow_up` (`migrations/index.ts:1383`). But per project memory: `feature/collection-wizard` (Phase 2.5) and bottom-tabs Phases 3-5 are in flight, both potentially adding migrations. Whoever lands first takes 026; this plan should be written as "the next available migration ID after merging from `main`" and acknowledge the rebase cost. The plan does call out "Migration conflicts are likely" — good — but bakes the literal `026` into Phase 1 acceptance ("Add migration `026_photos`"), which will be wrong by merge time.

### 13. Bumping `BACKUP_SCHEMA_VERSION_CURRENT` from 9 → 10 breaks every existing backup test fixture
Plan: "Bump backup schema from v9 to v10." That single edit changes the type that `serializeBackup()` returns (`serialize.ts:36-386` types `Promise<BackupEnvelopeV9>`), and every test fixture in `testFixtures.ts`, `validate.test.ts`, `restore.test.ts`, `serialize.test.ts`, `safetyBackups.test.ts` currently asserts on V9 shape. Phase 3 acceptance "Existing backup tests still pass" hides several hundred lines of mechanical churn:

- `BACKUP_TABLE_NAMES` (`types.ts:31-46`) — add 2 entries.
- `BACKUP_DELETE_ORDER` (`types.ts:50-65`) — must put `photo_attachments` before `photo_assets` (FK direction). The plan says "FK ... with restrictive delete behavior" so insert order is `photo_assets` first, delete is the reverse.
- `BACKUP_INSERT_ORDER` (`types.ts:67-82`) — same.
- `BackupTablesV9` (`types.ts:515`) is currently `= BackupTablesV8`; that's why it required no test churn going 8→9. A V10 that *adds tables* breaks that pattern. Define `BackupTablesV10 = BackupTablesV9 & { photo_assets: ...; photo_attachments: ... }` and route the validator/restore down distinct V9 vs V10 branches (matching how `BackupSchemaVersion` already discriminates in `validate.ts:107-137`).
- The `serializeBackup` return type and the giant Promise.all destructuring must add two more queries.

Plan should call out "this is a mechanical lift across ~6 files" rather than burying it in "existing tests still pass."

### 14. The safety snapshot of "current state" with photos is itself a giant operation, not described
Plan: "Include photo files in safety snapshots." But:

- Today a snapshot is a single JSON file at `safety-snapshots/breedwise-safety-backup-v5-<ts>.json` (`fileIO.ts:6, 32`). Adding photo files inside the JSON via base64 inherits issue 2 wholesale.
- The alternative — write the JSON next to a `safety-snapshots/<ts>/photo-assets/...` directory — changes the snapshot model from "a file" to "a directory" and breaks `listSafetySnapshots` (`safetyBackups.ts:36-66`), which assumes one file per snapshot.
- Sharing a safety snapshot becomes either impossible (it's a directory) or redundantly large (the JSON has the bytes anyway). Plan should specify which snapshot model it adopts.

### 15. Phase 4 "Render profile thumbnail or initials fallback in `MareDetailHeader`" is a layout change with no spec
`MareDetailHeader.tsx:23-56` currently has no avatar slot — it's a name + a calendar IconButton in a row, then a stack of text lines. Adding a circular thumbnail is not a drop-in: it reshapes the whole header. Plan doesn't say:

- Avatar size, position (left of name? above? leading badge?).
- Whether badges (`Recipient`, `Pregnant`, `MareDetailHeader.tsx:34-50`) sit beside the avatar or below.
- What happens on long mare names that wrap.
- Whether tapping the avatar opens the viewer (per the daily log card behavior) or does nothing.
- Whether the calendar IconButton stays in the same place.

Phase 4 acceptance "Screen tests cover thumbnail display and initials fallback" doesn't catch any of these. Spec the layout (or a low-fi sketch) before code.

### 16. `sort_order` reordering is not atomic and the plan doesn't say what tie-breaks ties
Plan: `sort_order INTEGER NOT NULL DEFAULT 0`, indexed by `(owner_type, owner_id, role, sort_order)`. No uniqueness on the index. Two issues:

- "Replace daily log attachment ordering" implies UPDATEs on multiple rows. If two rows end up with `sort_order = 3` (because the implementer forgot to renumber from 0), the order is nondeterministic. Plan should specify renumber-from-zero on every reorder operation, and a tie-breaker secondary sort (`created_at` then `id`) for safety.
- A unique index would prevent duplicate sort_orders but make reorder hard (you can't atomically swap rows 3 ↔ 4 without going through a placeholder). Plan can stay non-unique, but the test for reorder must explicitly assert that after `[a,b,c]` → `[c,a,b]`, the `sort_order` values are `0,1,2`, not `2,0,1`.

### 17. The daily log card thumbnail strip has no overflow rule
Plan: "Show a compact thumbnail strip when photos exist." Daily log cap is 12. 12 thumbnails at any reasonable tap-target size (32px+) overflows a 360px-wide phone. Plan should specify "show first N + count badge" or "horizontal scroll" or "grid of 4 with truncation." Otherwise the implementer ships a layout that breaks on small devices and the screen test passes because it uses a 1024px-wide test renderer.

### 18. Photo viewer scope is far thinner than user expectation
Plan: "Tapping a thumbnail opens a simple full-screen image viewer using the original file." That reads like `<Image source={{ uri }} resizeMode="contain" />` in a Modal. Real expectation:
- Pinch-to-zoom (mandatory).
- Swipe between photos in the same daily log (highly expected from any photo gallery).
- Some way to dismiss other than back gesture (X button, tap-to-dismiss).
- A loading indicator for large originals (which can take >1s on Android).

If V1 ships the literal "simple viewer" the plan describes, the user will hate it within five seconds. Either build a real one or call it a known Phase-7 follow-up explicitly.

---

## Test coverage gaps (Phases 1–5)

All of these are exactly the bugs the substantive issues above predict. None are mentioned in the plan.

- **Replace profile photo 50× in a row** (issue 3) — catches the partial-unique-index race and the orphan-cleanup leak.
- **Restore from a v9 backup onto a device that already has v10 photos** — does the restore wipe the existing photo files? Plan implies yes via "full-replace" but no test exists.
- **Restore from a v10 backup that contains attachments for a soft-deleted mare or stallion** (issue 5) — what should the validator do? What does it actually do?
- **Restore from a v10 backup that contains a `pregnancyCheck` or `foalingRecord` attachment** (issue 5) — accept-and-stash or reject?
- **Crash mid-restore with photo files written but DB transaction rolled back** (issue 1) — recoverable on next boot? plan doesn't even say there *is* a boot-time recovery step.
- **Multi-select 8 photos when 5 are already staged** (issue 10) — what's the actual behavior at the cap boundary?
- **Permission denied for camera AND library** (issue 10) — what does the user see?
- **iOS Limited Photo Access mode (empty picker, partial picker)** (issue 10).
- **HEIC original on Android** (issue 9) — viewer renders something? renders nothing?
- **Reorder produces unique, contiguous sort_orders** (issue 16).
- **App killed during draft creation** (issue 7) — boot reclaims orphan files.
- **Daily log card thumbnail strip on a 320px-wide phone with 12 photos** (issue 17).

---

## Design / scope pushback

- **`caption TEXT` column with no UI in V1.** Fine for forward-compat, but the validator/restore contract for that column is undefined: nullable string, max length, default. Pin it now (`null` default, max 500 chars at validator) so V2 doesn't have a freeform text injection vector to retrofit.
- **`width INTEGER, height INTEGER` are nullable** but the viewer needs them for layout. If thumbnail generation fails to read dimensions, do you still insert the row? Plan should say "rows must include width/height" (NOT NULL) and treat dimension-extraction failure as a hard import error.
- **`updated_at` on photo_assets and photo_attachments** is dead in V1 (no UPDATE paths other than caption-edit, which doesn't exist). Either drop the column or document why it's there ("future caption edits will bump it").
- **`thumbnail_mime_type TEXT NOT NULL`** without a CHECK. If you've already committed to JPEG thumbnails, write `CHECK (thumbnail_mime_type = 'image/jpeg')` and stop carrying a pretend-flexible field.
- **`source_kind` enum lacks `'imported'`** — if a future "restore from device backup" or "share-extension import" path appears, this CHECK constraint blocks it. Plan locks to `('camera', 'library')`. Worth a sentence on whether that's intentional.
- **Plan adds `expo-image-picker` and `expo-image-manipulator` but doesn't pin SDK 55-compatible versions.** SDK 55 expects `expo-image-picker@~17.x` and `expo-image-manipulator@~14.x` (verify with `expo install`). Pin these explicitly to avoid `npm install` resolving newer versions that break native autolinking.
- **`app.json` permission strings are "Add Expo permission copy"** — the actual `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` (even though V1 doesn't write back, iOS reviewers sometimes flag missing strings) and Android `READ_MEDIA_IMAGES` / `CAMERA` should be in the plan verbatim. iOS rejects builds with empty strings.
- **Backup file extension stays `.json`** — but the file is no longer human-readable JSON the moment it's gigabytes of base64. Keep `.json` for compat with the picker MIME filter (`fileIO.ts:73`) but document that it's a misnomer.
- **No Phase-3.5 step for "validate that photo files survive `expo-file-system/legacy.copyAsync` correctly across HEIC/PNG/JPEG."** Worth writing one fixture-based vitest before Phase 5 starts depending on the file service.
- **`ON DELETE RESTRICT` on `photo_attachments.photo_asset_id` FK** is the correct intent (the orphan cleanup is the only path that should remove an asset), but it deserves one sentence on why it's not `CASCADE`. The argument is "we want to surface bugs that try to delete an asset before its attachments are gone" — say so.
- **No "view stored photo file size on disk" debug surface.** With a 12-photo cap, users will hit storage issues. A Settings-screen "Photos use 1.2 GB" indicator is one query and would save support pain.

---

## Smaller things

- The plan says `useStallionForm` exists; it does (`hooks/useStallionForm.ts`). `useEditMareForm` also exists. Names check out.
- `useProfilePhotoDraft` and `usePhotoDrafts` should colocate with the other hooks under `src/hooks/` per CLAUDE.md ("Repository access belongs in hooks under `src/hooks/`"). Plan doesn't say where they live; spell it out.
- "Add Jest mocks for the new native modules if screen/unit tests need them" (Phase 0) — they will need them. Add the mocks unconditionally in `jest.setup.ts:13-127`, alongside the existing `expo-document-picker` / `expo-file-system/legacy` mocks. Don't make this conditional.
- The plan never says what `getMostRecentProfilePhoto` (or however it's named) returns when an attachment row exists but the file is missing on disk. Default to "render initials fallback" — but the loader needs to know to do that, which means the file existence check must happen in the data hook, not the UI. Worth one sentence.
- Acceptance criterion "Profile photos survive app reload through persisted DB/file state" is good but should be supplemented by "and survive a switch from light to dark mode without flicker" — `<Image>` recomposition under theme change is a known React Native footgun.
- `BACKUP_TABLE_NAMES`, `BACKUP_DELETE_ORDER`, `BACKUP_INSERT_ORDER` are easy to forget in a refactor. Plan should make them a Phase 3 sub-checklist item.
- Wave/phase boundaries are well-drawn, but Phase 6 ("set ENABLE_PHOTOS = true and verify") cannot be merged in a separate PR if the constant is statically `false` — Phases 4 and 5 will have committed code that's unreachable, and any review of those PRs in isolation will rightly flag dead code. Either ship Phase 4/5/6 as one PR with the flag flipped at the end, or use a runtime flag from Phase 0 onward (issue 8).

---

## Bottom line

The product framing is right and the phase order is sensible. The two architectural decisions that need to be re-defended before any code is written are:

1. **JSON-with-base64 backup format.** This collapses under realistic photo loads. Either cap import size and accept the constraint, or move to a side-file/binary archive format now (not in V2). The plan as written ships a known scaling failure.
2. **The atomicity story across SQLite and the filesystem.** Pick an ordering, write down the recovery model, and add a boot-time orphan reaper. Without those, normal flows (replace profile photo, restore, kill-during-pick) leave the device in inconsistent states the user can't fix.

Then six sub-issues need locking: profile-photo replace flow, soft-delete vs photo lifecycle, polymorphic owner_type validation, draft cleanup trigger, ENABLE_PHOTOS testability, and HEIC/EXIF/orientation. Tighten Phases 1, 2, and 3 along these lines before Phase 4 starts touching screens.

If the plan stays roughly as-is, expect ~2 weeks of invisible bugs landing in users' hands after Phase 6 flips the flag.
