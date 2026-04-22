# Collection Calculator Follow-Ups

Captured on 2026-04-22 after the first audit-driven fix pass.

## Completed in this pass

- Added direct unit coverage for `src/utils/collectionCalculator.ts`
- Clarified motile-based concentration semantics in the collection wizard and edit form
- Added external total-sperm equivalent display when motility is known
- Corrected the local comparison doc so it no longer implies semantic parity with the external calculator

## Remaining work

1. Decide whether BreedWise stays motile-only or adds `Total` and `Progressive` target modes.
2. Decide whether fixed final-volume planning belongs in the collection workflow.
3. Decide whether external-calculator compatibility should stay as guidance only or become an actual conversion workflow.
4. Consider adding recommended-range UX for post-extension concentration if users need faster field guidance.
5. If mode support is approved later, update persistence, repositories, wizard state, review output, and regression coverage together.

## Reference

- `docs/collection-wizard-vs-equine-reproduction-calculator.md`
