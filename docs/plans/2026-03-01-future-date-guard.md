# Future Date Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent users from selecting or saving dates after the local device day on all four reproductive form screens.

**Architecture:** Extend the shared `FormDateInput` to support a date picker maximum date, then add a shared validation helper that rejects future local dates. Each form screen will pass local "today" to date inputs and enforce submit-time validation so repository writes never accept future dates.

**Tech Stack:** React Native, `@react-native-community/datetimepicker`, TypeScript, Vitest

---

### Task 1: Add shared future-date validator

**Files:**
- Modify: `src/utils/validation.ts`
- Test: `src/utils/validation.test.ts`

**Step 1: Write the failing test**
- Add tests for `validateLocalDateNotInFuture`:
  - returns `null` for today
  - returns `null` for a past date
  - returns `Date cannot be in the future.` for a future date

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/utils/validation.test.ts`
- Expected: FAIL due to missing `validateLocalDateNotInFuture`.

**Step 3: Write minimal implementation**
- Implement `validateLocalDateNotInFuture(value: string): string | null`.
- Behavior:
  - empty trimmed value => `null`
  - invalid local-date format => `null` (format is validated elsewhere)
  - valid date after local today => `Date cannot be in the future.`
  - otherwise => `null`

**Step 4: Run test to verify it passes**
- Run: `npm test -- src/utils/validation.test.ts`
- Expected: PASS for new and existing validation tests.

**Step 5: Commit**
- `git add src/utils/validation.ts src/utils/validation.test.ts`
- `git commit -m "feat: add shared future-date validation"`

### Task 2: Add max-date support to shared date input

**Files:**
- Modify: `src/components/FormControls.tsx`

**Step 1: Write the failing test**
- N/A (component currently has no automated test harness).

**Step 2: Implement minimal component change**
- Add optional `maximumDate?: Date` prop to `FormDateInput`.
- Pass `maximumDate` to `DateTimePicker`.

**Step 3: Verify build/type compatibility**
- Run: `npm run typecheck`
- Expected: PASS.

**Step 4: Commit**
- `git add src/components/FormControls.tsx`
- `git commit -m "feat: support max selectable date in form date input"`

### Task 3: Apply date guard on all target screens

**Files:**
- Modify: `src/screens/DailyLogFormScreen.tsx`
- Modify: `src/screens/BreedingRecordFormScreen.tsx`
- Modify: `src/screens/FoalingRecordFormScreen.tsx`
- Modify: `src/screens/PregnancyCheckFormScreen.tsx`

**Step 1: Update validations**
- Import shared future-date validator into each screen.
- Apply future-date validation to all relevant date fields:
  - Daily Log: `date`
  - Breeding Record: `date`, `collectionDate`
  - Foaling: `date`
  - Pregnancy Check: `date`

**Step 2: Update UI date pickers**
- Create local `today = new Date()` in each screen render scope.
- Pass `maximumDate={today}` to each relevant `FormDateInput`.

**Step 3: Verify save-flow guards**
- Ensure `onSave` already exits when validation fails (no repository writes on future dates).

**Step 4: Run project checks**
- Run: `npm run typecheck`
- Run: `npm test -- src/utils/validation.test.ts`
- Expected: PASS.

**Step 5: Commit**
- `git add` updated screens
- `git commit -m "feat: block future dates in reproductive form screens"`

### Task 4: Final verification and summary

**Files:**
- No file changes expected.

**Step 1: Re-run targeted verification**
- `npm run typecheck`
- `npm test -- src/utils/validation.test.ts`

**Step 2: Manual QA checklist**
- On each target date field, verify future dates are not selectable.
- Try forcing future date input state (if applicable) and verify save is blocked with `Date cannot be in the future.`

**Step 3: Final status report**
- Provide changed files, validation behavior, and test command results.
