# Photos V1 Amended Plan — Deep Dive Review

Date: 2026-05-02
Reviewer: Claude (Opus 4.7)
Subject: `docs/plans/2026-04-30-photos-v1-amended-implementation-plan.md`
Branch: `photos-v1-phase-0`
Mode: Accuracy + completeness audit (not adversarial)

## Verdict

The amended plan is execution-ready through the Phase 1 design gate. Architecture decisions, data model, file service layering, archive boundary, mutex/sweep coordination, and the substantive round-2 adversarial-review remediations are sound and trace cleanly to existing code patterns. The original review found that Phase 0 evidence was incomplete because the plan only recorded older raw-byte spike output; follow-up Android and iOS real-archive evidence has since been recorded in the amended implementation plan, so the Phase 0 archive gate is considered cleared.

---

## What Was Verified Against The Codebase

| Plan claim | Source of truth | Status |
| --- | --- | --- |
| `BACKUP_SCHEMA_VERSION_V11` is current | `src/storage/backup/types.ts:34-35` | ✓ |
| `fileIO.ts` hard-codes `.json` / `application/json` | `src/storage/backup/fileIO.ts:7,64,73` | ✓ |
| Migration helpers exist (`tableExists`, `hasColumn`, `indexExists`, `columnDefinitionHasType`) | `src/storage/migrations/index.ts` (skip predicates at lines 1410, 1419, 1499–1515, etc.) | ✓ |
| `src/config/featureFlags.ts` matches the prescribed shape | file exists with `FEATURE_FLAGS.photos = false` and `isPhotosEnabled()` | ✓ |
| `app.json` has `expo-image-picker` plugin with copy and `microphonePermission: false` | `app.json:20-27` | ✓ |
| Jest mocks added for `expo-image-picker`, `expo-image-manipulator`, root `expo-file-system` binary surface | `jest.setup.ts:59-154` | ✓ |
| Spike at `scripts/spikes/photos-archive-spike.ts` uses root `expo-file-system` (`File`, `Directory`, `Paths`) | file lines 13, 105–117, 396–413 | ✓ |
| Spike uses `fflate` `Zip + ZipPassThrough` streaming callbacks | file lines 14–22, 209–256 | ✓ |
| Spike writes chunks incrementally via `FileHandle.writeBytes` | file lines 396–413 | ✓ |
| Spike reads archive back via `Unzip` chunked reads | file lines 264–311 | ✓ |
| Round-2 adversarial concerns (B1, B2, RC1–RC5, A1–A4) addressed | confirmed after the 2026-05-02 plan-document corrections — see "Round-2 reconciliation" below | ✓ |
| Dependencies installed: `expo-file-system@~55.0.16`, `expo-image-picker@~55.0.19`, `expo-image-manipulator@~55.0.15`, `fflate@^0.8.2` | `package.json:34, 36, 37, 41` | ✓ |

---

## Phase 0 Execution Note Inaccuracies Found During Review

### 1. Broken file reference: `docs/iostest.md` does not exist

Plan line 725:

> iOS Simulator runtime result recorded on 2026-05-01 from `docs/iostest.md`.

That file does not exist anywhere in the repo. The actual iOS runbook is `docs/how-to-test-photos-archive-memory-spike-on-mac.md`.

**Status:** Fixed in the amended implementation plan by removing the broken citation and treating the raw iOS result as inline evidence.

### 2. Recorded JSON is from the OLD raw-byte spike, not the real archive spike

The plan acknowledges the contradiction at line 749:

> Real archive sub-gate: implementation is ready to test but not cleared yet.

But both pasted device results look "passed" because the OLD harness wrote `passed: true`:

- Android JSON (lines 712–723): only contains `bytesRoundTrip`, `appendWrite`, `streamedBytesWritten`, `peakJsHeapBytes`, `fallbackDecision`, `passed`.
- iOS JSON (lines 730–743): same fields plus `streamedMiB`, `peakJsHeapMiB`, `heapLimitMiB`.

The current spike's `PhotosArchiveSpikeResult` type at `scripts/spikes/photos-archive-spike.ts:36-53` requires:

- `zipLibrary`
- `zipApi`
- `archiveWrite`
- `archiveReadBack`
- `backupJsonEntry`
- `masterPhotoEntry`
- `thumbnailPhotoEntry`
- `manifestMatchesEntries`
- `archiveEntryCount`

