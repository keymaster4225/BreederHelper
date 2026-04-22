# Semen Freezing Workflow Design

**Date:** 2026-04-21
**Status:** Approved — ready for implementation planning
**Branch:** `feature/collection-wizard` (or successor)
**Related:** Builds on the collection / dose-event model defined in `2026-04-21-collection-wizard-volume-rework-design.md`. Adds a parallel "freezing" workflow that consumes raw collection volume the same way shipments do.

## Summary

Add a workflow for freezing semen for long-term straw storage, distinct from the existing inseminate / ship flows. The workflow is a **4-step wizard** entered from two places: (1) a "Freeze" button on a specific collection card (auto-links the freeze to that collection and counts against its raw volume), and (2) an "Add Frozen Batch" button on a new "Frozen" tab on stallion detail (for batches not tied to a collection in the system — e.g., imported / purchased frozen straws).

A new entity `FrozenSemenBatch` captures all fields. It carries a `strawsRemaining` counter to support a future inventory-consumption feature, and integrates with the existing collection allocation cap so a collection cannot be over-allocated across shipments + freezes combined.

## Motivation

The TODO file has a long-standing item: "new screen for freezing semen, not just inseminating." Today, the only place straws appear in the data model is on `BreedingRecord` (`numberOfStraws`, `strawVolumeMl`, `strawDetails`) — and that captures straws being *used to inseminate a mare*, not straws being *created and stored*. There is no record of:

- How many straws a freeze produced
- The post-thaw motility / longevity quality metrics
- Centrifuge processing parameters
- Where the straws are physically stored
- Imported / purchased frozen semen from outside operations

This spec adds that capability and lays groundwork for a future frozen-semen inventory feature.

## Locked product decisions

All decisions below were reached through explicit brainstorming on 2026-04-21 with the project owner and are fixed inputs for implementation planning.

### Entry points

- **Primary path:** "Freeze" `SecondaryButton` on each collection card on the stallion-detail Collections tab. Navigates to the create wizard with `collectionId` set. Hidden when the source stallion is soft-deleted (mirrors existing `isDeleted` gating).
- **Standalone path:** "Add Frozen Batch" `PrimaryButton` at the top of a new "Frozen" tab on stallion detail. Navigates to the create wizard without a `collectionId`. Used for imported / purchased frozen straws.
- The `collectionId` link is **immutable after create** — simplifies allocation re-validation and matches existing patterns elsewhere.

### Wizard shape

Four steps, in this order:

1. **Basics** — Freeze date, raw volume used (mL), "Was centrifuged?" checkbox + conditional centrifuge fields when checked.
2. **Straws & Extender** — Extender (dropdown), straw count, straw volume (mL), concentration (M/mL), computed sperm-per-straw (read-only display), straws-per-dose, straw color (dropdown), straw label.
3. **Quality** — Post-thaw motility (%), longevity (hours).
4. **Storage & Notes** — Storage details (free text), general notes (free text).

Step pill bar at top; Back / Next on intermediate steps; Save on the final step. Cancel button in the header. Pattern mirrors existing `CollectionCreateWizard`.

### Centrifuge sub-flow

- "Was centrifuged?" lives on Step 1. Default unchecked.
- When checked, the following fields appear inline below the checkbox on the same step:
  - Speed (RPM)
  - Duration (minutes)
  - Cushion used? (checkbox)
  - Cushion type (free text — e.g., EquiPure)
  - Resuspension volume (mL)
  - Notes (free text)
- When unchecked on save, all centrifuge columns are force-cleared to null in the repository (no orphan data).

### Field semantics & derivations

- **Sperm per straw** is **derived, not stored.** Computed as `concentrationMillionsPerMl × strawVolumeMl`. Displayed as a read-only field on Step 2 next to the inputs, and on saved-record displays.
- **Doses available** is **derived, not stored.** Computed as `floor(strawsRemaining / strawsPerDose)` full doses + `strawsRemaining % strawsPerDose` leftover straws. Displayed as e.g., "12 doses + 0 leftover" or "10 doses + 2 leftover straws."
- **`strawsRemaining`** is auto-set on create equal to `strawCount`. It is a separate column for the future inventory-consumption feature; for v1 it always equals `strawCount` unless `strawCount` is later changed via edit.

