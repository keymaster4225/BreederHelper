# Daily Log Multiple Follicles Per Ovary - Design

**Date:** 2026-05-03  
**Status:** Draft, locally reviewed  
**Roadmap Item:** `P1 - Multiple measured follicles per ovary in daily logs` (Theme: Mare care depth)  
**Source:** `TODO:27`, `ROADMAP.md` section `Mare care depth`

## Goal

BreedWise should let a daily log record multiple measured follicles on the same ovary. The user has seen more than two follicles on one ovary before, so this should not be capped at two. The workflow should remain fast for the common 1-4 follicle case while allowing more rows when needed.

This is primarily a daily-log wizard UX and mapper change. The current SQLite/domain shape already stores follicle measurements as JSON arrays via:

- `rightOvaryFollicleMeasurementsMm`
- `leftOvaryFollicleMeasurementsMm`

No schema migration is expected for this feature.

## Locked Product Decisions

- Each ovary gets an explicit, clearable `Follicle Finding` selector.
- Supported primary findings in the selector:
  - unset / not entered
  - `Measured`
  - `MSF`
  - `AHF`
  - `CL`
- `Measured` is strictly mutually exclusive with `MSF`, `AHF`, and `CL`.
- When `Measured` is selected, the UI shows a repeatable follicle measurement editor.
- Measurement rows are labeled only while editing: `Follicle A`, `Follicle B`, `Follicle C`, etc.
- Those labels are transient UI labels. They are not persisted, not used for tracking identity, and not shown on saved/read surfaces.
- The edit UI preserves row order while the user types. Rows should not jump around during editing.
- Leaving `Measured` immediately hides and clears measurement rows.
- Zero measurement rows are allowed temporarily during editing.
- Save validation blocks `Measured` unless at least one valid measurement exists.
- Duplicate measurement values are allowed.
- Review, saved payloads, and read surfaces show measurements only, sorted largest to smallest, for example `40, 36.5, 34 mm`.
- Read surfaces do not redundantly display `Measured` when actual measurements exist.

## Repo Fit

Relevant current code:

- Wizard state and public handlers:
  - `src/hooks/dailyLogWizard/types.ts`
  - `src/hooks/dailyLogWizard/useDailyLogOvaryState.ts`
  - `src/hooks/useDailyLogWizard.ts`
- Mapper and validation logic:
  - `src/hooks/dailyLogWizard/mappers.ts`
  - `src/hooks/dailyLogWizard/measurementUtils.ts`
  - `src/hooks/dailyLogWizard/validation.ts`
- Wizard UI:
  - `src/screens/DailyLogWizardScreen.tsx`
  - `src/screens/daily-log-wizard/OvaryStep.tsx`
  - `src/screens/daily-log-wizard/ReviewStep.tsx`
- Read display:
  - `src/utils/dailyLogDisplay.ts`
  - `src/screens/mare-detail/DailyLogsTab.tsx`
- Persistence:
  - `src/storage/repositories/dailyLogs.ts`
  - `src/storage/migrations/index.ts`

Important codebase finding: multiple measurements are already supported below the UI layer. `DailyLogWizardOvaryDraft.follicleMeasurements` is an array, `buildDailyLogPayload` already accepts multiple rows, and repository storage serializes follicle measurement arrays. The current blocker is that `OvaryStep` reads and writes only `follicleMeasurements[0]` through `setOvaryFollicleSize`.

## Data Model Mapping

Do not add persisted follicle labels.

The `Follicle Finding` selector should be implemented as a UI adapter over existing fields rather than a new schema column:

| UI finding | Persisted representation |
| --- | --- |
| unset | `follicleState = null`; no primary finding structure selected |
| `Measured` | `follicleState = 'measured'`; measurement array contains sorted numeric values |
| `MSF` | `follicleState = null`; `structures` includes `multipleSmallFollicles` |
| `AHF` | `follicleState = null`; `structures` includes `hemorrhagicAnovulatoryFollicle` |
| `CL` | `follicleState = null`; `structures` includes `corpusLuteum` |

The existing `OvaryStructure` field contains more than the three primary findings. To avoid duplicate controls, the ovary step should treat these as primary finding structures:

- `multipleSmallFollicles`
- `hemorrhagicAnovulatoryFollicle`
- `corpusLuteum`

The remaining structures can stay in the existing structure chip area, likely renamed to `Additional Structures`:

- `follicularCyst`
- `lutealTissue`
- `adhesion`

## Legacy And Edit Behavior

Existing single-measurement records hydrate as one row and can be expanded.

Existing records with multiple stored measurements hydrate as multiple rows. The editing UI should preserve the stored row order while editing, but review/save/read display should sort values largest to smallest.

Existing records may have primary finding structures because the current UI allows `MSF`, `AHF`, and `CL` as structure chips. Hydration should derive the primary selector from those structures:

- if `follicleState === 'measured'`, show `Measured`
- else if exactly one primary finding structure exists, show that finding
- else if none exists, show unset
- if multiple primary finding structures exist, preserve them on a no-op edit and avoid data loss; once the user changes `Follicle Finding`, write only the newly selected primary finding

That last case is a compatibility guard for old data. The new UI should not allow creating multiple primary findings going forward.

## UI Design

### Ovary step

Each ovary step should render in this order:

1. Ovulation selector, unchanged.
2. `Follicle Finding` selector.
3. Measurement rows, only when `Follicle Finding = Measured`.
4. Consistency selector, unchanged.
5. Additional structures, excluding `MSF`, `AHF`, and `CL`.

The measured editor should:

