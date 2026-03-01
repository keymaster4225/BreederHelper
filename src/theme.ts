/**
 * Mare Tracker / BreederHelper Theme
 *
 * Based on Flutter Material 3 color scheme generated from Colors.brown seed.
 * Material 3 uses HCT color space to generate harmonious palettes.
 *
 * To use in your React Native app:
 *   import { colors, theme } from './theme';
 *
 * Usage with Claude Code:
 *   Drop this file into your project's src/constants/ or src/theme/ directory
 *   and import where needed.
 */

// ============================================================
// Core Color Palette (Material 3 generated from brown seed)
// ============================================================

export const colors = {
  // Primary - warm brown tones (main app identity)
  primary: '#7B5733',          // Primary buttons, app bar, FABs
  onPrimary: '#FFFFFF',        // Text/icons on primary surfaces
  primaryContainer: '#FFDDB8', // Lighter brown for cards, chips
  onPrimaryContainer: '#2C1600', // Text on primary container

  // Secondary - muted warm tones
  secondary: '#6E5C3F',        // Secondary buttons, less emphasis
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F8DFBB', // Tags, badges, subtle highlights
  onSecondaryContainer: '#261904',

  // Tertiary - olive/sage accent (complementary)
  tertiary: '#51643B',         // Accent elements, positive indicators
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#D4EAB5',
  onTertiaryContainer: '#0F2000',

  // Error - for validation, negative results
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  // Surface - backgrounds and cards
  surface: '#FFF8F4',          // Main background
  onSurface: '#201B13',        // Primary text color
  surfaceVariant: '#F0E0CF',   // Card backgrounds, input fields
  onSurfaceVariant: '#504539',  // Secondary text, labels, hints

  // Outline - borders and dividers
  outline: '#827568',          // Borders, dividers
  outlineVariant: '#D4C4B3',   // Subtle dividers

  // Inverse - for snackbars, tooltips
  inverseSurface: '#362F27',
  inverseOnSurface: '#FAEEE3',
  inversePrimary: '#EFBD80',

  // Misc
  shadow: '#000000',
  scrim: '#000000',
  surfaceTint: '#7B5733',

  // ============================================================
  // Semantic Colors (app-specific meanings)
  // ============================================================

  // Pregnancy check results
  positive: '#4CAF50',          // Positive result (green)
  negative: '#E53935',          // Negative result (red)
  heartbeat: '#EC407A',         // Heartbeat indicator (pink)

  // Teasing / edema score scale (0-5)
  score0: '#E0E0E0',           // No interest / no edema
  score1: '#FFCC80',           // Minimal
  score2: '#FFB74D',           // Mild
  score3: '#FFA726',           // Moderate
  score4: '#FF9800',           // Strong
  score5: '#EF6C00',           // Standing heat / max edema

  // Status indicators
  open: '#78909C',             // Open / not pregnant
  pregnant: '#66BB6A',         // Confirmed pregnant
  foaled: '#42A5F5',           // Successfully foaled
  loss: '#EF5350',             // Embryonic loss / abortion
};

// ============================================================
// Typography
// ============================================================

export const typography = {
  headlineLarge: {
    fontSize: 32,
    fontWeight: '400' as const,
    lineHeight: 40,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontSize: 28,
    fontWeight: '400' as const,
    lineHeight: 36,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontSize: 24,
    fontWeight: '400' as const,
    lineHeight: 32,
    letterSpacing: 0,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: '400' as const,
    lineHeight: 28,
    letterSpacing: 0,
  },
  titleMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
};

// ============================================================
// Spacing (consistent padding/margins)
// ============================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ============================================================
// Border Radius
// ============================================================

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// ============================================================
// Elevation (shadows for cards, buttons, etc.)
// ============================================================

export const elevation = {
  level0: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  level2: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  level3: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
};

// ============================================================
// Combined Theme Object
// ============================================================

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  elevation,
};

export default theme;
