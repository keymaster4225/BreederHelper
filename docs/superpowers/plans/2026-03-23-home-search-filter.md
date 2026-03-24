# Home Screen Search & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search bar and status filter chips (All/Pregnant/Open) to the home screen, filtering the mare list client-side.

**Architecture:** Pure UI change to `HomeScreen.tsx`. Two new state variables + one `useMemo` filter the already-loaded `mares` array and `pregnantInfo` map. No backend, schema, or navigation changes.

**Tech Stack:** React Native, TypeScript, `MaterialCommunityIcons`, existing theme tokens from `src/theme.ts`.

**Spec:** `docs/superpowers/specs/2026-03-23-home-search-filter-design.md`

---

### Task 1: Add filtering logic and unit test

**Files:**
- Create: `src/utils/filterMares.ts`
- Create: `src/utils/filterMares.test.ts`

This extracts the filtering logic into a pure, testable function so it can be unit tested without rendering React components.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/filterMares.test.ts
import { describe, expect, it } from 'vitest';
import { filterMares, type StatusFilter } from './filterMares';
import { Mare, PregnancyInfo } from '@/models/types';

function makeMare(overrides: Partial<Mare> & { id: string; name: string }): Mare {
  return {
    breed: 'Thoroughbred',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const MARE_A = makeMare({ id: '1', name: 'Athena' });
const MARE_B = makeMare({ id: '2', name: 'Bella' });
const MARE_C = makeMare({ id: '3', name: 'Cleopatra' });

const pregnantIds = new Map<string, PregnancyInfo>([
  ['1', { daysPostOvulation: 30, estimatedDueDate: '2027-01-01' }],
]);

describe('filterMares', () => {
  it('returns all mares when search is empty and filter is all', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], '', 'all', pregnantIds);
    expect(result).toEqual([MARE_A, MARE_B, MARE_C]);
  });

  it('filters by name case-insensitively', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], 'bell', 'all', pregnantIds);
    expect(result).toEqual([MARE_B]);
  });

  it('filters pregnant mares only', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], '', 'pregnant', pregnantIds);
    expect(result).toEqual([MARE_A]);
  });

  it('filters open mares only', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], '', 'open', pregnantIds);
    expect(result).toEqual([MARE_B, MARE_C]);
  });

  it('combines search and status filter', () => {
    const result = filterMares([MARE_A, MARE_B, MARE_C], 'a', 'open', pregnantIds);
    expect(result).toEqual([MARE_C]);
  });

  it('returns empty array when nothing matches', () => {
    const result = filterMares([MARE_A, MARE_B], 'zzz', 'all', pregnantIds);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/filterMares.test.ts`
Expected: FAIL — module `./filterMares` not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/filterMares.ts
import { Mare, PregnancyInfo } from '@/models/types';

export type StatusFilter = 'all' | 'pregnant' | 'open';

export function filterMares(
  mares: readonly Mare[],
  searchText: string,
  statusFilter: StatusFilter,
  pregnantInfo: ReadonlyMap<string, PregnancyInfo>,
): Mare[] {
  const needle = searchText.toLowerCase();

  return mares.filter((mare) => {
    const matchesSearch =
      needle === '' || mare.name.toLowerCase().includes(needle);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pregnant' && pregnantInfo.has(mare.id)) ||
      (statusFilter === 'open' && !pregnantInfo.has(mare.id));

    return matchesSearch && matchesStatus;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/filterMares.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/filterMares.ts src/utils/filterMares.test.ts
git commit -m "feat: add filterMares utility with tests for home screen search & filter"
```

---

### Task 2: Add search bar and filter chips to HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Update imports**

Add `useMemo` to the React import and `TextInput` to the react-native import at the top of the file.

```typescript
// Line 1: add useMemo
import { useCallback, useEffect, useMemo, useState } from 'react';
// Line 2: add TextInput
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
```

Add the `filterMares` import:

```typescript
import { filterMares, StatusFilter } from '@/utils/filterMares';
```

- [ ] **Step 2: Add state variables and useMemo**

After the existing `pregnantInfo` state declaration (line 36), add:

```typescript
const [searchText, setSearchText] = useState('');
const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

const filteredMares = useMemo(
  () => filterMares(mares, searchText, statusFilter, pregnantInfo),
  [mares, searchText, statusFilter, pregnantInfo],
);
```

- [ ] **Step 3: Add search bar JSX**

Insert after the `listHint` text (line 150) and before the `FlatList` (line 152). Replace the condition block `{mares.length > 0 ? <FlatList ...` with:

```tsx
{mares.length > 0 ? (
  <>
    <View style={styles.searchBar}>
      <MaterialCommunityIcons
        name="magnify"
        size={20}
        color={colors.onSurfaceVariant}
      />
      <TextInput
        style={styles.searchInput}
        placeholder="Search mares..."
        placeholderTextColor={colors.onSurfaceVariant}
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {searchText !== '' ? (
        <Pressable
          onPress={() => setSearchText('')}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={20}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
      ) : null}
    </View>

    <View style={styles.filterRow}>
      {(['all', 'pregnant', 'open'] as const).map((value) => {
        const isActive = statusFilter === value;
        const label = value === 'all' ? 'All' : value === 'pregnant' ? 'Pregnant' : 'Open';
        return (
          <Pressable
            key={value}
            style={[styles.filterChip, isActive ? styles.filterChipActive : styles.filterChipInactive]}
            onPress={() => setStatusFilter(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={isActive ? styles.filterChipTextActive : styles.filterChipTextInactive}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </>
) : null}
```

- [ ] **Step 4: Switch FlatList to use filteredMares and add filtered empty state**

Change `data={mares}` to `data={filteredMares}` on the FlatList.

Add a filtered-empty-state between the filter row and the FlatList:

```tsx
{mares.length > 0 && filteredMares.length === 0 ? (
  <View style={styles.filteredEmptyState}>
    <Text style={styles.filteredEmptyText}>No mares match your search.</Text>
  </View>
) : null}
```

Only render the FlatList when `filteredMares.length > 0`:

```tsx
{filteredMares.length > 0 ? <FlatList
  data={filteredMares}
  ...
/> : null}
```

- [ ] **Step 5: Add new styles**

Add these entries to the `StyleSheet.create` call:

```typescript
searchBar: {
  alignItems: 'center',
  backgroundColor: colors.surface,
  borderColor: colors.outline,
  borderRadius: borderRadius.md,
  borderWidth: 1,
  flexDirection: 'row',
  height: 44,
  marginBottom: spacing.md,
  paddingHorizontal: spacing.md,
},
searchInput: {
  color: colors.onSurface,
  flex: 1,
  marginHorizontal: spacing.sm,
  ...typography.bodyMedium,
},
filterRow: {
  flexDirection: 'row',
  gap: spacing.sm,
  marginBottom: spacing.md,
},
filterChip: {
  borderRadius: borderRadius.full,
  minHeight: 36,
  justifyContent: 'center',
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
},
filterChipActive: {
  backgroundColor: colors.primary,
},
filterChipInactive: {
  backgroundColor: colors.surface,
  borderColor: colors.outline,
  borderWidth: 1,
},
filterChipTextActive: {
  color: '#FFFFFF',
  ...typography.labelMedium,
},
filterChipTextInactive: {
  color: colors.onSurface,
  ...typography.labelMedium,
},
filteredEmptyState: {
  alignItems: 'center',
  paddingVertical: spacing.xl,
},
filteredEmptyText: {
  color: colors.onSurfaceVariant,
  ...typography.bodyMedium,
},
```

- [ ] **Step 6: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: No type errors. All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add search bar and status filter chips to home screen"
```

---

### Task 3: Manual smoke test

- [ ] **Step 1: Run the app**

Run: `npm start` or `npm run android`

- [ ] **Step 2: Verify search**

1. Home screen shows search bar above mare list.
2. Typing a mare name filters the list in real time.
3. Clear button (X) appears when text is present and clears on tap.
4. Empty state shows "No mares match your search." when no results.

- [ ] **Step 3: Verify filter chips**

1. Three chips visible: All, Pregnant, Open.
2. "All" is active by default (filled style).
3. Tapping "Pregnant" shows only pregnant mares.
4. Tapping "Open" shows only non-pregnant mares.
5. Tapping "All" returns to full list.
6. Search + filter combine (e.g., search "A" + filter "Pregnant").

- [ ] **Step 4: Verify no regressions**

1. Tapping a mare still navigates to detail.
2. Long-press delete still works.
3. Edit pencil icon still works.
4. Pregnant badge and DPO/due date still show.
5. "Add mare" header button still works.