### Freeze date defaulting

- When entering the wizard from a collection: pre-fill `freezeDate` from the collection's `collectionDate`. Editable.
- When entering standalone: required; no default.

### Extender (Step 2)

Predefined dropdown with these options plus an `Other` choice that reveals a free-text input:

- BotuCrio
- INRA Freeze
- Gent (Cryo-Gent)
- HF-20
- Equex STM
- Lactose-EDTA-egg-yolk
- Skim milk-glycerol
- Other

Stored as `extender` (enum) plus `extenderOther` (free text, populated only when `extender === 'Other'`).

### Straw color & label (Step 2)

- **Color:** Dropdown with these options plus `Other`:
  - Yellow, Pink, Blue, Green, Red, Orange, Purple, White, Black, Clear, Other
  - Stored as `strawColor` (enum) plus `strawColorOther` (free text, populated only when `strawColor === 'Other'`).
- **Label:** Free text. No format constraints.

### Volume accounting

- A freeze linked to a collection **counts against** that collection's raw-volume allocation, exactly like a shipment does. The freeze record stores `rawSemenVolumeUsedMl`; the collection allocation sum includes both `collection_dose_events` and `frozen_semen_batches`.
- Over-allocating is blocked at the repository layer (raises an error → surfaces as `Alert.alert` in the UI).
- Standalone (no `collectionId`) freezes have `rawSemenVolumeUsedMl` optional and never participate in any collection's cap.

### Display

Saved freeze batches appear in **two places** (option C from brainstorming):

1. **Inside the source collection's Allocations section** on the Collections tab — alongside dose event rows. Each freeze row shows: freeze-date · "Frozen: N straws" · edit/delete icons. Tap edit → `FrozenBatchForm`. (Standalone freezes do not appear here, since there's no source collection.)
2. **On a new "Frozen" tab on stallion detail** — lists all freezes for that stallion (linked + standalone). Each card shows: freeze date, source ("From collection MM-DD-YYYY" or "Imported"), straws-remaining/total, doses available + leftovers, post-thaw motility, storage details. Tap card → `FrozenBatchForm`.

## Data model

New table `frozen_semen_batches`:

```
frozen_semen_batches
├── id                              TEXT PK
├── stallion_id                     TEXT NOT NULL  → stallions(id) RESTRICT
├── collection_id                   TEXT NULL      → semen_collections(id) RESTRICT
├── freeze_date                     TEXT NOT NULL  (LocalDate YYYY-MM-DD)
├── raw_semen_volume_used_ml        REAL NULL      (counts against collection allocation when collection_id set)
├── extender                        TEXT NULL      (one of FREEZING_EXTENDER_VALUES)
├── extender_other                  TEXT NULL      (populated when extender = 'Other')
├── was_centrifuged                 INTEGER NOT NULL DEFAULT 0
├── centrifuge_speed_rpm            INTEGER NULL
├── centrifuge_duration_min         INTEGER NULL
├── centrifuge_cushion_used         INTEGER NULL   (nullable boolean)
├── centrifuge_cushion_type         TEXT NULL
├── centrifuge_resuspension_vol_ml  REAL NULL
├── centrifuge_notes                TEXT NULL
├── straw_count                     INTEGER NOT NULL
├── straws_remaining                INTEGER NOT NULL  (initialized = straw_count)
├── straw_volume_ml                 REAL NOT NULL
├── concentration_millions_per_ml   REAL NULL
├── straws_per_dose                 INTEGER NULL
├── straw_color                     TEXT NULL      (one of STRAW_COLOR_VALUES)
├── straw_color_other               TEXT NULL      (populated when straw_color = 'Other')
├── straw_label                     TEXT NULL
├── post_thaw_motility_percent      INTEGER NULL   (0–100)
├── longevity_hours                 INTEGER NULL
├── storage_details                 TEXT NULL
├── notes                           TEXT NULL
├── created_at                      TEXT NOT NULL
└── updated_at                      TEXT NOT NULL
```

Indexes:

