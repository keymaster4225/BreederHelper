# Splash Screen Implementation Plan

**Date:** 2026-04-05
**Status:** Approved for implementation

## Goal

Replace the current first-run onboarding flow with a branded splash screen that appears on launch for `1200ms`, then automatically enters the main app.

## Scope

- Rework `src/screens/WelcomeScreen.tsx` into a true launch splash screen
- Simplify startup orchestration in `App.tsx` so it no longer depends on onboarding state
- Remove now-unused onboarding storage dependency from the app flow
- Preserve the existing warm equestrian design language from `src/theme.ts`

## Target Behavior

- App launches
- Fonts and DB bootstrap complete as they do now
- Splash screen renders automatically
- Splash remains visible for `1200ms`
- Splash dismisses automatically
- App enters `src/navigation/AppNavigator.tsx` with no tap and no first-run gating
- On every launch, the splash appears the same way

## Files To Change

- `App.tsx`
- `src/screens/WelcomeScreen.tsx`
- Possibly `src/utils/onboarding.ts` if cleanup is desired now rather than later
- Relevant tests, likely:
  - `src/navigation/AppNavigator.integration.test.tsx`
  - any tests that assume onboarding still exists

## Planned Changes

### 1. Refactor startup flow in `App.tsx`

- Remove `onboardingComplete` state
- Remove the `useEffect` that calls `getOnboardingComplete()`
- Remove the conditional branch that decides between `WelcomeScreen` and `AppNavigator`
- Introduce a local splash visibility state, likely `showSplash`
- Once `fontsLoaded` and `isReady` are both true, start a `1200ms` timer
- While the timer is active, render `WelcomeScreen`
- After the timer completes, render `AppNavigator`
- Keep existing error handling intact
- Keep `SafeAreaProvider` wrapping both splash and navigator so layout behavior stays consistent

### 2. Redesign `WelcomeScreen.tsx` into a launch splash

- Remove onboarding-specific behavior:
  - `onComplete` prop
  - `handleGetStarted`
  - `setOnboardingComplete`
  - bottom CTA button
- Replace the screen structure with a visual-first, centered composition:
  - full-screen container
  - centered crest/medallion area
  - horse icon inside or over the crest
  - `BreedWise` title
  - subtitle: `Mare and stallion records, all in one place.`
- Use the existing warm theme tokens instead of inventing a disconnected palette
- Keep the layout intentionally simple because the screen is only visible for `1200ms`

### 3. Visual design details for `WelcomeScreen.tsx`

- Background:
  - base: `colors.surface`
  - add subtle layered warm shapes or tonal blocks using `colors.surfaceVariant`, `colors.primaryContainer`, or `colors.secondaryContainer`
- Crest:
  - circular or softly rounded medallion
  - primary tone: sage-driven, not bright green
  - horse icon centered and high-contrast
- Typography:
  - `BreedWise` in the existing serif family already used in theme
  - subtitle in Inter
  - left-right padding generous enough to feel composed on both phone sizes and tablets
- Composition:
  - vertically centered stack
  - no bottom action area
  - no instructional text
  - no progress indicators

### 4. Motion plan

- Keep motion light and short so it does not feel like fake loading
- Suggested implementation:
  - splash content fades in quickly on mount
  - optional small upward settle on the crest/title group
- Avoid complex animation libraries unless already present; native `Animated` is likely sufficient
- Respect reduced-complexity principles even if explicit reduced-motion handling is not yet in the app

### 5. Onboarding code cleanup

- Immediate functional cleanup:
  - stop importing `getOnboardingComplete` in `App.tsx`
  - stop importing `setOnboardingComplete` in `src/screens/WelcomeScreen.tsx`
- Optional cleanup after behavior is confirmed:
  - delete `src/utils/onboarding.ts`
  - remove obsolete onboarding tests
- Treat deletion as a second cleanup pass if desired

## Implementation Order

1. Update `App.tsx` to control splash timing instead of onboarding state
2. Redesign `src/screens/WelcomeScreen.tsx` to be a non-interactive splash
3. Run typecheck and relevant tests
4. Clean up unused onboarding utilities if they are no longer referenced
5. Re-run verification

## Testing Plan

- Manual behavior checks:
  - cold launch shows splash
  - splash lasts about `1200ms`
  - no tap required
  - app lands in the main dashboard/home tab
  - repeat launch behaves the same way every time
- Code-level checks:
  - typecheck for prop/signature changes after removing `onComplete`
  - screen/integration tests updated so they no longer expect onboarding persistence
- Edge cases:
  - app does not show splash before fonts/db are ready if current startup contract is preserved
  - timer cleanup on unmount to avoid state updates after unmount
  - bootstrap error path still throws correctly

## Risks

- Existing tests may encode the onboarding flow and will fail until updated
- If the splash timer starts too early, users may not actually see the full `1200ms`; it should begin only after bootstrap readiness
- If `src/screens/WelcomeScreen.tsx` keeps onboarding-era props during refactor, the app can compile but behave inconsistently

## Recommended Technical Shape

- Keep `WelcomeScreen` as a presentational component with no storage logic
- Let `App.tsx` own timing and startup sequencing
- Do not embed navigation logic inside the splash screen itself; simply swap rendered trees in `App.tsx`
