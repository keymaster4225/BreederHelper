# Sticky Follow-Up Actions Implementation Plan

## Summary

Promote `Save & Add Follow-up` from an easy-to-miss inline secondary button at the bottom of long forms into a sticky bottom action bar. This keeps the follow-up workflow visible while the user scrolls, without changing task creation, task completion, or navigation behavior.

Affected workflows:

- Daily Log Wizard review step
- Medication form
- Breeding record form
- Pregnancy check form

## Implementation Changes

### 1. Add Shared Sticky Action Component

Create a reusable component in `src/components/FormActionBar.tsx`.

Component API:

```ts
type FormActionBarProps = {
  readonly primaryLabel: string;
  readonly onPrimaryPress: () => void;
  readonly primaryDisabled?: boolean;
  readonly secondaryLabel?: string;
  readonly onSecondaryPress?: () => void;
  readonly secondaryDisabled?: boolean;
  readonly destructiveLabel?: string;
  readonly onDestructivePress?: () => void;
  readonly destructiveDisabled?: boolean;
};
```

Also export the scroll-clearance constant from this file so screens use one shared value:

```ts
export const STICKY_ACTION_BAR_SCROLL_PADDING = 220;
```

Behavior:

- Render at the bottom of the screen, outside the `ScrollView`, as a normal flex child after the scroll content. Do not use absolute positioning.
- Use existing `PrimaryButton`, `SecondaryButton`, and `DeleteButton`.
- Add a top border and surface background so it reads as a fixed footer.
- Use vertical stacking, not side-by-side buttons, to avoid cramped mobile text.
- Apply vertical padding using existing `spacing` tokens. Do not add extra horizontal padding when the bar is used inside `Screen`, because `Screen` already owns horizontal page padding.
- Preserve dynamic progress labels by letting callers pass `Saving...` and `Deleting...` labels.
- Use per-button disabled props so Save / Follow-up / Delete can each keep their existing disabled rules.
- Render optional secondary/destructive actions only when both their label and handler are provided. Do not render an empty or inert button if only one of the pair is present.
- No new business logic in this component.

### 2. Update Standard Forms

Modify:

- `src/screens/MedicationFormScreen.tsx`
- `src/screens/BreedingRecordFormScreen.tsx`
- `src/screens/PregnancyCheckFormScreen.tsx`

For each:

- Remove the inline `PrimaryButton`, `SecondaryButton`, and `DeleteButton` from inside the `ScrollView`.
- Keep all input fields inside the `ScrollView`.
- Render `FormActionBar` after the `ScrollView`, still inside the existing `KeyboardAvoidingView`.
- Remove now-unused `PrimaryButton`, `SecondaryButton`, and `DeleteButton` imports from these screens.
- Pass:
  - primary label: `isSaving ? 'Saving...' : 'Save'`
  - secondary label: `Save & Add Follow-up`
  - destructive label: `isDeleting ? 'Deleting...' : 'Delete'` only in edit mode
- Preserve existing disabled conditions:
  - medication primary/secondary: `isSaving`
  - medication destructive: `isSaving`
  - breeding primary/secondary/destructive: `isSaving || isDeleting`
  - pregnancy check primary/secondary: `isSaving || isDeleting || breedingRecords.length === 0`
  - pregnancy check destructive: `isSaving || isDeleting`

### 3. Update Daily Log Wizard

Modify:

- `src/screens/DailyLogWizardScreen.tsx`
- `src/screens/daily-log-wizard/ReviewStep.tsx`

Changes:

- Remove save/delete button rendering from `ReviewStep`.
- Keep `ReviewStep` focused on review content and notes editing.
- Remove now-unused `ReviewStep` props from its `Props` type and call site:
  - `isEdit`
  - `isSaving`
  - `isDeleting`
  - `onSave`
  - `onSaveAndAddFollowUp`
  - `onDelete`
- In `DailyLogWizardScreen`, render `FormActionBar` after the `ScrollView` only when `wizard.currentStepId === 'review'`.
- Keep existing inline `Back` / `Next` actions for non-review wizard steps unchanged.
- Pass:
  - primary label: `wizard.isSaving ? 'Saving...' : 'Save'`
  - secondary label: `Save & Add Follow-up`
  - destructive label: `wizard.isDeleting ? 'Deleting...' : 'Delete'` only when `wizard.isEdit`
