# Strategic Colorization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the semantic colors already defined in `theme.ts` to communicate teasing/edema scores, pregnancy results, and foaling outcomes visually in the mare detail screen.

**Architecture:** All changes are in the presentation layer only. A small `StatusBadge` component is extracted for reuse across score pills and result badges. The `MareDetailScreen` renders colored badges instead of plain text for score/result/outcome values. No data model or repository changes.

**Tech Stack:** React Native, TypeScript, existing `theme.ts` color tokens.

---

### Task 1: Create StatusBadge Component

**Files:**
- Create: `src/components/StatusBadge.tsx`

**Step 1: Create the StatusBadge component**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/theme';

type StatusBadgeProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
};

export function StatusBadge({ label, backgroundColor, textColor }: StatusBadgeProps): JSX.Element {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.labelMedium,
  },
});
```

**Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS — no type errors

**Step 3: Commit**

```bash
git add src/components/StatusBadge.tsx
git commit -m "feat: add StatusBadge component for colored data indicators"
```

---

### Task 2: Add Score Color Helper

**Files:**
- Create: `src/utils/scoreColors.ts`
- Create: `src/__tests__/scoreColors.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getScoreColors } from '@/utils/scoreColors';
import { colors } from '@/theme';

describe('getScoreColors', () => {
  it('returns score0 colors for null', () => {
    const result = getScoreColors(null);
    expect(result.backgroundColor).toBe(colors.score0);
  });

  it('returns score0 colors for N/A string', () => {
    const result = getScoreColors('N/A');
    expect(result.backgroundColor).toBe(colors.score0);
  });

  it('returns correct colors for score 1', () => {
    const result = getScoreColors(1);
    expect(result.backgroundColor).toBe(colors.score1);
    expect(result.textColor).toBe(colors.onPrimaryContainer);
  });

  it('returns correct colors for score 4', () => {
    const result = getScoreColors(4);
    expect(result.backgroundColor).toBe(colors.score4);
    expect(result.textColor).toBe('#FFFFFF');
  });

  it('returns correct colors for score 5', () => {
    const result = getScoreColors(5);
    expect(result.backgroundColor).toBe(colors.score5);
    expect(result.textColor).toBe('#FFFFFF');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- scoreColors`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
import { colors } from '@/theme';

type BadgeColors = {
  backgroundColor: string;
  textColor: string;
};

const SCORE_MAP: Record<number, BadgeColors> = {
  0: { backgroundColor: colors.score0, textColor: colors.onSurfaceVariant },
  1: { backgroundColor: colors.score1, textColor: colors.onPrimaryContainer },
  2: { backgroundColor: colors.score2, textColor: colors.onPrimaryContainer },
  3: { backgroundColor: colors.score3, textColor: colors.onPrimaryContainer },
  4: { backgroundColor: colors.score4, textColor: '#FFFFFF' },
  5: { backgroundColor: colors.score5, textColor: '#FFFFFF' },
};

const DEFAULT_COLORS: BadgeColors = {
  backgroundColor: colors.score0,
  textColor: colors.onSurfaceVariant,
};

export function getScoreColors(score: number | string | null | undefined): BadgeColors {
  if (score == null || score === 'N/A' || score === '-') {
    return DEFAULT_COLORS;
  }
  const num = typeof score === 'string' ? parseInt(score, 10) : score;
  return SCORE_MAP[num] ?? DEFAULT_COLORS;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- scoreColors`
Expected: PASS — all 5 tests green

**Step 5: Commit**

```bash
git add src/utils/scoreColors.ts src/__tests__/scoreColors.test.ts
git commit -m "feat: add score color mapping for teasing/edema display"
```

---

### Task 3: Render Score Pills in Daily Log Cards

**Files:**
- Modify: `src/screens/MareDetailScreen.tsx`

**Step 1: Add imports**

At the top of `MareDetailScreen.tsx`, add:

```tsx
import { StatusBadge } from '@/components/StatusBadge';
import { getScoreColors } from '@/utils/scoreColors';
```

**Step 2: Add a renderScoreBadge helper function**

Inside the component, alongside `renderCardRow` and `renderEditIconButton`:

```tsx
const renderScoreBadge = (score: number | null | undefined): JSX.Element => {
  const display = score != null ? String(score) : 'N/A';
  const badgeColors = getScoreColors(score);
  return <StatusBadge label={display} backgroundColor={badgeColors.backgroundColor} textColor={badgeColors.textColor} />;
};
```

**Step 3: Replace plain text with score badges in daily log rendering**

In the `dailyLogs` tab section, change the teasing and edema `renderCardRow` calls:

Before:
```tsx
{renderCardRow('Teasing', log.teasingScore ?? '-')}
{renderCardRow('Edema', log.edema ?? '-')}
```

After:
```tsx
<View style={styles.cardRow}>
  <Text style={styles.cardLabel}>Teasing</Text>
  {renderScoreBadge(log.teasingScore)}
</View>
<View style={styles.cardRow}>
  <Text style={styles.cardLabel}>Edema</Text>
  {renderScoreBadge(log.edema)}
</View>
```

**Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/screens/MareDetailScreen.tsx
git commit -m "feat: render colored score pills for teasing/edema in daily logs"
```

---

### Task 4: Render Pregnancy Result Badges

**Files:**
- Modify: `src/screens/MareDetailScreen.tsx`

**Step 1: Replace pregnancy result and heartbeat plain text with badges**

In the `pregnancyChecks` tab section, change the result and heartbeat `renderCardRow` calls:

Before:
```tsx
{renderCardRow('Result', check.result)}
{renderCardRow('Heartbeat', check.heartbeatDetected ? 'Yes' : 'No')}
```

After:
```tsx
<View style={styles.cardRow}>
  <Text style={styles.cardLabel}>Result</Text>
  <StatusBadge
    label={check.result === 'positive' ? 'Positive' : 'Negative'}
    backgroundColor={check.result === 'positive' ? colors.positive : colors.negative}
    textColor="#FFFFFF"
  />
</View>
<View style={styles.cardRow}>
  <Text style={styles.cardLabel}>Heartbeat</Text>
  <StatusBadge
    label={check.heartbeatDetected ? 'Yes' : 'No'}
    backgroundColor={check.heartbeatDetected ? colors.heartbeat : colors.score0}
    textColor={check.heartbeatDetected ? '#FFFFFF' : colors.onSurfaceVariant}
  />
</View>
```

**Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/screens/MareDetailScreen.tsx
git commit -m "feat: render colored badges for pregnancy result and heartbeat"
```

---

### Task 5: Color Foaling Outcome Text

**Files:**
- Modify: `src/screens/MareDetailScreen.tsx`

**Step 1: Add outcome color helper inside the component**

```tsx
const getOutcomeColor = (outcome: string): string => {
  if (outcome === 'liveFoal') return colors.pregnant;
  if (outcome === 'stillbirth' || outcome === 'aborted') return colors.loss;
  return colors.onSurface;
};

const formatOutcome = (outcome: string): string => {
  if (outcome === 'liveFoal') return 'Live Foal';
  if (outcome === 'stillbirth') return 'Stillbirth';
  if (outcome === 'aborted') return 'Aborted';
  return 'Unknown';
};
```

**Step 2: Replace outcome plain text with colored text**

In the `foalingRecords` tab section, change:

Before:
```tsx
{renderCardRow('Outcome', record.outcome)}
```

After:
```tsx
<View style={styles.cardRow}>
  <Text style={styles.cardLabel}>Outcome</Text>
  <Text style={[styles.cardValue, { color: getOutcomeColor(record.outcome) }]}>
    {formatOutcome(record.outcome)}
  </Text>
</View>
```

**Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Run full test suite**

Run: `npm test`
Expected: PASS — no regressions

**Step 5: Commit**

```bash
git add src/screens/MareDetailScreen.tsx
git commit -m "feat: color foaling outcome text by result type"
```

---

### Task 6: Visual Smoke Test

**Step 1: Start the app**

Run: `npm run android` or `npm start`

**Step 2: Verify score pills**

Navigate to a mare with daily logs. Confirm:
- Teasing/edema scores show colored pills
- Colors progress from gray (N/A) through orange (5)
- Text is readable on all backgrounds

**Step 3: Verify pregnancy badges**

Navigate to pregnancy checks tab. Confirm:
- "Positive" shows green badge
- "Negative" shows red badge
- "Heartbeat: Yes" shows pink badge
- "Heartbeat: No" shows gray badge

**Step 4: Verify foaling outcome**

Navigate to foaling records tab. Confirm:
- "Live Foal" text is green
- "Stillbirth" / "Aborted" text is red
- "Unknown" text is default color
