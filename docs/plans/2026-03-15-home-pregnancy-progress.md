# Home Screen Pregnancy Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show currently pregnant mares on the home screen with days post ovulation and estimated due date, while avoiding ambiguous pregnancy selection and untested display logic.

**Architecture:** Keep the visual change in `src/screens/HomeScreen.tsx`, but move the pregnancy-selection and summary calculations into small pure helpers in `src/models/types.ts`. HomeScreen will fetch pregnancy and foaling data first, identify the active pregnancy deterministically, then fetch the matching breeding record and daily logs only for mares that are still pregnant. This keeps the UI simple and lets the new logic be covered by the existing Node-only Vitest setup.

**Tech Stack:** TypeScript, React Native, Expo SDK 55, Vitest

---

### Task 1: Add pure helpers for active-pregnancy selection and card info

**Files:**
- Modify: `src/models/types.ts`
- Modify: `src/models/types.test.ts`

**Step 1: Write the failing tests**

In `src/models/types.test.ts`, add builders for `PregnancyCheck`, `FoalingRecord`, and `BreedingRecord`, then add these new test blocks:

```ts
describe('findCurrentPregnancyCheck', () => {
  it('returns null when there are no checks', () => {
    expect(findCurrentPregnancyCheck([], [])).toBeNull();
  });

  it('returns null when the latest check is negative', () => {
    const checks = [
      makePregnancyCheck({ id: 'older-positive', date: '2026-05-10', result: 'positive' }),
      makePregnancyCheck({ id: 'latest-negative', date: '2026-05-20', result: 'negative' }),
    ];

    expect(findCurrentPregnancyCheck(checks, [])).toBeNull();
  });

  it('breaks same-day ties by updatedAt so latest is deterministic', () => {
    const checks = [
      makePregnancyCheck({
        id: 'positive-earlier',
        date: '2026-05-20',
        result: 'positive',
        updatedAt: '2026-05-20T09:00:00Z',
      }),
      makePregnancyCheck({
        id: 'negative-later',
        date: '2026-05-20',
        result: 'negative',
        updatedAt: '2026-05-20T10:00:00Z',
      }),
    ];

    expect(findCurrentPregnancyCheck(checks, [])).toBeNull();
  });

  it('returns null when a foaling record exists on or after the positive check date', () => {
    const checks = [makePregnancyCheck({ date: '2026-05-20', result: 'positive' })];
    const foalings = [makeFoalingRecord({ date: '2026-05-20' })];

    expect(findCurrentPregnancyCheck(checks, foalings)).toBeNull();
  });

  it('returns the latest positive check when no foaling supersedes it', () => {
    const checks = [
      makePregnancyCheck({ id: 'older', date: '2026-05-10', result: 'positive' }),
      makePregnancyCheck({ id: 'latest', date: '2026-05-20', result: 'positive' }),
    ];

    expect(findCurrentPregnancyCheck(checks, [])?.id).toBe('latest');
  });
});

describe('buildPregnancyInfoForCheck', () => {
  it('uses the most recent ovulation on or before the check date, not a later ovulation', () => {
    const check = makePregnancyCheck({ date: '2026-05-20', result: 'positive' });
    const dailyLogs = [
      makeDailyLog({ date: '2026-05-18', ovulationDetected: true }),
      makeDailyLog({ date: '2026-05-25', ovulationDetected: true }),
    ];
    const breedingRecord = makeBreedingRecord({ date: '2026-05-10' });

    expect(
      buildPregnancyInfoForCheck(check, dailyLogs, breedingRecord, '2026-06-01')
    ).toEqual({
      daysPostOvulation: 14,
      estimatedDueDate: '2027-04-15',
    });
  });

  it('returns a null due date when the breeding record is missing', () => {
    const check = makePregnancyCheck({ date: '2026-05-20', result: 'positive' });
    const dailyLogs = [makeDailyLog({ date: '2026-05-18', ovulationDetected: true })];

    expect(
      buildPregnancyInfoForCheck(check, dailyLogs, null, '2026-06-01')
    ).toEqual({
      daysPostOvulation: 14,
      estimatedDueDate: null,
    });
  });
});
```

**Step 2: Run the focused tests and confirm they fail**

Run:

```bash
npm test -- src/models/types.test.ts
```

Expected: FAIL because `findCurrentPregnancyCheck` and `buildPregnancyInfoForCheck` do not exist yet.

**Step 3: Implement the minimal helpers in `src/models/types.ts`**

Add a shared interface and two helpers near the existing pregnancy/date helpers:

```ts
export interface PregnancyInfo {
  daysPostOvulation: number | null;
  estimatedDueDate: LocalDate | null;
}

function comparePregnancyChecksDesc(a: PregnancyCheck, b: PregnancyCheck): number {
  return (
    b.date.localeCompare(a.date) ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function findCurrentPregnancyCheck(
  pregnancyChecks: PregnancyCheck[],
  foalingRecords: FoalingRecord[]
): PregnancyCheck | null {
  const latestCheck = [...pregnancyChecks].sort(comparePregnancyChecksDesc)[0];

  if (!latestCheck || latestCheck.result !== 'positive') {
    return null;
  }

  const foaledAfterCheck = foalingRecords.some((record) => record.date >= latestCheck.date);
  return foaledAfterCheck ? null : latestCheck;
}

export function buildPregnancyInfoForCheck(
  check: PregnancyCheck,
  dailyLogs: DailyLog[],
  breedingRecord: BreedingRecord | null,
  today: LocalDate
): PregnancyInfo {
  const ovulationDate = findMostRecentOvulationDate(dailyLogs, check.date);

  return {
    daysPostOvulation: ovulationDate ? calculateDaysPostBreeding(today, ovulationDate) : null,
    estimatedDueDate: breedingRecord ? estimateFoalingDate(breedingRecord.date) : null,
  };
}
```

