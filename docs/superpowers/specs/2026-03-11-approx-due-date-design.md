# Approximate Due Date on Pregnancy Check Form

**Date:** 2026-03-11
**Status:** Approved

## Summary

Add an "Approx. due date" line to the info box on PregnancyCheckFormScreen, directly below the existing "Days post breeding" row.

## Display Conditions

The due date line appears only when all three conditions are met:

1. A breeding record is selected
2. Result is "Positive"
3. Heartbeat detected is "Yes"

When any condition is not met, the line is hidden entirely (not shown with a dash or placeholder).

## Calculation

Breeding date + 340 days (standard equine gestation average).

A utility function `calculateApproxDueDate(breedingDate: LocalDate): LocalDate` computes this. It takes the breeding date, adds 340 days, and returns the result as a `YYYY-MM-DD` LocalDate string.

## Display Format

```
Approx. due date: MM-DD-YYYY
```

Uses the app's existing `MM-DD-YYYY` display format convention (via `formatLocalDate`).

## Code Changes

### `src/models/types.ts`
- Add `calculateApproxDueDate(breedingDate: LocalDate): LocalDate` function
- Uses `fromLocalDate` to parse, adds 340 days, returns `toLocalDate` result

### `src/screens/PregnancyCheckFormScreen.tsx`
- Add a `useMemo` that calls `calculateApproxDueDate` when a breeding record is selected
- Conditionally render the info row only when result is positive AND heartbeat is "Yes"
- Place the row directly below the "Days post breeding" row in the info box

### Tests
- Unit test for `calculateApproxDueDate` verifying correct 340-day addition
- Test edge cases: leap year crossing, year boundary crossing

## What This Does NOT Include

- No configurable gestation length (possible future enhancement)
- No date range display
- No schema or migration changes
- No new dependencies
