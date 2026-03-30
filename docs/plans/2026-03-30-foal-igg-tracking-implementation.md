# Foal IgG Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add numeric IgG test recording to the foal form, with expandable entry, foaling card badges, and dashboard alerts.

**Architecture:** When the "IgG Tested" milestone checkbox is toggled on in the foal form, an expandable section drops down with an inline list of IgG test entries (date, value mg/dL, auto-derived interpretation). Data stored as JSON in a new `igg_tests` column on the `foals` table. Latest result shown as badge on foaling tab cards. Dashboard alert for foals born within 48h without IgG test.

**Tech Stack:** Expo/React Native, TypeScript, SQLite (expo-sqlite), Vitest

---

### Task 1: Type Definitions

**Files:**
- Modify: `src/models/types.ts:1-73` (add types after FoalMilestones, extend Foal)

- [ ] **Step 1: Add IggTest and IggInterpretation types to `src/models/types.ts`**

After the `FoalMilestones` type definition (line 59), add:

```typescript
export type IggInterpretation = 'adequate' | 'partialFailure' | 'completeFailure';

export interface IggTest {
  readonly date: LocalDate;
  readonly valueMgDl: number;
  readonly recordedAt: ISODateTime;
}
```

- [ ] **Step 2: Add `iggTests` to the `Foal` interface**

In the `Foal` interface, after the `milestones` field (line 69), add:

```typescript
  iggTests: readonly IggTest[];
```

- [ ] **Step 3: Commit**

```bash
git add src/models/types.ts
git commit -m "feat: add IggTest and IggInterpretation types, extend Foal interface"
```

---

### Task 2: IgG Utility — Interpretation Logic

**Files:**
- Create: `src/utils/igg.ts`
- Test: `src/utils/igg.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/igg.test.ts
import { describe, expect, it } from 'vitest';
import { interpretIgg, formatIggInterpretation, IGG_THRESHOLDS } from '@/utils/igg';

describe('interpretIgg', () => {
  it('returns completeFailure below 400', () => {
    expect(interpretIgg(0)).toBe('completeFailure');
    expect(interpretIgg(200)).toBe('completeFailure');
    expect(interpretIgg(399)).toBe('completeFailure');
  });

  it('returns partialFailure for 400-799', () => {
    expect(interpretIgg(400)).toBe('partialFailure');
    expect(interpretIgg(600)).toBe('partialFailure');
    expect(interpretIgg(799)).toBe('partialFailure');
  });

  it('returns adequate for 800+', () => {
    expect(interpretIgg(800)).toBe('adequate');
    expect(interpretIgg(1000)).toBe('adequate');
    expect(interpretIgg(2000)).toBe('adequate');
  });
});

describe('formatIggInterpretation', () => {
  it('formats adequate', () => {
    expect(formatIggInterpretation('adequate')).toBe('Adequate');
  });

  it('formats partialFailure', () => {
    expect(formatIggInterpretation('partialFailure')).toBe('Partial Failure');
  });

  it('formats completeFailure', () => {
    expect(formatIggInterpretation('completeFailure')).toBe('Complete Failure');
  });
});

describe('IGG_THRESHOLDS', () => {
  it('has adequate at 800', () => {
    expect(IGG_THRESHOLDS.ADEQUATE).toBe(800);
  });

  it('has partial failure at 400', () => {
    expect(IGG_THRESHOLDS.PARTIAL_FAILURE).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/igg.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/igg.ts
import type { IggInterpretation } from '@/models/types';

export const IGG_THRESHOLDS = {
  ADEQUATE: 800,
  PARTIAL_FAILURE: 400,
} as const;

export function interpretIgg(valueMgDl: number): IggInterpretation {
  if (valueMgDl >= IGG_THRESHOLDS.ADEQUATE) return 'adequate';
  if (valueMgDl >= IGG_THRESHOLDS.PARTIAL_FAILURE) return 'partialFailure';
  return 'completeFailure';
}

const INTERPRETATION_LABELS: Record<IggInterpretation, string> = {
  adequate: 'Adequate',
  partialFailure: 'Partial Failure',
  completeFailure: 'Complete Failure',
};

export function formatIggInterpretation(interpretation: IggInterpretation): string {
  return INTERPRETATION_LABELS[interpretation];
}

const INTERPRETATION_COLORS: Record<IggInterpretation, string> = {
  adequate: '#4CAF50',
  partialFailure: '#FF9800',
  completeFailure: '#E53935',
};

export function getIggColor(interpretation: IggInterpretation): string {
  return INTERPRETATION_COLORS[interpretation];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/igg.test.ts`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/igg.ts src/utils/igg.test.ts