- `(stallion_id)` for the Frozen tab list query
- `(collection_id)` for the per-collection allocation rollup

FK behavior is RESTRICT on both relationships (mirrors existing pattern). Deleting a freeze is fine; deleting a collection is blocked if any freeze references it; deleting a stallion is blocked if any freeze references it.

## TypeScript types

In `src/models/types.ts`:

```ts
export const FREEZING_EXTENDER_VALUES = [
  'BotuCrio',
  'INRA Freeze',
  'Gent',
  'HF-20',
  'Equex STM',
  'Lactose-EDTA-egg-yolk',
  'Skim milk-glycerol',
  'Other',
] as const;
export type FreezingExtender = (typeof FREEZING_EXTENDER_VALUES)[number];

export const STRAW_COLOR_VALUES = [
  'Yellow', 'Pink', 'Blue', 'Green', 'Red',
  'Orange', 'Purple', 'White', 'Black', 'Clear', 'Other',
] as const;
export type StrawColor = (typeof STRAW_COLOR_VALUES)[number];

export interface CentrifugeSettings {
  speedRpm: number | null;
  durationMin: number | null;
  cushionUsed: boolean | null;
  cushionType: string | null;
  resuspensionVolumeMl: number | null;
  notes: string | null;
}

export interface FrozenSemenBatch {
  id: UUID;
  stallionId: UUID;
  collectionId: UUID | null;
  freezeDate: LocalDate;
  rawSemenVolumeUsedMl: number | null;
  extender: FreezingExtender | null;
  extenderOther: string | null;
  wasCentrifuged: boolean;
  centrifuge: CentrifugeSettings;
  strawCount: number;
  strawsRemaining: number;
  strawVolumeMl: number;
  concentrationMillionsPerMl: number | null;
  strawsPerDose: number | null;
  strawColor: StrawColor | null;
  strawColorOther: string | null;
  strawLabel: string | null;
  postThawMotilityPercent: number | null;
  longevityHours: number | null;
  storageDetails: string | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type CreateFrozenSemenBatchInput = Omit<
  FrozenSemenBatch,
  'id' | 'strawsRemaining' | 'createdAt' | 'updatedAt'
>;
// strawsRemaining is auto-set to strawCount in the repository on create.

export type UpdateFrozenSemenBatchInput = Partial<
  Omit<CreateFrozenSemenBatchInput, 'stallionId' | 'collectionId'>
>;
// stallionId and collectionId are immutable after create.
```

## Repository

New file `src/storage/repositories/frozenSemenBatches.ts`:

- `createFrozenSemenBatch(input: CreateFrozenSemenBatchInput): Promise<FrozenSemenBatch>` — validates input, asserts collection allocation cap (when `collectionId` is set), inserts with `strawsRemaining = strawCount`. If `wasCentrifuged === false`, all centrifuge columns are nulled regardless of input.
- `updateFrozenSemenBatch(id: UUID, patch: UpdateFrozenSemenBatchInput): Promise<FrozenSemenBatch>` — re-asserts cap if `rawSemenVolumeUsedMl` changes (excluding this freeze from the sum). Recomputes `strawsRemaining` if `strawCount` changes (`new = newCount − usedSoFar`); blocks if result < 0. Force-clears centrifuge columns if `wasCentrifuged` flips to false.
- `deleteFrozenSemenBatch(id: UUID): Promise<void>` — straight delete in v1 (no consumption check).
- `getFrozenSemenBatch(id: UUID): Promise<FrozenSemenBatch | null>`
- `listFrozenSemenBatchesByStallion(stallionId: UUID): Promise<FrozenSemenBatch[]>` — for the Frozen tab.
- `listFrozenSemenBatchesByCollection(collectionId: UUID): Promise<FrozenSemenBatch[]>` — for the per-collection allocations rollup.

Allocation integration in `src/storage/repositories/internal/collectionAllocation.ts`:

- `getAllocatedSemenVolumeForCollectionDb` extended to also sum `raw_semen_volume_used_ml` from `frozen_semen_batches WHERE collection_id = ?`.
- New optional param: `excludeFrozenBatchId` (mirrors existing `excludeDoseEventId`).
- `assertCollectionSemenVolumeCanSupportAllocation` accepts the new exclude param so updating a freeze re-checks correctly.
- `assertCollectionRawVolumeCanBeUpdated` automatically benefits since it calls the same allocation sum.

