# One-Off Stallion on Breeding Record Design

**Date:** 2026-03-01
**Status:** Approved
**Goal:** Allow users to enter a stallion name directly on a breeding record without creating a saved stallion entry.

## Approach

Add an optional `stallion_name` text field to `breeding_records`. Make `stallion_id` nullable. The user picks either a saved stallion (via OptionSelector) or taps "Other" to type a one-off name.

## Schema

New migration (`003_breeding_stallion_name`):
- Add `stallion_name TEXT` column to `breeding_records`
- Make `stallion_id` nullable (requires SQLite table recreation)
- Add `CHECK` constraint: at least one of `stallion_id` or `stallion_name` must be non-null

## Data Model

`BreedingRecord.stallionId` becomes `UUID | null`. New field `stallionName?: string | null`.

Invariant: exactly one of `stallionId` or `stallionName` is set per record.

## UI — BreedingRecordFormScreen

- Existing stallion OptionSelector gets an extra "Other" pill at the end
- Tapping "Other" clears `stallionId`, shows a `FormTextInput` for stallion name
- Tapping any saved stallion pill clears the typed name and hides the text input
- Validation: require either a selected stallion or a non-empty stallion name

## Display — MareDetailScreen

Breeding record cards resolve stallion display as:
- If `stallionId` is set: look up saved stallion name (existing behavior)
- If `stallionName` is set: display it directly

## Files Affected

| File | Changes |
|------|---------|
| `src/storage/migrations/` | New migration + update runner |
| `src/models/types.ts` | `stallionId` optional, add `stallionName` |
| `src/storage/repositories/queries.ts` | Update create/update/read queries |
| `src/screens/BreedingRecordFormScreen.tsx` | "Other" option + text input UI |
| `src/screens/MareDetailScreen.tsx` | Display stallion name from record |
| Tests | Updated for new schema/behavior |
