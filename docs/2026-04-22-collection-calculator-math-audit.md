# Collection Calculator Math Audit

**Date:** 2026-04-22  
**Status:** Findings document for follow-up planning  
**Scope:** Compare BreedWise collection-wizard math against the public calculator at `equine-reproduction.com` and determine whether observed mismatches are arithmetic bugs or model differences.

## Purpose

This audit was performed to answer two questions before any product changes are planned:

1. Is BreedWise's collection wizard doing incorrect math?
2. If the external calculator produces different outputs, are those differences bugs in BreedWise or differences in modeling assumptions?

This document is intentionally written as a source-backed findings artifact that can be turned into an implementation plan later. It is not itself the implementation plan.

## Sources Reviewed

Public sources reviewed on 2026-04-22:

- `https://equine-reproduction.com/semen-calculator`
- `https://equine-reproduction.com/SemenCalculator2`

Local code and docs reviewed:

- `src/utils/collectionCalculator.ts`
- `src/hooks/useCollectionWizard.ts`
- `src/utils/collectionAllocation.ts`
- `src/storage/repositories/internal/collectionAllocation.ts`
- `src/storage/repositories/collectionWizard.ts`
- `src/screens/collection-wizard/CollectionBasicsStep.tsx`
- `src/screens/collection-wizard/ProcessingDetailsStep.tsx`
- `src/screens/collection-wizard/ShippedDoseRowEditor.tsx`
- `src/screens/collection-wizard/DoseAllocationStep.tsx`
- `src/screens/CollectionFormScreen.tsx`
- `src/screens/CollectionWizardScreen.screen.test.tsx`
- `src/storage/repositories/collectionWizard.test.ts`
- `docs/collection-wizard-vs-equine-reproduction-calculator.md`
- `docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md`

Verification commands run during the audit:

- `npm run test:screen -- src/screens/CollectionWizardScreen.screen.test.tsx`
- `npm test -- src/storage/repositories/collectionWizard.test.ts`

## Summary of Outcome

The audit conclusion is:

- BreedWise's calculator math is correct for the model the app currently declares and labels.
- The external calculator is using a different definition of "final concentration" than BreedWise.
- The biggest mismatch is semantic, not arithmetic.
- The existing local comparison doc overstates similarity between the two tools and should not be treated as the authoritative reference.
- BreedWise needs direct calculator-unit tests and clearer UI/documentation regardless of whether any feature expansion is approved.

## BreedWise Model

BreedWise currently defines the calculator as a **motile-based** planning tool.

The relevant user-facing labels make that explicit:

- `Target motile sperm / dose (M)`
- `Target post-extension concentration (M motile/mL)`

The pure formulas in `src/utils/collectionCalculator.ts` are:

```text
rawMotileConcentrationMillionsPerMl =
  concentrationMillionsPerMl * (progressiveMotilityPercent / 100)

semenPerDoseMl =
  targetMotileSpermMillionsPerDose / rawMotileConcentrationMillionsPerMl

doseVolumeMl =
  targetMotileSpermMillionsPerDose /
  targetPostExtensionConcentrationMillionsPerMl

extenderPerDoseMl =
  doseVolumeMl - semenPerDoseMl

maxDoses =
  rawVolumeMl / semenPerDoseMl
```

Implications of that model:

- The target dose field is a target for **motile sperm**, not total sperm.
- The post-extension concentration field is also interpreted as **motile sperm per mL**.
- If a user wants a higher post-extension motile concentration than the raw motile concentration can physically support, BreedWise correctly produces a negative-extender warning instead of silently switching models.

## External Calculator Model

The public page documents the following important assumptions:

- Volume, concentration, progressive motility, sperm-type mode, and ship-type mode are essential inputs.
- The default target mode is `Total Sperm`.
- The default ship-type mode is `Variable`.
- The default fixed final volume is `57.75 mL`.
- The default final concentration is `35 million/ml`, with a recommendation to stay between `25-50 million/ml` unless centrifuging.

The public form posts to `SemenCalculator2`, and the response returns a report plus hidden fields containing intermediate values such as:

