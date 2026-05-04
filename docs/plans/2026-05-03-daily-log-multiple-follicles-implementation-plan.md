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
- label rows as `Follicle A`, `Follicle B`, etc. only within the current edit session
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
- `src/utils/follicleMeasurements.ts`
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
  - Must wait until Worker A's Step 2 hook-state changes are merged or otherwise stable, because `DailyLogWizardScreen` and `OvaryStep` depend on the new follicle-finding handler contract.
- **Reviewer agent, optional after implementation**
  - Reviews the final diff for mismatches against the design spec, especially data-loss behavior around `MSF` / `AHF` / `CL`.

Do not start workers until Step 1 is complete and committed or otherwise stable. Do not start Worker B until Step 2 is also complete. The helper API plus hook public API are the coordination points.

## Delivery Strategy

Implement in five waves:

1. Foundation helpers and tests.
2. Wizard state and payload behavior.
3. Ovary step UI.
4. Review/read display cleanup.
5. Verification and final review.

The safest order is contract-first: establish finding mapping and measurement sorting before the screen starts using them.

### Compatibility Decisions

- Hydration and rendering must never hide existing primary finding structures. The UI selector value is derived from the draft at render time; it is not stored as separate wizard state.
- Existing records with multiple primary finding structures are legacy-compatible but not newly creatable. They should render with the selector unset and the primary structures hidden from additional chips, then preserve all primary structures if the user makes a no-op edit.
- When multiple legacy primary finding structures exist, the edit UI must still make those values visible as a read-only legacy summary near `Follicle Finding` until the user explicitly chooses a new primary finding.
- Once the user explicitly changes `Follicle Finding`, the app normalizes to a single selected primary finding or measured rows.
- Leaving `Measured` clears measurement rows immediately with no confirmation in v1. This follows the design's locked decision; tests must make the destructive branch explicit so it cannot happen accidentally.
- Edit-session row order is preserved while typing. Saved payloads are sorted descending, so after save and reload the editing labels can re-bind to sorted values. `Follicle A/B/C` are only transient row labels, never identifiers.
- `FollicleState` and `OvaryStructure` remain independent domain concepts. The new selector maps `MSF`, `AHF`, and `CL` through `OvaryStructure`; `FollicleState` should only be set to `'measured'` in the new flow.

## Step-by-Step Plan

### Step 1: Add shared finding and measurement helpers

**Owner:** Main agent
**Files:**

- Modify: `src/hooks/dailyLogWizard/types.ts`
- Modify: `src/hooks/dailyLogWizard/measurementUtils.ts`
- Create: `src/utils/follicleMeasurements.ts`
- Create or modify tests near `measurementUtils` and `src/utils/follicleMeasurements.test.ts`

**Implementation:**

1. Add a UI-level finding type:

   ```ts
   export type DailyLogWizardFollicleFinding = '' | 'measured' | 'msf' | 'ahf' | 'cl';
   ```

2. Define primary structure constants:

   - `multipleSmallFollicles`
   - `hemorrhagicAnovulatoryFollicle`
   - `corpusLuteum`

3. Add neutral measurement helpers in `src/utils/follicleMeasurements.ts`:

   - `sortMeasurementsDesc(values: readonly number[]): number[]`

4. Add wizard-specific finding helpers in `src/hooks/dailyLogWizard/measurementUtils.ts`:

   - `getOvaryFollicleFinding(draft: DailyLogWizardOvaryDraft): DailyLogWizardFollicleFinding`
   - `isPrimaryFindingStructure(value: OvaryStructure): boolean`
   - `removePrimaryFindingStructures(values: readonly OvaryStructure[]): OvaryStructure[]`
   - `getPrimaryFindingStructure(finding: DailyLogWizardFollicleFinding): OvaryStructure | null`

5. Preserve duplicate measurements when sorting.
6. Do not mutate caller arrays.
7. Keep the sort helper out of `src/hooks/dailyLogWizard/*` so read-surface utilities do not depend on wizard internals.
8. Define `getOvaryFollicleFinding` behavior exactly:
   - `follicleState === 'measured'` returns `'measured'`, even if stale primary structures also exist.
   - exactly one primary structure returns its mapped finding.
   - zero primary structures returns `''`.
   - multiple primary structures returns `''` so no single selector value is falsely shown; preservation is handled by no-op draft state.

**Acceptance criteria:**

- Helper tests cover descending sort, duplicates, empty arrays, primary structure filtering, and finding derivation.
- Helper tests cover `[multipleSmallFollicles] -> 'msf'`, `[hemorrhagicAnovulatoryFollicle] -> 'ahf'`, `[corpusLuteum] -> 'cl'`, no primary structures -> unset, measured-with-stale-primary -> `measured`, and multi-primary legacy structures -> unset without mutation.
- Helper names make it clear that `MSF`, `AHF`, and `CL` are UI findings backed by `OvaryStructure`.
- `src/utils/follicleMeasurements.ts` has no imports from hooks, screens, or storage.

