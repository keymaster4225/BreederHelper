# Collection Calculator Follow-Ups

Captured on 2026-04-22 after the first audit-driven fix pass.

## Completed in this pass

- Added direct unit coverage for `src/utils/collectionCalculator.ts`
- Clarified motile-based concentration semantics in the collection wizard and edit form
- Added external total-sperm equivalent display when motility is known
- Added `35 M/mL` default + `25-50 M/mL` recommended-range helper copy for post-extension concentration
- Corrected the local comparison doc so it no longer implies semantic parity with the external calculator

## Remaining work

1. Decide whether BreedWise stays motile-only or adds `Total` and `Progressive` target modes.
2. Decide whether fixed final-volume planning belongs in the collection workflow.
3. Decide whether external-calculator compatibility should stay as guidance only or become an actual conversion workflow.
4. If mode support is approved later, update persistence, repositories, wizard state, review output, and regression coverage together.

## Reference

- `docs/collection-wizard-vs-equine-reproduction-calculator.md`
