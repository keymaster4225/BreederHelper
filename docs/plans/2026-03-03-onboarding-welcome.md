# Onboarding: Welcome Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-screen welcome experience shown on first launch, plus improved empty states on the Mares and Stallions screens.

**Architecture:** `App.tsx` checks AsyncStorage after DB bootstrap; if `onboarding_complete` is not set, renders `WelcomeScreen` instead of `AppNavigator`. Tapping "Get Started" sets the flag and swaps in the normal navigator. Empty states are improved in-place in `HomeScreen` and `StallionManagementScreen`.

**Tech Stack:** Expo SDK 55, React Native, TypeScript, `@expo/vector-icons` (MaterialCommunityIcons), `@react-native-async-storage/async-storage`, Vitest

**Worktree:** `.worktrees/onboarding-welcome` on branch `feature/onboarding-welcome`

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install both packages**

```bash
npm install @expo/vector-icons @react-native-async-storage/async-storage
```

**Step 2: Verify they appear in package.json**

```bash
grep -E "vector-icons|async-storage" package.json
```

Expected: both packages listed under `dependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @expo/vector-icons and async-storage"
```

---

### Task 2: Create onboarding utility

**Files:**
- Create: `src/utils/onboarding.ts`
- Create: `src/utils/onboarding.test.ts`

**Step 1: Write the failing test**

Create `src/utils/onboarding.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage before importing the module under test
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOnboardingComplete, setOnboardingComplete } from './onboarding';

const mockGetItem = AsyncStorage.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = AsyncStorage.setItem as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getOnboardingComplete', () => {
  it('returns false when key is null', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getOnboardingComplete()).toBe(false);
  });

  it('returns true when key is "true"', async () => {
    mockGetItem.mockResolvedValue('true');
    expect(await getOnboardingComplete()).toBe(true);
  });
});

describe('setOnboardingComplete', () => {
  it('writes "true" to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setOnboardingComplete();
    expect(mockSetItem).toHaveBeenCalledWith('onboarding_complete', 'true');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- onboarding.test
```

Expected: FAIL — `getOnboardingComplete` not found.

**Step 3: Create `src/utils/onboarding.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_complete';

export async function getOnboardingComplete(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY);
  return val === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- onboarding.test
```

Expected: 3 tests passing.

**Step 5: Commit**

```bash
git add src/utils/onboarding.ts src/utils/onboarding.test.ts
git commit -m "feat: add onboarding AsyncStorage utility"
```

---

### Task 3: Improve HomeScreen empty state

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

The current empty state is a single line of text on line 60. Replace it with an icon, heading, subtitle, and inline CTA button. Also add the `MaterialCommunityIcons` import.

**Step 1: Add the import at the top of the file** (after the existing imports)

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
```

**Step 2: Replace the empty state** — find this block:

```tsx
{!isLoading && mares.length === 0 ? <Text style={styles.emptyText}>No mares yet. Add your first mare.</Text> : null}
```

Replace with:

```tsx
{!isLoading && mares.length === 0 ? (
  <View style={styles.emptyState}>
    <MaterialCommunityIcons name="horse" size={72} color={colors.onSurfaceVariant} />
    <Text style={styles.emptyHeading}>No mares yet</Text>
    <Text style={styles.emptySubtitle}>Add your first mare to get started.</Text>
    <Pressable
      style={({ pressed }) => [styles.emptyButton, pressed && styles.pressedOpacity]}
      onPress={() => navigation.navigate('EditMare')}
    >
      <Text style={styles.emptyButtonText}>Add your first mare</Text>
    </Pressable>
  </View>
) : null}
```

**Step 3: Add new styles** — add these entries to the existing `StyleSheet.create({})` block (after `emptyText`):

```tsx
emptyState: {
  alignItems: 'center',
  gap: spacing.md,
  paddingVertical: spacing.xxxl,
},
emptyHeading: {
  ...typography.titleLarge,
  color: colors.onSurface,
},
emptySubtitle: {
  ...typography.bodyMedium,
  color: colors.onSurfaceVariant,
  textAlign: 'center',
},
emptyButton: {
  backgroundColor: colors.primaryContainer,
  borderRadius: borderRadius.md,
  paddingHorizontal: spacing.xl,
  paddingVertical: spacing.md,
  marginTop: spacing.sm,
},
emptyButtonText: {
  ...typography.labelLarge,
  color: colors.onPrimaryContainer,
},
```

**Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: improve mares empty state with icon and CTA"
```

