# Onboarding: Walkthrough Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 3-step swipeable walkthrough shown on first launch, plus improved empty states on the Mares and Stallions screens.

**Architecture:** `App.tsx` checks AsyncStorage after DB bootstrap; if `onboarding_complete` is not set, renders `OnboardingScreen` instead of `AppNavigator`. Users can swipe through 3 steps or tap Next/Skip. Completing or skipping sets the flag and swaps in the normal navigator. Empty states are improved in-place.

**Tech Stack:** Expo SDK 55, React Native, TypeScript, `@expo/vector-icons` (MaterialCommunityIcons), `@react-native-async-storage/async-storage`, Vitest

**Worktree:** `.worktrees/onboarding-walkthrough` on branch `feature/onboarding-walkthrough`

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

**Step 1: Add the import** (after the existing imports):

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
```

**Step 2: Replace the empty state** — find:

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

**Step 3: Add new styles** — in the existing `StyleSheet.create({})` block, after `emptyText`:

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

**Step 1: Add the import** (after existing imports):

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
```

**Step 2: Replace the empty state** — find (line ~182):

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

**Step 3: Add new styles** — after `emptyText` in the stylesheet:

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

### Task 5: Create OnboardingScreen

**Files:**
- Create: `src/screens/OnboardingScreen.tsx`

This screen renders 3 horizontally pageable slides in a `ScrollView` with `pagingEnabled`. A footer shows dot indicators and a Next / Get Started button. A Skip link appears top-right throughout.

**Step 1: Create the file**

```tsx
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, spacing, typography } from '@/theme';
import { setOnboardingComplete } from '@/utils/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = {
  icon: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: 'horse',
    title: 'BreederHelper',
    body: 'Your offline breeding records, always at hand.',
  },
  {
    icon: 'format-list-bulleted',
    title: 'Start with your mares',
    body: 'Each mare has her own record: daily logs, breeding history, pregnancy checks, and foaling.',
  },
  {
    icon: 'check-circle-outline',
    title: "That's it",
    body: "Add your first mare whenever you're ready.",
  },
];

type Props = {
  onComplete: () => void;
};

export function OnboardingScreen({ onComplete }: Props): JSX.Element {
  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleComplete = async (): Promise<void> => {
    await setOnboardingComplete();
    onComplete();
  };

  const handleNext = (): void => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      setCurrentStep(next);
    } else {
      void handleComplete();
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const step = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentStep(step);
  };

  const isLast = currentStep === STEPS.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.skip} onPress={() => { void handleComplete(); }}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {STEPS.map((step, index) => (
          <View key={index} style={styles.slide}>
            <MaterialCommunityIcons
              name={step.icon as 'horse'}
              size={80}
              color={colors.primary}
            />
            <Text style={styles.slideTitle}>{step.title}</Text>
            <Text style={styles.slideBody}>{step.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  skipText: {
    ...typography.labelLarge,
    color: colors.onSurfaceVariant,
  },
  pager: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  slideTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    textAlign: 'center',
  },
  slideBody: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.outlineVariant,
  },
  dotActive: {
    backgroundColor: colors.primary,
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
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: add OnboardingScreen 3-step walkthrough"
```

---

### Task 6: Wire OnboardingScreen into App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Replace `App.tsx` entirely with:**

```tsx
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
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
        <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />
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
git commit -m "feat: show OnboardingScreen walkthrough on first launch"
```

---

### Task 7: Smoke test on device

**Step 1: Run on Android emulator**

```bash
npm run android
```

**Step 2: Verify first-launch walkthrough**

- App shows Step 1: horse icon, "BreederHelper", subtitle text
- "Skip" link visible top-right
- Dot indicators show step 1 of 3 active
- Swipe left → Step 2 (list icon, "Start with your mares")
- Swipe left → Step 3 (check icon, "That's it", button says "Get Started")
- Tap "Get Started" → navigates to Mares screen

**Step 3: Verify Skip works**

- Force-clear AsyncStorage (uninstall/reinstall app or clear app data)
- Reopen → walkthrough shows
- Tap "Skip" on Step 1 → navigates directly to Mares screen

**Step 4: Verify returning user**

- Close and reopen — app goes directly to Mares screen

**Step 5: Verify empty states**

- Mares screen (empty): horse icon + "No mares yet" + subtitle + "Add your first mare" button
- Stallions screen (empty): horse-variant icon + "No stallions yet" + subtitle