- `ShipRaw`
- `ExVol`
- `ShipVol`
- `DilFactor`
- `DilRatio`
- `BigShipVolShipRaw`
- `BigShipExVol`
- `SpermShipped`

Observed behavior from controlled samples shows that the site is not using the same definition as BreedWise.

### Observed website behavior

When the site is run in `Total Sperm` mode:

- raw semen per dose is based on **raw total sperm concentration**
- final dose volume is based on **final total sperm concentration**

When the site is run in `Progressive` mode:

- raw semen per dose is based on **raw motile sperm concentration**
- final dose volume still appears to be based on **final total sperm concentration**
- the tool appears to infer the total sperm needed at shipment by dividing the target progressive sperm by the motility fraction

That means the website is effectively treating `FinalConc` as:

```text
finalTotalSpermPerMl
```

not:

```text
finalMotileSpermPerMl
```

even when `SpermType=P`.

## Controlled Sample Results

The controlled sample set used throughout this audit was:

```text
volume = 100 mL
concentration = 200 M/mL
progressive motility = 50%
target = 1 billion sperm per dose
final concentration = 35 M/mL
fixed volume = 57.75 mL
```

Helpful derived constants:

```text
raw total sperm concentration = 200 M/mL
raw motile sperm concentration = 100 M/mL
motility fraction = 0.50
```

### Case A: Website progressive mode

Posted values:

```text
NumDos=1
ship=1
SpermType=P
FinalConc=35
ShipType=V
```

Website returned these key intermediates:

```text
ShipRaw = 10
ExVol = 47.142857142857
ShipVol = 57.142857142857
BigShipVolShipRaw = 10.10625
BigShipExVol = 47.64375
SpermShipped = 1.010625
```

Interpretation:

- `ShipRaw = 10 mL` means the site used raw motile concentration for semen-per-dose:
  - `1,000 M target progressive / 100 M raw motile per mL = 10 mL`
- `ShipVol = 57.142857 mL` means the site did **not** use `35 M motile/mL` for final concentration:
  - if it had, the final volume would be `1,000 / 35 = 28.571429 mL`
  - instead it used `2,000 M total sperm / 35 M total per mL = 57.142857 mL`
- In other words, for progressive mode the site appears to convert:

```text
targetTotalSpermAtShipment =
  targetProgressiveSperm / motilityFraction
```

and then applies `FinalConc` to that total-sperm figure.

### Case B: Website total-sperm mode

Posted values:

```text
NumDos=1
ship=1
SpermType=T
FinalConc=35
ShipType=V
```

Website returned:

```text
ShipRaw = 5
ExVol = 23.571428571429
ShipVol = 28.571428571429
SpermShipped = 2.02125
```

Interpretation:

- `ShipRaw = 5 mL` comes from total sperm only:
  - `1,000 M total target / 200 M raw total per mL = 5 mL`
- `ShipVol = 28.571429 mL` comes from:
  - `1,000 M total target / 35 M total per mL = 28.571429 mL`

This mode is internally consistent with the site's apparent `FinalConc = total sperm per mL` interpretation.

### Case C: BreedWise equivalent math

If the same raw collection is entered into BreedWise and the user types:

```text
Target motile sperm / dose = 1000 M
Target post-extension concentration = 35 M motile/mL
```

BreedWise correctly computes:

```text
semenPerDoseMl = 1000 / 100 = 10 mL
doseVolumeMl = 1000 / 35 = 28.571429 mL
extenderPerDoseMl = 28.571429 - 10 = 18.571429 mL
maxDoses = 100 / 10 = 10
```

This is correct for a **motile concentration** target.

### Case D: Unit-converted bridge between the tools

To match the website's `35 M total/mL` behavior at `50%` motility, the BreedWise-equivalent motile concentration is:

```text
35 M total/mL * 0.50 = 17.5 M motile/mL
```

If BreedWise is given:

```text
Target motile sperm / dose = 1000 M
Target post-extension concentration = 17.5 M motile/mL
```

then BreedWise computes:

