# Frozen Semen Straw Consumption — Design

**Date:** 2026-04-27
**Status:** Draft (open questions pending)
**Roadmap Item:** `P1 — Frozen semen straw consumption` (Theme: Stallion depth)
**Source:** `TODO:15`, `ROADMAP.md` §Stallion depth

## Goal

When a breeding is recorded with `method = frozenAI`, the straws used should be
debited from a specific frozen-semen batch so `FrozenSemenBatch.strawsRemaining`
reflects real, current inventory.

A user managing a stallion's frozen inventory should be able to:

- pick the batch the straws came from when logging a frozen-AI breeding
- see live remaining counts on the stallion's frozen tab
- have the count corrected automatically if the breeding record is edited or deleted
- keep historical records intact when older batches are emptied or refilled

Out of scope for V1: low-inventory alerts (`TODO:17` is a separate P2),
multi-batch single-insemination splits (deferred unless needed), and
collection-level dose-event mirroring (already covered for fresh / shipped via
`CollectionDoseEvent`).

## Repo Fit

Grounded in current code:

- Domain types: `src/models/types.ts` — `BreedingRecord` (line 350) and
  `FrozenSemenBatch` (line 231). `BreedingRecord` has `numberOfStraws`,
  `strawVolumeMl`, `strawDetails`, but **no** link to a batch today.
- Persistence:
  - `src/storage/repositories/breedingRecords.ts`
  - `src/storage/repositories/frozenSemenBatches.ts`
- Form / UI:
  - `src/hooks/useBreedingRecordForm.ts`
  - `src/screens/BreedingRecordFormScreen.tsx`
  - `src/screens/stallion-detail/FrozenInventoryTab.tsx`
- Backup pipeline (per CLAUDE.md, must be extended for any schema change):
  - `src/storage/backup/types.ts`, `serialize.ts`, `restore.ts`,
    `validate.ts`, `safetyBackups.ts`, `testFixtures.ts`
- Migration runner: `src/storage/migrations/` (last applied
  `025_daily_log_flush_follow_up` — confirm before adding 026).

The fresh / shipped-AI side already has `CollectionDoseEvent` modeling per-dose
allocation against a `SemenCollection`. Frozen has nothing analogous; the batch
just stores `strawsRemaining` as an absolute number.

## Proposed Model Change

Add a nullable FK from `BreedingRecord` to `FrozenSemenBatch`:

```ts
interface BreedingRecord {
  // ...existing fields...
  frozenSemenBatchId?: UUID | null; // new
  numberOfStraws?: number | null;   // existing
}
```

- New column: `breeding_records.frozen_semen_batch_id TEXT NULL REFERENCES frozen_semen_batches(id) ON DELETE RESTRICT`.
- Existing rows migrate with `frozen_semen_batch_id = NULL` (legacy / unallocated).
- Only meaningful when `method = 'frozenAI'`. For other methods the field is ignored / forced null.

`FrozenSemenBatch.strawsRemaining` stays the canonical inventory number; it is
mutated transactionally alongside breeding-record writes.

### Why a nullable column instead of computing remaining

`strawsRemaining` is already a stored, user-editable field (initial value =
`strawCount` at batch creation, adjustable via batch edit). Computing it from
breeding records would invalidate manual corrections (e.g. straws lost in
shipping, freezer failure, gifted to another farm). Storing it and adjusting on
write keeps that escape hatch.

## Behavior

### Create breeding record (method = frozenAI)

1. User picks a stallion. Form shows a **Batch** picker filtered to that
   stallion's frozen batches.
2. Picker shows each batch with `freezeDate`, `strawColor`/`strawLabel`, and
   `strawsRemaining / strawCount`.
3. Whether the batch is required, and how empty batches are surfaced, is an
   open question — see Q1, Q2.
4. User enters `numberOfStraws`. UI validates against
   `selectedBatch.strawsRemaining` — see Q3.
5. On save, in a single transaction:
   - insert breeding record with `frozenSemenBatchId` set;
   - decrement `strawsRemaining` by `numberOfStraws`.

### Edit breeding record

If `frozenSemenBatchId` or `numberOfStraws` changed:

- Re-credit old `(batchId, oldStraws)`, debit new `(batchId, newStraws)`, in
  one transaction. Same batch is fine — net delta applies.
- If method changes away from `frozenAI`, re-credit any prior debit and clear
  the FK.

### Delete breeding record