**Suggested verification:**

```bash
npm test -- src/utils/follicleMeasurements.test.ts
npm test -- src/hooks/dailyLogWizard/measurementUtils.test.ts
```

### Step 1.5: Pin hydration and current-selector derivation

**Owner:** Main agent
**Files:**

- Modify: `src/hooks/dailyLogWizard/mappers.test.ts`
- Check: `src/hooks/dailyLogWizard/mappers.ts`
- Check: `src/screens/daily-log-wizard/OvaryStep.tsx`

**Implementation:**

1. Keep `hydrateDailyLogWizardRecord` as a domain-draft hydrator. It should preserve `structures` and `follicleMeasurements` exactly as stored, apart from existing row-id formatting.
2. Do not drop or normalize primary finding structures during hydration.
3. Document through tests that current selector derivation happens by calling `getOvaryFollicleFinding(ovary)` where the UI renders, not by adding a persisted or hydrated selector field.
4. Add hydration/derivation tests for:
   - `structures = ['multipleSmallFollicles']` derives `MSF`.
   - `structures = ['multipleSmallFollicles', 'corpusLuteum']` remains preserved in the hydrated draft and derives unset.
   - `structures = ['follicularCyst', 'multipleSmallFollicles']` derives `MSF` while keeping `follicularCyst` available for the additional-structure chip list.
   - `follicleState = 'measured'` with stale primary structures derives `Measured`.

**Acceptance criteria:**

- Existing `MSF`, `AHF`, and `CL` records are visible through the new selector when a single primary structure exists.
- Legacy multi-primary records are not silently rewritten on hydration or no-op save.
- No extra selector field is persisted or added to backup shape.

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
6. Replace tests that call `setOvaryFollicleSize` with the row-based handlers and `setOvaryFollicleFinding`.
7. Keep `setOvaryFollicleSize` only inside an intermediate local diff if needed while Step 4 is unfinished; do not ship the final branch with this public hook API.

**Acceptance criteria:**

- Selecting measured seeds exactly one row only when no rows exist.
- Removing the final row is allowed.
- Switching away from measured clears rows immediately.
- Selecting one primary finding removes other primary finding structures.
- Existing additional structures remain when switching primary finding unless they are one of the primary structures.
- `setOvaryFollicleFinding('ahf')` on `structures = ['follicularCyst', 'multipleSmallFollicles']` produces `['follicularCyst', 'hemorrhagicAnovulatoryFollicle']`.
- Switching from `Measured` to `MSF`, `AHF`, `CL`, or unset clears measurement rows immediately and the test name/case makes this destructive behavior explicit.

**Suggested verification:**

```bash
npm run test:screen -- src/hooks/useDailyLogWizard.screen.test.tsx
```

### Step 3: Sort payload measurements before persistence

**Owner:** Worker A
**Files:**

- Modify: `src/hooks/dailyLogWizard/mappers.ts`
- Modify: `src/hooks/dailyLogWizard/mappers.test.ts`
- Modify: `src/hooks/dailyLogWizard/validation.test.ts`
- Modify: `src/storage/repositories/dailyLogs.test.ts`

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
   - repository create-or-update plus read-back round-trips multiple sorted values through SQLite JSON serialization

**Acceptance criteria:**

- Saved payloads no longer depend on edit row order.
- Existing validation behavior remains intact.
- At least one repository test proves multiple values survive the storage path, not just the mapper payload.

**Suggested verification:**