```text
semenPerDoseMl = 10 mL
doseVolumeMl = 1000 / 17.5 = 57.142857 mL
extenderPerDoseMl = 47.142857 mL
```

That matches the website's variable-volume progressive output exactly.

## Comparison Table

| Quantity | BreedWise | Website observed behavior | Practical impact |
|---|---|---|---|
| Dose target mode | Motile only | Total or Progressive | BreedWise lacks the site's mode toggle |
| Dose target units | Millions (`M`) | Billions | Users can mis-key copied numbers by 1000x |
| Final concentration meaning | `M motile/mL` | Appears to be `M total/mL` | Same numeric input can produce different dose volumes |
| Semen per dose | `targetMotile / rawMotileConc` | `targetTotal / rawTotalConc` in total mode, `targetProgressive / rawMotileConc` in progressive mode | Matches only when modes are aligned |
| Dose volume | `targetMotile / targetPostExtensionMotileConc` | Appears based on total sperm at shipment divided by final total concentration | Main source of mismatch |
| Extender per dose | `doseVolume - semenPerDose` | Same shape after the site's own dose-volume math | Diverges whenever concentration semantics differ |
| Max doses | `rawVolume / semenPerDose` | Based on total or progressive mode | Mode-dependent on website, motile-only in BreedWise |
| Allocation cap | Raw semen only | Not exposed as an allocation workflow | BreedWise behavior is app-specific and correct for its data model |

## Website Dose Count Observation

The site has a field named `Number of Insemination Doses in each Shipment` (`NumDos`), but tested samples did not show that field materially changing the dilution math returned in hidden fields.

Observed examples:

- `SpermType=T`, `NumDos=1` and `NumDos=2` returned the same `ShipRaw`, `ExVol`, `ShipVol`, and `SpermShipped`
- `SpermType=P`, `NumDos=1` and `NumDos=3` returned the same `ShipRaw`, `ExVol`, `ShipVol`, and `SpermShipped`

This suggests `NumDos` is either:

- report-oriented metadata,
- used in some other branch not triggered in the tested cases, or
- not actually wired into the calculator math in the way a reader would expect.

This matters because the website should not be treated as a gold-standard reference for shipment-row allocation logic in BreedWise.

## Local Code Audit

### Calculator utility

`src/utils/collectionCalculator.ts` is internally coherent and matches the approved local spec:

- it computes a raw motile concentration first
- it derives semen per dose from the motile target
- it derives final dose volume from the motile post-extension concentration
- it warns on negative extender rather than silently changing models
- it warns when target math yields fewer than one possible dose

No arithmetic issue was found in the implementation.

### Allocation and save invariants

`src/utils/collectionAllocation.ts`, `src/storage/repositories/internal/collectionAllocation.ts`, and `src/storage/repositories/collectionWizard.ts` all consistently enforce the same invariant:

```text
SUM(doseSemenVolumeMl * doseCount) <= rawVolumeMl
```

when `rawVolumeMl` is present.

This is correct for BreedWise's explicit domain model, which caps allocation by raw semen volume rather than by theoretical extended volume.

### UI wording

`ProcessingDetailsStep.tsx` and `CollectionFormScreen.tsx` both label the field as `M motile/mL`.

That wording matches the actual code but does **not** match the external site's semantics. The current mismatch is therefore:

- not a hidden bug in our formula implementation
- but a likely user-comprehension problem when copying numbers from outside calculators or vet paperwork

## Test Coverage Observations

What is covered today:

- `src/screens/CollectionWizardScreen.screen.test.tsx` verifies calculator-driven prefill and volume-cap blocking behavior
- `src/storage/repositories/collectionWizard.test.ts` verifies save-time validation and collection/allocation persistence behavior

What is missing today:

- there is no direct `src/utils/collectionCalculator.test.ts`
- there is no focused unit test file that locks the pure formulas, edge cases, or conversion scenarios in isolation

That gap increases the risk of silently changing calculator semantics later while still passing higher-level tests.

## Key Findings

