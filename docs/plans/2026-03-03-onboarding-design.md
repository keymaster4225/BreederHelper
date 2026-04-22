# Onboarding Design — 2026-03-03

## Context

BreederHelper has no first-launch experience and a bare empty state ("No mares yet. Add your first mare.") on the home screen. The goal is to add a welcoming onboarding flow and richer empty states. Two approaches will be built in parallel worktrees for comparison.

## Target Users

Mixed: experienced horse breeders who want fast data entry AND smaller hobby breeders who may be less familiar. Onboarding should be clean and welcoming — not flowery or tutorial-heavy.

## New Dependencies (both approaches)

- `@expo/vector-icons` — MaterialCommunityIcons `horse` icon and others
- `@react-native-async-storage/async-storage` — persist a single "has_seen_onboarding" boolean

## Shared: Improved Empty States

Both approaches improve the same two empty states:

**HomeScreen (Mares)**
- Large `horse` icon (MaterialCommunityIcons)
- Heading: "No mares yet"
- Subtitle: "Add your first mare to get started."
- Prominent "Add Mare" button (replaces the plain text link)

**StallionManagementScreen**
- Similar icon treatment
- Heading: "No stallions yet"
- Subtitle: "Add stallions to reference in breeding records."

## Approach B — Welcome Screen (`feature/onboarding-welcome`)

Single full-screen shown once on first launch:

```
[horse icon, ~80px]
BreederHelper
Track your mares, breeding records,
and foaling results — all offline.

      [ Get Started ]
```

- "Get Started" dismisses and navigates to Home
- Tracked via AsyncStorage key `onboarding_complete`
- No skip needed — single screen, single tap
- Shown in AppNavigator as an initial route conditional on AsyncStorage flag

## Approach C — Walkthrough (`feature/onboarding-walkthrough`)

Three swipeable cards shown once on first launch:

**Step 1 — Welcome**
- Horse icon + "BreederHelper"
- "Your offline breeding records, always at hand."

**Step 2 — Your Mares**
- List icon + "Start with your mares"
- "Each mare has her own record: daily logs, breeding history, pregnancy checks, and foaling."

**Step 3 — Ready**
- Check icon + "That's it"
- "Add your first mare whenever you're ready."
- "Get Started" button

Navigation:
- Dot indicators (1 of 3)
- "Skip" link top-right (all steps)
- Swipe left/right OR "Next" / "Get Started" button
- Tracked same way as Approach B

## First-Launch Detection

```
AsyncStorage.getItem('onboarding_complete')
  → null  : show onboarding
  → 'true': skip to Home
```

Set to `'true'` when user taps "Get Started" or "Skip".

## File Structure

```
src/
  screens/
    WelcomeScreen.tsx          (Approach B only)
    OnboardingScreen.tsx       (Approach C only)
  utils/
    onboarding.ts              (shared: getOnboardingComplete, setOnboardingComplete)
```

AppNavigator updated in each branch to conditionally show onboarding as initial route.