- Preserve disabled condition: `wizard.isSaving || wizard.isDeleting`.

### 4. Prevent Footer Overlap

For the affected `ScrollView`s:

- Add extra bottom padding to the scroll content so the last field can scroll above the sticky action bar.
- Prefer local style composition:

```tsx
contentContainerStyle={[formStyles.form, styles.formWithActionBar]}
```

- Use a named shared constant for scroll clearance, for example:

```ts
export const STICKY_ACTION_BAR_SCROLL_PADDING = 220;
```

- Import the constant from `src/components/FormActionBar.tsx`; do not redefine it in each screen.
- Apply this constant to standard forms with a sticky action bar.
- Apply this constant conditionally in `DailyLogWizardScreen` only when `wizard.currentStepId === 'review'`.
- Use one conservative padding value for both create and edit modes. It may leave extra scroll space in create mode, but it prevents footer overlap in edit mode where three stacked buttons are present.
- Do not use `spacing.xl * 4`; it is too small for the stacked footer in edit mode.
- Do not change global `formStyles.form`, because not every form has a sticky footer.

### 5. Visual Treatment

Use existing design tokens:

- background: `colors.surface`
- top border: `colors.outlineVariant`
- padding: `spacing.md` / `spacing.lg`
- no new color palette
- no icons required

The hierarchy should remain:

1. `Save` as primary filled action.
2. `Save & Add Follow-up` as secondary outlined action.
3. `Delete` as destructive action in edit mode.

Accept the existing `DeleteButton` internal `marginTop` unless manual review shows the footer spacing looks excessive. Do not introduce new button variants just to remove that margin.

Keep the action bar within the existing `Screen` safe-area and padding structure. Do not add `useSafeAreaInsets` or move the footer outside `Screen` unless manual verification proves the footer conflicts with device safe areas.

## Tests

### Screen Tests

Update or add Jest screen tests for:

- Medication form renders `Save & Add Follow-up`.
- Breeding record form renders `Save & Add Follow-up`.
- Pregnancy check form renders `Save & Add Follow-up`.
- Daily log wizard review step renders `Save & Add Follow-up`.
- Daily log wizard non-review steps do not render save/follow-up actions.
- Daily log wizard review step does not render duplicate inline save/follow-up actions after the action bar is added.
- Button presses call the existing mocked save/follow-up/delete handlers where practical.

Update screen-test hook mocks as needed:

- Standard form mocks must include `onSaveAndAddFollowUp: jest.fn()`.
- Daily log wizard mocks must include `saveAndAddFollowUp: jest.fn()`.

### Component Test

Add a focused Jest test for `FormActionBar`:

- renders primary, secondary, and destructive labels when provided
- calls the correct handler for each button
- disables each action independently according to its per-button disabled prop
- omits secondary/destructive actions when their label or handler is missing

### Existing Hook Tests

Keep the hook tests added for:

- daily log follow-up metadata
- medication follow-up metadata
- breeding follow-up metadata
- pregnancy-check follow-up metadata

## Verification Commands

Run:

```bash
npm run typecheck
npm run test:screen
npm run lint
```

Optionally run the full unit suite afterward:

```bash
npm test
```

Manual check:

- On a phone-sized viewport/device, scroll each affected form to the bottom in create and edit mode.
- Confirm the last editable field can scroll above the sticky footer.
- Confirm the footer remains visible while scrolling and while the keyboard is open.
- Confirm the footer aligns with the form fields and does not appear double-inset from the screen edge.

## Acceptance Criteria

- `Save & Add Follow-up` remains visible at the bottom of each affected form while scrolling.
- Users can still save normally with the primary `Save` action.
- Existing follow-up task behavior is unchanged.
- Existing delete behavior remains available in edit mode.
- No fields are hidden behind the sticky footer.
- The pregnancy-check Delete action remains available even when there are no breeding records.
- Saving and deleting progress labels are preserved.
- Typecheck, screen tests, and lint pass.

## Assumptions

- Sticky bottom action bar is the chosen UX direction.
- The follow-up action should remain secondary, not replace or compete with `Save`.
- This is a layout/visibility improvement only; no storage or task workflow logic should change.
