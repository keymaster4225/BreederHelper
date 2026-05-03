# Daily Log Multiple Follicles Per Ovary - Implementation Plan

**Date:** 2026-05-03  
**Status:** Ready for implementation review  
**Source Spec:** `docs/plans/2026-05-03-daily-log-multiple-follicles-design.md`  
**Roadmap Item:** `P1 - Multiple measured follicles per ovary in daily logs`

## Goal

Expose the existing multi-measurement ovary model through the daily log wizard so a single ovary can record multiple measured follicles in one exam.

The finished app should:

- let each ovary choose a clearable `Follicle Finding`
- support `Measured`, `MSF`, `AHF`, and `CL` as mutually exclusive primary findings
- show repeatable measured-follicle rows when `Measured` is selected
- label rows as `Follicle A`, `Follicle B`, etc. only while editing
- allow blank / zero rows temporarily during editing
- block save when `Measured` has no valid measurement
- preserve duplicate values
- sort measurements largest-to-smallest for review, persistence, and read display
- avoid schema, backup, and migration changes

## Repo Fit

This plan is grounded in the current codebase:

- `DailyLogWizardOvaryDraft.follicleMeasurements` is already an array.
- `buildDailyLogPayload` already reads multiple measurement rows.
- `dailyLogs.ts` serializes `rightOvaryFollicleMeasurementsMm` and `leftOvaryFollicleMeasurementsMm` as JSON arrays.
- `dailyLogDisplay.ts` and mare detail cards already render multiple stored measurements.
- The current UI bottleneck is `OvaryStep`, which reads and writes only `follicleMeasurements[0]` through `setOvaryFollicleSize`.

Primary implementation areas:

- `src/hooks/dailyLogWizard/types.ts`
- `src/hooks/dailyLogWizard/measurementUtils.ts`
- `src/hooks/dailyLogWizard/useDailyLogOvaryState.ts`
- `src/hooks/dailyLogWizard/mappers.ts`
- `src/hooks/dailyLogWizard/validation.ts`
- `src/hooks/useDailyLogWizard.ts`
- `src/screens/DailyLogWizardScreen.tsx`
- `src/screens/daily-log-wizard/OvaryStep.tsx`
- `src/screens/daily-log-wizard/ReviewStep.tsx`
- `src/utils/dailyLogDisplay.ts`
- focused tests under `src/hooks`, `src/screens`, and `src/utils`

## Non-Goals

- No SQLite migration.
- No backup schema change.
- No persisted follicle labels.
- No cross-day follicle identity tracking.
- No ovulation-detection behavior change.
- No redesign of the full daily log wizard.

## Sub-Agent Strategy

Use sub-agents only after the foundation contracts are clear. The work is small enough for one engineer, but two implementation workers are prudent once shared helper APIs exist.

- **Main agent ownership:** foundation types/helpers, final integration, conflict resolution, and quality gates.
- **Worker A: hook and mapper implementation**
  - Owns `src/hooks/dailyLogWizard/*`, `src/hooks/useDailyLogWizard.ts`, and hook/mapper/validation tests.
  - Must not edit screen files.
- **Worker B: UI and display implementation**
  - Owns `src/screens/DailyLogWizardScreen.tsx`, `src/screens/daily-log-wizard/*`, `src/utils/dailyLogDisplay.ts`, and screen/display tests.
  - Must consume the helper APIs created by the main agent / Worker A instead of inventing duplicate mapping logic.
- **Reviewer agent, optional after implementation**
  - Reviews the final diff for mismatches against the design spec, especially data-loss behavior around `MSF` / `AHF` / `CL`.

Do not start workers until Step 1 is complete and committed or otherwise stable. The helper API is the coordination point.

## Delivery Strategy

Implement in five waves:

1. Foundation helpers and tests.
2. Wizard state and payload behavior.
3. Ovary step UI.
4. Review/read display cleanup.
5. Verification and final review.

The safest order is contract-first: establish finding mapping and measurement sorting before the screen starts using them.

## Step-by-Step Plan

### Step 1: Add shared finding and measurement helpers

**Owner:** Main agent  
**Files:**

- Modify: `src/hooks/dailyLogWizard/types.ts`
- Modify: `src/hooks/dailyLogWizard/measurementUtils.ts`
- Create or modify tests near `measurementUtils`

**Implementation:**

1. Add a UI-level finding type:

   ```ts
   export type DailyLogWizardFollicleFinding = '' | 'measured' | 'msf' | 'ahf' | 'cl';
   ```

2. Define primary structure constants:

   - `multipleSmallFollicles`
   - `hemorrhagicAnovulatoryFollicle`
   - `corpusLuteum`

3. Add helpers:

   - `sortMeasurementsDesc(values: readonly number[]): number[]`
   - `getOvaryFollicleFinding(draft: DailyLogWizardOvaryDraft): DailyLogWizardFollicleFinding`
   - `isPrimaryFindingStructure(value: OvaryStructure): boolean`
   - `removePrimaryFindingStructures(values: readonly OvaryStructure[]): OvaryStructure[]`
   - `getPrimaryFindingStructure(finding: DailyLogWizardFollicleFinding): OvaryStructure | null`