---

### Task 4: Improve StallionManagementScreen empty state

**Files:**
- Modify: `src/screens/StallionManagementScreen.tsx`

The current empty state is on line 182. The form is already visible above it so no CTA button is needed — just icon + text.

**Step 1: Add the import** (after the existing imports):

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
```

**Step 2: Replace the empty state** — find:

```tsx
{!isLoading && stallions.length === 0 ? <Text style={styles.emptyText}>No stallions yet.</Text> : null}
```

Replace with:

```tsx
{!isLoading && stallions.length === 0 ? (
  <View style={styles.emptyState}>
    <MaterialCommunityIcons name="horse-variant" size={56} color={colors.onSurfaceVariant} />
    <Text style={styles.emptyHeading}>No stallions yet</Text>
    <Text style={styles.emptySubtitle}>Add stallions to reference in breeding records.</Text>
  </View>
) : null}
```

**Step 3: Add new styles** — add these to the existing `StyleSheet.create({})` block (after `emptyText`):

```tsx
emptyState: {
  alignItems: 'center',
  gap: spacing.sm,
  paddingVertical: spacing.xxl,
},
emptyHeading: {
  ...typography.titleMedium,
  color: colors.onSurface,
},
emptySubtitle: {
  ...typography.bodyMedium,
  color: colors.onSurfaceVariant,
  textAlign: 'center',
},
```

**Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/screens/StallionManagementScreen.tsx
git commit -m "feat: improve stallions empty state with icon"
```

---

### Task 5: Create WelcomeScreen

**Files:**
- Create: `src/screens/WelcomeScreen.tsx`

**Step 1: Create the file**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, spacing, typography } from '@/theme';
import { setOnboardingComplete } from '@/utils/onboarding';

type Props = {
  onComplete: () => void;
};

export function WelcomeScreen({ onComplete }: Props): JSX.Element {
  const handleGetStarted = async (): Promise<void> => {
    await setOnboardingComplete();
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="horse" size={80} color={colors.primary} />
        <Text style={styles.title}>BreederHelper</Text>
        <Text style={styles.subtitle}>
          Track your mares, breeding records, and foaling results — all offline.
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => {
          void handleGetStarted();
        }}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.labelLarge,
    color: colors.onPrimary,
  },
});
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/screens/WelcomeScreen.tsx
git commit -m "feat: add WelcomeScreen for first-launch onboarding"
```

---

### Task 6: Wire WelcomeScreen into App.tsx

**Files:**
- Modify: `App.tsx`

The current `App.tsx` renders `<AppNavigator />` as soon as the DB is ready. We need to also check AsyncStorage and conditionally render `WelcomeScreen` instead.

**Step 1: Replace `App.tsx` entirely with:**

```tsx
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useAppBootstrap } from './src/storage/useAppBootstrap';
import { getOnboardingComplete } from './src/utils/onboarding';

export default function App(): JSX.Element | null {
  const { isReady, error } = useAppBootstrap();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    getOnboardingComplete().then(setOnboardingComplete);
  }, [isReady]);

  if (error) {
    throw error;
  }

  if (!isReady || onboardingComplete === null) {
    return null;
  }

  if (!onboardingComplete) {
    return (
      <SafeAreaProvider>
        <WelcomeScreen onComplete={() => setOnboardingComplete(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Run all tests**

```bash
npm test
```

Expected: all existing tests still pass (36+), plus the 3 new onboarding utility tests.

**Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: show WelcomeScreen on first launch via AsyncStorage flag"
```

---

### Task 7: Smoke test on device

**Step 1: Run on Android emulator**

```bash
npm run android
```

**Step 2: Verify first-launch flow**

- App shows `WelcomeScreen` with horse icon, title, subtitle, and "Get Started" button
- Tap "Get Started" → navigates to Mares screen
- Mares screen shows horse icon empty state (not the plain text version)
- Navigate to Stallions → shows horse-variant icon empty state

**Step 3: Verify returning user**

- Close and reopen the app
- App goes directly to Mares screen (WelcomeScreen does NOT appear again)

**Step 4: Add a mare and verify normal flow still works**

- Tap "Add your first mare" in empty state → opens AddMare form
- Save a mare → mare appears in list
