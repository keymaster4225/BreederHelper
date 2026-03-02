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
};

export function SecondaryButton({ label, onPress }: SecondaryButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedOpacityLight]}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

type IconButtonProps = {
  icon: string;
  onPress: () => void;
};

export function IconButton({ icon, onPress }: IconButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
      onPress={onPress}
    >
      <Text style={styles.iconText}>{icon}</Text>
    </Pressable>
  );
}

type DeleteButtonProps = {
  label: string;
  onPress: () => void;
};

export function DeleteButton({ label, onPress }: DeleteButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressedOpacity]}
      onPress={onPress}
    >
      <Text style={styles.deleteButtonText}>{label}</Text>
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
    ...typography.labelLarge,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  deleteButtonText: {
    color: colors.error,
    ...typography.labelLarge,
  },
  pressedOpacity: {
    opacity: 0.85,
  },
  pressedOpacityLight: {
    opacity: 0.7,
  },
});