- show rows labeled `Follicle A`, `Follicle B`, etc.
- use one decimal-pad numeric input per row
- show a remove control per row with an accessibility label such as `Remove Follicle A`
- show an `Add Follicle` action below the rows
- seed one empty row when `Measured` is selected and there are no rows
- allow removing the last row, leaving zero rows temporarily

Use existing form primitives where practical. If a remove control needs an icon, use the app's existing icon library and provide an accessibility label.

### Review step

Review should not show editing-only labels.

For measured ovaries:

- show `Follicles: 40 mm, 36.5 mm, 34 mm`
- sort largest to smallest
- omit `Follicle state: Measured`

For `MSF`, `AHF`, and `CL`, show the existing human-readable structure label.

### Mare detail daily-log cards

Read cards should keep the current collapsible ovary detail pattern. For measured ovaries, display sorted measurements only:

- label: `Follicles`
- value: `40 mm, 36.5 mm, 34 mm`

The detail display should sort defensively instead of assuming stored arrays are already sorted, so older or imported records still read consistently.

## Sorting Rules

Add a small shared helper near existing measurement logic:

- input: readonly number[]
- output: number[] sorted descending
- preserve duplicates
- do not mutate caller arrays

Use it in:

- `buildDailyLogPayload` before assigning `rightOvaryFollicleMeasurementsMm` and `leftOvaryFollicleMeasurementsMm`
- `ReviewStep` before formatting measured rows
- `dailyLogDisplay.ts` before building read-surface measurement text

This keeps persisted values and displayed values consistent without relying on UI row order.

## Validation Rules

Keep the current measurement validation domain:

- valid range: `0` through `100`
- up to one decimal place
- blank rows are ignored
- invalid non-blank rows block save
- duplicate values are allowed
- if `follicleState === 'measured'`, at least one valid measurement is required

The current validation shape in `validateOvary` already mostly matches this. It should be covered by explicit tests for:

- measured with zero rows
- measured with blank-only rows
- measured with multiple valid rows including duplicates
- measured with one invalid row among valid rows
- non-measured finding clears/ignores measurements

## Implementation Plan

### Step 1: Shared finding and measurement helpers

- Add a UI-level finding type for the ovary step, for example `DailyLogWizardFollicleFinding`.
- Add mapping helpers that convert between wizard ovary drafts and the primary finding selector.
- Add a sort helper for measurement values.
- Keep persisted domain types unchanged.

### Step 2: Update ovary state handlers

- Replace or de-emphasize `setOvaryFollicleSize` in favor of row-based handlers already present:
  - `addOvaryMeasurement`
  - `updateOvaryMeasurement`
  - `removeOvaryMeasurement`
- Add a `setOvaryFollicleFinding` handler.
- When selecting `Measured`, set `follicleState = 'measured'`, clear primary finding structures, and seed one empty row if needed.
- When selecting `MSF`, `AHF`, `CL`, or unset, clear `follicleMeasurements` and set `follicleState = null`.
- When selecting one primary structure, remove other primary structures from that ovary.

### Step 3: Update ovary UI

- Replace the single `Follicle Size` field in `OvaryStep` with:
  - `Follicle Finding` selector
  - repeatable measured-row editor when measured
  - `Additional Structures` chips excluding primary finding structures
- Wire row add/update/remove callbacks from `DailyLogWizardScreen`.

### Step 4: Update review and read display

- Update `ReviewStep` to show sorted measurements without editing labels.
- Update `dailyLogDisplay.ts` so mare detail cards sort measurements defensively.
- Preserve existing legacy notes behavior.

### Step 5: Tests

Update or add focused tests:

- `src/hooks/dailyLogWizard/mappers.test.ts`
  - payload sorts measured values descending
  - duplicates are preserved
  - non-measured finding does not persist measurement values
- `src/hooks/dailyLogWizard/validation.test.ts`
  - measured rows require at least one valid value
  - duplicate values pass
- `src/hooks/useDailyLogWizard.screen.test.tsx`
  - selecting measured seeds one row
  - adding/removing rows updates draft state
  - selecting non-measured clears rows
- `src/screens/DailyLogFormScreen.screen.test.tsx`
  - ovary step renders `Follicle Finding`
  - measured selection renders multiple row controls
  - `Add Follicle` calls the row add handler
- `src/utils/dailyLogDisplay.test.ts`
  - read surface sorts measurement values descending
  - duplicate values display
- Existing repository tests should not need schema changes, but at least one repository or mapper test should prove multiple values round-trip through the payload/storage path.

## Verification

Run targeted checks first:

```bash
npm test -- src/hooks/dailyLogWizard/mappers.test.ts src/hooks/dailyLogWizard/validation.test.ts src/utils/dailyLogDisplay.test.ts
npm run test:screen -- src/screens/DailyLogFormScreen.screen.test.tsx
```

Then run the normal quality gates before commit:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

## Risks

- **Primary finding mapping risk:** `MSF`, `AHF`, and `CL` are currently `OvaryStructure` values, not `FollicleState` values. The implementation needs a deliberate UI adapter rather than a naive enum swap.
- **Legacy data risk:** older logs can contain more than one primary finding structure. The plan requires no-op edit preservation until the user explicitly changes the new `Follicle Finding` selector.
- **UX density risk:** unbounded rows can make the ovary step long. The editor should stay compact because the realistic range is usually 1-4 rows.
- **False tracking risk:** `Follicle A/B/C` labels are editing affordances only. Do not imply cross-day follicle identity tracking.

## Out Of Scope

- Persisted follicle labels.
- Cross-day follicle identity tracking.
- A follicle trend chart.
- Schema migration.
- Backup schema changes.
- Changes to ovulation detection logic.
