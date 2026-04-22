# BreedWise UI/UX Audit Report

Comprehensive review of all screens and components against mobile UX best practices,
WCAG accessibility guidelines, and React Native platform conventions.

---

## Critical Issues

### 1. DeleteButton has no `disabled` prop

- **File:** `src/components/Buttons.tsx`
- **Impact:** User can tap delete while a save or another delete is already in progress, causing race conditions or double-submission.
- **Affected screens:**
  - `EditMareScreen.tsx` — calls `<DeleteButton>` but cannot disable during `isDeleting`
  - `BreedingRecordFormScreen.tsx` — no `isSaving` guard on delete button
  - `DailyLogFormScreen.tsx` — no `isSaving` guard on delete button
  - `PregnancyCheckFormScreen.tsx` — no `isSaving` guard on delete button
  - `FoalingRecordFormScreen.tsx` — no `isSaving` guard on delete button
  - `StallionManagementScreen.tsx` — no `isSaving` guard on delete button
- **Fix:** Add a `disabled` prop to `DeleteButton` and pass `isSaving || isDeleting` from each screen.

### 2. SecondaryButton has no `disabled` prop

- **File:** `src/components/Buttons.tsx`
- **Impact:** Cannot prevent interaction during async operations (e.g., cancel while saving).
- **Fix:** Add a `disabled` prop with opacity/style feedback, matching `PrimaryButton` behavior.

### 3. No KeyboardAvoidingView on form screens

- **Files:**
  - `src/screens/EditMareScreen.tsx`
  - `src/screens/DailyLogFormScreen.tsx`
  - `src/screens/BreedingRecordFormScreen.tsx`
  - `src/screens/PregnancyCheckFormScreen.tsx`
  - `src/screens/FoalingRecordFormScreen.tsx`
  - `src/screens/StallionManagementScreen.tsx`
- **Impact:** On iOS, the keyboard covers bottom inputs. All screens use `ScrollView` but lack `KeyboardAvoidingView`.
- **Fix:** Wrap each form screen's content in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`.

### 4. Inline buttons below 44px touch target

- **File:** `src/screens/HomeScreen.tsx` (lines 190-211)
- **Detail:** Edit/Delete inline buttons use `paddingVertical: spacing.sm` (8px). With label text height (~16px), the total touch target is ~32px — well below the 44px minimum.
- **Fix:** Add `minHeight: 44` to inline button styles.

### 5. Tab buttons below 44px touch target

- **File:** `src/screens/MareDetailScreen.tsx` (lines 292-310)
- **Detail:** Tab buttons use `paddingVertical: spacing.sm` (8px), resulting in ~36px effective height.
- **Fix:** Add `minHeight: 44` to tab button styles.

---

## High Issues

### 6. No accessibilityLabel on icon-only buttons

- **Files:**
  - `src/components/Buttons.tsx` (lines 48-58) — `IconButton` component has no `accessibilityLabel` prop
  - `src/screens/HomeScreen.tsx` (lines 73-79) — Header "+" button lacks `accessibilityLabel`
- **Impact:** Screen reader users cannot determine what the button does.
- **Fix:** Add `accessibilityLabel` and `accessibilityRole="button"` to `IconButton` and the header plus button.

### 7. No accessibilityRole on interactive elements

- **Files:** Multiple screens — `Pressable` elements used for mare rows, form selects, date inputs, and modal options lack `accessibilityRole`.
- **Fix:** Add `accessibilityRole="button"` to all `Pressable` elements that act as buttons/links.

### 8. Missing returnKeyType on TextInputs

- **File:** `src/components/FormControls.tsx` (line 34)
- **Detail:** `FormTextInput` does not forward a `returnKeyType` prop. All text inputs show the default keyboard return key.
- **Fix:** Accept and forward `returnKeyType` in `FormTextInput`. Use `"next"` for intermediate fields and `"done"` for the last field in each form.

### 9. Color contrast: score0 on surface

- **File:** `src/theme.ts` (line 70)
- **Detail:** `score0: '#E0E0E0'` on `surface: '#F9F9FB'` yields approximately 1.2:1 contrast ratio. WCAG AA requires 4.5:1 for text and 3:1 for large text/UI components.
- **Used in:** `MareDetailScreen.tsx` for the "No" heartbeat badge and score 0 indicators.
- **Fix:** Darken `score0` to at least `#9E9E9E` if used for text, or ensure it is only used as a background with dark text on top.

### 10. Pregnancy form: breeding record picker lacks stallion name

