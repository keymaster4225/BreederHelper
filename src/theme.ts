/**
 * Mare Tracker / BreedWise Theme
 *
 * Warm, organic, equestrian-inspired palette.
 * Sage green primary, cream backgrounds, dark cocoa text, serif headers.
 *
 * To use in your React Native app:
 *   import { colors, theme } from '@/theme';
 */

// ============================================================
// Core Color Palette (Warm Equestrian)
// ============================================================

export const colors = {
  // Primary - sage green
  primary: '#97B498',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D5E5D6',
  onPrimaryContainer: '#2E5A30',

  // Secondary - tan/gold
  secondary: '#C19A6B',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F0E2CE',
  onSecondaryContainer: '#5C3D1F',

  // Tertiary - warm brown
  tertiary: '#8B7355',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E8DCCC',
  onTertiaryContainer: '#3E2F1C',

  // Error - for validation, negative results
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  // Surface - cream
  surface: '#FDFBF7',
  onSurface: '#4A3728',
  surfaceVariant: '#F4EFE0',
  onSurfaceVariant: '#706259',

  // Outline - warm tan borders
  outline: '#C4B5A4',
  outlineVariant: '#DDD4C5',

  // Inverse - for snackbars, tooltips
  inverseSurface: '#4A3728',
  inverseOnSurface: '#FDF8F0',
  inversePrimary: '#B8D4B9',

  // Misc
  shadow: '#000000',
  scrim: '#000000',
  surfaceTint: '#97B498',

  // ============================================================
  // Semantic Colors (app-specific meanings)
  // ============================================================

  // Pregnancy check results
  positive: '#4CAF50',          // Positive result (green)
  negative: '#E53935',          // Negative result (red)
  heartbeat: '#EC407A',         // Heartbeat indicator (pink)

  // Teasing / edema score scale (0-5)
  score0: '#9E9E9E',           // No interest / no edema
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
    fontFamily: 'Lora_400Regular',
    lineHeight: 40,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontSize: 28,
    fontWeight: '400' as const,
    fontFamily: 'Lora_400Regular',
    lineHeight: 36,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontSize: 24,
    fontWeight: '400' as const,
    fontFamily: 'Lora_400Regular',
    lineHeight: 32,
    letterSpacing: 0,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: '400' as const,
    fontFamily: 'Lora_400Regular',
    lineHeight: 28,
    letterSpacing: 0,
  },
  titleMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    fontFamily: 'Inter_500Medium',
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontSize: 14,
    fontWeight: '500' as const,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: '500' as const,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    fontFamily: 'Inter_500Medium',
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    fontFamily: 'Inter_500Medium',
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
  sm: 8,
  md: 12,
  lg: 24,
  xl: 32,
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
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  level2: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  level3: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
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
