# Theme Integration Design

**Date:** 2026-02-28
**Status:** Approved

## Overview

Adopt the Material 3-inspired warm brown theme defined in `theme.ts` across the entire BreederHelper app. Replace all hardcoded color, typography, spacing, border radius, and elevation values with centralized theme tokens.

## Approach

**Approach A — Direct imports.** Move `theme.ts` to `src/theme.ts`. Each file imports what it needs directly:

```ts
import { colors, typography, spacing, borderRadius, elevation } from '../theme';
```

No React Context provider, no runtime theme switching. Styles remain in `StyleSheet.create()` blocks referencing theme constants.

**Rationale:** Simplest solution, no new infrastructure, zero runtime overhead, easy to review. Dark mode is not a requirement; if it ever becomes one, this is a well-understood migration path.

## Files to Modify

1. `src/theme.ts` — destination for `theme.ts` (moved from project root)
2. `src/components/FormControls.tsx` — shared form styles (largest impact)
3. `src/components/Screen.tsx` — screen background color
4. `src/screens/HomeScreen.tsx` — mare list, buttons
5. `src/screens/MareDetailScreen.tsx` — detail view, tabs, cards
6. `src/screens/StallionManagementScreen.tsx` — stallion list/form
7. `src/screens/EditMareScreen.tsx` — edit form
8. `src/screens/BreedingRecordFormScreen.tsx` — breeding form
9. Any other screen files discovered to have hardcoded styles

**No changes to:** Navigation config, repositories, models, utils, migrations, or any business logic.

## Color Mapping

| Current hardcoded value | Theme token | Usage |
|------------------------|------------|-------|
| `#1f6feb` | `colors.primary` | Primary buttons, active tabs |
| `#9bbcf3` | `colors.primaryContainer` | Disabled button state |
| `#ffffff` (backgrounds) | `colors.surface` | Screen/card backgrounds |
| `#ffffff` (on primary) | `colors.onPrimary` | Text on primary buttons |
| `#1b1f24` | `colors.onSurface` | Primary text |
| `#57606a` | `colors.onSurfaceVariant` | Subtitle/meta text |
| `#d0d7de` | `colors.outline` | Borders, dividers |
| `#f7f9fb` / `#f3f4f6` | `colors.surfaceVariant` | Card/row backgrounds |
| `#eceff3` | `colors.secondaryContainer` | Secondary button backgrounds |
| `#8c959f` | `colors.onSurfaceVariant` | Placeholder text |
| `#b42318` | `colors.error` | Error text, delete buttons |
| `#ffe3e0` | `colors.errorContainer` | Delete button background |

## Typography Mapping

| Context | Theme token |
|---------|------------|
| Screen titles / headers | `typography.titleLarge` |
| Section headings | `typography.titleMedium` |
| Card titles, row titles | `typography.titleSmall` |
| Body text, input values | `typography.bodyLarge` |
| Subtitle/meta text | `typography.bodyMedium` |
| Small labels, captions | `typography.bodySmall` |
| Button text | `typography.labelLarge` |
| Tab labels, chips | `typography.labelMedium` |

## Spacing Mapping

| Current value | Theme token |
|---------------|------------|
| `4` | `spacing.xs` |
| `8` | `spacing.sm` |
| `12` | `spacing.md` |
| `16` | `spacing.lg` |
| `20` | `spacing.xl` |
| `24` | `spacing.xxl` |
| `32` | `spacing.xxxl` |

## Border Radius Mapping

| Current value | Theme token |
|---------------|------------|
| `4` | `borderRadius.sm` |
| `6` / `8` | `borderRadius.md` |
| `12` | `borderRadius.lg` |
| `16` | `borderRadius.xl` |

## Elevation

Apply to cards and buttons where shadow styles exist:
- Most cards: `elevation.level1`
- Prominent elements (modals, FABs): `elevation.level2`

## Risk Assessment

| Category | Risk | Notes |
|----------|------|-------|
| Colors | Very low | Visual only, no logic impact |
| Spacing | Low | Values map cleanly to existing numbers |
| Border radius | Low | Simple numeric substitution |
| Elevation | Low | Shadow styling only |
| Typography | Medium | `fontSize`/`lineHeight`/`letterSpacing` change together; requires visual review pass |

## Success Criteria

1. `npm run typecheck` passes
2. `npm test` passes
3. No hardcoded color hex values remain in `src/`
4. No hardcoded spacing/typography/radius values that have a theme equivalent remain in `src/`
5. App renders correctly on Android emulator (visual review)