```bash
npm test -- src/hooks/dailyLogWizard/mappers.test.ts src/hooks/dailyLogWizard/validation.test.ts
npm test -- src/storage/repositories/dailyLogs.test.ts
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
7. Add an `Add Follicle` action below the rows with an explicit accessibility label or accessible text.
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
11. Compute the displayed selector value with `getOvaryFollicleFinding(ovary)` inside `OvaryStep` or immediately before passing props to it.
12. When multiple primary finding structures exist, show a read-only legacy summary near `Follicle Finding` that lists the existing primary findings before they are normalized.
13. Give the `Follicle Finding` selector explicit accessibility treatment consistent with existing form controls.

**Acceptance criteria:**

- The ovary step no longer uses `setOvaryFollicleSize`.
- Measurement rows do not reorder while typing.
- `Add Follicle` appends a blank row.
- Remove works for any row, including the last row.
- `MSF`, `AHF`, and `CL` appear only in `Follicle Finding`, not in `Additional Structures`.
- A legacy single-primary structure record displays the matching selector value instead of appearing blank.
- Legacy records with one primary plus one additional structure display the selector value and keep the additional structure chip visible.
- Legacy records with multiple primary structures display the selector as unset and show the existing primary findings in a read-only legacy summary.
- A screen or component test covers the multi-primary legacy display so preserved data is visible before explicit normalization.

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
6. Remove `singleFollicleSize: true` from both ovary review calls and delete the `singleFollicleSize` branch if no longer needed.
7. Parse measurement row strings to valid numeric values, pass them through `sortMeasurementsDesc` from `src/utils/follicleMeasurements.ts`, then format display text. Do not sort raw strings.
8. Keep the primary finding display behavior explicit:
   - measured values show under `Follicles`
   - `MSF`, `AHF`, and `CL` may continue to appear through the existing structure-label summary
   - additional structure chips may also appear in the summary, but the implementation must not depend on duplicate primary chips being visible in the edit UI

**Acceptance criteria:**

- Review text for measured values is stable regardless of edit row order.
- Review does not imply persisted follicle identity labels.
- Review no longer has a single-follicle-only formatting path.

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
- Remove obsolete `setOvaryFollicleSize` from `useDailyLogOvaryState`, `useDailyLogWizard`, tests, and screen mocks. If a caller still needs it, document the exact caller and why it is intentionally supported before shipping.
- Update tests if final helper names differ from this plan.

**Implementation:**

1. Run `rg` to verify old single-field and bypass wiring is gone:

   ```bash
   rg -n "setOvaryFollicleSize|onFollicleSizeChange|setOvaryFollicleState|onFollicleStateChange|FOLLICLE_STATE_OPTIONS|Follicle Size|follicleSizeValue|singleFollicleSize" src/
   ```

2. Run a broader semantics check for old single-measurement assumptions:

   ```bash
   rg -n "follicleMeasurements\\[0\\]|single follicle|single-follicle" src/
   ```

3. Confirm `MSF`, `AHF`, and `CL` are not duplicated between the primary selector and additional structures.
4. Confirm no migration or backup files changed unless a later code finding proves the design assumption wrong.
5. Confirm no persisted label field was introduced.

**Acceptance criteria:**

- Source diff matches the design scope.
- No schema or backup churn appears in the diff.
- No implementation implies cross-log follicle tracking.
- Old single-size hook/screen APIs are either deleted or explicitly justified.
- PR notes mention that changing away from `Measured` clears measured rows and that `MSF`, `AHF`, and `CL` moved into `Follicle Finding`.

### Step 8: Verification

**Owner:** Main agent, with optional reviewer agent after tests pass
**Commands:**

Run focused tests first:

```bash
npm test -- src/hooks/dailyLogWizard/mappers.test.ts src/hooks/dailyLogWizard/validation.test.ts src/utils/dailyLogDisplay.test.ts
npm test -- src/storage/repositories/dailyLogs.test.ts
npm run test:screen -- src/hooks/useDailyLogWizard.screen.test.tsx src/screens/DailyLogFormScreen.screen.test.tsx src/screens/mare-detail/DailyLogsTab.screen.test.tsx
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
  -> Step 1.5 hydration/selector derivation
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
- **Legacy primary finding invisibility:** old `MSF`, `AHF`, or `CL` chip data could disappear from the edit UI if selector derivation is not wired. Mitigation: Step 1.5 tests and Step 4 acceptance criteria require visible selector hydration for single-primary records.
- **Hidden data clearing:** leaving `Measured` intentionally clears measurements without confirmation in v1. Mitigation: tests must assert this behavior so it is deliberate rather than accidental, and release notes should call out that changing the finding replaces measured rows.
- **Row label confusion:** `Follicle A/B/C` labels are transient and can re-bind after save/reload because persisted values are sorted. Mitigation: keep labels out of review and read surfaces and do not present them as identifiers.
- **Unbounded rows:** many rows can make the ovary step long. Mitigation: compact row UI and no artificial cap.
- **Validation copy specificity:** multi-row validation can otherwise report a vague single-row error. Mitigation: keep per-row error display near the invalid input where the current UI supports it, and update validation or screen copy if the existing error reads as a single-field-only message.
- **Release perception risk:** users editing older logs may see `MSF`, `AHF`, and `CL` move from structure chips into `Follicle Finding`. Mitigation: mention the control split in release notes or PR notes.

## Done Definition

- User can enter multiple measured follicle rows on either ovary.
- User can add and remove rows, including removing all rows temporarily.
- Save blocks measured ovaries with no valid measurement.
- Saved and displayed measurements sort largest-to-smallest.
- `MSF`, `AHF`, and `CL` are mutually exclusive with measured rows.
- No schema, backup, or persisted-label changes are introduced.
- Focused tests and full quality gates pass.