## Pure helpers

New file `src/utils/frozenSemen.ts`:

```ts
export function computeSpermPerStrawMillions(
  concentrationMillionsPerMl: number | null,
  strawVolumeMl: number | null,
): number | null;

export function computeDosesAvailable(
  strawsRemaining: number,
  strawsPerDose: number | null,
): { fullDoses: number; leftoverStraws: number } | null;
```

Both pure and unit-tested in Vitest.

## Screen flow & navigation

Two new routes added to `RootStackParamList` in `src/navigation/AppNavigator.tsx`:

```ts
FrozenBatchCreateWizard: { stallionId: string; collectionId?: string };
FrozenBatchForm:         { stallionId: string; frozenBatchId: string };
```

### Wizard screen

`src/screens/FrozenBatchWizardScreen.tsx` orchestrates the 4-step flow. State managed via a hook `src/hooks/useFrozenBatchWizard.ts` (mirrors `useCollectionWizard`). Step content lives in `src/screens/frozen-batch-wizard/`:

| Step | File | Fields |
|------|------|--------|
| 1 | `BasicsStep.tsx` | Freeze date, raw volume used, "Was centrifuged?" + conditional centrifuge fields |
| 2 | `StrawsStep.tsx` | Extender (+ Other), straw count, straw volume, concentration, computed sperm-per-straw (read-only), straws-per-dose, straw color (+ Other), label |
| 3 | `QualityStep.tsx` | Post-thaw motility %, longevity hours |
| 4 | `StorageStep.tsx` | Storage details, notes |

Step pill bar across the top (4 pills). Back / Next on intermediate steps; Save on the final step → calls `createFrozenSemenBatch` → navigates back to the entry context (collection card → Collections tab; or "Add" button → Frozen tab).

### Edit screen

`src/screens/FrozenBatchFormScreen.tsx` — single scrollable form with all sections visible. Same field layout, plus a Delete button at the bottom (with `Alert.alert` confirm). Mirrors the `CollectionForm` pattern.

### Display updates

1. **`StallionDetailScreen`** gets a third tab: `Frozen`. Update `TAB_OPTIONS` to include `{ label: 'Frozen' }` and `TAB_KEY_TO_INDEX` to include `frozen: 2`. New file `src/screens/stallion-detail/FrozenBatchesTab.tsx`:
   - Top: `PrimaryButton` "Add Frozen Batch" → `FrozenBatchCreateWizard` (no `collectionId`). Hidden when `isDeleted`.
   - List of cards via `listFrozenSemenBatchesByStallion`. Each card shows freeze date, source, straws-remaining/total, doses available + leftovers, post-thaw motility, storage details. Tap → `FrozenBatchForm`.
   - Uses `cardStyles` and `CardRow` to match existing card style.

2. **`CollectionsTab`** gets a "Freeze" `SecondaryButton` next to "Add Shipment" on each collection card → `FrozenBatchCreateWizard` with that `collectionId`. Hidden when `isDeleted`. Freezes attached to the collection appear in that collection's "Allocations" list as a new row variant: icon + "Frozen: N straws" + freeze date + edit/delete icons. Tap edit → `FrozenBatchForm`. Tap delete → `Alert.alert` confirm → `deleteFrozenSemenBatch` → reload.

### Navigation summary

```
StallionDetail
├── Collections tab
│   └── Collection card
│       ├── [Add Shipment] → DoseEventModal           (existing)
│       ├── [Freeze]       → FrozenBatchCreateWizard  (new, with collectionId)
│       └── Allocations
│           ├── Shipment row → DoseEventModal         (existing)
│           └── Freeze row   → FrozenBatchForm        (new)
├── Breeding tab                                       (existing)
└── Frozen tab                                         (new)
    ├── [Add Frozen Batch] → FrozenBatchCreateWizard  (no collectionId)
    └── Batch card         → FrozenBatchForm
```

## Validation, error handling, edit & delete rules