git commit -m "feat: add IgG interpretation utility with tests"
```

---

### Task 3: Database Migration and Repository Layer

**Files:**
- Modify: `src/storage/migrations/index.ts:216-269` (add migration007, update migrations array)
- Modify: `src/storage/repositories/queries.ts:868-1073` (update FoalRow, mapFoalRow, createFoal, updateFoal, add listAllFoals, add parseIggTests)

- [ ] **Step 1: Add migration 007 to `src/storage/migrations/index.ts`**

After the `migration006` definition (after line 234), add:

```typescript
const migration007 = `
ALTER TABLE foals ADD COLUMN igg_tests TEXT NOT NULL DEFAULT '[]';
`;
```

Add to the `migrations` array (after the migration 006 entry):

```typescript
  {
    id: 7,
    name: '007_add_foal_igg_tests',
    statements: splitStatements(migration007),
    shouldSkip: async (db) => hasColumn(db, 'foals', 'igg_tests'),
  },
```

- [ ] **Step 2: Update `FoalRow` type in `queries.ts`**

Add `igg_tests` field to the `FoalRow` type (after `milestones: string;`):

```typescript
  igg_tests: string;
```

- [ ] **Step 3: Add `parseIggTests` function in `queries.ts`**

After the `parseFoalMilestones` function, add:

```typescript
export function parseIggTests(value: string): IggTest[] {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  const result: IggTest[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.date !== 'string') continue;
    if (typeof e.valueMgDl !== 'number' || e.valueMgDl <= 0) continue;
    const recordedAt = typeof e.recordedAt === 'string' ? e.recordedAt : '';
    result.push({ date: e.date, valueMgDl: e.valueMgDl, recordedAt });
  }
  return result;
}
```

Add `IggTest` to the imports from `@/models/types` at the top of the file.

- [ ] **Step 4: Update `mapFoalRow` to include `iggTests`**

In the `mapFoalRow` function, after `milestones: parseFoalMilestones(row.milestones),` add:

```typescript
    iggTests: parseIggTests(row.igg_tests),
```

- [ ] **Step 5: Update all foal SELECT queries to include `igg_tests`**

In `getFoalById`, `getFoalByFoalingRecordId`, and `listFoalsByMare`, add `igg_tests` to the SELECT columns:

For `getFoalById` and `getFoalByFoalingRecordId`:
```sql
SELECT id, foaling_record_id, name, sex, color, markings, birth_weight_lbs,
       milestones, igg_tests, notes, created_at, updated_at
FROM foals
```

For `listFoalsByMare`:
```sql
SELECT f.id, f.foaling_record_id, f.name, f.sex, f.color, f.markings,
       f.birth_weight_lbs, f.milestones, f.igg_tests, f.notes, f.created_at, f.updated_at
FROM foals f
```

- [ ] **Step 6: Update `createFoal` to accept and store `iggTests`**

Add `iggTests?: readonly IggTest[];` to the `createFoal` input type.

Add `igg_tests` to the INSERT column list and the VALUES placeholder. In the parameter array, add:

```typescript
JSON.stringify(input.iggTests ?? []),
```

Place it after the `milestones` parameter.

- [ ] **Step 7: Update `updateFoal` to accept and store `iggTests`**

Add `iggTests?: readonly IggTest[];` to the `updateFoal` input type.

Add `igg_tests = ?,` to the SET clause. In the parameter array, add:

```typescript
JSON.stringify(input.iggTests ?? []),
```

Place it after the `milestones` parameter.

- [ ] **Step 8: Add `listAllFoals` bulk query**

After the `deleteFoal` function, add:

```typescript
export async function listAllFoals(): Promise<Foal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<FoalRow>(
    `
    SELECT id, foaling_record_id, name, sex, color, markings,
           birth_weight_lbs, milestones, igg_tests, notes, created_at, updated_at
    FROM foals;
    `
  );
  return rows.map(mapFoalRow);
}
```

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: Remaining errors only in `FoalFormScreen.tsx` (which will be updated in Task 5).

- [ ] **Step 10: Commit**

```bash
git add src/storage/migrations/index.ts src/storage/repositories/queries.ts
git commit -m "feat: add igg_tests column migration and repository support"
```

---

### Task 4: Dashboard Alert — Foal Needs IgG Test

**Files:**
- Modify: `src/utils/dashboardAlerts.ts:1-460` (add constant, extend types, add alert generator, wire into main)
- Modify: `src/utils/dashboardAlerts.test.ts` (add test cases)

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/dashboardAlerts.test.ts`:

