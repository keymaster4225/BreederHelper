# Plan Review: Sticky Follow-Up Actions

Review of `docs/plans/2026-04-27-sticky-follow-up-actions-implementation-plan.md` against the current state of `main` + `codex/dashboard-rework`.

## Verified accurate

| Plan claim | Code evidence |
|---|---|
| Affected screens contain inline `Save & Add Follow-up` | `MedicationFormScreen.tsx:108-112`, `BreedingRecordFormScreen.tsx:222-226`, `PregnancyCheckFormScreen.tsx:119-123`, `daily-log-wizard/ReviewStep.tsx:285-303` |
| Disabled conditions for primary/secondary buttons | medication `isSaving` (line 105/111), breeding `isSaving \|\| isDeleting` (line 219/225), pregnancy `isSaving \|\| isDeleting \|\| breedingRecords.length === 0` (line 116/122), wizard `isSaving \|\| isDeleting` (line 289/294) |
| Theme tokens exist | `colors.surface`, `colors.outlineVariant`, `spacing.md/lg/xl` all in `theme.ts:15-86` and `183-191` |
| `wizard.currentStepId === 'review'` gating works | `useDailyLogWizard.ts:219` exposes `currentStepId` from `currentStep.id` |
| `KeyboardAvoidingView` wraps `ScrollView` in all 4 screens | confirmed in each file |
| `formStyles.form` is `gap: spacing.lg, paddingBottom: spacing.xl` | `FormControls.tsx:520-525` |

## Issues / gaps to address before implementing

### 1. `disabled?: boolean` API is too coarse for `PregnancyCheckFormScreen`

On that screen the Delete button's disabled rule differs from Save (`PregnancyCheckFormScreen.tsx:122` vs `:129`):

- Save / Save & Add Follow-up: `isSaving || isDeleting || breedingRecords.length === 0`
- Delete: `isSaving || isDeleting` (no breeding-records check)

A single `disabled` prop in `FormActionBarProps` cannot express that. Either split into `primaryDisabled` / `secondaryDisabled` / `destructiveDisabled`, or document explicitly that callers must pre-compute per-button disabled state (which the proposed API doesn't currently allow).

### 2. Dynamic Save / Delete labels are dropped

Today's labels include progress state:

- `label={isSaving ? 'Saving...' : 'Save'}` (e.g. `BreedingRecordFormScreen.tsx:217`, `ReviewStep.tsx:287`)
- `label={isDeleting ? 'Deleting...' : 'Delete'}` (e.g. `BreedingRecordFormScreen.tsx:230`, `ReviewStep.tsx:298`)

The proposed static `primaryLabel: string` / `destructiveLabel?: string` either drops the in-progress indicator, or forces every caller to compute the label inline. Plan should call this out and commit to one approach.

### 3. Footer-overlap padding `spacing.xl * 4` is too small

`spacing.xl = 20`, so the suggested padding is 80 px. A vertically stacked footer with Save (≥48 px) + Save & Add Follow-up (≥48 px) + Delete (≥48 px, plus its `marginTop: spacing.sm`) plus footer padding is ~165–200 px tall. 80 px will leave the last field hidden in edit mode. The hedge ("if theme values support arithmetic consistently, otherwise a named constant") doesn't address that the *value itself* is wrong.

Recommend either:

- an `onLayout` measurement of the action bar feeding `contentContainerStyle.paddingBottom`, or
- a calibrated constant (e.g. `spacing.xl * 9` ≈ 180) verified visually on device.

### 4. Wizard padding must be conditional, not blanket

For non-review wizard steps the inline Back / Next stays inside the `ScrollView`, so adding the action-bar bottom padding unconditionally would leave dead whitespace. The plan should specify that the extra padding is applied only when `currentStepId === 'review'`, mirroring the FormActionBar render condition.

### 5. `ReviewStep` prop surface cleanup is implicit

Plan says "Remove save/delete button rendering from ReviewStep" but doesn't direct the implementer to also drop the now-unused props from `ReviewStep`'s `Props` type and from the call site at `DailyLogWizardScreen.tsx:172-198`:

- `isEdit`, `isSaving`, `isDeleting`
- `onSave`, `onSaveAndAddFollowUp`, `onDelete`

Worth listing explicitly.

### 6. Existing screen-test mocks lack `onSaveAndAddFollowUp` / `saveAndAddFollowUp`

Plan claim: *"No changes should be needed unless component wiring tests directly query old inline button placement."* Verified false:

- `BreedingRecordFormScreen.screen.test.tsx:72`, `PregnancyCheckFormScreen.screen.test.tsx:41`, `DailyLogFormScreen.screen.test.tsx:61-166` all create hook-state mocks that omit the follow-up handler.
- Existing tests still pass because they never fire that button; but any new assertion that fires it (per the plan's own added tests) will hit `onPress=undefined`.
- These mocks need `onSaveAndAddFollowUp: jest.fn()` (and `saveAndAddFollowUp` on the wizard mock) added.

### 7. No standalone `FormActionBar` test mentioned

Per CLAUDE.md screen-coverage convention, a new shared component with non-trivial layout warrants at least a render / handler-wiring test alongside the screen-level checks.

## Minor / stylistic

- `<Screen style={{ paddingTop: 0 }}>` in `BreedingRecordFormScreen.tsx:93` is a screen-specific override; the plan doesn't address whether the sticky footer needs an analogous bottom override to sit flush. Probably no change needed (Screen already has `flex: 1` container at `Screen.tsx:24-27`), but worth a one-liner.
- `DeleteButton` already has `marginTop: spacing.sm` baked in (`Buttons.tsx:141`) — when stacked inside an action bar with its own `gap`, this will compound spacing. Consider zeroing it via a wrapping `View` or accepting the slightly larger gap as intentional.
- Acceptance criterion *"No fields are hidden behind the sticky footer"* is currently unverifiable from code review alone; mention manual visual check on device as part of verification steps.

## Bottom line

The plan correctly identifies the affected code and the disabled rules, and the gating on `currentStepId === 'review'` is well-targeted. The main risks are:

- (1) the proposed component API is under-specified for `PregnancyCheckFormScreen`'s split disabled logic,
- (2) the dynamic Save / Delete labels are silently dropped,
- (3) the suggested overlap padding (`spacing.xl * 4`) is materially too small in edit mode,
- (6) the test-mock impact is understated.

Address those four items before implementation; the rest are tightening.
