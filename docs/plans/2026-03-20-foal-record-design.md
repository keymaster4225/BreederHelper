# Foal Record Feature Design

## Context

BreedWise currently tracks foaling records (date, outcome, sex, complications, notes) but has no way to record information about the foal itself. Breeders need to track foal identity (name, color, markings), birth weight, and critical neonatal milestones (stood, nursed, passed meconium, etc.) in the first 24-48 hours. This feature adds a `Foal` entity linked 1:1 to a foaling record, accessible by tapping a Live Foal card on the mare detail screen.

---

## Data Model

### New Types (`src/models/types.ts`)

```typescript
FoalColor = 'bay' | 'chestnut' | 'black' | 'gray' | 'palomino' | 'buckskin'
           | 'roan' | 'pintoPaint' | 'sorrel' | 'dun' | 'cremello' | 'other'

MilestoneKey = 'stood' | 'nursed' | 'passedMeconium' | 'iggTested'
             | 'enemaGiven' | 'placentaPassed' | 'umbilicalTreated' | 'firstVetCheck'

MilestoneEntry = { done: boolean; timestamp?: ISODateTime | null }
Milestones = Partial<Record<MilestoneKey, MilestoneEntry>>

Foal = {
  id, foalingRecordId, name, sex (FoalSex), color (FoalColor | null),
  markings (string | null), birthWeightLbs (number | null),
  milestones (Milestones), notes (string | null), createdAt, updatedAt
}
```

### New Table (migration 005)

```sql
CREATE TABLE IF NOT EXISTS foals (
  id TEXT PRIMARY KEY,
  foaling_record_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('colt','filly','unknown')),
  color TEXT CHECK (color IS NULL OR color IN ('bay','chestnut','black','gray',
    'palomino','buckskin','roan','pintoPaint','sorrel','dun','cremello','other')),
  markings TEXT,
  birth_weight_lbs REAL CHECK (birth_weight_lbs IS NULL OR birth_weight_lbs > 0),
  milestones TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (foaling_record_id) REFERENCES foaling_records(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_foals_foaling_record ON foals (foaling_record_id);
```

- UNIQUE on `foaling_record_id` enforces 1:1 with foaling record
- Milestones stored as JSON TEXT (fixed set, always read/written as unit, no need to query individually)
- ON DELETE RESTRICT: must delete foal before deleting foaling record

---

## Repository Layer (`src/storage/repositories/queries.ts`)

New functions following existing patterns:
- `createFoal(input)` -- INSERT with `JSON.stringify(milestones)`
- `updateFoal(id, input)` -- UPDATE all mutable fields
- `getFoalById(id)` -- SELECT by primary key
- `getFoalByFoalingRecordId(foalingRecordId)` -- SELECT by FK (for create-vs-edit detection)
- `listFoalsByMare(mareId)` -- JOIN foals to foaling_records WHERE mare_id = ? (avoids N+1)
- `deleteFoal(id)` -- DELETE by id

Row mapper `mapFoalRow` converts snake_case DB row to camelCase Foal, with `parseMilestones()` for safe JSON parsing (returns `{}` on failure).

---

## Display Utilities

### `src/utils/outcomeDisplay.ts` -- add:
- `formatFoalColor(color)` -- e.g., `'pintoPaint'` -> `'Pinto/Paint'`
- `formatFoalSex(sex)` -- e.g., `'colt'` -> `'Colt'`

### `src/utils/milestones.ts` -- new file:
- `MILESTONE_KEYS: MilestoneKey[]` -- ordered array of all 8 keys
- `MILESTONE_LABELS: Record<MilestoneKey, string>` -- human-readable labels

---

## Navigation (`src/navigation/AppNavigator.tsx`)

Add route to `RootStackParamList`:
```typescript
FoalForm: { foalingRecordId: string; foalId?: string; defaultSex?: string }
```

- `foalingRecordId` required (always known from foaling card)
- `foalId` optional (present = edit, absent = create)
- `defaultSex` passes foaling record's foalSex for pre-population on create

