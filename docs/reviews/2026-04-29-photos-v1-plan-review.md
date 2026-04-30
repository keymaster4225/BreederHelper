# Photos V1 Implementation Plan Review

Date: 2026-04-29
Reviewed by: Claude Opus 4.6
Plan under review: `docs/plans/2026-04-26-photos-v1-implementation-plan.md`

## Overall Assessment

This is an exceptionally well-crafted plan. It has been through multiple rounds of adversarial review and it shows. The plan is thorough, correctly grounded in the actual codebase, and demonstrates careful thinking about crash recovery, memory pressure, forward compatibility, and incremental delivery. The issues flagged below are refinements, not blockers.

## Strengths

### 1. Phase 0 spike is the right call

The plan explicitly gates all production work on proving the binary archive path works on Expo SDK 55. The `expo-file-system` modern API (`File`/`Directory`) is relatively new and not widely battle-tested in the RN community. Making this a hard prerequisite — with a "stop and revise" clause — is disciplined engineering.

### 2. Files-first persistence model is sound

The SQLite + filesystem atomicity gap is a real problem the plan identifies correctly. Writing files first, then committing metadata, with a consistency sweep to mop up, is the standard pattern (similar to how Git manages objects vs refs). The 60-second grace window for newly finalized files is a smart detail.

### 3. Backup architecture avoids the memory cliff

Rejecting base64-in-JSON *and* fully-buffered ZIP is correct. 100 photos x 2 MB = 200 MB easily OOMs the JS runtime. The streaming/chunked archive approach is the only viable path.

### 4. Migration/schema numbering is treated as dynamic

The plan says "expected 028/v12" but repeatedly warns not to hard-code these until rebase. This is correct given centralized migrations where other feature branches may land first.

### 5. Comprehensive testing checklist

The testing section covers real-world edge cases: HEIC-to-JPEG across platforms, 320px phone width, permission denial, mid-write crash, mixed legacy/new snapshots. These are the scenarios that actually break photo features in production.

## Issues and Risks

### 1. `fflate` streaming may not truly stream on Expo SDK 55

**Severity: Medium — mitigated by Phase 0 spike**

The plan says to use `fflate` for ZIP and demands streaming/chunked writes. However, `fflate` is a synchronous codec — its streaming API (`Zip`/`Unzip` classes with callbacks) operates on `Uint8Array` chunks but still requires the caller to manage chunk flushing to disk. The plan assumes `File.write(Uint8Array, { append: true })` works, but the modern `expo-file-system` API's binary write support is exactly what Phase 0 is spiking.

**Risk:** If `fflate`'s chunk callbacks produce chunks faster than file I/O can flush them, you're still buffering in memory. The plan should specify a backpressure mechanism — e.g., awaiting each file write before requesting the next chunk from `fflate`.

**Recommendation:** Phase 0 acceptance criteria should include measuring peak heap *during* the 100x2MB archive write, not just after. The 150 MB ceiling is stated but the measurement protocol isn't specific enough.

### 2. `MANUAL_BACKUP_PREFIX` is hardcoded to `v5` — not `vCurrent`

**Severity: Low — cosmetic but misleading**

In `src/storage/backup/fileIO.ts:5-6`, the backup filename prefixes are hardcoded:

```ts
const MANUAL_BACKUP_PREFIX = 'breedwise-backup-v5-';
const SAFETY_BACKUP_PREFIX = 'breedwise-safety-backup-v5-';
```

The plan says filenames will use the photo schema version (e.g., `breedwise-backup-v12-...`). But the current code bakes in `v5` regardless of `BACKUP_SCHEMA_VERSION_CURRENT`. This has been wrong since the schema moved past v5. The plan's Phase 3 file I/O changes need to either:

- Fix the prefix to use the current schema version dynamically, or
- Acknowledge the discrepancy and leave the prefix as cosmetic-only.

### 3. `listSafetySnapshots` currently filters by `.json` extension only

**Severity: Medium — requires non-trivial rework**

In `src/storage/backup/safetyBackups.ts:42`, the listing skips anything not ending in `.json`. The plan correctly identifies that listing/pruning must handle both `.json` and `.breedwisebackup`, but this is a more invasive change than it appears. The current `listSafetySnapshots` reads each file, parses it as JSON, and validates it. For `.breedwisebackup` archives, the listing function would need to:

- Open the archive
- Extract `backup.json` from inside it
- Parse and validate that

This is a non-trivial change to a function that currently does simple text file reads. The plan mentions it in Phase 3 but may underestimate the complexity.

### 4. `pickBackupFile` uses `type: 'application/json'` — archive MIME will be tricky

**Severity: Low — plan already acknowledges the fallback**

`src/storage/backup/fileIO.ts:73` filters the document picker to JSON only. The plan says to update this for `.breedwisebackup`, but Android and iOS handle custom extensions/MIME types inconsistently. The plan acknowledges falling back to `*/*` plus extension validation, which is pragmatic but should be the default expectation, not a fallback.