At the top, add `Foal` to the imports from `@/models/types`. Add `FOAL_IGG_ALERT_WINDOW_HOURS` to the imports from `@/utils/dashboardAlerts`.

Add a `makeFoal` factory:

```typescript
function makeFoal(overrides: Partial<Foal> = {}): Foal {
  return {
    id: 'foal-1',
    foalingRecordId: 'fr-1',
    milestones: {},
    iggTests: [],
    createdAt: '2026-03-26T00:00:00Z',
    updatedAt: '2026-03-26T00:00:00Z',
    ...overrides,
  };
}
```

Add the test block:

```typescript
describe('foalNeedsIgg', () => {
  it('generates alert for foal born within 48h with no IgG tests', () => {
    const mare = makeMare();
    const foaling = makeFoaling({ id: 'fr-1', date: '2026-03-25', outcome: 'liveFoal' });
    const foal = makeFoal({ foalingRecordId: 'fr-1', iggTests: [] });
    const result = generateDashboardAlerts(
      makeInput({
        mares: [mare],
        foalingRecords: [foaling],
        foals: [foal],
        today: '2026-03-26',
      })
    );
    const iggAlerts = result.filter((a) => a.kind === 'foalNeedsIgg');
    expect(iggAlerts).toHaveLength(1);
    expect(iggAlerts[0].priority).toBe('high');
    expect(iggAlerts[0].mareName).toBe('Star');
  });

  it('does not generate alert when foal has IgG tests', () => {
    const mare = makeMare();
    const foaling = makeFoaling({ id: 'fr-1', date: '2026-03-25', outcome: 'liveFoal' });
    const foal = makeFoal({
      foalingRecordId: 'fr-1',
      iggTests: [{ date: '2026-03-25', valueMgDl: 800, recordedAt: '2026-03-25T12:00:00Z' }],
    });
    const result = generateDashboardAlerts(
      makeInput({
        mares: [mare],
        foalingRecords: [foaling],
        foals: [foal],
        today: '2026-03-26',
      })
    );
    const iggAlerts = result.filter((a) => a.kind === 'foalNeedsIgg');
    expect(iggAlerts).toHaveLength(0);
  });

  it('does not generate alert for foal born more than 48h ago', () => {
    const mare = makeMare();
    const foaling = makeFoaling({ id: 'fr-1', date: '2026-03-20', outcome: 'liveFoal' });
    const foal = makeFoal({ foalingRecordId: 'fr-1', iggTests: [] });
    const result = generateDashboardAlerts(
      makeInput({
        mares: [mare],
        foalingRecords: [foaling],
        foals: [foal],
        today: '2026-03-26',
      })
    );
    const iggAlerts = result.filter((a) => a.kind === 'foalNeedsIgg');
    expect(iggAlerts).toHaveLength(0);
  });

  it('does not generate alert for non-liveFoal outcomes', () => {
    const mare = makeMare();
    const foaling = makeFoaling({ id: 'fr-1', date: '2026-03-25', outcome: 'stillbirth' });
    const foal = makeFoal({ foalingRecordId: 'fr-1', iggTests: [] });
    const result = generateDashboardAlerts(
      makeInput({
        mares: [mare],
        foalingRecords: [foaling],
        foals: [foal],
        today: '2026-03-26',
      })
    );
    const iggAlerts = result.filter((a) => a.kind === 'foalNeedsIgg');
    expect(iggAlerts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/dashboardAlerts.test.ts`
Expected: FAIL — `foalNeedsIgg` not in AlertKind, `foals` not in DashboardInput, `FOAL_IGG_ALERT_WINDOW_HOURS` not exported

- [ ] **Step 3: Update types and add constant in `dashboardAlerts.ts`**

Add `Foal` to imports from `@/models/types`.

Add constant after the existing constants:

```typescript
export const FOAL_IGG_ALERT_WINDOW_HOURS = 48;
```

Add `'foalNeedsIgg'` to the `AlertKind` union:

```typescript
export type AlertKind =
  | 'approachingDueDate'
  | 'pregnancyCheckNeeded'
  | 'recentOvulation'
  | 'heatActivity'
  | 'noRecentLog'
  | 'medicationGap'
  | 'foalNeedsIgg';
```