1. BreedWise math is correct for the model it currently advertises.
2. The external calculator and BreedWise do **not** mean the same thing by final concentration.
3. A user copying `35` from the website into BreedWise's `M motile/mL` field will get a smaller dose volume than the website, and BreedWise will still be mathematically correct.
4. The current root-level comparison doc (`docs/collection-wizard-vs-equine-reproduction-calculator.md`) incorrectly suggests that both tools compute the same derived quantities without qualifying the semantic mismatch.
5. The website's `NumDos` field does not appear to be a reliable reference for validating BreedWise shipment-allocation math.
6. BreedWise needs direct calculator-unit tests even if the product decides to keep the current motile-only model.

## Implications For Product Direction

### Short-term correctness work

These are low-risk fixes that do not require changing the product model:

- add direct unit tests for the pure calculator utility
- correct the misleading comparison doc
- clarify UI wording around `M motile/mL`
- add compatibility guidance for users copying values from total-sperm-based calculators

### Product-choice work

These changes require explicit product decisions:

- whether BreedWise should stay motile-only
- whether BreedWise should support both `Total` and `Progressive` target modes
- whether BreedWise should add a fixed final-volume mode
- whether BreedWise should help convert external `total sperm/mL` targets into BreedWise's `motile/mL` model

## Candidate Fix Tracks

This section is intentionally fix-oriented so a later plan can turn it into scoped implementation tasks.

### Track 1: Correctness hardening

Likely touchpoints:

- `src/utils/collectionCalculator.ts`
- new `src/utils/collectionCalculator.test.ts`

Expected outcomes:

- direct formula-level test coverage
- explicit edge-case coverage for missing inputs, zero motility, negative extender, and target-exceeds-capacity
- locked regression tests for the sample cases documented in this audit

### Track 2: Documentation repair

Likely touchpoints:

- `docs/collection-wizard-vs-equine-reproduction-calculator.md`
- possibly a short pointer from that file to this audit document

Expected outcomes:

- remove the claim that both tools compute the same outputs without qualification
- explain that the website's final concentration behaves as total sperm/mL
- preserve a concise field-comparison summary while deferring math authority to this audit

### Track 3: UI clarity and compatibility guidance

Likely touchpoints:

- `src/screens/collection-wizard/ProcessingDetailsStep.tsx`
- `src/screens/CollectionFormScreen.tsx`
- `src/screens/collection-wizard/ReviewStep.tsx`

Expected outcomes:

- clearer help text beside `Target post-extension concentration (M motile/mL)`
- warning or helper copy for users copying inputs from calculators that use total sperm/mL
- optional inline conversion hint when motility is known

### Track 4: Optional feature expansion

Likely touchpoints if approved:

- `src/utils/collectionCalculator.ts`
- `src/hooks/useCollectionWizard.ts`
- `src/screens/collection-wizard/ProcessingDetailsStep.tsx`
- `src/screens/collection-wizard/ShippedDoseRowEditor.tsx`
- persistence types and repositories if new user-selected modes are stored

Possible features:

- `Total` vs `Progressive` target mode
- fixed final-volume mode
- external-calculator compatibility preset
- expanded extender catalog or antibiotic capture if planning later widens the scope

## Open Decisions Before Planning

The next implementation-planning step should not start until these decisions are answered:

1. Should BreedWise preserve the current motile-only model and simply explain it better?
2. Should the app support a total-sperm target mode in addition to the current motile mode?
3. Should the app support fixed final-volume planning, or is that out of scope for the current collection workflow?
4. Is compatibility guidance sufficient, or does the app need an actual conversion workflow for imported external targets?
5. Should the old comparison doc be corrected in place, deprecated, or replaced with a pointer to this audit?

## Recommended Next Step

Use this document as the factual basis for a follow-up implementation-planning doc.

That later plan should:

- choose a product direction for the concentration and target-mode semantics
- scope the minimum safe documentation and test fixes
- explicitly separate "clarify the current model" work from "change the math model" work
- treat the website as a compatibility reference, not as the app's normative formula source

Until those planning decisions are made, BreedWise should be treated as **mathematically correct but externally easy to misinterpret**.
