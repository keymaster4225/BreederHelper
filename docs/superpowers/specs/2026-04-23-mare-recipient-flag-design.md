# Mare Recipient Flag — Design Spec

- **Date:** 2026-04-23
- **Status:** Approved (brainstorm)
- **Scope:** Add a boolean "Recipient" flag to mares, with a home-screen segmented filter and inline badge.

## Goal

Let the user mark a mare as a **Recipient** (embryo-transfer recipient) during creation or edit, and surface that classification in the mare list so recipients can be found and filtered independently of breeding mares. The flag is a foundation for future recipient-specific features; this spec only covers the flag itself, its filter UI, and its badge.

## Non-Goals

- No new breeding method for embryo transfer.
- No donor ↔ recipient relationship modeling.
- No persistence of the filter segment across app launches.
- No recipient-specific dashboard alerts or workflows.
- No changes to pregnancy-check, foaling, or foal flows — recipients use the same existing flows.

## Data Model

### Type (`src/models/types.ts`)

Add `isRecipient: boolean` to the `Mare` interface. Required, non-nullable; defaults to `false` for existing rows.

```ts
export interface Mare {
  // ...existing fields...
  isRecipient: boolean;
}
```

### Migration 023 (`src/storage/migrations/index.ts`)

Migrations are inline TypeScript strings in `index.ts`, not standalone `.sql` files. The next free id is **023**.

```ts
const migration023 = `
ALTER TABLE mares ADD COLUMN is_recipient INTEGER NOT NULL DEFAULT 0
  CHECK (is_recipient IN (0, 1));
`;
```

Add to the `migrations` array with a `shouldSkip` guard following the pattern of migration017:

```ts
{
  id: 23,
  name: '023_mare_is_recipient',
  statements: splitStatements(migration023),
  shouldSkip: async (db) => hasColumn(db, 'mares', 'is_recipient'),
},
```

Existing mares get `is_recipient = 0` automatically; no backfill required.

## Repository (`src/storage/repositories/mares.ts`)

- Extend `createMare` input with `isRecipient: boolean` (no default — always explicit from caller).
- Extend `updateMare` input with `isRecipient: boolean`.
- Add `is_recipient` to the INSERT column list and UPDATE SET clause.
- Add `is_recipient` to all SELECT statements in `listMares` and `getMareById`.
- Extend `MareRow` type with `is_recipient: 0 | 1` (SQLite integer round-trip).
- Update `mapMareRow` to coerce: `isRecipient: row.is_recipient === 1`.

Repository writes always store `0` or `1`; the domain model always exposes `boolean`.

## Form (`EditMareScreen` + `useEditMareForm`)

- Add a `FormField` labeled `Recipient` wrapping the existing `FormCheckbox` component from `src/components/FormControls.tsx` (no new component needed — `FormCheckbox` already exists).
- Place the field **immediately after `Name`**, before `Breed`.
- `useEditMareForm` gains:
  - `isRecipient: boolean` in its returned state
  - `setIsRecipient: (v: boolean) => void` setter
  - Initial value: `false` on create, `mare.isRecipient` on edit
  - Passed through to `createMare` and `updateMare` calls
- Always editable — no conditional lock once the mare has records. Toggling it never affects other data.

## HomeScreen Filter + Badge

### Segmented control

- New segmented control rendered at the top of `HomeScreen`, above the dashboard alerts section, with three segments: `All | Breeding | Recipients`.
- Default segment is `All` on every app open — no AsyncStorage persistence.
- Segment state lives in local component state via `useState`.

### Filter logic (`src/utils/mareFilters.ts` — new file)

Pure function, easily unit-testable:

```ts
export type MareSegment = 'all' | 'breeding' | 'recipients';

export function filterMaresBySegment(mares: readonly Mare[], segment: MareSegment): Mare[] {
  switch (segment) {
    case 'all':
      return [...mares];
    case 'breeding':
      return mares.filter((m) => !m.isRecipient);
    case 'recipients':
      return mares.filter((m) => m.isRecipient);
  }
}
```

### Empty states

- `All` empty → existing "No mares yet" copy (unchanged).
- `Breeding` empty → `No breeding mares.`
- `Recipients` empty → `No recipients.`

### Badge in list rows