None of these appear in the recorded JSON. The runbook (`docs/how-to-test-photos-archive-memory-spike-on-mac.md:21-37`) lists these fields as required for the real-archive sub-gate.

The recent commit `eeba92d "Add Photos V1 archive spike proof"` upgraded the spike code, but the JSON in the plan was never re-captured.

**Status:** Fixed after review. Android real-archive evidence is recorded from `docs/Screenshot_20260502_222858_BreedWise.jpg`; iOS real-archive evidence is recorded in `docs/iostest2.md`. The amended implementation plan now records both upgraded archive-shape JSON payloads and marks the real-archive sub-gate cleared.

### 3. App.tsx wiring not described in Phase 0 Execution Notes

Plan line 332:

> If it is wired into `App.tsx`, remove that wiring before Phase 0 is considered complete unless the app entrypoint keeps it behind a deliberate dev-only path that cannot run in preview/release builds.

`App.tsx` does wire the spike screen at lines 9, 12, 19, and 66–71:

```tsx
import { PhotosArchiveSpikeScreen } from './src/screens/dev/PhotosArchiveSpikeScreen';
import { shouldRunPhotosArchiveSpike } from './src/config/devSpikes';
...
const runPhotosArchiveSpike = shouldRunPhotosArchiveSpike();
...
if (runPhotosArchiveSpike) {
  return (
    <SafeAreaProvider>
      <PhotosArchiveSpikeScreen />
    </SafeAreaProvider>
  );
}
```

This is permitted under the plan's exception clause, but the Phase 0 Execution Notes never list:

- the new files: `src/screens/dev/PhotosArchiveSpikeScreen.tsx` and `src/config/devSpikes.ts`
- whether `shouldRunPhotosArchiveSpike()` is `__DEV__`-gated

The iOS runbook claims at line 201 that the spike is `__DEV__`-guarded, but `App.tsx` only consults the helper. The helper does enforce that gate: `src/config/devSpikes.ts:7-9` returns true only when `__DEV__` is true and `extra.runPhotosArchiveSpike === true`. The code is safe; the gap is only that Phase 0 Execution Notes did not list the wiring and gating mechanism.

**Status:** Fixed in the amended implementation plan by listing the temporary screen, dev-spike helper, and `__DEV__` plus env-flag gating mechanism.

---

## Smaller Gaps Worth Tightening

### 4. Hard Gate #5 cross-reference

Plan line 94 says "The exact ZIP library API is documented." The documentation lives in code (`scripts/spikes/photos-archive-spike.ts:40`) and the runbook. Add the cross-reference in the hard gate.

### 5. Round-2 RC5#4 was not addressed (Android auto-backup / iOS data inclusion)

Android currently has `android:allowBackup="true"` in the generated manifest. Depending on generated backup rules and device backup/restore behavior, a reinstall or restore may bring back SQLite metadata without matching `documentDirectory` photo files, or may include app files in a way the plan has not intentionally specified. iOS app-data restore behavior also needs an explicit verification row rather than an assumption.

Add to Phase 6 manual verification matrix:

- Android reinstall (cleared + restored from device backup) — verify sweep cleans dangling rows without user-visible breakage if metadata and files diverge.
- Confirm `app.json` Android config does not auto-backup `documentDirectory/photo-assets/` partially (review `auto_backup_rules.xml` if one is generated).
- iOS reinstall or app-data restore — verify `documentDirectory` and SQLite metadata remain consistent, or that missing files fall back and sweep cleanly.

### 6. Performance index ↔ heavy-mare scenario was not connected

Round-2 RC5#5 noted "50 daily logs × 12 photos = 600 thumbnails" risk. The plan's `idx_photo_attachments_owner_role_order` index on `(owner_type, owner_id, role, sort_order, created_at, id)` does answer it, but the Data Model section never says so. One sentence would close the loop.

### 7. `useDashboardData` fix is misclassified as Phase 0 work

Plan line 686:

> Fixed `useDashboardData` to load on mount and guard concurrent reloads after the navigator smoke test exposed that the dashboard could remain on its spinner if focus-based reload did not fire under native-stack screen tests.

This is unrelated to photos — it is an incidental regression surfaced by Phase 0 test infrastructure. Either move to a separate "incidental fixes" subsection or label explicitly so future readers do not interpret it as a hard-gate deliverable.

### 8. Stale local-backup file in `docs/plans/`

