# Color Scheme Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the brown/tan Material 3 palette in `src/theme.ts` with a slate indigo + soft white palette.

**Architecture:** Single-file change — all screens import `colors` from `@/theme`, so updating the token values in `src/theme.ts` automatically propagates everywhere. No component changes needed.

**Tech Stack:** TypeScript, React Native, Expo SDK 55

---

### Task 1: Update color tokens in src/theme.ts

**Files:**
- Modify: `src/theme.ts`

**Step 1: Replace the core color palette block**

Open `src/theme.ts` and replace everything inside the `export const colors = { ... }` object with the following:

```typescript
export const colors = {
  // Primary - slate indigo
  primary: '#3D52A0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DEE0FF',
  onPrimaryContainer: '#00105C',

  // Secondary - muted blue-gray
  secondary: '#5A5F89',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E0E3FF',
  onSecondaryContainer: '#171B52',

  // Tertiary - warm teal accent
  tertiary: '#3B7EA1',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#C5E8FF',
  onTertiaryContainer: '#001E2E',

  // Error
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  // Surface - near-white with subtle blue-gray tint
  surface: '#F9F9FB',
  onSurface: '#1A1C2E',
  surfaceVariant: '#E4E5F4',
  onSurfaceVariant: '#464775',

  // Outline
  outline: '#767AA3',
  outlineVariant: '#C5C6E8',

  // Inverse
  inverseSurface: '#2E2F4F',
  inverseOnSurface: '#F1F0FF',
  inversePrimary: '#BAC3FF',

  // Misc
  shadow: '#000000',
  scrim: '#000000',
  surfaceTint: '#3D52A0',

  // ============================================================
  // Semantic Colors (unchanged — harmonize with cool primaries)
  // ============================================================

  // Pregnancy check results
  positive: '#4CAF50',
  negative: '#E53935',
  heartbeat: '#EC407A',

  // Teasing / edema score scale (0-5)
  score0: '#E0E0E0',
  score1: '#FFCC80',
  score2: '#FFB74D',
  score3: '#FFA726',
  score4: '#FF9800',
  score5: '#EF6C00',

  // Status indicators
  open: '#78909C',
  pregnant: '#66BB6A',
  foaled: '#42A5F5',
  loss: '#EF5350',
};
```

**Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass (no theme-dependent logic in tests).

**Step 4: Smoke test on device**

Run:
```bash
npm run android
```

Visually verify:
- Nav bar / header uses indigo (not brown)
- Buttons are indigo
- Backgrounds are near-white (not cream)
- Form inputs have light blue-gray background
- Error states still show red
- Score indicators still show orange gradient

**Step 5: Commit**

```bash
git add src/theme.ts
git commit -m "feat: replace brown/tan palette with slate indigo + soft white"
```
