# Daily Log Multiple Follicles - Adversarial Plan Critique

**Date:** 2026-05-03
**Reviewer:** Claude (adversarial pass)
**Targets:**
- `docs/plans/2026-05-03-daily-log-multiple-follicles-design.md`
- `docs/plans/2026-05-03-daily-log-multiple-follicles-implementation-plan.md`

Cross-referenced against actual code in `src/hooks/dailyLogWizard/`, `src/screens/daily-log-wizard/`, and `src/utils/dailyLogDisplay.ts`.

## Critical / High

### 1. Hydration of the primary `Follicle Finding` selector is unspecified - silent invisible data on legacy edits

The design (design.md:97-104) defines a derivation rule: "if exactly one primary finding structure exists, show that finding"; "if multiple ... preserve them on a no-op edit." The implementation plan never says where this happens.

- `hydrateDailyLogWizardRecord` (mappers.ts:130) currently just passes `structures` through.
- Step 1 names a helper `getOvaryFollicleFinding(draft)` but Step 4's UI only describes wiring `onFollicleFindingChange` - it doesn't say "OvaryStep computes the current finding via `getOvaryFollicleFinding(ovary)` for display."
- Combined with Step 4's "exclude primary finding structures from chips" rule, an existing log with `structures = ['multipleSmallFollicles']` will render with **nothing** in either control unless derivation is explicitly wired. The data is still on disk; the UI just lies. First innocuous save on that record will then write through whatever the new selector reports - high data-loss risk.

**Fix**: add an explicit step (between 1 and 4) that documents where derivation happens and adds a hydration test for: `[multipleSmallFollicles]` -> `MSF`; `[multipleSmallFollicles, corpusLuteum]` -> preserved on no-op; `[follicularCyst, multipleSmallFollicles]` -> MSF + `follicularCyst` chip remains.

### 2. The multi-primary "preserve on no-op" branch is referenced in the design but absent from the plan

Design: "if multiple primary finding structures exist, preserve them on a no-op edit and avoid data loss". Plan Step 2 sub-step 1-4 has no branch for this. `setOvaryFollicleFinding('msf')` per Step 2 sub-step 3 will "remove any existing primary finding structures" - fine when the user *picks* something, but the ambient render also has to not damage state. What does `getOvaryFollicleFinding` return when both `multipleSmallFollicles` and `corpusLuteum` are present? Plan doesn't say. Implementer will guess.

### 3. Destructive "Measured -> MSF" with no confirmation, no undo, no test guard

Step 2 sub-step 3 silently clears `follicleMeasurements`. Risks section flags this but mitigation is "tests must assert this is deliberate" - that protects the *implementer*, not the user. Wizard has no per-step Cancel; one mis-tap nukes 4 measured rows. Design says zero confirmation. Either:

- Add an explicit confirmation when measurements exist and user switches finding, or
- At minimum, document this as an accepted UX risk in the plan, not just a testing bullet.

## Medium

### 4. Sort-on-save permanently destroys edit order across reload - undermines the "preserve row order while editing" promise

Design.md:34: "edit UI preserves row order while the user types". Step 3 sorts at save. After save + reload, hydrated rows are now sorted, not original-order. The "edit order preserved" promise is true within a single editing session only. Worth either:

- Calling out explicitly in the plan ("post-save the edit order is sorted; this is intentional"), or
- Storing in entered order and only sorting on display.

### 5. `Follicle A/B/C` labels are actively misleading after the first save

Because of #4, "Follicle B" today can be "Follicle A" tomorrow. Risk section calls them "transient labels" - but they're worse than transient: they re-bind to different values across sessions. The user thinks of them as identifiers (the wording invites it). Recommend dropping letter labels entirely and using `Follicle 1, 2, 3 ...` or just a row index without an alpha label, with copy that emphasizes order is not stable.

### 6. `setOvaryFollicleSize` left as a zombie API

Step 2 sub-step 6 keeps it "temporarily." Step 7 says delete "only if no tests or call sites need it." There is no step that actually deletes its tests. Step 7's grep (`rg -n "setOvaryFollicleSize|onFollicleSizeChange|Follicle Size" src/screens src/hooks`) will succeed (find nothing in `src/screens`) while the dead handler still lives in `useDailyLogOvaryState.ts:87` and the hook's public `return`. Either commit to deletion or commit to keeping it - current plan is ambiguous and ships a maybe.

### 7. Step 7's grep is too narrow and misleading

- Misses `follicleSizeValue` (OvaryStep.tsx:46), `singleFollicleSize` flag (ReviewStep.tsx:69, 83-91, 229, 236), and lowercase variants.
- Doesn't grep tests broadly.
- Add: `rg -n "singleFollicleSize|follicleSizeValue|onFollicleSizeChange" src/`.

### 8. ReviewStep cleanup is under-specified