- **File:** `src/screens/PregnancyCheckFormScreen.tsx` (lines 225-229)
- **Detail:** Breeding record options display as `date (method)` only. When multiple records exist for the same date, they are indistinguishable.
- **Fix:** Include stallion name in the display: `date - stallionName (method)`.

---

## Medium Issues

### 11. Long-press to select mare is not discoverable

- **File:** `src/screens/HomeScreen.tsx` (line 125)
- **Detail:** Long-press on a mare row reveals Edit/Delete buttons, but there is no visual hint, tooltip, or onboarding cue to explain this gesture.
- **Fix:** Add a subtle hint (e.g., "Long press to manage") or use a visible overflow menu (three dots) instead.

### 12. Empty state inconsistency in PregnancyCheckFormScreen

- **File:** `src/screens/PregnancyCheckFormScreen.tsx` (lines 222-230)
- **Detail:** "No breeding records found for this mare" is rendered as plain `<Text>` without the styled empty state pattern (icon + heading + subtitle) used elsewhere.
- **Fix:** Use the same empty state visual pattern as `HomeScreen` and `StallionManagementScreen`.

### 13. Mare detail tab empty states lack CTA

- **File:** `src/screens/MareDetailScreen.tsx` (lines 120, 147, 169, 209)
- **Detail:** Each tab shows "No [records] yet." as `emptyText` but provides no button to add a record. Users must navigate away to create entries.
- **Fix:** Add a "+ Add [record type]" CTA button within each empty state.

### 14. Hardcoded padding inconsistency

- **File:** `src/screens/MareDetailScreen.tsx` (lines 357-368)
- **Detail:** Secondary button uses `paddingVertical: 10` while the theme spacing scale uses `spacing.sm = 8` and `spacing.md = 12`. The value 10 is off-scale.
- **Fix:** Use `spacing.md` (12) or `spacing.sm` (8) for consistency with the spacing system.

### 15. Missing keyboardType on text fields

- **File:** `src/screens/DailyLogFormScreen.tsx` (lines 188-204)
- **Detail:** Ovary and uterine text fields show a full alpha keyboard. These fields accept descriptive text, but if they were intended for numeric/shorthand input, `keyboardType` should be set.
- **Fix:** Verify intended input type and add `keyboardType` if appropriate.

---

## Low Issues

### 16. StallionManagementScreen inline button touch target

- **File:** `src/screens/StallionManagementScreen.tsx` (lines 251-256)
- **Detail:** Inline button uses `paddingVertical: spacing.sm` (8px), resulting in ~36px height.
- **Fix:** Add `minHeight: 44`.

### 17. FormControls modal option vs form field height mismatch

- **File:** `src/components/FormControls.tsx`
- **Detail:** Modal options use `minHeight: 48` while form field inputs use `minHeight: 44`. Minor inconsistency.
- **Fix:** Align both to the same minimum (48px is fine for both, exceeding the 44px minimum).

### 18. WelcomeScreen SafeAreaView edges not specified

- **File:** `src/screens/WelcomeScreen.tsx` (line 19)
- **Detail:** Uses `SafeAreaView` without `edges` prop. May not properly respect notched screens on all devices.
- **Fix:** Specify `edges` if using `react-native-safe-area-context`, or verify behavior on notched devices.

---

## Recommendations (Priority Order)

1. **Add `disabled` prop to DeleteButton and SecondaryButton** — prevents double-submission and race conditions during async operations.
2. **Wrap form screens in `KeyboardAvoidingView`** — iOS keyboard overlap is a usability blocker for bottom-of-form fields.
3. **Increase touch targets to 44px minimum** — add `minHeight: 44` to inline buttons, tab buttons, and verify IconButton effective tap area.
4. **Add `accessibilityLabel` to icon-only buttons** — critical for screen reader users; also add `accessibilityRole="button"` to all interactive `Pressable` elements.
5. **Fix score0 contrast** — darken to at least `#9E9E9E` for text usage, or use only as background with dark `onSurface` text.
6. **Add stallion name to breeding record picker** — improves distinguishability in pregnancy check form.
7. **Add CTA buttons to empty tab states** — reduces navigation friction on mare detail screen.
8. **Make long-press discoverable** — add visual hint or switch to explicit overflow menu.
9. **Forward `returnKeyType` in FormTextInput** — improves keyboard navigation flow across forms.
10. **Standardize spacing values** — replace hardcoded `10` with theme spacing tokens.