Add `foals` to `DashboardInput`:

```typescript
  readonly foals?: readonly Foal[];
```

- [ ] **Step 4: Add the `checkFoalNeedsIgg` generator function**

After the `checkMedicationGap` function, add:

```typescript
function checkFoalNeedsIgg(
  mare: Mare,
  foalingRecords: readonly FoalingRecord[],
  foalByFoalingRecordId: ReadonlyMap<string, Foal>,
  today: LocalDate
): DashboardAlert | null {
  const liveFoalings = foalingRecords.filter((fr) => fr.outcome === 'liveFoal');

  for (const foaling of liveFoalings) {
    const daysAgo = daysBetween(today, foaling.date);
    if (daysAgo > 2) continue; // 48h ≈ 2 days

    const foal = foalByFoalingRecordId.get(foaling.id);
    if (!foal) continue; // no foal record yet — could also alert, but spec says "foal exists"
    if (foal.iggTests.length > 0) continue;

    const foalLabel = foal.name || 'Foal';

    return {
      kind: 'foalNeedsIgg',
      priority: 'high',
      mareId: mare.id,
      mareName: mare.name,
      title: `${foalLabel} needs IgG test`,
      subtitle: `Born ${foaling.date}`,
      sortKey: daysAgo,
      foalingRecordId: foaling.id,
      foalId: foal.id,
    };
  }

  return null;
}
```

- [ ] **Step 5: Extend `DashboardAlert` to carry optional foal nav params**

Add optional fields to `DashboardAlert`:

```typescript
export interface DashboardAlert {
  readonly kind: AlertKind;
  readonly priority: AlertPriority;
  readonly mareId: string;
  readonly mareName: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sortKey: number;
  readonly foalingRecordId?: string;
  readonly foalId?: string;
}
```

- [ ] **Step 6: Wire into `generateDashboardAlerts`**

In the main function body, after `const medsByMare = groupByMareId(input.medicationLogs ?? []);`, add:

```typescript
  const foalByFoalingRecordId = new Map<string, Foal>();
  for (const foal of input.foals ?? []) {
    foalByFoalingRecordId.set(foal.foalingRecordId, foal);
  }
```

Inside the `for (const mare of mares)` loop, after the `medicationGap` alert check, add:

```typescript
    const iggAlert = checkFoalNeedsIgg(mare, mareFoalings, foalByFoalingRecordId, today);
    if (iggAlert) alerts.push(iggAlert);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/utils/dashboardAlerts.test.ts`
Expected: PASS (all existing + 4 new tests)

- [ ] **Step 8: Commit**

```bash
git add src/utils/dashboardAlerts.ts src/utils/dashboardAlerts.test.ts
git commit -m "feat: add foalNeedsIgg dashboard alert with tests"
```

---

### Task 5: FoalFormScreen — Expandable IgG Section

**Files:**
- Modify: `src/screens/FoalFormScreen.tsx:1-318` (add IgG state, expandable section, update save payload)

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of the file:

```typescript
import { IggTest } from '@/models/types';
import { toLocalDate } from '@/utils/dates';
import { FormDateInput } from '@/components/FormControls';
import { interpretIgg, formatIggInterpretation, getIggColor } from '@/utils/igg';
import { StatusBadge } from '@/components/StatusBadge';
```

Also add `Pressable` to the react-native import if not already there.

- [ ] **Step 2: Add IgG state**

After the existing state declarations (after `const [errors, setErrors] = useState<FormErrors>({});`), add:

```typescript
const [iggTests, setIggTests] = useState<IggTest[]>([]);
```

- [ ] **Step 3: Load existing IgG tests on edit**

In the `useEffect` that loads existing foal data, after `setMilestones(existing.milestones);`, add:

```typescript
          setIggTests([...existing.iggTests]);
```

- [ ] **Step 4: Add IgG test manipulation helpers**

After the `toggleMilestone` function, add:

```typescript
  const addIggTest = (): void => {
    const newTest: IggTest = {
      date: toLocalDate(new Date()),
      valueMgDl: 0,
      recordedAt: new Date().toISOString(),
    };
    setIggTests((prev) => [newTest, ...prev]);
  };

  const updateIggTest = (index: number, updates: Partial<Pick<IggTest, 'date' | 'valueMgDl'>>): void => {
    setIggTests((prev) =>
      prev.map((test, i) =>
        i === index ? { ...test, ...updates } : test
      )
    );
  };

  const removeIggTest = (index: number): void => {
    setIggTests((prev) => prev.filter((_, i) => i !== index));
  };
```

