# Foal Record Feature Design (Revised)

## Context

BreedWise already stores a `FoalingRecord` with event-level facts about the mare and the foaling outcome:
- date
- outcome
- foal sex
- complications
- notes

Breeders also need a place to track the live foal itself after delivery:
- identity details
- physical details at birth
- neonatal care milestones in the first 24-48 hours

This revision keeps the feature narrow enough for the current app and schema patterns while avoiding several bad assumptions in the earlier draft.

---

## Scope And Guardrails

### In scope

- Add a separate `Foal` record linked to a `FoalingRecord`
- Support create/edit/delete of a foal record for a live foal
- Show foal status from the mare detail foaling tab
- Track neonatal milestones with optional recorded times

### Explicit non-goals for this iteration

- Twins or multiple foals per foaling event
- Dedicated postpartum mare milestone tracking
- Reporting or querying milestones across the whole database
- Pedigree or registration workflows

### Important product decision

This release intentionally supports at most one foal record per foaling record.

That is a product constraint, not a domain truth. The UI and schema should be written so a future migration to one-to-many foals is possible without untangling mixed responsibilities first.

---

## Design Corrections From The Prior Draft

1. `FoalingRecord` remains the source of truth for foaling-event facts.
   `Foal` is for foal-specific data only.

2. Mare/postpartum milestones do not belong on `Foal`.
   In particular, `placentaPassed` stays off this model.

3. Foal name is optional.
   Users must be able to save an unnamed foal.

4. Milestone rows support explicit recorded times.
   A checkbox alone is not enough because many users backfill after the fact.

5. Delete UX should be proactive.
   The app should know whether a foaling record has a foal before attempting deletion, instead of depending on a foreign-key failure as the primary flow.

---

## Data Model

### Existing `FoalingRecord` stays mostly unchanged

Keep current fields in `src/models/types.ts`:
- `date`
- `outcome`
- `foalSex`
- `complications`
- `notes`

`foalSex` remains duplicated at the foaling-record level for now because:
- it already exists
- it is displayed in current UI
- removing it would force a broader migration than this feature needs

Rule for this iteration:
- when creating a foal from a live foaling record, initialize foal sex from `FoalingRecord.foalSex` if present
- editing the foal does not automatically back-sync `FoalingRecord.foalSex`

This duplication should be documented as temporary and tolerated.

### New types in `src/models/types.ts`

