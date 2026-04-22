# Collection Wizard Volume Rework Design

**Date:** 2026-04-21
**Status:** Approved — ready for implementation planning
**Branch:** `feature/collection-wizard`
**Supersedes:** parts of `docs/plans/2026-04-21-collection-wizard-implementation-plan.md` (field layout, collection schema, dose-event volume model)
**Depends on:** the phase-2.5 wizard scaffold already landed in commit `2b4aa16` on this branch

## Summary

Rework the collection wizard on stallion detail around a more honest physical model: each dose is an independent package with its own semen + extender composition, not a uniform slice of an averaged pool. The wizard becomes a 4-step flow — **Basics → Processing Calculator → Dose Allocation → Review** — with the calculator pre-filling per-dose defaults that can be overridden per row. The saved-record edit screen stays a single-page form with the same new fields and a read-only derived panel. Wizard-created on-farm allocations stay editable through their linked mare-side breeding records, with a synchronized companion `usedOnSite` event behind the scenes.

This is a breaking schema change: four dropped columns on `semen_collections`, two new targets on `semen_collections`, two new per-dose volume columns on `collection_dose_events`, and a backup schema bump to v3.

## Motivation

The phase-2.5 wizard (commit `2b4aa16`) treats dose allocation as "N doses out of a pool." In reality:

- Each shipped dose has its own semen volume and its own extender volume. Breeders titrate these per recipient or per tube.
- On-farm fresh-AI doses are **not extended**. They have only a semen volume — or none recorded at all if the vet didn't measure.
- The physical constraint on how much you can allocate is total raw semen volume, not a user-entered "dose count" cap.
- Dose planning math (target motile sperm count, target post-extension concentration) is what breeders actually think about. The existing `doseSizeMillions` field conflates too many concepts.

The current field layout also scatters collection planning inputs across wizard steps in a way the user (the primary breeder) finds uncomfortable when actually using the wizard.

## Locked product decisions

All decisions below were reached through explicit brainstorming on 2026-04-21 and are fixed inputs for implementation planning.

### Wizard shape

- Four steps, in order: **Collection Basics → Processing (Live Calculator) → Dose Allocation → Review**.
- Explicit `Back` / `Next` / `Save` buttons; no swipe-based step navigation (stallion detail already uses a horizontal pager).
- Step 2 is the "meat" of the wizard: a live calculator that pre-fills per-dose defaults on Step 3.

### Volume model

- Collection-level `totalVolumeMl` means **raw ejaculate** only. Stored column remains `raw_volume_ml` (no rename). UI labels it "Total Volume".
- Per-dose volume model applies to **shipped rows only** with full semen + extender:
  - `doseSemenVolumeMl` — raw semen in this dose
  - `doseExtenderVolumeMl` — extender in this dose
  - `totalExtendedVolumeMl` — **computed on read only**, never stored; equals `doseSemenVolumeMl + doseExtenderVolumeMl` for a row.
