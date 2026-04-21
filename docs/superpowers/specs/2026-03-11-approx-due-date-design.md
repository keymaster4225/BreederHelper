# Approximate Due Date on Pregnancy Check Form

**Date:** 2026-03-11
**Status:** Approved

## Summary

Add an "Approx. due date" line to the info box on PregnancyCheckFormScreen, directly below the existing "Days post breeding" row.

## Display Conditions

The due date line appears only when both conditions are met:

1. A breeding record is selected
2. Result is "Positive"

When either condition is not met, the line is hidden entirely (not shown with a dash or placeholder).

Heartbeat status does not affect visibility — early pregnancy checks (14-16 days) may not yet have a detectable heartbeat, but the due date is still useful.

## Calculation

Breeding date + the mare's saved gestation length, defaulting to 340 days when the mare uses the standard value.

Reuses the existing `estimateFoalingDate(breedingDate: LocalDate, gestationLengthDays: number): LocalDate` function in `src/models/types.ts`, which adds the mare's gestation length to the breeding date.

## Display Format

```
Approx. due date: MM-DD-YYYY
```

Uses the app's existing `MM-DD-YYYY` display format convention (via `formatLocalDate`).

## Code Changes

### `src/screens/PregnancyCheckFormScreen.tsx`
- Import `estimateFoalingDate` from `@/models/types` and `formatLocalDate` from `@/utils/dates`
- Add a `useMemo` that calls `estimateFoalingDate` when a breeding record is selected
- Conditionally render the info row only when result is "Positive"
- Place the row directly below the "Days post breeding" row in the existing info view

### Tests
- Unit test for `estimateFoalingDate` (if not already covered) verifying correct mare-specific gestation-length addition
- Test edge cases: leap year crossing, year boundary crossing

## What This Does NOT Include

- No configurable gestation length (possible future enhancement)
- No date range display
- No schema or migration changes
- No new dependencies