### Per-field validation (`src/utils/validation.ts` extensions)

| Field | Rule |
|-------|------|
| `freezeDate` | Required, valid `LocalDate` |
| `rawSemenVolumeUsedMl` | Optional; if set, > 0; cap-checked against collection (when linked) |
| `extender` | Optional; if `'Other'`, `extenderOther` must be non-empty |
| Centrifuge fields | Only validated when `wasCentrifuged === true`; otherwise ignored on save (stored as null) |
| `centrifugeSpeedRpm` | Positive integer, 100–10000 (sanity range) |
| `centrifugeDurationMin` | Positive integer |
| `centrifugeResuspensionVolumeMl` | Positive number |
| `strawCount` | Required, positive integer ≥ 1 |
| `strawVolumeMl` | Required, positive number (typical 0.25–1.0, no hard cap) |
| `concentrationMillionsPerMl` | Optional, > 0 |
| `strawsPerDose` | Optional, positive integer, ≤ `strawCount` |
| `strawColor` | Optional; if `'Other'`, `strawColorOther` must be non-empty |
| `postThawMotilityPercent` | Optional, integer 0–100 |
| `longevityHours` | Optional, positive integer |

### Cross-field business rules (enforced in repository)

- `strawsRemaining` is auto-set on create = `strawCount`; never user-editable on create.
- On update, if `strawCount` changes: `usedSoFar = oldStrawCount − oldStrawsRemaining`; `newStrawsRemaining = newStrawCount − usedSoFar`. Block if result < 0 with message "Cannot reduce straw count below what's already been used."
- For v1, `strawsRemaining` is also blocked from being set directly via the form input shape — only flows from `strawCount` changes. (Future inventory-decrement work will edit it through dedicated "consume" actions.)
- `wasCentrifuged === false` ⇒ all `centrifuge*` columns force-cleared to null on save.

### Allocation cap

- Single source of truth for "how much volume is used from this collection" includes both shipments and freezes.
- On freeze create: assert before insert; throw → caught by form → `Alert.alert('Allocation error', message)`.
- On freeze update: re-assert if `rawSemenVolumeUsedMl` changes, with the current freeze excluded from the sum.
- Updating a collection's raw volume continues to use `assertCollectionRawVolumeCanBeUpdated`, which now correctly accounts for freeze allocations.

### Edit constraints

