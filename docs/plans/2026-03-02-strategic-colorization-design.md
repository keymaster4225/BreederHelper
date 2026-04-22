# Strategic Colorization Design

## Goal

Surface the semantic colors already defined in `theme.ts` in the UI. The score scale, pregnancy result colors, and foaling outcome colors exist in the theme but are never rendered. This makes the app monochromatic when it has meaningful data that should be communicated through color.

## Target Audience

Professional and hobby horse breeders. Color must add clarity and speed to data scanning, not decoration.

## Scope (Option A)

Three changes, all using existing theme colors on existing data:

### 1. Teasing & Edema Score Pills

**Location:** `MareDetailScreen.tsx` — daily logs tab, teasing and edema card rows.

**Current:** Score renders as plain text body ("4", "N/A").

**New:** Score renders inside a small colored pill (rounded background + contrasting text).

| Score | Background | Text Color |
|-------|-----------|------------|
| N/A | `colors.score0` (#E0E0E0) | `colors.onSurfaceVariant` |
| 1 | `colors.score1` (#FFCC80) | `colors.onPrimaryContainer` |
| 2 | `colors.score2` (#FFB74D) | `colors.onPrimaryContainer` |
| 3 | `colors.score3` (#FFA726) | `colors.onPrimaryContainer` |
| 4 | `colors.score4` (#FF9800) | `#FFFFFF` |
| 5 | `colors.score5` (#EF6C00) | `#FFFFFF` |

Implementation: A `ScorePill` component or inline style function that maps score value to background/text colors. Rendered in place of the plain text value in `renderCardRow` for teasing/edema rows.

### 2. Pregnancy Result Badges

**Location:** `MareDetailScreen.tsx` — pregnancy checks tab, result and heartbeat card rows.

**Current:** "Positive" / "Negative" renders as plain body text. "Yes" / "No" for heartbeat.

**New:** Result and heartbeat values render as small colored badges.

| Value | Background | Text Color |
|-------|-----------|------------|
| Positive | `colors.positive` (#4CAF50) | `#FFFFFF` |
| Negative | `colors.negative` (#E53935) | `#FFFFFF` |
| Heartbeat: Yes | `colors.heartbeat` (#EC407A) | `#FFFFFF` |
| Heartbeat: No | `colors.score0` (#E0E0E0) | `colors.onSurfaceVariant` |

### 3. Foaling Outcome Color

**Location:** `MareDetailScreen.tsx` — foaling records tab, outcome card row.

**Current:** Outcome renders as plain body text.

**New:** Outcome text is colored (not a badge — just text color change).

| Outcome | Text Color |
|---------|-----------|
| Live foal | `colors.pregnant` (#66BB6A) |
| Stillborn | `colors.loss` (#EF5350) |
| Abortion | `colors.loss` (#EF5350) |
| Other / unknown | `colors.onSurface` (default) |

## Files Modified

- `src/screens/MareDetailScreen.tsx` — all three changes live here
- Possibly `src/components/FormControls.tsx` or a new small component if we extract `ScorePill` / `StatusBadge` for reuse

## What We Are NOT Changing

- No new colors added to `theme.ts`
- No changes to data model or repositories
- No dark mode
- No decorative color (gradients, glows, etc.)
- Form screens are unchanged — color is added to data display only