Keep `findMostRecentOvulationDate()` unchanged here; the important fix is using `check.date` as the lookup boundary and `today` only for the elapsed-day calculation.

**Step 4: Re-run the focused tests**

Run:

```bash
npm test -- src/models/types.test.ts
```

Expected: PASS for the new helper coverage and the existing date-helper tests.

**Step 5: Commit the helper layer**

```bash
git add src/models/types.ts src/models/types.test.ts
git commit -m "feat: add home pregnancy summary helpers"
```

### Task 2: Update HomeScreen to load and render pregnancy progress

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

**Step 1: Replace the pregnancy state shape**

Change:

```ts
const [pregnantMareIds, setPregnantMareIds] = useState<Set<string>>(new Set());
```

To:

```ts
const [pregnantInfo, setPregnantInfo] = useState<Map<string, PregnancyInfo>>(new Map());
```

Import:

```ts
import {
  Mare,
  PregnancyInfo,
  buildPregnancyInfoForCheck,
  findCurrentPregnancyCheck,
} from '@/models/types';
import {
  getBreedingRecordById,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listMares,
  listPregnancyChecksByMare,
  softDeleteMare,
} from '@/storage/repositories';
import { deriveAgeYears, formatLocalDate, toLocalDate } from '@/utils/dates';
```

**Step 2: Update `loadMares()` to compute pregnancy info safely**

Inside `loadMares()`, replace the `Set<string>` builder with logic shaped like this:

```ts
const today = toLocalDate(new Date());
const nextPregnantInfo = new Map<string, PregnancyInfo>();

await Promise.all(
  result.map(async (mare) => {
    const [checks, foalings] = await Promise.all([
      listPregnancyChecksByMare(mare.id),
      listFoalingRecordsByMare(mare.id),
    ]);

    const currentCheck = findCurrentPregnancyCheck(checks, foalings);
    if (!currentCheck) {
      return;
    }

    const [breedingRecord, dailyLogs] = await Promise.all([
      getBreedingRecordById(currentCheck.breedingRecordId),
      listDailyLogsByMare(mare.id),
    ]);

    nextPregnantInfo.set(
      mare.id,
      buildPregnancyInfoForCheck(currentCheck, dailyLogs, breedingRecord, today)
    );
  })
);

setPregnantInfo(nextPregnantInfo);
```

This preserves the existing "pregnant only if latest check is positive and no later foaling exists" behavior, but removes the nondeterministic `checks[0]` assumption and keeps DPO tied to the active pregnancy check.

**Step 3: Render the badge plus compact summary line**

In the `FlatList` row renderer:

```ts
const pregnancy = pregnantInfo.get(item.id) ?? null;
const pregnancyParts: string[] = [];

if (pregnancy?.daysPostOvulation !== null) {
  pregnancyParts.push(`DPO ${pregnancy.daysPostOvulation}`);
}

if (pregnancy?.estimatedDueDate) {
  pregnancyParts.push(`Due ${formatLocalDate(pregnancy.estimatedDueDate, 'MM-DD-YYYY')}`);
}
```

Render:

```tsx
{pregnancy ? (
  <>
    <StatusBadge label="Pregnant" backgroundColor={colors.pregnant} textColor="#fff" />
    {pregnancyParts.length > 0 ? (
      <Text style={styles.rowMeta}>{pregnancyParts.join(' | ')}</Text>
    ) : null}
  </>
) : null}
```

Do not render the extra line for non-pregnant mares or for pregnant mares that have neither DPO nor due date available.

**Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with the new imports, state shape, and render code.

**Step 5: Commit the HomeScreen update**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: show pregnancy progress on home screen"
```

### Task 3: Verify behavior end-to-end

**Files:**
- No code changes expected unless verification finds an issue

**Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for the full suite, including the expanded `src/models/types.test.ts`.

**Step 2: Manual smoke test in the app**

Run:

```bash
npm run android
```

Verify:
- A mare with a current positive pregnancy check shows the green `Pregnant` badge.
- The HomeScreen summary line shows `DPO {n}` when there is an ovulation log on or before the active pregnancy check date.
- A later ovulation log after the pregnancy check does not replace the pregnancy's DPO basis.
- The summary line shows `Due MM-DD-YYYY` when the matching breeding record still exists.
- A pregnant mare with no ovulation logs still shows the badge and due date if available.
- A mare with a later foaling record shows neither the badge nor the summary line.

**Step 3: Commit any verification-driven fix**

If manual testing required a follow-up tweak:

```bash
git add src/models/types.ts src/models/types.test.ts src/screens/HomeScreen.tsx
git commit -m "fix: align home pregnancy progress with active pregnancy"
```