ReviewStep.tsx:229,236 currently calls `formatOvarySummary(rightOvary, { showFollicleState: false, singleFollicleSize: true })`. Step 5 says "Format measured ovaries as sorted values only" but doesn't say:

- Flip `singleFollicleSize` to `false` (or remove the flag),
- Pipe values through `sortMeasurementsDesc` *before* the `.map(... .trim()).filter(Boolean)` chain at lines 79-81 (raw strings vs sorted numbers - mismatched types unless converted),
- Decide what review shows when finding is `MSF`/`AHF`/`CL` (currently `formatOvarySummary` shows them via the `structures` block - design says to keep the existing structure label, but ReviewStep currently lists ALL structures including chips. After the UI split, do those primaries even appear in `structures` of the draft anymore? Yes per the data mapping. But the review doesn't distinguish primary vs additional. Decide whether to label primary as "Follicle Finding" or leave it under "Structures".).

### 9. No test required for round-trip through the repository

Design.md:242 explicitly asks for at least one repository/mapper test that "prove[s] multiple values round-trip through the payload/storage path." The implementation plan drops this. Step 3's tests only cover the mapper output, not the SQLite serialize -> deserialize -> display path. `dailyLogs.ts` JSON serialization already exists, but with multiple values now actually populated for the first time from real UI, this should not be skipped.

### 10. Validation copy is single-row

`validation.ts:48` returns "Enter a valid follicle size (0-100 mm, up to 1 decimal place)." With multi-row UI this reads as "you have an invalid value somewhere" without saying which row. The plan doesn't update copy or surface per-row error positioning.

### 11. Sub-agent split has an undocumented dependency between Worker A and Worker B

Plan says "Do not start workers until Step 1 is complete," but Worker B's Step 4 modifies `OvaryStep.tsx`, which currently imports/uses `setOvaryFollicleSize` (DailyLogWizardScreen.tsx:135,147). Worker B requires Worker A's Step 2 to be merged first, not just Step 1. The dependency graph implies it; the worker briefing doesn't reinforce it. Add: "Worker B must wait for Worker A's Step 2 commit."

## Low

### 12. Test file path may not exist as written

Plan references `src/hooks/useDailyLogWizard.screen.test.tsx` (Step 2). Hook tests usually aren't `.screen.test.tsx`. Verify before assigning.

### 13. Accessibility coverage incomplete

Plan calls for an `accessibilityLabel` on the per-row remove control only. Per CLAUDE.md ("Every new icon-only button needs an `accessibilityLabel`"), `Add Follicle` and the `Follicle Finding` selector also need explicit a11y treatment.

### 14. Acceptance criterion in Step 2 is asserted but not testable as written

"Existing additional structures remain when switching primary finding unless they are one of the primary structures." No concrete test name in Step 2's verification block. Add an explicit case: `setOvaryFollicleFinding('ahf')` on `structures = ['follicularCyst','multipleSmallFollicles']` -> `['follicularCyst','hemorrhagicAnovulatoryFollicle']`.

### 15. No verification that the existing `Follicle state` enum value doesn't collide with the new `MSF` UI label semantics

`FollicleState` (`src/models/types.ts:194`) and `OvaryStructure` (`src/models/types.ts:198`) are independent unions, but they share visually similar terminology. Brief callout in the plan: "FollicleState only ever takes `'measured'` in the new flow; do not auto-map other FollicleState values."

### 16. Risks section omits the "user discovers their old MSF/CL chip data isn't displayed" perception risk

This is a release-notes / changelog item, not just a code risk.

## Positives

- Contract-first ordering (Step 1 helpers before workers branch) is sound.
- Explicit "no schema / no backup change" assertion is the right scope guard.
- Defensive sort in `dailyLogDisplay.ts` (Step 6) protects older records.
- Wave structure with clear file ownership reduces merge conflicts.

## Recommended Plan Edits Before Implementation

1. Add a "Step 1.5: Hydration derivation" with explicit handling of: empty / one primary structure / multiple primary structures / measured-with-stale-primary.
2. Specify `getOvaryFollicleFinding`'s return for the multi-primary case; add a test.
3. In Step 5, explicitly remove `singleFollicleSize: true` at ReviewStep.tsx:229,236 and route values through `sortMeasurementsDesc` after numeric parsing.
4. In Step 7, broaden the grep and require `setOvaryFollicleSize` deletion (or formal kept-API justification).
5. Add a repository round-trip test to Step 3 or Step 8.
6. Decide and document the post-reload row-order behavior; either reorder labels to digits or document the alpha-label re-binding behavior.
7. Add a11y labels for `Follicle Finding`, `Add Follicle`, and the per-row remove icon.
8. Decide whether destructive finding switches need a confirm; document the decision.

## Bottom Line

The plan's *direction* is right and the contract-first sequencing is good, but it leaves hydration semantics, ReviewStep cleanup, and zombie-API resolution under-specified. As written, an implementer can ship a green test suite while quietly hiding legacy `MSF`/`CL` chip data from the UI.