- `stallionId` immutable after create (mirrors existing pattern).
- `collectionId` immutable after create (simpler than re-checking two collections' caps).
- All other fields editable; allocation cap re-checked when raw volume changes.

### Delete rules (v1)

- Allowed at any time. Confirm `Alert` before destructive action.
- After delete: `navigation.goBack()` returns to whichever tab the user came from.
- Future (when consumption tracking exists): block delete if `strawsRemaining < strawCount`. Out of scope for v1.

### Error display

- Inline field errors below each input, matching existing `FormControls` patterns.
- Required-field validation runs per-step in the wizard; inline errors shown on Next tap if invalid.
- Allocation cap and other backend errors → `Alert.alert(title, message)`.

## Migration

A new SQL migration (next sequential number — `020` or higher depending on what lands first on `feature/collection-wizard`) creates `frozen_semen_batches` per the schema in the **Data model** section. FKs as specified. Indexes on `(stallion_id)` and `(collection_id)`. Migration test added to `src/storage/migrations/index.test.ts` mirroring existing patterns.

## Backup & restore

Already-modified backup files in this branch make this a small extension:

- `src/utils/backup/types.ts` — add `FrozenSemenBatchBackup` type
- `src/utils/backup/serialize.ts` — add `frozen_semen_batches` to the export bundle (alongside `semen_collections`, `collection_dose_events`)
- `src/utils/backup/restore.ts` — add the corresponding insert path with FK-safe ordering (after stallions and semen_collections)
- `src/utils/backup/validate.ts` — add validation rules for the new entity
- `src/utils/backup/safetyBackups.ts` — extend so write operations on frozen batches trigger auto-snapshots consistent with other write-op coverage
- `src/utils/backup/testFixtures.ts` — add a sample frozen batch fixture
- Bump `BACKUP_SCHEMA_VERSION_CURRENT` from V3 → V4 in `src/utils/backup/types.ts`. Add `BACKUP_SCHEMA_VERSION_V4` constant and the corresponding versioned bundle type. The restore path must still accept V1, V2, and V3 backups and treat the absent `frozen_semen_batches` array as empty.

## Testing

| File | What it tests |
|------|---------------|
| `src/utils/frozenSemen.test.ts` | `computeSpermPerStrawMillions` (handles nulls, basic math), `computeDosesAvailable` (full + leftovers, divides evenly, null straws-per-dose) |
| `src/utils/frozenSemenDisplay.ts` + `.test.ts` (new file) | `formatFreezingExtender('Other', 'Custom Brand') → 'Custom Brand'`; `formatStrawColor` likewise; `formatFreezeBatchSummary` for card display. Kept separate from `outcomeDisplay.ts` to keep that file focused on outcome enums. |
| `src/utils/validation.test.ts` (extend) | New per-field rules from above |
| `src/storage/repositories/frozenSemenBatches.test.ts` | CRUD: create with/without collection, update, delete, list-by-stallion, list-by-collection. Cap enforcement: create blocked when over-allocated; update blocked; cap respected when freeze excluded from sum. `wasCentrifuged=false` clears centrifuge fields. `strawCount` decrease blocked below `usedSoFar`. `collectionId`/`stallionId` immutable on update. |
| `src/storage/repositories/internal/collectionAllocation.test.ts` (extend) | Allocation sum includes both dose events and freezes; exclude param works for freezes. |
| `src/storage/repositories/semenCollections.test.ts` (extend) | Updating collection raw volume blocked when freezes push it over the cap. |
| `src/storage/migrations/index.test.ts` (extend) | New migration creates table with expected columns / FKs. |
| `src/screens/FrozenBatchWizardScreen.screen.test.tsx` | Renders step 1, advances through steps, "Was Centrifuged?" toggles fields, computed sperm-per-straw updates, save calls repository, allocation cap error surfaces in Alert. Happy path + at least one error path. |
| `src/screens/FrozenBatchFormScreen.screen.test.tsx` | Loads existing batch, edits, saves, deletes (with confirm). Happy path + at least one error path. |
| `src/screens/stallion-detail/CollectionsTab.screen.test.tsx` (extend) | "Freeze" button renders and navigates with `collectionId`; freeze rows render in the Allocations list with correct labels; tapping a freeze row → `FrozenBatchForm`; `isDeleted=true` hides the Freeze button. |
| `src/screens/StallionDetailScreen.screen.test.tsx` (extend) | New "Frozen" tab renders; `initialTab='frozen'` lands on it; soft-deleted stallion hides "Add Frozen Batch" button. |
| `src/utils/backup/serialize.test.ts` (extend) | Round-trip serialize for both linked and standalone freezes. |
| `src/utils/backup/restore.test.ts` (extend) | Round-trip restore respects FK ordering. |
| `src/utils/backup/validate.test.ts` (extend) | Schema validation rejects malformed freeze records (missing required fields, invalid enums, broken FKs). |
| `src/utils/backup/safetyBackups.test.ts` (extend) | Auto-snapshot triggers on freeze create/update/delete. |

## Quality gates

Per `CLAUDE.md`:

- `npm run typecheck`
- `npm test`
- `npm run test:screen`
- `npm run lint`

All must pass before commit. New screens count toward the screen-coverage CI threshold (commit `48e3c52`); each new screen test must clear it. Every new icon-only button needs an `accessibilityLabel`.

## Out of scope for v1 (tracked in TODO)

- **Inventory consumption flows** — decrementing `strawsRemaining` when straws are used in a breeding. The schema is laid out to support this, but no UI flow exists yet.
- **Dashboard alerts for low frozen inventory** — would feed off `strawsRemaining` once consumption tracking lands.
- **Bulk-edit / multi-batch operations** — applying changes across multiple freezes at once.
- **Versioning the centrifuge protocol** — currently each freeze stores its own settings; no shared "centrifuge profiles."
- **Tank / canister / cane location modeling** — currently storage is a single free-text field per the user's preference.
