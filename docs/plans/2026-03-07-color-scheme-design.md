# Color Scheme Refresh — Design Doc

**Date:** 2026-03-07
**Status:** Approved

## Problem

The current brown/tan Material 3 palette (seeded from `Colors.brown`) feels flat and dated. The goal is a clean, modern app aesthetic that doesn't lean on equestrian theming.

## Chosen Direction: Option B — Slate Indigo + Soft White

Backup option (not implemented): Option C — Deep Emerald + Warm Cream.

## Palette

### Primary
| Token | Value | Usage |
|---|---|---|
| `primary` | `#3D52A0` | Nav bars, primary buttons, FABs |
| `onPrimary` | `#FFFFFF` | Text/icons on primary surfaces |
| `primaryContainer` | `#DEE0FF` | Chips, card highlights |
| `onPrimaryContainer` | `#00105C` | Text on primary container |

### Secondary
| Token | Value | Usage |
|---|---|---|
| `secondary` | `#5A5F89` | Secondary buttons, less emphasis |
| `onSecondary` | `#FFFFFF` | |
| `secondaryContainer` | `#E0E3FF` | Badges, subtle highlights |
| `onSecondaryContainer` | `#171B52` | |

### Tertiary
| Token | Value | Usage |
|---|---|---|
| `tertiary` | `#3B7EA1` | Warm teal accent, breaks up blues |
| `onTertiary` | `#FFFFFF` | |
| `tertiaryContainer` | `#C5E8FF` | |
| `onTertiaryContainer` | `#001E2E` | |

### Surfaces
| Token | Value | Usage |
|---|---|---|
| `surface` | `#F9F9FB` | Main background (near-white, slight blue-gray) |
| `onSurface` | `#1A1C2E` | Primary text |
| `surfaceVariant` | `#E4E5F4` | Card backgrounds, input fields |
| `onSurfaceVariant` | `#464775` | Secondary text, labels, hints |

### Outline
| Token | Value | Usage |
|---|---|---|
| `outline` | `#767AA3` | Borders, dividers |
| `outlineVariant` | `#C5C6E8` | Subtle dividers |

### Inverse
| Token | Value | Usage |
|---|---|---|
| `inverseSurface` | `#2E2F4F` | Snackbars, tooltips |
| `inverseOnSurface` | `#F1F0FF` | |
| `inversePrimary` | `#BAC3FF` | |

### Misc
| Token | Value |
|---|---|
| `shadow` | `#000000` |
| `scrim` | `#000000` |
| `surfaceTint` | `#3D52A0` |

## Semantic Colors (unchanged)

Functional colors are retained as-is — they harmonize well with cool primaries and serve clear domain meanings.

- `positive`: `#4CAF50`
- `negative`: `#E53935`
- `heartbeat`: `#EC407A`
- Score scale: `#E0E0E0` → `#EF6C00`
- Status: open `#78909C`, pregnant `#66BB6A`, foaled `#42A5F5`, loss `#EF5350`

## Scope

Update `src/theme.ts` only. No component changes required — all screens reference `colors.*` tokens, so the update is automatic.