4. Preserve duplicate measurements when sorting.
5. Do not mutate caller arrays.

**Acceptance criteria:**

- Helper tests cover descending sort, duplicates, empty arrays, primary structure filtering, and finding derivation.
- Helper names make it clear that `MSF`, `AHF`, and `CL` are UI findings backed by `OvaryStructure`.

**Suggested verification:**

```bash
npm test -- src/hooks/dailyLogWizard/measurementUtils.test.ts
```

### Step 2: Update wizard ovary state handlers

**Owner:** Worker A after Step 1, or main agent if working solo  
**Files:**

- Modify: `src/hooks/dailyLogWizard/useDailyLogOvaryState.ts`
- Modify: `src/hooks/useDailyLogWizard.ts`
- Modify: `src/hooks/useDailyLogWizard.screen.test.tsx`

**Implementation:**

1. Add `setOvaryFollicleFinding(side, finding)`.
2. When finding is `measured`:
   - set `follicleState = 'measured'`
   - remove primary finding structures from `structures`
   - seed one empty measurement row if there are no rows
3. When finding is `msf`, `ahf`, or `cl`:
   - set `follicleState = null`
   - clear `follicleMeasurements`
   - remove any existing primary finding structures
   - add the selected primary structure
4. When finding is unset:
   - set `follicleState = null`
   - clear `follicleMeasurements`
   - remove primary finding structures
5. Keep row editing order stable:
   - `addOvaryMeasurement` appends
   - `updateOvaryMeasurement` edits in place
   - `removeOvaryMeasurement` removes only the target row
6. Keep `setOvaryFollicleSize` temporarily if tests or older call sites still use it during the transition, but remove screen usage from it in Step 4.

**Acceptance criteria:**

- Selecting measured seeds exactly one row only when no rows exist.
- Removing the final row is allowed.
- Switching away from measured clears rows immediately.
- Selecting one primary finding removes other primary finding structures.
- Existing additional structures remain when switching primary finding unless they are one of the primary structures.

**Suggested verification:**

```bash
npm test -- src/hooks/useDailyLogWizard.screen.test.tsx
```

### Step 3: Sort payload measurements before persistence

**Owner:** Worker A  
**Files:**

- Modify: `src/hooks/dailyLogWizard/mappers.ts`
- Modify: `src/hooks/dailyLogWizard/mappers.test.ts`
- Modify: `src/hooks/dailyLogWizard/validation.test.ts`

**Implementation:**

1. Use `sortMeasurementsDesc` after `collectValidMeasurements`.
2. Assign sorted arrays to:
   - `rightOvaryFollicleMeasurementsMm`
   - `leftOvaryFollicleMeasurementsMm`
3. Preserve duplicates.
4. Keep measured-only behavior:
   - if `follicleState !== 'measured'`, persist `[]`
5. Add tests for:
   - unsorted input becomes sorted output
   - duplicates survive sorting
   - invalid non-blank rows are still rejected by validation
   - blank-only measured rows fail validation
   - non-measured finding persists no measurement values

**Acceptance criteria:**

- Saved payloads no longer depend on edit row order.
- Existing validation behavior remains intact.

**Suggested verification:**

```bash
npm test -- src/hooks/dailyLogWizard/mappers.test.ts src/hooks/dailyLogWizard/validation.test.ts
```

### Step 4: Update `OvaryStep` UI

**Owner:** Worker B after Steps 1-2 are stable  
**Files:**

- Modify: `src/screens/daily-log-wizard/OvaryStep.tsx`
- Modify: `src/screens/DailyLogWizardScreen.tsx`
- Modify: `src/screens/DailyLogFormScreen.screen.test.tsx`

**Implementation:**

1. Replace the single `Follicle Size` field with a clearable `Follicle Finding` selector.
2. Use options:
   - `Measured`
   - `MSF`
   - `AHF`
   - `CL`
3. Show repeatable measurement rows only when finding is `measured`.
4. Label visible rows by current edit order:
   - `Follicle A`
   - `Follicle B`
   - `Follicle C`
5. Add one decimal-pad input per row.
6. Add a remove control per row with an accessibility label.
7. Add an `Add Follicle` action below the rows.
8. Rename the structure chip field to `Additional Structures`.
9. Exclude primary finding structures from additional-structure chips:
   - `multipleSmallFollicles`
   - `hemorrhagicAnovulatoryFollicle`
   - `corpusLuteum`
10. Wire props from `DailyLogWizardScreen`:
    - `onFollicleFindingChange`
    - `onAddMeasurement`
    - `onUpdateMeasurement`
    - `onRemoveMeasurement`

**Acceptance criteria:**

- The ovary step no longer uses `setOvaryFollicleSize`.
- Measurement rows do not reorder while typing.
- `Add Follicle` appends a blank row.
- Remove works for any row, including the last row.
- `MSF`, `AHF`, and `CL` appear only in `Follicle Finding`, not in `Additional Structures`.

**Suggested verification:**

```bash
npm run test:screen -- src/screens/DailyLogFormScreen.screen.test.tsx
```