```typescript
export type FoalColor =
  | 'bay'
  | 'chestnut'
  | 'black'
  | 'gray'
  | 'palomino'
  | 'buckskin'
  | 'roan'
  | 'pintoPaint'
  | 'sorrel'
  | 'dun'
  | 'cremello'
  | 'other';

export type FoalMilestoneKey =
  | 'stood'
  | 'nursed'
  | 'passedMeconium'
  | 'iggTested'
  | 'enemaGiven'
  | 'umbilicalTreated'
  | 'firstVetCheck';

export interface FoalMilestoneEntry {
  done: boolean;
  recordedAt?: ISODateTime | null;
}

export type FoalMilestones = Partial<Record<FoalMilestoneKey, FoalMilestoneEntry>>;

export interface Foal {
  id: UUID;
  foalingRecordId: UUID;
  name?: string | null;
  sex?: FoalSex | null;
  color?: FoalColor | null;
  markings?: string | null;
  birthWeightLbs?: number | null;
  milestones: FoalMilestones;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

Notes:
- `name` is nullable
- `sex` is nullable because the existing foaling record may not know it yet
- milestone timestamps are named `recordedAt` to avoid implying perfect event accuracy

### New table: migration 005

```sql
CREATE TABLE IF NOT EXISTS foals (
  id TEXT PRIMARY KEY,
  foaling_record_id TEXT NOT NULL UNIQUE,
  name TEXT,
  sex TEXT CHECK (sex IS NULL OR sex IN ('colt', 'filly', 'unknown')),
  color TEXT CHECK (color IS NULL OR color IN (
    'bay', 'chestnut', 'black', 'gray', 'palomino', 'buckskin',
    'roan', 'pintoPaint', 'sorrel', 'dun', 'cremello', 'other'
  )),
  markings TEXT,
  birth_weight_lbs REAL CHECK (birth_weight_lbs IS NULL OR birth_weight_lbs > 0),
  milestones TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (foaling_record_id) REFERENCES foaling_records(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_foals_foaling_record_id
  ON foals (foaling_record_id);
```

Rationale:
- `UNIQUE (foaling_record_id)` matches the current scope
- `ON DELETE RESTRICT` preserves integrity
- milestones stay JSON text because the app edits the milestone set as a single foal detail payload and does not need relational milestone queries yet

### Future-compatibility note

If the app later needs twins, the migration path is:
1. drop the unique constraint by table rebuild
2. move foal sex display away from `FoalingRecord`
3. add ordinal/display labeling per foal

This future is easier if the current model does not mix mare milestones into `Foal`.

---

## Repository Layer

File: `src/storage/repositories/queries.ts`

Add:
- `createFoal(input)`
- `updateFoal(id, input)`
- `getFoalById(id)`
- `getFoalByFoalingRecordId(foalingRecordId)`
- `listFoalsByFoalingRecordIds(foalingRecordIds)`
- `listFoalsByMare(mareId)`
- `deleteFoal(id)`

### Mapping helpers

Add:
- `type FoalRow`
- `mapFoalRow(row)`
- `parseFoalMilestones(value)`

`parseFoalMilestones` requirements:
- parse JSON safely
- return `{}` on invalid JSON
- ignore unknown milestone keys
- normalize malformed entries to `{ done: boolean, recordedAt: string | null }` only when valid

This avoids propagating corrupt local data into UI crashes.

### Query notes

`listFoalsByMare(mareId)` is still useful for mare detail load and matches existing repository style.

Also add `getFoalByFoalingRecordId` because:
- the foaling-record form needs fast dependency checks before delete
- the foal screen needs direct create-vs-edit lookup

---

## Display Utilities

### `src/utils/outcomeDisplay.ts`

Add:
- `formatFoalColor(color)`
- `formatFoalSex(sex)`

These should format enum values for display, matching existing utility patterns.

### New file: `src/utils/foalMilestones.ts`

Add:
- `FOAL_MILESTONE_KEYS`
- `FOAL_MILESTONE_LABELS`

The list should include only foal-specific milestones:
- stood
- nursed
- passed meconium
- IgG tested
- enema given
- umbilical treated
- first vet check

Do not include `placentaPassed`.

---

## Navigation

File: `src/navigation/AppNavigator.tsx`

Add:

```typescript
FoalForm: {
  mareId: string;
  foalingRecordId: string;
  foalId?: string;
  defaultSex?: FoalSex | null;
}
```

Notes:
- include `mareId` to match current navigation conventions
- `defaultSex` should be typed as `FoalSex | null`, not `string`
- `foalId` is optional for edit mode convenience, but the screen should still be able to resolve by `foalingRecordId`

Register `FoalFormScreen`.

---

## Foal Form Screen

File: `src/screens/FoalFormScreen.tsx`

Pattern:
- follow the loading/saving/delete flow used by `FoalingRecordFormScreen`
- reuse shared controls from `src/components/FormControls.tsx`

### Form fields

1. Name
   Optional text input
2. Sex
   Option selector: Colt / Filly / Unknown
3. Color
   Option selector
4. Markings
   Optional text input
5. Birth Weight (lbs)
   Optional numeric text input
6. Milestones
   One row per milestone with:
   - checkbox
   - label
   - recorded time display
   - action to set/edit recorded time
7. Notes
   Optional multiline text input
8. Save button
9. Delete button in edit mode

### Milestone interaction design

Each milestone row should support:
- toggling done on/off
- defaulting `recordedAt` to `new Date().toISOString()` the first time a user checks the row
- preserving `recordedAt` on later edits unless the user explicitly clears it

Recommended behavior:
- checking an unchecked milestone with no time sets `recordedAt` to now
- unchecking sets `done` to false but does not silently destroy the recorded time until save-state for that row is fully cleared by user intent

Implementation simplification for this iteration:
- if the existing UI toolkit has no good inline date-time picker pattern, allow tapping a small "Set time" secondary action that opens a modal or native picker
- if date-time picker support is too heavy for this pass, show `recordedAt` read-only when auto-set and add a clearly documented follow-up task for manual editing

Do not pretend checkbox time capture is the same as event time.

### Validation

- `birthWeightLbs` must be a positive number if provided
- empty `name` is allowed
- trim text fields before save

### Load behavior

On mount:
1. load the foaling record
2. verify it exists
3. if outcome is not `liveFoal`, show an alert and leave the screen
4. load existing foal by `foalId` or by `foalingRecordId`

### Save behavior

- create when no foal exists
- update when foal exists
- navigate back on success

### Delete behavior

- confirmation alert
- delete foal
- navigate back

---

## Foaling Record Screen Changes

File: `src/screens/FoalingRecordFormScreen.tsx`

### Outcome-aware UI

This form should remain the place where the foaling event is edited.

Add small but important behavior:
- when `outcome !== 'liveFoal'`, do not offer any navigation affordance to create a foal record
- if an existing foaling record has a foal and the user changes outcome away from `liveFoal`, block save with a clear message

Recommended message:
- `This foaling record already has a foal record. Delete the foal record before changing the outcome.`

This is better than allowing incompatible state and only discovering it later.

### Delete behavior

Before attempting delete:
1. query `getFoalByFoalingRecordId(foalingRecordId)`
2. if a foal exists, show a direct message and stop
3. only call `deleteFoalingRecord` when no foal exists

Still keep the DB foreign key restriction as final protection.

---

## Mare Detail Screen Changes

File: `src/screens/MareDetailScreen.tsx`

### Data loading

Extend `loadData()` to fetch:
- `listFoalsByMare(mareId)`

Build:
- `foalByFoalingRecordId: Record<string, Foal>`

### Foaling tab card behavior

Keep the existing card layout and pencil edit affordance for the foaling record itself.

For the body of live-foal cards:
- wrap the card body in a `Pressable`
- navigate to `FoalForm`
- preserve the existing pencil icon for editing the foaling record

For non-live-foal cards:
- leave the card non-tappable

### Live-foal card content

If a foal exists:
- show foal name when present
- otherwise show `Unnamed foal`
- optionally show one secondary line with sex and color if available

If no foal exists:
- show `Tap to add foal record`

This avoids blank states and does not force users to invent a name.

---

## Tests

File: `src/storage/repositories/repositories.test.ts`

Add repository coverage for:
- create foal
- get foal by id
- get foal by foaling record id
- update foal
- delete foal
- list foals by mare
- invalid milestone JSON falls back to `{}`
- duplicate foal create for same `foaling_record_id` fails

Add form/screen behavior coverage where practical for:
- live foal card is tappable
- non-live foal card is not tappable
- foaling record delete is blocked when foal exists
- changing foaling outcome away from live foal is blocked when foal exists

If UI tests are not currently set up, document these as manual verification items instead of pretending they are covered.

---

## Manual Verification

1. Create a `liveFoal` foaling record with no foal yet.
2. Mare detail foaling tab shows `Tap to add foal record`.
3. Tap live foal card body and confirm `FoalFormScreen` opens.
4. Save an unnamed foal and confirm the card shows `Unnamed foal`.
5. Edit foal and add name, color, weight, and milestones.
6. Return to mare detail and confirm updated foal summary appears.
7. Confirm pencil icon still opens `FoalingRecordFormScreen`, not `FoalFormScreen`.
8. Confirm non-live foal cards are not tappable.
9. Attempt to delete a foaling record that has a foal and confirm deletion is blocked before the repository delete call.
10. Attempt to change outcome from `liveFoal` to `stillbirth` on a foaling record with an attached foal and confirm save is blocked.
11. Delete the foal record, then delete the foaling record successfully.

---

## Files

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/models/types.ts` | add `Foal` and milestone types |
| Modify | `src/storage/migrations/index.ts` | add migration 005 |
| Modify | `src/storage/repositories/queries.ts` | add foal queries and mappers |
| Modify | `src/navigation/AppNavigator.tsx` | add `FoalForm` route |
| Create | `src/screens/FoalFormScreen.tsx` | foal create/edit UI |
| Modify | `src/screens/MareDetailScreen.tsx` | live-foal card affordance and summary |
| Modify | `src/screens/FoalingRecordFormScreen.tsx` | proactive dependency checks |
| Modify | `src/utils/outcomeDisplay.ts` | foal display formatters |
| Create | `src/utils/foalMilestones.ts` | milestone keys and labels |
| Modify | `src/storage/repositories/repositories.test.ts` | repository coverage |
| Modify | `CLAUDE.md` | document revised foal feature behavior |

---

## Verification Commands

1. `npm run typecheck`
2. `npm test`

---

## Risks And Follow-Ups

### Accepted risks in this iteration

- `FoalingRecord.foalSex` and `Foal.sex` can drift
- milestone timestamps may ship with limited editing UX in v1
- one-foal-per-foaling-record is a deliberate product limitation

### Follow-up candidates

- support explicit date-time editing for milestone `recordedAt`
- add derived milestone summary chips on mare detail
- revisit `FoalingRecord.foalSex` once foal UI becomes primary
- design a proper one-to-many foal model if twin tracking becomes required
