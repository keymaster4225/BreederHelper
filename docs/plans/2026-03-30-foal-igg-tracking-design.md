# Foal IgG Tracking -- Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Summary

Add numeric IgG test recording to the foal form. When the "IgG Tested" milestone checkbox is toggled ON, an inline expandable section drops down showing IgG test entries. Each test records a date, numeric value (mg/dL), and auto-derives an interpretation from standard thresholds. Multiple tests per foal are supported (initial + retests after plasma treatment). The latest IgG result displays as a badge on foaling tab cards. A dashboard alert prompts breeders when a new foal has no IgG test recorded.

## Motivation

The current foal form tracks "IgG Tested" as a simple boolean milestone -- it records that testing occurred but not the result. Breeders need to record actual IgG values to track passive transfer status, decide on plasma treatment, and verify improvement after retesting. This is a critical newborn foal health metric.

## IgG Interpretation Thresholds

| Value (mg/dL) | Interpretation | Badge Color |
|----------------|-----------------|-------------|
| >= 800 | Adequate | Green |
| 400 -- 799 | Partial Failure | Orange |
| < 400 | Complete Failure | Red |

These are standard equine neonatal thresholds. Auto-derived from the numeric value -- the user enters only the number.

## Data Model

### New Type: `IggTest`

```typescript
interface IggTest {
  date: ISODate;           // YYYY-MM-DD, defaults to today on creation
  valueMgDl: number;       // positive integer, the test result
  recordedAt: ISODateTime; // auto-set when entry is created
}

type IggInterpretation = 'adequate' | 'partialFailure' | 'completeFailure';
```

### Foal Type Extension

Add `iggTests: IggTest[]` to the `Foal` interface (defaults to `[]`).

### Database Migration (007)

```sql
ALTER TABLE foals ADD COLUMN igg_tests TEXT NOT NULL DEFAULT '[]';
```

Stored as JSON array, following the same pattern as the existing `milestones` column. Parsed/validated on read, serialized on write.

## UI Changes

### 1. FoalFormScreen -- Expandable IgG Section

When the "IgG Tested" milestone checkbox is toggled ON:
- An expandable section slides down immediately below the checkbox
- Shows existing IgG test entries in a vertical list (newest first)
- Each entry displays:
  - Date (date input, defaults to today)
  - Value in mg/dL (numeric input, positive integer)
  - Status badge (colored per threshold table above)
  - Delete button (trash icon)
- "Add Test" button at the bottom of the list
- New entries start with today's date and empty value field

When "IgG Tested" is toggled OFF:
- Section collapses/hides
- Test data is preserved (not deleted) -- toggling back ON reveals it again

Validation:
- Value must be a positive number (> 0)
- Date is required (defaults to today)
- At least one test must be complete (have a value) if the section is visible, OR the section can be empty if the user hasn't entered results yet

### 2. FoalingTab Card -- IgG Badge

On the foal summary area within each foaling record card (for live foals with IgG tests):
- Show the latest IgG result as a compact badge: "IgG: [value] [interpretation]"
- Color-coded per threshold table (green/orange/red)
- Only displays when at least one IgG test exists
- Position: below the foal name/sex/color line

### 3. Dashboard Alert -- Foal Needs IgG Test

New alert type in `dashboardAlerts.ts`:
- **Trigger:** Foal exists (linked to a live-foal foaling record) AND has zero IgG tests AND the foaling record date is within the last 48 hours
- **Message:** "Foal from [Mare Name] needs IgG test"
- **Navigation:** Tapping navigates directly to the FoalForm screen (with `mareId`, `foalingRecordId`, `foalId` params)
- **Auto-dismiss:** Alert disappears once any IgG test is recorded for that foal

## Files to Modify

| File | Change |
|------|--------|
| `src/models/types.ts` | Add `IggTest`, `IggInterpretation` types; add `iggTests` to `Foal` |
| `src/storage/migrations/index.ts` | Migration 007: add `igg_tests` column to `foals` |
| `src/storage/repositories/queries.ts` | Update `mapFoalRow` to parse `igg_tests`; update `createFoal`/`updateFoal` to serialize; add `listAllFoals` bulk query |
| `src/screens/FoalFormScreen.tsx` | Expandable IgG section below "IgG Tested" checkbox |
| `src/screens/mare-detail/FoalingTab.tsx` | IgG badge on foal summary card |
| `src/utils/dashboardAlerts.ts` | Extend `DashboardInput` with `foals` field; add `foalNeedsIgg` alert kind (priority: high); add `AlertKind` union member |
| `src/components/AlertCard.tsx` | Handle navigation for new `foalNeedsIgg` alert type |
| `src/screens/HomeScreen.tsx` | Call `listAllFoals` bulk query; pass foals into `DashboardInput`; handle `foalNeedsIgg` alert navigation to FoalForm |
| `src/navigation/AppNavigator.tsx` | Ensure FoalForm route params include `foalId` for direct nav from alert |
| **New:** `src/utils/igg.ts` | `interpretIgg()`, `formatIggInterpretation()`, threshold constants |

## Testing

- `src/utils/igg.test.ts` -- Unit tests for `interpretIgg()`:
  - Boundary values: 399, 400, 799, 800
  - Typical values: 200, 600, 1000
- `src/utils/dashboardAlerts.test.ts` -- Add tests for IgG alert generation:
  - Foal with no IgG tests within 48h window -> alert
  - Foal with IgG tests -> no alert
  - Foal older than 48h -> no alert
  - Non-live-foal outcomes -> no alert

## Edge Cases

- **IgG Tested unchecked after tests entered:** Test data preserved, section hidden. Re-checking reveals them.
- **Migration on existing data:** All existing foals get `igg_tests = '[]'` (empty array). No data loss.
- **Foal form loaded pre-migration:** `igg_tests` column has DEFAULT so existing rows are safe.
- **Value input:** Constrained to positive integers. No upper bound enforced (lab values can vary).
- **Multiple tests same date:** Allowed (e.g., morning test + evening retest).
- **Alert priority:** The `foalNeedsIgg` alert has `high` priority (IgG testing is time-sensitive in the first 24-48 hours).
- **Bulk query pattern:** A new `listAllFoals` query is needed (matching the existing `listAllDailyLogs`/`listAllBreedingRecords` pattern) to avoid N+1 queries on the HomeScreen.
- **`recordedAt` pattern:** `IggTest.recordedAt` follows the same auto-set-on-creation pattern as milestone `recordedAt`.