### Step 5: Update review display

**Owner:** Worker B  
**Files:**

- Modify: `src/screens/daily-log-wizard/ReviewStep.tsx`
- Modify or add relevant screen tests if current coverage asserts ovary review text

**Implementation:**

1. Format measured ovaries as sorted values only.
2. Do not show `Follicle A/B/C` labels in review.
3. Do not show redundant `Measured` state when values exist.
4. Continue showing `MSF`, `AHF`, and `CL` by their existing display labels when selected.
5. Preserve legacy notes behavior.

**Acceptance criteria:**

- Review text for measured values is stable regardless of edit row order.
- Review does not imply persisted follicle identity labels.

### Step 6: Update read-surface display

**Owner:** Worker B  
**Files:**

- Modify: `src/utils/dailyLogDisplay.ts`
- Modify: `src/utils/dailyLogDisplay.test.ts`
- Check: `src/screens/mare-detail/DailyLogsTab.screen.test.tsx`

**Implementation:**

1. Sort measurement arrays descending inside `buildOvarySummary` and `buildOvaryDetailLines`.
2. Preserve duplicates.
3. Keep label `Follicles` for measured values.
4. Continue falling back to legacy ovary notes when no structured ovary data exists.

**Acceptance criteria:**

- Mare detail cards display sorted measurements defensively.
- Duplicate values display rather than collapse.
- Existing legacy-note tests still pass.

**Suggested verification:**

```bash
npm test -- src/utils/dailyLogDisplay.test.ts
npm run test:screen -- src/screens/mare-detail/DailyLogsTab.screen.test.tsx
```

### Step 7: Integration pass

**Owner:** Main agent  
**Files:**

- Review all touched files.
- Remove obsolete `setOvaryFollicleSize` only if no tests or call sites need it.
- Update tests if final helper names differ from this plan.

**Implementation:**

1. Run `rg` to verify old single-field wiring is gone from screen code:

   ```bash
   rg -n "setOvaryFollicleSize|onFollicleSizeChange|Follicle Size" src/screens src/hooks
   ```

2. Confirm `MSF`, `AHF`, and `CL` are not duplicated between the primary selector and additional structures.
3. Confirm no migration or backup files changed unless a later code finding proves the design assumption wrong.
4. Confirm no persisted label field was introduced.

**Acceptance criteria:**

- Source diff matches the design scope.
- No schema or backup churn appears in the diff.
- No implementation implies cross-log follicle tracking.

### Step 8: Verification

**Owner:** Main agent, with optional reviewer agent after tests pass  
**Commands:**

Run focused tests first:

```bash
npm test -- src/hooks/dailyLogWizard/mappers.test.ts src/hooks/dailyLogWizard/validation.test.ts src/utils/dailyLogDisplay.test.ts
npm run test:screen -- src/screens/DailyLogFormScreen.screen.test.tsx src/screens/mare-detail/DailyLogsTab.screen.test.tsx
```

Then run full gates:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

**Reviewer-agent prompt, if used:**

> Review the daily-log multiple-follicles implementation against `docs/plans/2026-05-03-daily-log-multiple-follicles-design.md` and `docs/plans/2026-05-03-daily-log-multiple-follicles-implementation-plan.md`. Focus on data-loss risk around primary finding mapping, accidental schema changes, row-order vs sorted-display behavior, validation gaps, and whether the UI implies persisted follicle identity. Return findings with file/line references only; do not edit files.

**Acceptance criteria:**

- All focused and full quality gates pass.
- Reviewer finds no high-severity mismatch with the design.
- Any lower-severity findings are either fixed or explicitly documented before PR.

## Dependency Graph

```text
Step 1 helpers
  -> Step 2 wizard state
  -> Step 3 payload sorting
  -> Step 4 ovary UI
Step 1 helpers
  -> Step 5 review display
  -> Step 6 read display
Steps 2-6
  -> Step 7 integration pass
  -> Step 8 verification
```

## Risks And Mitigations

- **Primary finding mapping:** `MSF`, `AHF`, and `CL` are currently `OvaryStructure` values. Mitigation: centralize UI mapping helpers in Step 1 and keep persisted domain types unchanged.
- **Legacy multi-primary structures:** older logs may have multiple primary structures. Mitigation: preserve no-op edits, but normalize once the user explicitly changes `Follicle Finding`.
- **Hidden data clearing:** leaving `Measured` intentionally clears measurements. Mitigation: tests must assert this behavior so it is deliberate rather than accidental.
- **Row label confusion:** `Follicle A/B/C` labels are transient. Mitigation: keep labels out of review and read surfaces.
- **Unbounded rows:** many rows can make the ovary step long. Mitigation: compact row UI and no artificial cap.

## Done Definition

- User can enter multiple measured follicle rows on either ovary.
- User can add and remove rows, including removing all rows temporarily.
- Save blocks measured ovaries with no valid measurement.
- Saved and displayed measurements sort largest-to-smallest.
- `MSF`, `AHF`, and `CL` are mutually exclusive with measured rows.
- No schema, backup, or persisted-label changes are introduced.
- Focused tests and full quality gates pass.