`2026-04-26-photos-v1-implementation-plan.md.local-backup` was still present alongside the plan it was replaced by.

**Status:** Fixed after review by deleting the stale local-backup file.

---

## Round-2 Reconciliation

| Round-2 finding | Where in amended plan | Status |
| --- | --- | --- |
| B1: Migration ID rebase + skip predicates | Phase 1 lines 209–215 lists exact predicates | ✓ |
| B2: DocumentPicker / Sharing MIME hard-coded | Phase 3 lines 469–471 | ✓ |
| RC1: `expo-file-system` binary API import path | Hard Gate #1 line 90; Phase 0 lines 333–334; Phase 0 Notes line 691–693 | ✓ |
| RC2: `fflate` heap measurement | Hard Gate #4 line 93; Phase 0 lines 339, 358–361 | ✓ |
| RC3: Sweep concurrency / mutex | Architecture lines 260–270; Phase 2 lines 426, 433–435 | ✓ |
| RC4 (forward-compat caption / dual extension picker / format binding) | `caption` preserved nullable line 198 / Phase 3 line 471 / dates declared ISO line 219 | ✓ |
| RC5#1: Migration repair logic | Phase 1 line 372 | ✓ |
| RC5#2: Caption forward-compat | Validation line 495 | ✓ |
| RC5#3: Disk-full handling | Architecture line 258; Phase 2 test line 451 | ✓ |
| RC5#4: Android auto-backup / iOS inclusion | Addressed by 2026-05-02 correction to Phase 6 manual matrix | ✓ |
| RC5#5: Heavy-mare performance | Addressed by 2026-05-02 correction connecting the owner-role-order index to the heavy-mare path | ✓ |
| RC5#6: Test mock locations | Phase 0 line 343 names `jest.setup.ts` | ✓ |
| RC5#7: Future-version restore rejection | Validation line 495; Phase 6 line 651 | ✓ |
| A1: BACKUP_INSERT_ORDER / BACKUP_DELETE_ORDER explicit | Phase 3 lines 475–477 | ✓ |
| A1: Refactor `deleteManagedTables` / `insertManagedTables` | Phase 3 line 484 | ✓ (goes beyond what reviewers asked for) |
| A1: Binary fixture in `testFixtures.ts` | Phase 3 line 486 | ✓ |
| A2: Sweep delete order matches BACKUP_DELETE_ORDER | Architecture line 277 | ✓ |
| A3: Enums in `src/models/enums.ts` + formatter | Domain types lines 156–170 | ✓ |
| A4: File service home is `src/storage/photoFiles/` | Architecture line 224 | ✓ |
| Horse transfer scope decoupling (subtle `HorseTransferTablesV1` aliasing risk) | Architecture lines 318–322; Phase 1 line 378 | ✓ |

---

## Correction Status

Applied to `docs/plans/2026-04-30-photos-v1-amended-implementation-plan.md` on 2026-05-02:

1. Fixed the broken `docs/iostest.md` reference by recording the iOS result as inline evidence.
2. Added a Phase 0 Execution Notes bullet listing `src/screens/dev/PhotosArchiveSpikeScreen.tsx` and `src/config/devSpikes.ts`, including the `__DEV__` gating mechanism.
3. Added Android reinstall / backup-config and iOS app-data restore verification rows to the Phase 6 manual matrix.
4. Added a Data Model sentence connecting `idx_photo_attachments_owner_role_order` to the heavy-mare bulk-lookup scenario.
5. Moved the `useDashboardData` note into an incidental non-Photos fix subsection.
6. Renamed the runtime evidence section to clarify that the pasted JSON clears only the raw binary sub-gate, not the real archive sub-gate.

Archive follow-up recorded on 2026-05-02:

- `docs/Screenshot_20260502_222858_BreedWise.jpg` records an Android PASS for the upgraded real archive spike.
- `docs/iostest2.md` records an iOS Simulator PASS for the upgraded real archive spike.
- The amended implementation plan now records Android and iOS real archive evidence inline and marks the two-platform real archive sub-gate cleared.

Resolved outside the plan document:

- Deleted `docs/plans/2026-04-26-photos-v1-implementation-plan.md.local-backup` so the replaced plan cannot be mistaken for a live source of truth.

None of these are structural changes. The non-Phase-0 corrections are documentation hygiene that keeps the plan trustworthy as the source of truth before code work starts.