- [ ] **Step 5: Update the save payload**

In the `onSave` function, add `iggTests` to the payload object. Change the `payload` to:

```typescript
      const validIggTests = iggTests.filter((t) => t.valueMgDl > 0);
      const payload = {
        name: name.trim() || null,
        sex,
        color,
        markings: markings.trim() || null,
        birthWeightLbs: trimmedWeight ? Number(trimmedWeight) : null,
        milestones,
        iggTests: validIggTests,
        notes: notes.trim() || null,
      };
```

- [ ] **Step 6: Add expandable IgG section JSX**

In the milestones section, replace the simple milestone map with logic that inserts the IgG expandable section after the `iggTested` checkbox. Replace the milestone rendering block:

```typescript
          <View style={milestoneStyles.section}>
            <Text style={milestoneStyles.sectionTitle}>Milestones</Text>
            {FOAL_MILESTONE_KEYS.map((key) => {
              const entry = milestones[key];
              const isDone = entry?.done ?? false;
              const timeLabel = isDone ? formatRecordedAt(entry?.recordedAt) : '';
              return (
                <View key={key}>
                  <View style={milestoneStyles.row}>
                    <FormCheckbox
                      label={FOAL_MILESTONE_LABELS[key]}
                      value={isDone}
                      onChange={() => toggleMilestone(key)}
                    />
                    {timeLabel ? <Text style={milestoneStyles.time}>{timeLabel}</Text> : null}
                  </View>
                  {key === 'iggTested' && isDone ? (
                    <View style={iggStyles.section}>
                      {iggTests.map((test, index) => {
                        const hasValue = test.valueMgDl > 0;
                        const interpretation = hasValue ? interpretIgg(test.valueMgDl) : null;
                        return (
                          <View key={index} style={iggStyles.testRow}>
                            <View style={iggStyles.testFields}>
                              <View style={iggStyles.dateField}>
                                <FormDateInput
                                  value={test.date}
                                  onChange={(date) => updateIggTest(index, { date })}
                                  displayFormat="MM-DD-YYYY"
                                />
                              </View>
                              <View style={iggStyles.valueField}>
                                <FormTextInput
                                  value={hasValue ? String(test.valueMgDl) : ''}
                                  onChangeText={(text) => {
                                    const parsed = parseInt(text, 10);
                                    updateIggTest(index, { valueMgDl: isNaN(parsed) ? 0 : parsed });
                                  }}
                                  placeholder="mg/dL"
                                  keyboardType="numeric"
                                />
                              </View>
                              {interpretation ? (
                                <StatusBadge
                                  label={formatIggInterpretation(interpretation)}
                                  backgroundColor={getIggColor(interpretation)}
                                  textColor="#FFFFFF"
                                />
                              ) : null}
                            </View>
                            <Pressable
                              onPress={() => removeIggTest(index)}
                              hitSlop={8}
                              accessibilityLabel="Remove test"
                            >
                              <Text style={iggStyles.deleteIcon}>✕</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                      <Pressable onPress={addIggTest} style={iggStyles.addButton}>
                        <Text style={iggStyles.addButtonText}>+ Add Test</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
```

- [ ] **Step 7: Add IgG styles**

After the existing `milestoneStyles`, add:

```typescript
const iggStyles = StyleSheet.create({
  section: {
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.outline,
    paddingLeft: spacing.md,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  testFields: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  dateField: {
    minWidth: 120,
  },
  valueField: {
    width: 80,
  },
  deleteIcon: {
    color: colors.error,
    fontSize: 18,
    padding: spacing.xs,
  },
  addButton: {
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: colors.primary,
    ...typography.labelMedium,
  },
});
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/screens/FoalFormScreen.tsx
git commit -m "feat: add expandable IgG test section to foal form"
```

---

### Task 6: FoalingTab Card — IgG Badge

**Files:**
- Modify: `src/screens/mare-detail/FoalingTab.tsx:1-147` (add IgG badge to foal summary)

- [ ] **Step 1: Add imports**

Add to the top of the file:

```typescript
import { interpretIgg, formatIggInterpretation, getIggColor } from '@/utils/igg';
```

- [ ] **Step 2: Add IgG badge to the foal summary**

