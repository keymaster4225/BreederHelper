# Approximate Due Date Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display an approximate due date (breeding date + the mare's saved gestation length, default 340 days) on the Pregnancy Check form when the result is positive.

**Architecture:** Reuse the existing `estimateFoalingDate` function from `src/models/types.ts`. Add a conditional `useMemo` + info row in `PregnancyCheckFormScreen`. Add unit tests for `estimateFoalingDate`.

**Tech Stack:** React Native, TypeScript, Vitest

---

## Chunk 1: Tests and Implementation

### Task 1: Add unit tests for `estimateFoalingDate`

**Files:**
- Create: `src/models/types.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, expect, it } from 'vitest';
import { estimateFoalingDate } from './types';

describe('estimateFoalingDate', () => {
  it('adds the mare gestation length to the breeding date', () => {
    // 2026-01-01 + 340 days = 2026-12-07
    expect(estimateFoalingDate('2026-01-01')).toBe('2026-12-07');
  });

  it('handles year boundary crossing', () => {
    // 2026-03-01 + 340 days = 2027-02-04
    expect(estimateFoalingDate('2026-03-01')).toBe('2027-02-04');
  });

  it('handles leap year crossing', () => {
    // 2027-05-01 + 340 days = 2028-04-05 (2028 is a leap year)
    expect(estimateFoalingDate('2027-05-01')).toBe('2028-04-05');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- src/models/types.test.ts`
Expected: 3 tests PASS (function already exists)

- [ ] **Step 3: Commit**

```bash
git add src/models/types.test.ts
git commit -m "test: add unit tests for estimateFoalingDate"
```

### Task 2: Add due date display to PregnancyCheckFormScreen

**Files:**
- Modify: `src/screens/PregnancyCheckFormScreen.tsx:8` (imports)
- Modify: `src/screens/PregnancyCheckFormScreen.tsx:122-132` (add useMemo after daysPostBreeding)
- Modify: `src/screens/PregnancyCheckFormScreen.tsx:246-248` (add due date row)

- [ ] **Step 4: Add imports**

In `src/screens/PregnancyCheckFormScreen.tsx`, update line 8 to also import `estimateFoalingDate`:

```typescript
import { BreedingRecord, calculateDaysPostBreeding, estimateFoalingDate } from '@/models/types';
```

Add `formatLocalDate` import — add this new import line after line 18:

```typescript
import { formatLocalDate } from '@/utils/dates';
```

- [ ] **Step 5: Add `approxDueDate` useMemo**

After the existing `daysPostBreeding` useMemo (after line 132), add:

```typescript
const approxDueDate = useMemo(() => {
  if (!selectedBreedingRecord) {
    return null;
  }
  return estimateFoalingDate(selectedBreedingRecord.date);
}, [selectedBreedingRecord]);
```

- [ ] **Step 6: Add the due date info row**

After the existing "Days post-breeding" `Text` (line 247), add the conditional due date line:

```tsx
<View style={localStyles.infoRow}>
  <Text style={localStyles.infoLabel}>Days post-breeding: {daysPostBreeding === null ? '-' : `${daysPostBreeding}`}</Text>
  {result === 'positive' && approxDueDate ? (
    <Text style={localStyles.infoLabel}>Approx. due date: {formatLocalDate(approxDueDate, 'MM-DD-YYYY')}</Text>
  ) : null}
</View>
```

This replaces the existing `<View style={localStyles.infoRow}>...</View>` block (lines 246-248).

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 8: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/screens/PregnancyCheckFormScreen.tsx
git commit -m "feat: show approximate due date on pregnancy check form"
```