- **On-farm rows are not extended.** They track `doseSemenVolumeMl` only (optional — breeders don't always measure). No extender field.
- Collection-level `extenderVolumeMl` is **removed**. Extender is purely per-dose; if a rollup is ever wanted it's `SUM(doseExtenderVolumeMl × doseCount)` over shipped rows.

### Target values (Step 2)

- **`targetMotileSpermMillionsPerDose`** — target *motile* sperm per dose (not total sperm). Industry-standard AI spec.
- **`targetPostExtensionConcentrationMillionsPerMl`** — target post-extension motile concentration. Industry-standard AI spec.
- Both are **stored** on `semen_collections` (nullable). Preserves planning intent across reopens and future reporting (e.g. phase-3 trend analytics).
- Old `doseSizeMillions` column is removed — the new targets supersede it.

### Row-per-dose vs. row-per-spec

- **Row = N identical doses at a shared spec.** A row stores one `{doseSemenVolumeMl, doseExtenderVolumeMl}` plus an integer `doseCount` multiplier. Volume used by row = `doseSemenVolumeMl × doseCount`.
- If doses to one recipient have different specs, split into multiple rows.
- On-farm rows are always `doseCount = 1` (same-mare-twice prevention + one breeding event per row makes multiplier meaningless). The `1` is written to storage but not shown as an editable UI field.

### Allocation cap

- The cap is **volume-based**, not dose-count-based.
- Rule: `SUM(doseSemenVolumeMl × doseCount)` over rows with non-null `doseSemenVolumeMl` ≤ collection `rawVolumeMl`.
- Rows with blank `doseSemenVolumeMl` (legal only on on-farm) are **excluded** from the sum.
- If collection `rawVolumeMl` is blank, the cap is skipped entirely.
- Cap is **hard-blocking** at save time, not a soft warning. Soft warnings get trained past.
- `doseCount` (collection-level, user-entered) is removed entirely. Row count is self-evident.

### Calculator pre-fill on Step 3

- On "Add shipped row" / "Add on-farm row", new rows pre-fill `doseSemenVolumeMl` (and, for shipped, `doseExtenderVolumeMl`) from calculator-derived values.
- Pre-fill uses full precision internally; UI rounds to 2 decimal places on display.
- If calculator values are missing/invalid, new rows start empty.
- **Rows are independent from the calculator after creation.** Going back to Step 2 and changing targets does not mutate already-added rows. Only newly-added rows pick up fresh defaults.

### Edit flow (saved-collection edit)

- `CollectionFormScreen` stays a plain single-page form — no wizard, no multi-step.
- Shows all collection-level fields including targets.
- Shows a **read-only derived panel** below inputs using the same calculator pure function (per-dose semen, per-dose extender, dose volume, max doses).
- No dose-event editing on this screen. Dose events continue to be edited on `CollectionsTab` / `DoseEventModal`.

### On-farm lifecycle after save

- Each wizard-created on-farm allocation is represented by:
  - one `breeding_records` row with `method = 'freshAI'` and `collection_id` set
  - one companion `collection_dose_events` row with `event_type = 'usedOnSite'` and `breeding_record_id` pointing at that breeding record
- After creation, the **mare-side breeding record** is the editable surface for that allocation.
- `DoseEventModal` continues to reject direct editing of `usedOnSite` rows.
- When a linked on-farm breeding record is edited, the companion `usedOnSite` event is updated in the same transaction:
  - `breeding_records.date` -> `collection_dose_events.event_date`
  - `breeding_records.volume_ml` -> `collection_dose_events.dose_semen_volume_ml`
  - `breeding_records.notes` -> `collection_dose_events.notes`
- Clearing `breeding_records.volume_ml` is allowed and writes `NULL` to `dose_semen_volume_ml`.
- `dose_extender_volume_ml` always stays `NULL` for `usedOnSite` rows.
- `dose_count` always stays `1` for `usedOnSite` rows and is never user-editable after creation.
- If a breeding record has a companion `usedOnSite` event, the following edits are blocked:
  - changing `method` away from `freshAI`
  - clearing `collection_id`
  - switching `collection_id` to a different collection
- The `recipient` field on the companion `usedOnSite` event remains a mare-name snapshot taken at creation time. It is not live-synced to later mare-name edits.
- Deleting a linked on-farm breeding record deletes its companion `usedOnSite` event through the existing `breeding_record_id` cascade.

### Migration for existing data

- Lossy but clean: drop the four removed columns outright. User has explicitly accepted losing old values in those columns.
- Pre-existing `shipped` dose events get `doseSemenVolumeMl` / `doseExtenderVolumeMl` NULL.
- Pre-existing `usedOnSite` dose events are canonicalized to the new invariant:
  - `dose_count = 1`
  - `dose_extender_volume_ml = NULL`
  - `dose_semen_volume_ml = NULL`
- If a legacy `usedOnSite` row had `dose_count > 1`, append exactly one sentence to `notes`:
  - `Legacy on-farm dose count {N} collapsed to 1 during volume-model migration.`
- If `notes` was empty, the migration note becomes the entire note.
- If `notes` already had content, append the migration note after a blank line.
- Pre-existing collections get `targetMotileSpermMillionsPerDose` / `targetPostExtensionConcentrationMillionsPerMl` NULL.
- Migration must work identically on fresh installs and upgraded installs (per the data-storage-hardening canonical-migration rule).

### Backup schema

- Bump to **v3**. Column drops are structural, not additive, so v2→v3 is a breaking change.
- v2 backups remain restorable via a migration step at restore time (drop the removed fields, leave new fields NULL). v3 backups write/read the new shape directly.

## Navigation and screen structure

Unchanged from `docs/plans/2026-04-21-collection-wizard-implementation-plan.md`:

- Route split stays: `CollectionCreateWizard: { stallionId }` for create, `CollectionForm: { stallionId, collectionId }` for edit.
- `Add Collection` on `CollectionsTab` navigates to the wizard. Collection-card pencil buttons still navigate to the edit form.

Wizard module structure (already in place, will be modified):

- `src/screens/CollectionWizardScreen.tsx` — thin screen shell
- `src/hooks/useCollectionWizard.ts` — draft state, per-step validation, save orchestration
- `src/screens/collection-wizard/CollectionBasicsStep.tsx`
- `src/screens/collection-wizard/ProcessingDetailsStep.tsx` — will be rebuilt as the Live Calculator
- `src/screens/collection-wizard/DoseAllocationStep.tsx`
- `src/screens/collection-wizard/ReviewStep.tsx`
- `src/screens/collection-wizard/ShippedDoseRowEditor.tsx`
- `src/screens/collection-wizard/OnFarmMareRowEditor.tsx`

New module:

- `src/utils/collectionCalculator.ts` — pure math for the calculator, reused by the edit screen's derived panel.

## Step-by-step behavior

### Step 1 — Collection Basics

Fields:

- **Collection Date** (required, date, max today, display `MM-DD-YYYY`)
- **Total Volume (mL)** — stored as `raw_volume_ml`. Optional number, > 0 when present.
- **Concentration (M/mL, raw)** — stored as `concentration_millions_per_ml`. Optional number, > 0 when present.
- **Progressive Motility (%)** — stored as `progressive_motility_percent`. Optional number, 0 ≤ x ≤ 100.

Validation:

- `collectionDate` required.
- Numeric fields must be either blank or within range.

### Step 2 — Processing (Live Calculator)

Top of step (read-only pinned chips, derived from Step 1):

- Total Volume
- Concentration
- Motility %

User inputs:

- **Target motile sperm / dose (M)** — stored as `target_motile_sperm_millions_per_dose`. Optional number, > 0.
- **Target post-extension concentration (M motile/mL)** — stored as `target_post_extension_concentration_millions_per_ml`. Optional number, > 0.
- **Extender Type** — unchanged; existing `extender_type` column with autocomplete from `EXTENDER_TYPES`.
- **Notes** — unchanged; existing collection-level notes.

Derived display panel (below inputs, updates live):

```
At this target:
~ N doses possible
~ X mL semen per dose
~ Y mL extender per dose
```

Edge-case behavior in the display:

- Any required math input missing (V, C, M, D, Cpost) → neutral empty state: "Enter a target to see per-dose math."
- `C × M = 0` → empty state.
- `semenPerDose > doseVolume` (target post-ext concentration ≥ raw motile concentration) → warning inline: "Extender amount negative — target concentration is ≥ raw motile concentration." **Does not block navigation.**
- `maxDoses < 1` → warning: "Target exceeds what this collection can produce." **Does not block navigation.**

Step 2 validation:

- All fields optional. User can pass straight through.

### Step 3 — Dose Allocation

Structure:

- Top: live allocation summary band
  - `Semen used: X / Y mL`
  - `Remaining: Z mL (~W doses)` where W is derived from current calculator's `semenPerDose`
  - If any rows have blank `doseSemenVolumeMl`: append info "N row(s) have no volume entered — not counted toward allocation."
  - If Z < 0: summary turns warning-colored; Save on Step 4 disabled.
  - If `rawVolumeMl` is null: summary shows "Total volume not recorded — allocation not capped."
- List of existing rows (shipped + on-farm interleaved, in add order)
- `+ Add shipped row` button
- `+ Add on-farm row` button

#### Shipped row editor

Fields (all required unless marked optional):

- `recipient` (name) — stored in existing `recipient` column
- `recipient_phone`
- `recipient_street`
- `recipient_city`
- `recipient_state`
- `recipient_zip`
- `carrier_service` — suggested values + custom text via `src/utils/carrierServices.ts`
- `container_type` — suggested values + custom text via `src/utils/containerTypes.ts`
- **Ship date** — stored in `event_date`. Defaults from `collectionDate`.
- `doseSemenVolumeMl` — required, > 0, pre-filled from calculator when valid
- `doseExtenderVolumeMl` — required, ≥ 0, pre-filled from calculator when valid
- `doseCount` — required integer ≥ 1, default 1
- `tracking_number` — optional
- `notes` — optional

Row-level derived display (inside the editor, small text):

- `Total per dose: {semen + extender} mL`
- `Total semen used by this row: {semen × count} mL`
- `Total extender used by this row: {extender × count} mL`

#### On-farm row editor

Fields:

- **Mare** — required. Options from `listMares()`. Cannot match another on-farm row in the same wizard session.
- **Breeding date** — required. Defaults from `collectionDate`.
- `doseSemenVolumeMl` — optional. Pre-filled from calculator when valid.
- `doseCount` — fixed at 1. Not shown in UI. Written to storage as 1.
- `notes` — optional.

On-farm row derived display:

- If `doseSemenVolumeMl` is present: `Semen used: X mL`.
- If blank: `Semen volume not recorded`.

#### Navigation out of Step 3

- Cap must not be exceeded. If it is, tapping Next/Save keeps user on Step 3 with the summary band in warning color. A toast/inline message names the overflow amount.

### Step 4 — Review

Shows all planned data in sections:

- **Collection** — date, volumes, concentration, motility
- **Processing Plan** — targets, extender type, notes
- **Shipped** — each row: recipient + carrier + container + `semen + extender ×count`
- **On-farm** — each row: mare + date + semen volume (or "not recorded")
- **Totals** — semen allocated / total, remaining
- **Any warnings** — if any calculator inputs triggered warnings (e.g. target exceeds capacity), surface them here non-blockingly

Allow jump-back to any prior step.

Save button:

- Disabled if allocation cap is exceeded. Inline message points to the overflow.
- Enabled otherwise (collection-only saves with no rows are legal).

## Data model and schema changes

### `semen_collections`

**Drop columns:**

- `extended_volume_ml` — post-extender total (backs the TypeScript field `SemenCollection.totalVolumeMl`); derivable from per-dose data.
- `extender_volume_ml` — moved to per-dose.
- `dose_count` — redundant with rows and volume cap.
- `dose_size_millions` — superseded by target fields.

(Note the DB/TS naming offset: TS `totalVolumeMl` → DB `extended_volume_ml`, TS `rawVolumeMl` → DB `raw_volume_ml`. This spec keeps DB column names authoritative where relevant.)

**Add columns:**

- `target_motile_sperm_millions_per_dose` REAL NULLABLE
- `target_post_extension_concentration_millions_per_ml` REAL NULLABLE

**Unchanged columns:**

- `id`, `stallion_id`, `collection_date`
- `raw_volume_ml` (UI label becomes "Total Volume")
- `concentration_millions_per_ml` (semantically "raw")
- `progressive_motility_percent`
- `extender_type`
- `notes`
- `created_at`, `updated_at`

### `collection_dose_events`

**Add columns:**

- `dose_semen_volume_ml` REAL NULLABLE
- `dose_extender_volume_ml` REAL NULLABLE

**Unchanged:** everything from the phase-2.5 commit — `recipient`, `recipient_phone`, `recipient_street`, `recipient_city`, `recipient_state`, `recipient_zip`, `carrier_service`, `container_type`, `tracking_number`, `breeding_record_id`, `dose_count`, `event_date`, `event_type`, `notes`, timestamps, etc.

### Type updates (`src/models/types.ts`)

Update:

- `SemenCollection`, `CreateSemenCollectionInput`, `UpdateSemenCollectionInput`:
  - Remove: `totalVolumeMl`, `extenderVolumeMl`, `doseCount`, `doseSizeMillions`
  - Add: `targetMotileSpermMillionsPerDose?: number | null`
  - Add: `targetPostExtensionConcentrationMillionsPerMl?: number | null`
- `CollectionDoseEvent`, `CreateCollectionDoseEventInput`, `UpdateCollectionDoseEventInput`:
  - Add: `doseSemenVolumeMl?: number | null`
  - Add: `doseExtenderVolumeMl?: number | null`

`totalExtendedVolumeMl` is **never a field** on any type — it's computed at display time.

### Repository updates

- `src/storage/repositories/semenCollections.ts` — map new/dropped columns in create/update/find.
- `src/storage/repositories/collectionDoseEvents.ts` — map new volume columns.
- `src/storage/repositories/collectionWizard.ts` — transactional save consumes new row shape. Ensure new `doseSemenVolumeMl × doseCount` roll-up is the basis of the in-transaction cap check.
- `src/storage/repositories/internal/collectionAllocation.ts` — update invariant to volume-based cap (`SUM(doseSemenVolumeMl × doseCount) ≤ rawVolumeMl`, skipping null semen volumes). Keep current enforcement points: save-time, dose-event edit, collection total edit.

### Migration

Migration `019_collection_wizard_volume_rework` — added as a new `migration019` SQL string in `src/storage/migrations/index.ts` with a matching entry in the `migrations: Migration[]` array. The repo stores all migrations as inline TypeScript constants in that file (the `001_initial_schema.sql` file is a reference/export; new migrations follow the in-file constant pattern used by `011`–`018`).

Phase-2.5 migration is already `018_collection_dose_event_shipping_details`. This is `019`.

Pattern (SQLite needs "new table + copy + drop + rename" for column drops, a dance this repo uses extensively — see `011`, `012`, `015`, `016` for the exact idiom):

1. Create `semen_collections_new` with the final target schema (unchanged columns + target fields, minus dropped columns). Include all existing CHECK constraints on unchanged columns and the canonical constraints introduced by `016`.
2. `INSERT INTO semen_collections_new SELECT <unchanged columns>, NULL, NULL FROM semen_collections`.
3. Drop old `semen_collections`, rename `semen_collections_new` → `semen_collections`.
4. Recreate indexes and foreign key references with current intended semantics:
   - `breeding_records.collection_id` -> `semen_collections(id)` uses `ON UPDATE CASCADE ON DELETE RESTRICT`
   - `collection_dose_events.collection_id` -> `semen_collections(id)` uses `ON DELETE CASCADE`
   - `collection_dose_events.breeding_record_id` -> `breeding_records(id)` uses `ON DELETE CASCADE`
5. On `collection_dose_events`: two `ALTER TABLE ADD COLUMN` statements for `dose_semen_volume_ml` and `dose_extender_volume_ml` (additive, safe; both `REAL NULLABLE`). Add CHECK constraints `dose_semen_volume_ml IS NULL OR dose_semen_volume_ml >= 0` and `dose_extender_volume_ml IS NULL OR dose_extender_volume_ml >= 0`.
6. Normalize legacy `usedOnSite` rows during the migration so every one ends in canonical shape:
   - force `dose_count = 1`
   - force `dose_extender_volume_ml = NULL`
   - leave `dose_semen_volume_ml = NULL`
   - append the legacy-collapse note when the previous `dose_count > 1`

Guards consistent with other migrations in the file:
- `requiresForeignKeysOff: true` (table rebuild).
- `shouldSkip` keyed on the presence of `target_motile_sperm_millions_per_dose` on `semen_collections` (absence of new column signals the migration hasn't run). Also verify that dropped columns are gone in a canonical-repair follow-up if needed — see the pattern in `016`.

Must pass both fresh-install and upgrade-install paths in `migrations/index.test.ts`, consistent with the data-storage-hardening canonical-migration rule.

## Persistence and transaction plan

Unchanged from the original plan at a structural level; the diff is the payload shape.

`createCollectionWithAllocations(input)` continues to be the single entry point, inside `db.withTransactionAsync(...)`:

1. Insert `semen_collections` with new target fields.
2. Insert shipped `collection_dose_events` (each carries its own `doseSemenVolumeMl`, `doseExtenderVolumeMl`, `doseCount`, shipment fields).
3. For each on-farm row: insert `breeding_records` (freshAI, with collection linkage), then insert companion `usedOnSite` `collection_dose_events` with `breeding_record_id`, `doseSemenVolumeMl` (possibly null), `doseCount = 1`, no extender field.
4. Within the transaction, re-compute the allocation cap (defense in depth); abort on violation.

After commit, emit invalidation for `semenCollections`, `collectionDoseEvents`, `breedingRecords`.

### On-farm create-time field mapping

For each on-farm row, the created `freshAI` breeding record stores:

- `volume_ml = doseSemenVolumeMl`
- `concentration_m_per_ml = semen_collections.concentration_millions_per_ml` snapshot at create time
- `motility_percent = semen_collections.progressive_motility_percent` snapshot at create time
- `collection_date = semen_collections.collection_date`
- `notes = on-farm row notes`

The companion `usedOnSite` event stores:

- `dose_semen_volume_ml = doseSemenVolumeMl`
- `dose_extender_volume_ml = NULL`
- `dose_count = 1`
- `event_date = breeding_records.date`
- `notes = breeding_records.notes`

### Allocation invariants (updated)

Enforced in shared repo/service logic, not only UI:

- `SUM(doseSemenVolumeMl × doseCount)` across a collection's events with non-null `doseSemenVolumeMl` must not exceed `semen_collections.raw_volume_ml` when that value is non-null.
- A collection with `raw_volume_ml = NULL` cannot be capped. Rows may still be added, but there's no cap check.
- Lowering a saved collection's `raw_volume_ml` below already-allocated volume must fail.
- Editing a saved dose event recomputes totals with the current event excluded before applying the new value.
- Editing `breeding_records.volume_ml` for a linked on-farm allocation reruns the same collection allocation cap check, excluding the current companion event during recompute.
- Any failure during wizard save rolls back the entire transaction.
- **`usedOnSite` events always have `dose_extender_volume_ml = NULL` and `dose_count = 1`.** Enforce at repo layer — reject attempts to write extender volume or non-1 dose count on a `usedOnSite` event. Mirror as backup validation rule.
- **`shipped` events must have non-null `dose_semen_volume_ml` and non-null `dose_extender_volume_ml` when the event is saved.** (Null values are legal in the DB only for historical pre-migration rows and on-farm rows.)

## Pure functions (new utils)

### `src/utils/collectionCalculator.ts`

```ts
export interface CollectionInputs {
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;  // 0..100
  targetMotileSpermMillionsPerDose: number | null;
  targetPostExtensionConcentrationMillionsPerMl: number | null;
}

export interface CollectionDerived {
  semenPerDoseMl: number | null;
  extenderPerDoseMl: number | null;
  doseVolumeMl: number | null;
  maxDoses: number | null;
  warnings: Array<'negative-extender' | 'target-exceeds-capacity'>;
}

export function deriveCollectionMath(i: CollectionInputs): CollectionDerived;
```

Used by:

- Step 2 live display
- Step 3 row pre-fill (passes `semenPerDoseMl` + `extenderPerDoseMl` to new rows)
- Edit screen's read-only derived panel
- Review step totals/warnings

### `src/utils/collectionAllocation.ts`

```ts
export interface AllocationRow {
  doseSemenVolumeMl: number | null;
  doseCount: number;
}

export interface AllocationSummary {
  totalAllocatedMl: number;
  remainingMl: number | null;      // null if rawVolumeMl is null
  blankVolumeRowCount: number;
  exceededByMl: number;            // 0 if within cap
  isWithinCap: boolean;
}

export function computeAllocationSummary(
  rows: AllocationRow[],
  rawVolumeMl: number | null,
): AllocationSummary;
```

Used by Step 3 summary band, Step 4 Save guard, and repo-level invariant.

(The existing `src/storage/repositories/internal/collectionAllocation.ts` may be merged into this public util, or this can call into it — structural choice for the implementation plan.)

## Suggested-value helpers

No change. `src/utils/carrierServices.ts` and `src/utils/containerTypes.ts` continue to provide the existing suggested values with custom-text support.

## Backup, restore, and validation

### Type updates

- `src/utils/backup/types.ts`:
  - Add `BackupV3` shape reflecting all changes.
  - Keep `BackupV2` for restore-path only.

### Serialize (`serialize.ts`)

- Writes v3 only. All `semen_collections` rows carry new target fields; all `collection_dose_events` rows carry new volume fields (nullable).

### Restore (`restore.ts`)

- Accepts v2: during restore, strip removed fields (`extended_volume_ml`, `extender_volume_ml`, `dose_count`, `dose_size_millions`) and insert new fields as NULL.
- During v2 -> v3 restore, apply the same canonicalization as migration `019` for legacy `usedOnSite` rows:
  - force `dose_count = 1`
  - force `dose_extender_volume_ml = NULL`
  - leave `dose_semen_volume_ml = NULL`
  - append the same legacy-collapse note when the previous `dose_count > 1`
- Accepts v3: direct.
- Unknown keys on v3 may be ignored during restore validation, but they are **not** preserved through restore/serialize round trips because only known columns are stored in SQLite.

### Validate (`validate.ts`)

- v3 validation for new row shape.
- **Volume cap validation at backup level:** for each `semen_collections` row with non-null `raw_volume_ml`, `SUM(dose_semen_volume_ml × dose_count)` across its `collection_dose_events` rows with non-null `dose_semen_volume_ml` must not exceed `raw_volume_ml`. (Replaces the existing dose-count-based cap rule.)
- **Type-specific row rules:** `usedOnSite` events must have `dose_extender_volume_ml = NULL` and `dose_count = 1`. Reject on restore if violated.
- Preserve existing rules: `breeding_record_id` FK integrity, etc.

### Fixtures

- Add v3 fixture to `testFixtures.ts`.
- Keep a v2 fixture for restore-round-trip coverage.

## Test plan

### New test files

- `src/utils/collectionCalculator.test.ts`
  - happy path with sample numbers
  - zero / missing motility → empty state
  - zero / missing concentration → empty state
  - target exceeds capacity → warning
  - negative extender (target post-ext ≥ raw motile concentration) → warning
  - rounding precision
- `src/utils/collectionAllocation.test.ts`
  - empty rows → 0 allocated
  - all shipped rows with volumes → exact sum
  - mixed shipped + on-farm with blank on-farm volume → skipped, counted only from shipped
  - `doseCount > 1` multiplier honored
  - cap exactly met (isWithinCap = true)
  - cap exceeded (exceededByMl > 0, isWithinCap = false)
  - `rawVolumeMl = null` → `remainingMl = null`, always within cap

### Updated test files

- `src/screens/CollectionWizardScreen.screen.test.tsx`
  - new step contents (Basics, Calculator, Allocation, Review)
  - calculator pre-fills new shipped row with `doseSemenVolumeMl` + `doseExtenderVolumeMl`
  - calculator pre-fills new on-farm row with `doseSemenVolumeMl` only
  - editing target on Step 2 does not mutate existing rows (only new ones)
  - hard-block on over-allocation; Save disabled on Step 4 with inline message
  - collection-only save (no rows) succeeds
  - Targets round-trip on save
  - Same mare cannot be selected twice in on-farm rows
- `src/screens/CollectionFormScreen.screen.test.tsx`
  - new fields present, old fields absent
  - derived panel updates live when inputs change
  - saves targets correctly
- `src/screens/StallionDetailScreen.screen.test.tsx` — mocks updated for new types
- `src/navigation/AppNavigator.integration.test.tsx` — mocks updated
- `src/storage/repositories/semenCollections.test.ts`
  - dropped columns absent from CRUD
  - target fields writable/readable, default NULL
- `src/storage/repositories/collectionDoseEvents.test.ts`
  - `doseSemenVolumeMl` + `doseExtenderVolumeMl` round-trip
  - null round-trip (on-farm blank volume case)
- `src/storage/repositories/collectionWizard.test.ts`
  - transactional save with mixed shipped + on-farm rows carrying volumes
  - in-transaction cap check fires
  - lowering collection `rawVolumeMl` below already-allocated sum fails
  - on-farm create-time breeding record uses row `doseSemenVolumeMl`, not collection `rawVolumeMl`
- `src/storage/repositories/breedingRecords.test.ts`
  - editing linked on-farm breeding record syncs companion `usedOnSite` event date, semen volume, and notes
  - changing linked on-farm method away from `freshAI` is blocked
  - clearing or switching linked `collection_id` is blocked
  - cap check runs when linked on-farm `volume_ml` changes
- `src/storage/repositories/repositories.test.ts` — surface the new volume-based cap
- `src/storage/migrations/index.test.ts`
  - migration `019` adds/drops expected columns
  - fresh install path: final schema correct, no data migration needed
  - upgrade install path: data preserved for unchanged columns, target fields NULL, dose-event volume fields NULL
  - upgrade install path: legacy `usedOnSite` rows are collapsed to `dose_count = 1` and receive the migration note when needed
  - canonical migration repair still clean
- `src/utils/backup/validate.test.ts` — new volume-based cap; reject backups exceeding it
- `src/utils/backup/serialize.test.ts` — emits v3 with new fields
- `src/utils/backup/restore.test.ts`
  - v2 → v3 migration path during restore
  - v3 direct restore
  - legacy `usedOnSite` rows are canonicalized during v2 restore
- `src/utils/backup/safetyBackups.test.ts` — new schema reflected

### Regression cautions

- Partial `jest.requireMock('@/storage/repositories')` maps will break silently until new repo functions are added to mocks.
- Fake DB implementations in migration/repository tests need the new SQL shape (including the new-table-copy-drop-rename dance for column drops).
- Backup tests depend heavily on `cloneBackupFixture()` — update fixture to v3.
- Any screen or test that reads `collection.totalVolumeMl` (backed by DB `extended_volume_ml`) / `collection.extenderVolumeMl` / `collection.doseCount` / `collection.doseSizeMillions` must be updated or deleted.

## Verification before merge

- `npm run typecheck`
- `npm test`
- `npm run test:screen`
- `npm run lint`
- Manual smoke on device: create-wizard end to end, edit a saved collection, edit a shipped dose event with new fields, on-farm row with blank volume.

## Assumptions and defaults

- `recipient` remains the stored name/display field for both shipped (= recipient name) and usedOnSite (= mare-name snapshot) events.
- Tracking number remains optional.
- Carrier/service and container type remain required on shipped rows.
- On-farm companion events are linked via `breeding_record_id` and edited through breeding-record flows, not as free-form shipment rows.
- Wizard remains stallion-detail driven; mare-side breeding entry is still a separate flow and untouched by this design.
- No schema changes to the `breeding_records` table.
- No new DB enums for carrier or container — both remain free-form strings with suggested values.

## Out of scope

- Trend charts / phase-3 analytics consuming the new targets (future work).
- Dose-size calculator advanced modes (ratio calculator) — user mentioned this as a possible future addition; not part of this rework.
- Any changes to mare-side breeding entry.
- Any changes to `CollectionsTab` routing for linked `usedOnSite` rows — the original plan's prescription stands.