In the `cardBody` JSX, inside the `isLiveFoal && foal` branch, after the `foalDetailRow` View (after the closing `</View>` and `) : null}` for the sex/color section), add:

```typescript
                    {foal.iggTests.length > 0 ? (() => {
                      const latest = foal.iggTests.reduce((a, b) =>
                        a.date >= b.date ? a : b
                      );
                      const interpretation = interpretIgg(latest.valueMgDl);
                      return (
                        <View style={styles.iggBadgeRow}>
                          <StatusBadge
                            label={`IgG: ${latest.valueMgDl} ${formatIggInterpretation(interpretation)}`}
                            backgroundColor={getIggColor(interpretation)}
                            textColor="#FFFFFF"
                          />
                        </View>
                      );
                    })() : null}
```

- [ ] **Step 3: Add the style**

Add to the `styles` object:

```typescript
  iggBadgeRow: {
    marginTop: spacing.xs,
  },
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/mare-detail/FoalingTab.tsx
git commit -m "feat: show latest IgG result badge on foaling tab cards"
```

---

### Task 7: AlertCard and HomeScreen — Wire Dashboard Alert

**Files:**
- Modify: `src/components/AlertCard.tsx:14-24` (add foalNeedsIgg config)
- Modify: `src/screens/HomeScreen.tsx:1-522` (add listAllFoals import, fetch foals, pass to dashboard, handle alert nav)

- [ ] **Step 1: Add `foalNeedsIgg` to ALERT_CONFIG in `AlertCard.tsx`**

Add the entry to the `ALERT_CONFIG` object:

```typescript
  foalNeedsIgg: { icon: 'baby-bottle-outline', accentColor: '#E53935' },
```

- [ ] **Step 2: Add `listAllFoals` import to `HomeScreen.tsx`**

Add `listAllFoals` to the import from `@/storage/repositories`:

```typescript
import {
  listAllBreedingRecords,
  listAllDailyLogs,
  listAllFoalingRecords,
  listAllFoals,
  listAllMedicationLogs,
  listAllPregnancyChecks,
  listMares,
  softDeleteMare,
} from '@/storage/repositories';
```

- [ ] **Step 3: Fetch foals in `loadMares`**

In the `loadMares` callback, add `listAllFoals()` to the `Promise.all` call:

```typescript
      const [result, allDailyLogs, allBreedings, allChecks, allFoalings, allMedLogs, allFoals] = await Promise.all([
        listMares(),
        listAllDailyLogs(),
        listAllBreedingRecords(),
        listAllPregnancyChecks(),
        listAllFoalingRecords(),
        listAllMedicationLogs(),
        listAllFoals(),
      ]);
```

- [ ] **Step 4: Pass foals to `generateDashboardAlerts`**

In the `generateDashboardAlerts` call, add the `foals` property:

```typescript
      const alerts = generateDashboardAlerts({
        mares: result,
        dailyLogs: allDailyLogs,
        breedingRecords: allBreedings,
        pregnancyChecks: allChecks,
        foalingRecords: allFoalings,
        medicationLogs: allMedLogs,
        foals: allFoals,
        today,
      });
```

- [ ] **Step 5: Handle `foalNeedsIgg` alert navigation**

In the `onAlertPress` callback, add a case for `foalNeedsIgg`:

```typescript
        case 'foalNeedsIgg':
          if (alert.foalingRecordId) {
            navigation.navigate('FoalForm', {
              mareId: alert.mareId,
              foalingRecordId: alert.foalingRecordId,
              foalId: alert.foalId,
            });
          }
          break;
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS (all tests including new IgG tests and dashboard alert tests)

- [ ] **Step 8: Commit**

```bash
git add src/components/AlertCard.tsx src/screens/HomeScreen.tsx
git commit -m "feat: wire foalNeedsIgg dashboard alert with navigation to foal form"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with zero errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS with all tests green

- [ ] **Step 3: Verify IgG utility tests**

Run: `npm test -- src/utils/igg.test.ts`
Expected: 8 tests passing (interpretIgg boundaries + formatIggInterpretation + thresholds)

- [ ] **Step 4: Verify dashboard alert tests**

Run: `npm test -- src/utils/dashboardAlerts.test.ts`
Expected: All existing tests + 4 new foalNeedsIgg tests passing

- [ ] **Step 5: Final commit (if any remaining changes)**

```bash
git status
# If clean, no commit needed
```