- When the segment is `All`, recipient mares render a `Recipient` `StatusBadge` next to the mare name.
- In `Breeding`, no badge (redundant — all are non-recipients).
- In `Recipients`, no badge (redundant — all are recipients).
- The existing `Pregnant` badge behavior is unchanged and can appear alongside `Recipient`.

### Badge colors

- Background: `colors.secondaryContainer` (`#F0E2CE`)
- Text: `colors.onSecondaryContainer` (`#5C3D1F`)
- Label: `Recipient`

Chosen to be visually distinct from the green `Pregnant` badge so the two do not collide when a recipient is also in foal.

## MareDetail Header

`MareDetailScreen` header card currently shows a `Pregnant` `StatusBadge` when applicable. Add the same `Recipient` badge there, using identical colors and label, when `mare.isRecipient` is true. Both badges can appear together for a pregnant recipient.

## Testing

### Unit — `src/utils/mareFilters.test.ts` (new)

- `filterMaresBySegment` with `all` returns all mares (including empty array).
- `breeding` returns only non-recipient mares.
- `recipients` returns only recipient mares.
- Empty input returns empty array for every segment.

### Repository — `src/storage/repositories/mares.test.ts` (extend or create)

- `createMare` persists `isRecipient: false` and `isRecipient: true` and round-trips through `getMareById`.
- `updateMare` can toggle `isRecipient` from false → true and true → false.
- `listMares` returns the correct boolean for each mare.

### Migration — `src/storage/migrations/index.test.ts`

- After applying migrations, the `mares` table has column `is_recipient` with default `0`.
- A mare row inserted before migration023 has `is_recipient = 0` after upgrade.

### Screen (Jest + RNTL)

**`EditMareScreen.screen.test.tsx`:**
- Recipient checkbox renders on create.
- Toggling the checkbox and submitting calls `createMare` with `isRecipient: true`.
- On edit, checkbox reflects the mare's current value.
- Toggling on edit and submitting calls `updateMare` with the new value.

**`HomeScreen` screen test (extend existing):**
- Segmented control renders with three segments, defaulting to `All`.
- Switching to `Breeding` hides recipient mares.
- Switching to `Recipients` hides breeding mares.
- Recipient badge appears next to recipient mares in `All` view.
- Recipient badge does not appear in `Breeding` or `Recipients` views.

**`MareDetailScreen.screen.test.tsx`:**
- Recipient badge renders in header when `mare.isRecipient` is true.
- Recipient badge absent otherwise.

## Files Touched

**New**
- `src/utils/mareFilters.ts`
- `src/utils/mareFilters.test.ts`

**Modified**
- `src/models/types.ts` — add `isRecipient` to `Mare`
- `src/storage/migrations/index.ts` — add migration023
- `src/storage/migrations/index.test.ts` — assert column + default
- `src/storage/repositories/mares.ts` — thread through create/update/select
- `src/storage/repositories/mares.test.ts` (new or extend) — CRUD round-trip
- `src/hooks/useEditMareForm.ts` — add `isRecipient` state + setter
- `src/screens/EditMareScreen.tsx` — add `FormField` + `FormCheckbox`
- `src/screens/EditMareScreen.screen.test.tsx` — checkbox behavior
- `src/screens/HomeScreen.tsx` — segmented control + filter wiring + badge
- `src/screens/HomeScreen.screen.test.tsx` (or equivalent) — segment + badge behavior
- `src/screens/MareDetailScreen.tsx` — recipient badge in header
- `src/screens/MareDetailScreen.screen.test.tsx` — recipient badge render
- `src/utils/devSeed.ts` — set `isRecipient: false` on seeded mares (or `true` on one demo mare for manual QA)

**Also check:** any backup/restore serialization code (`src/storage/backup/*`) that enumerates mare fields — if it uses explicit field lists rather than `SELECT *`, add `is_recipient` there as well.

## Open Risks / Notes

- Backup/restore: verify the mare serializer either selects all columns or is updated to include `is_recipient`. Missing this would silently drop the flag on restore.
- Dev seed data: consider marking one seeded mare as a recipient so manual QA can exercise the filter + badge without needing to create new records.
- Segment control visibility: if the home list is empty entirely (no mares at all), the segmented control can still render — it's harmless and keeps UI stable. Alternatively hide when total mare count is zero. Defer to implementation judgment.
