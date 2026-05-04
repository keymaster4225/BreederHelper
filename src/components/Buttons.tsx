import { Pressable, StyleSheet, Text } from 'react-native';
import type { ReactNode } from 'react';

import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.pressedOpacity,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function SecondaryButton({ label, onPress, disabled }: SecondaryButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.secondaryButtonDisabled,
        pressed && !disabled && styles.pressedOpacityLight,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.secondaryButtonText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function IconButton({ icon, onPress, accessibilityLabel, disabled }: IconButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.iconButton,
        disabled && styles.iconButtonDisabled,
        pressed && !disabled && styles.iconButtonPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
    >
      {typeof icon === 'string' ? <Text style={styles.iconText}>{icon}</Text> : icon}
    </Pressable>
  );
}

type DeleteButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function DeleteButton({ label, onPress, disabled }: DeleteButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.deleteButton,
        disabled && styles.deleteButtonDisabled,
        pressed && !disabled && styles.pressedOpacity,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.deleteButtonText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...elevation.level1,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.primaryContainer,
    ...elevation.level0,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.xl,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  iconButtonPressed: {
    backgroundColor: colors.outlineVariant,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconText: {
    color: colors.onSurface,
    fontSize: 20,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.error,
    ...typography.labelLarge,
  },
  disabledText: {
    opacity: 0.7,
  },
  pressedOpacity: {
    opacity: 0.85,
  },
  pressedOpacityLight: {
    opacity: 0.7,
  },
});