Re-credit `numberOfStraws` to the linked batch in the same transaction as the
record delete. Soft-delete (if/when introduced) follows the same rule on the
state transition.

### Delete frozen batch

`ON DELETE RESTRICT` blocks deletion when any breeding record points at it.
Surfaces a clear error: "This batch is referenced by N breeding records. Edit
or remove those services first." (Matches CLAUDE.md restrictive-FK convention.)

### Backup / restore

- Bump `BACKUP_SCHEMA_VERSION` (currently V9 → V10).
- Round-trip the new column.
- Restore order already loads `frozen_semen_batches` before `breeding_records`
  (verify) so FK is satisfied.
- On restore, take `strawsRemaining` from the backup as-is — do **not**
  recompute from breeding records. The backup is the source of truth.

## UI Surfaces

- **`BreedingRecordFormScreen`** (frozen-AI branch): batch picker between
  `Stallion` and `Number of straws`. Disables / hides when method ≠ frozenAI.
  Picker empty state: "No frozen batches recorded for this stallion. Add a
  batch from the stallion's frozen inventory tab."
- **`FrozenInventoryTab`** (stallion detail): each batch card already shows
  `strawsRemaining`. Add `X used of Y` line so the consumed count is visible
  at a glance.
- **`BreedingEventDetailScreen`** (frozen-AI): show batch label / freeze date
  with a tap-through to the batch (or just a static line if a batch route
  doesn't exist yet — see Q4).

## Open Questions (need your call)

1. **Batch required for frozen-AI breeding?**
   a) Required — user must pick a batch; no untracked frozen services.
   b) Optional — picker can be left blank for "untracked / outside source"
      records (e.g. straw arrived from another farm not in the app).
2. **Empty / depleted batches in the picker:**
   a) Hide once `strawsRemaining = 0`.
   b) Show but disabled with a "0 remaining" badge.
   c) Show selectable, allow over-draw (see Q3).
3. **Over-draw (numberOfStraws > strawsRemaining):**
   a) Block save with a validation error.
   b) Warn but allow, clamp `strawsRemaining` at 0.
   c) Warn but allow, let `strawsRemaining` go negative (lets the user fix it
      later via batch edit).
4. **Legacy frozen-AI breeding records (no batch link):**
   a) Leave them unlinked forever; `strawsRemaining` reflects only post-feature
      services.
   b) Add a one-time "link to batch" affordance on legacy records (manual
      backfill UI).
   c) Auto-attempt to link on first run if exactly one matching batch exists
      for that stallion + date window.
5. **Multi-batch per breeding (single insemination using straws from two
   batches):**
   a) Defer — V1 supports one batch per breeding record; users can log two
      records if needed.
   b) Support now — picker becomes multi-select with per-batch straw counts.
6. **Stallion change on an existing breeding record:** if a user edits the
   stallion to a different stallion, the previously-linked batch belongs to
   the old stallion. Behavior:
   a) Force-clear the batch link and require re-pick.
   b) Block the stallion change while a batch is linked.

My defaults if you'd rather not decide each one: **1b, 2b, 3a, 4a, 5a, 6a.**
That keeps V1 small, avoids a backfill UI, and never lets inventory go
negative.

## Risks

- Concurrency: SQLite single-writer, but two screens editing the same batch
  back-to-back could compute stale `strawsRemaining`. Mitigation: do all
  inventory math inside the same transaction as the breeding-record write,
  reading `strawsRemaining` fresh inside the transaction.
- Migration test coverage: a fresh-install vs upgrade-install schema mismatch
  has bitten this codebase before (data-storage-hardening rule). Migration
  026 must be tested via both paths.
- Backup forward compatibility: V10 must still restore V9 backups, mapping
  missing `frozenSemenBatchId` to null.

## Test Plan (high level)

- Repository: create/update/delete breeding record adjusts `strawsRemaining`;
  re-credit on delete; method change away from frozenAI re-credits.
- Repository: ON DELETE RESTRICT prevents batch delete with linked records.
- Migration: 026 applies cleanly on fresh DB and on a DB stopped at 025.
- Backup: V10 round-trip; V9 restore upgrades cleanly.
- Screen: `BreedingRecordFormScreen` shows the picker only for frozenAI; over-
  draw behavior matches Q3 outcome.
- Screen: `FrozenInventoryTab` shows updated remaining count after a frozen-AI
  service is logged.