### 5. Polymorphic `owner_type` + `owner_id` without FK enforcement

**Severity: Low — correctly mitigated by the consistency sweep**

The `photo_attachments.owner_id` column has no foreign key because it references different tables depending on `owner_type`. This means:

- SQLite cannot enforce referential integrity.
- The consistency sweep is the *only* defense against dangling references.
- If a new owner type is added and someone forgets to update the sweep, orphaned attachments will silently accumulate.

The plan addresses this with "reject unknown owner types" in restore and sweep cleanup for known owner types. But the CHECK constraint on `owner_type` becomes a maintenance burden — every future owner type needs a migration to alter the CHECK.

**Recommendation:** Document this as a known tradeoff in the migration file comment, and consider a helper function that returns the valid owner types from one authoritative source (the enum in `enums.ts`) so the sweep and validators don't drift.

### 6. Profile photo layout — 64x64 avatar may crowd the header on small phones

**Severity: Low — UI polish**

The plan specifies a 64x64 circular avatar in the mare/stallion detail header. Combined with the calendar button, edit icon, badges, and a long name, this could get tight on a 320px phone. The plan says "let long names wrap" but doesn't specify a minimum text width or how many lines of wrapping are acceptable before the layout becomes unusable.

**Recommendation:** Add a visual acceptance test — even if informal — for a mare named something like "Dappled Grey's Lady Midnight" with both Recipient and Pregnant badges, on a 320px viewport.

### 7. No explicit error handling for `expo-image-manipulator` failures

**Severity: Low — easy to add during implementation**

The plan describes the import normalization pipeline including retrying at lower quality/dimensions if over 2 MB. But it doesn't specify what happens if `expo-image-manipulator` itself throws (e.g., corrupt source image, unsupported format, out-of-memory during manipulation). The "reject the import with a clear message" clause covers the size cap, but not manipulation errors.

**Recommendation:** Add a catch-all in the normalization pipeline that surfaces a user-friendly error like "This photo couldn't be processed. Try a different photo."

### 8. Daily log wizard UX — photos on the review step only

**Severity: Low — acceptable for V1**

The plan puts photo add/remove/reorder on the review step. For users adding 12 photos, they'll need to complete the entire ovary/uterus/teasing wizard before they can start adding photos. If they lose photos due to a crash on the review step, they'd have to redo the wizard.

This is probably fine for V1 since photos are optional and the wizard is short, but a dedicated Photos step (between the last field step and review) would be more resilient. The plan may have intentionally chosen the review step to minimize wizard step changes.

### 9. No mention of image loading/caching strategy for list views

**Severity: Low — unlikely to bite in V1**

The plan specifies showing thumbnail strips on daily log cards (56x56px, horizontal scroll). For a mare with dozens of daily logs each having 12 photos, the list view could attempt to render hundreds of thumbnails simultaneously. The plan doesn't mention:

- Whether thumbnails use React Native's `Image` component (which has its own cache) or `expo-image`.
- Whether off-screen thumbnails are recycled.
- Maximum simultaneous image loads.

For V1 this is probably tolerable since thumbnails are small (512px edge, likely 20-50 KB each), but it could become a performance issue.

### 10. `sort_order` renumbering — client-side vs server-side not specified

**Severity: Low — implementation detail**

The plan says "renumber from zero" on every reorder and "list queries must tie-break by `sort_order`, `created_at`, then `id`". This is sound, but the plan doesn't specify whether renumbering is done client-side before save or in a SQL UPDATE. If client-side, the hook needs to maintain contiguous ordering in its staged state. If server-side, it's a multi-row UPDATE inside a transaction. Either works, but the plan should be explicit.

## Minor Observations

- `formatPhotoOwnerType` in `outcomeDisplay.ts` — unlikely to be needed in V1 since owner types aren't displayed to users. Specifying it now is forward-looking but could be deferred.
- Checked-in JPEG byte literal as a test fixture — good. Keep it tiny (1x1 pixel JPEG is ~631 bytes).
- The "replace profile photo 50 times" stress test is a nice touch that catches real bugs (leaking old assets, unique index violations).
- Cleaning up attachments whose polymorphic owner no longer exists is critical but easy to forget. Good that it's called out explicitly.

## Summary Verdict

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Completeness | Excellent | Covers schema, files, backup, UI, permissions, testing, rollback |
| Correctness | Very Good | Architecture decisions are sound; minor gaps in error handling |
| Risk Management | Excellent | Phase 0 gate, feature flag, consistency sweep, crash recovery |
| Codebase Alignment | Very Good | Correctly identifies current schema v11, migration 027, file I/O patterns |
| Feasibility | Good | Biggest risk is the `fflate` + `expo-file-system` modern API integration |
| Scope Control | Excellent | Clear V1 boundaries; deferred features listed explicitly |

## Bottom Line

This plan is ready to execute. The Phase 0 spike is the critical decision point — if it passes, the rest of the plan is well-structured for incremental delivery. The hardcoded `v5` prefix in `fileIO.ts` should be fixed as part of Phase 3 regardless.
