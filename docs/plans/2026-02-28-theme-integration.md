# Theme Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all hardcoded color, typography, spacing, border radius, and elevation values in the app with tokens from `src/theme.ts`.

**Architecture:** Direct imports — each file imports `{ colors, typography, spacing, borderRadius, elevation }` from `@/theme`. No React Context, no runtime overhead. Styles remain in `StyleSheet.create()` blocks.

**Tech Stack:** React Native, TypeScript, Expo SDK 53. All changes are in `src/` only. No business logic, navigation, or data layer changes.

---

### Task 1: Move theme.ts into src/

**Files:**
- Move: `theme.ts` (project root) → `src/theme.ts`

**Step 1: Move the file**

```bash
mv theme.ts src/theme.ts
```

**Step 2: Run typecheck**

```bash
npm run typecheck
```
Expected: passes (no files import from the root `theme.ts` yet)

**Step 3: Commit**

```bash
git add src/theme.ts theme.ts
git commit -m "chore: move theme.ts to src/theme.ts"
```

---

### Task 2: Update FormControls.tsx

**Files:**
- Modify: `src/components/FormControls.tsx`

This is the most impactful file — it exports `formStyles` used by every form screen.

**Step 1: Add the theme import at the top of the file, after the existing imports**

Add this line after the `@/utils/dates` import:

```typescript
import { borderRadius, colors, spacing, typography } from '@/theme';
```

**Step 2: Replace the `formStyles` StyleSheet**

Replace the entire `formStyles` block (lines 127–147) with:

```typescript
export const formStyles = StyleSheet.create({
  form: {
    gap: 14,
    paddingBottom: spacing.xl,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.primaryContainer,
  },
  saveButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
});
```

**Step 3: Replace the `placeholderTextColor` inline string in `FormTextInput`**

Change line 37:
```typescript
// Before
placeholderTextColor="#8c959f"
// After
placeholderTextColor={colors.onSurfaceVariant}
```

**Step 4: Replace the local `styles` StyleSheet**

Replace the entire `styles` block (lines 149–218) with:

```typescript
const styles = StyleSheet.create({
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.onSurface,
    ...typography.labelLarge,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  dateWrap: {
    gap: spacing.sm,
  },
  dateValue: {
    color: colors.onSurface,
  },
  datePlaceholder: {
    color: colors.onSurfaceVariant,
  },
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearButtonText: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  errorText: {
    color: colors.error,
    ...typography.bodySmall,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  optionTextActive: {
    color: colors.onPrimary,
  },
});
```

**Step 5: Run typecheck**

```bash
npm run typecheck
```
Expected: passes

**Step 6: Commit**

```bash
git add src/components/FormControls.tsx
git commit -m "feat: apply theme tokens to FormControls"
```

---

### Task 3: Update Screen.tsx

**Files:**
- Modify: `src/components/Screen.tsx`

**Step 1: Add theme import after the React import**

```typescript
import { colors, spacing } from '@/theme';
```

**Step 2: Replace the styles block**

```typescript
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
  },
});
```

**Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes

**Step 4: Commit**

```bash
git add src/components/Screen.tsx
git commit -m "feat: apply theme tokens to Screen"
```

---

### Task 4: Update HomeScreen.tsx

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

**Step 1: Add theme import after the last existing import**

```typescript
import { borderRadius, colors, spacing, typography } from '@/theme';
```

**Step 2: Replace the styles block**

```typescript
const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  listContent: {
    gap: 10,
    paddingBottom: spacing.xl,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowMain: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  rowTitle: {
    ...typography.titleSmall,
  },
  rowSubtitle: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
  rowMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  inlineEditButton: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineEditButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
```

**Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes

**Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: apply theme tokens to HomeScreen"
```

---

### Task 5: Update MareDetailScreen.tsx

**Files:**
- Modify: `src/screens/MareDetailScreen.tsx`

**Step 1: Add theme import after the last existing import**

```typescript
import { borderRadius, colors, spacing, typography } from '@/theme';
```

**Step 2: Replace the styles block**

```typescript
const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: 3,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerLine: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabButton: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  tabButtonTextActive: {
    color: colors.onPrimary,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  listWrap: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardTitle: {
    ...typography.titleSmall,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.xl,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  iconText: {
    color: colors.onSurface,
    ...typography.labelLarge,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
```

**Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes

**Step 4: Commit**

```bash
git add src/screens/MareDetailScreen.tsx
git commit -m "feat: apply theme tokens to MareDetailScreen"
```

---

### Task 6: Update StallionManagementScreen.tsx

**Files:**
- Modify: `src/screens/StallionManagementScreen.tsx`

**Step 1: Add theme import after the last existing import**

```typescript
import { borderRadius, colors, spacing, typography } from '@/theme';
```

**Step 2: Replace the local styles block (the `const styles = StyleSheet.create({...})` at the bottom)**

```typescript
const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.onSurface,
    ...typography.titleMedium,
  },
  listWrap: {
    gap: 10,
    paddingBottom: 10,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  cardMain: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  cardTitle: {
    ...typography.titleSmall,
  },
  cardMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineButton: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  deleteButton: {
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  deleteButtonText: {
    color: colors.error,
    ...typography.labelMedium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
});
```

**Step 3: Run typecheck**

```bash
npm run typecheck
```
Expected: passes

**Step 4: Commit**

```bash
git add src/screens/StallionManagementScreen.tsx
git commit -m "feat: apply theme tokens to StallionManagementScreen"
```

---

### Task 7: Update the 4 form screens (delete button styles)

The four screens below each have an identical plain-object `styles` block at the bottom with hardcoded delete button colors. Apply the same change to all four.

**Files:**
- Modify: `src/screens/BreedingRecordFormScreen.tsx`
- Modify: `src/screens/DailyLogFormScreen.tsx`
- Modify: `src/screens/PregnancyCheckFormScreen.tsx`
- Modify: `src/screens/FoalingRecordFormScreen.tsx`

**For each file:**

**Step 1: Add theme import after the last existing import**

```typescript
import { borderRadius, colors, spacing, typography } from '@/theme';
```

**Step 2: Replace the `styles` plain object at the bottom of the file**

```typescript
const styles = {
  deleteButton: {
    alignItems: 'center' as const,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  deleteButtonText: {
    color: colors.error,
    ...typography.labelLarge,
  },
};
```

**Step 3: Run typecheck after updating all 4 files**

```bash
npm run typecheck
```
Expected: passes

**Step 4: Run tests**

```bash
npm test
```
Expected: all pass (no test changes needed — no logic was touched)

**Step 5: Commit**

```bash
git add src/screens/BreedingRecordFormScreen.tsx src/screens/DailyLogFormScreen.tsx src/screens/PregnancyCheckFormScreen.tsx src/screens/FoalingRecordFormScreen.tsx
git commit -m "feat: apply theme tokens to form screen delete buttons"
```

---

### Task 8: Final verification

**Step 1: Run full typecheck**

```bash
npm run typecheck
```
Expected: passes with zero errors

**Step 2: Run full test suite**

```bash
npm test
```
Expected: all tests pass

**Step 3: Confirm no hardcoded hex colors remain in src/**

```bash
grep -r '#[0-9a-fA-F]\{6\}' src/ --include="*.tsx" --include="*.ts" -l
```
Expected: only `src/theme.ts` appears in results (the theme file itself defines the hex values)

**Step 4: Visual review on Android**

```bash
npm run android
```

Navigate through:
- [ ] Home screen (mare list, Add Mare / Stallions buttons)
- [ ] Mare detail (header card, tabs, record cards, edit icon button)
- [ ] Add/Edit Mare form
- [ ] Stallion Management (form, stallion list, edit/delete buttons)
- [ ] Breeding Record form (including delete button if editing)
- [ ] Daily Log form (including delete button if editing)
- [ ] Pregnancy Check form (including delete button if editing)
- [ ] Foaling Record form (including delete button if editing)

Check for: text overflow, button sizing, card layout, and color rendering.

**Step 5: Final commit (if any visual fixes were made)**

```bash
git add -p
git commit -m "fix: visual adjustments after theme rollout"
```