Register `FoalFormScreen` component.

---

## FoalFormScreen (`src/screens/FoalFormScreen.tsx`) -- new file

Follows existing form screen pattern (FoalingRecordFormScreen as template):

**Form fields:**
1. Name (required, FormTextInput)
2. Sex (OptionSelector: Colt/Filly/Unknown, pre-populated from defaultSex param)
3. Color (OptionSelector: 12 color options)
4. Markings (FormTextInput, free text)
5. Birth Weight in lbs (FormTextInput, numeric keyboard, optional)
6. **Milestones section** -- 8 rows, each with:
   - Checkbox (done/not done)
   - Label (e.g., "Stood")
   - Auto-set timestamp on check, clear on uncheck
7. Notes (FormTextInput, multiline)
8. Save button (PrimaryButton)
9. Delete button (DangerButton, edit mode only)

**Behavior:**
- `isEdit = Boolean(foalId)` -- load existing foal if editing
- Title: "Add Foal Record" / "Edit Foal Record"
- Validation: name required, birthWeightLbs must be positive number if provided
- Save: createFoal or updateFoal, then goBack
- Delete: confirmation Alert, deleteFoal, goBack
- Milestones updated immutably: `setMilestones(prev => ({ ...prev, [key]: { done: !prev[key]?.done, timestamp: ... } }))`

---

## Mare Detail Screen Changes (`src/screens/MareDetailScreen.tsx`)

### Data loading:
- Add `listFoalsByMare(mareId)` call in `loadData`
- Build lookup: `foalByFoalingRecordId: Record<string, Foal>`

### Foaling tab card changes:
- **Live Foal cards:** Wrap in `Pressable` that navigates to FoalForm
- **Non-live-foal cards:** Remain plain `View` (not tappable)
- **Edit icon (pencil):** Still navigates to FoalingRecordForm (unchanged)
- **Visual indicator on live foal cards:**
  - If foal exists: show foal name
  - If no foal yet: show "Tap to add foal record" in primary color
- **Pressed style:** `opacity: 0.85` on press for tappable cards

### Foaling record delete error handling:
- Update FoalingRecordFormScreen to catch FK constraint error when foal exists and show "Delete the foal record first"

---

## File Summary

| Action | File | What |
|--------|------|------|
| Modify | `src/models/types.ts` | Add Foal, FoalColor, MilestoneKey, MilestoneEntry, Milestones |
| Modify | `src/storage/migrations/index.ts` | Add migration 005 for foals table |
| Modify | `src/storage/repositories/queries.ts` | Add FoalRow, mapFoalRow, parseMilestones, CRUD + listFoalsByMare |
| Modify | `src/navigation/AppNavigator.tsx` | Add FoalForm route + screen registration |
| Modify | `src/screens/MareDetailScreen.tsx` | Load foals, tappable live foal cards, foal name/hint display |
| Modify | `src/screens/FoalingRecordFormScreen.tsx` | FK error message for foal-linked records |
| Modify | `src/utils/outcomeDisplay.ts` | Add formatFoalColor, formatFoalSex |
| Create | `src/utils/milestones.ts` | MILESTONE_KEYS, MILESTONE_LABELS constants |
| Create | `src/screens/FoalFormScreen.tsx` | New foal create/edit form screen |
| Modify | `src/storage/repositories/repositories.test.ts` | Add foal repository tests |
| Modify | `CLAUDE.md` | Document foal feature |

---

## Verification

1. `npm run typecheck` -- no TS errors
2. `npm test` -- existing tests pass + new foal tests pass
3. Manual on emulator:
   - Create foaling record (Live Foal) -> card shows "Tap to add foal record"
   - Tap card -> FoalFormScreen opens in create mode, sex pre-populated
   - Fill in foal details + check milestones -> save -> card shows foal name
   - Tap again -> edit mode with all data loaded
   - Pencil icon -> still opens FoalingRecordForm
   - Non-live-foal cards -> not tappable
   - Delete foal -> card reverts to "Tap to add" state
   - Try deleting foaling record with foal -> shows error message
