import { Pressable, StyleSheet, Text } from 'react-native';

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
  icon: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function IconButton({ icon, onPress, accessibilityLabel }: IconButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.iconText}>{icon}</Text>
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
    borderRadius: borderRadius.md,
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
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
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
