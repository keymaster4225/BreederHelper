# UI Polish & Visual Refinement Design

**Date:** 2026-03-01
**Status:** Approved
**Goal:** Comprehensive polish pass — pressed states, elevation, spacing normalization, shared button components, card styling, and empty/loading state improvements. Clean & modern style, keeping the warm brown Material 3 identity.

## 1. Shared Button Components

New file: `src/components/Buttons.tsx`

### PrimaryButton
- Solid `colors.primary` fill, `colors.onPrimary` text
- Props: `label: string`, `onPress: () => void`, `disabled?: boolean`
- `elevation.level1` shadow, `borderRadius.md`
- Pressed state: `opacity: 0.85`
- Disabled state: `colors.primaryContainer` background

### SecondaryButton
- Outlined, no fill. `colors.outline` border, `colors.onSurface` text
- Props: `label: string`, `onPress: () => void`
- Pressed state: `opacity: 0.7`

### IconButton
- 28x28 round button for edit pencil icons
- Props: `icon: string`, `onPress: () => void`
- `colors.surfaceVariant` background, `borderRadius.xl`
- Pressed state: background shifts to `colors.outlineVariant`

## 2. Pressed States & Elevation

All interactive `Pressable` elements gain visual feedback:
- Buttons: `opacity: 0.85` on press
- List rows / tappable cards: `opacity: 0.92` on press
- Mare list rows (HomeScreen): `elevation.level1`
- Mare detail header card: `elevation.level2`
- Record cards (MareDetailScreen): `elevation.level1`

## 3. Spacing & Typography Normalization

Replace raw numbers with theme tokens:

| Raw value | Replacement |
|-----------|-------------|
| `gap: 10` | `gap: spacing.md` (12) |
| `gap: 3` | `gap: spacing.xs` (4) |
| `gap: 6` | `gap: spacing.sm` (8) |
| `paddingHorizontal: 14` | `paddingHorizontal: spacing.lg` (16) |
| `paddingVertical: 10` | `paddingVertical: spacing.md` (12) |
| `paddingBottom: 30` | `paddingBottom: spacing.xxxl` (32) |
| `marginRight: 10` | `marginRight: spacing.md` (12) |
| `padding: 10` | `padding: spacing.md` (12) |

Typography normalization:
- `headerName` (`fontSize: 18, fontWeight: '700'`) → `typography.titleMedium` with `fontWeight: '700'` override
- `headerLine` (`fontSize: 13`) → `typography.bodySmall`

## 4. Card Data Row Styling

MareDetailScreen record cards: replace unstyled `<Text>Label: value</Text>` with styled label/value pairs.
- Labels: `typography.bodySmall`, `colors.onSurfaceVariant`
- Values: `typography.bodyMedium`, `colors.onSurface`
- Implementation: local `CardRow` render helper in MareDetailScreen (not a separate component file).

## 5. Empty & Loading States

- Empty states: `typography.bodyMedium`, `colors.onSurfaceVariant`, centered with vertical padding
- Loading: Replace plain "Loading..." text with `ActivityIndicator` from React Native, `color={colors.primary}`

## 6. Files Changed

| File | Changes |
|------|---------|
| `src/components/Buttons.tsx` | **New** — PrimaryButton, SecondaryButton, IconButton |
| `src/components/FormControls.tsx` | Use PrimaryButton for save button, normalize spacing |
| `src/screens/HomeScreen.tsx` | Shared buttons, pressed states, elevation, spacing/typography normalization |
| `src/screens/MareDetailScreen.tsx` | Shared buttons, IconButton, elevation, card row styling, spacing/typography |
| `src/screens/StallionManagementScreen.tsx` | Shared buttons, pressed states, elevation, spacing |
| `src/screens/EditMareScreen.tsx` | PrimaryButton for save, spacing normalization |
| `src/screens/DailyLogFormScreen.tsx` | PrimaryButton for save, spacing normalization |
| `src/screens/BreedingRecordFormScreen.tsx` | PrimaryButton for save, spacing normalization |
| `src/screens/PregnancyCheckFormScreen.tsx` | PrimaryButton for save, spacing normalization |
| `src/screens/FoalingRecordFormScreen.tsx` | PrimaryButton for save, spacing normalization |

No changes needed to `src/theme.ts` — all required tokens already exist.
