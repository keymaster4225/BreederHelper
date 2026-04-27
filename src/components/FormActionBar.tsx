import { StyleSheet, View } from 'react-native';

import { DeleteButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { colors, spacing } from '@/theme';

export const STICKY_ACTION_BAR_SCROLL_PADDING = 220;

export type FormActionBarProps = {
  readonly primaryLabel: string;
  readonly onPrimaryPress: () => void;
  readonly primaryDisabled?: boolean;
  readonly secondaryLabel?: string;
  readonly onSecondaryPress?: () => void;
  readonly secondaryDisabled?: boolean;
  readonly destructiveLabel?: string;
  readonly onDestructivePress?: () => void;
  readonly destructiveDisabled?: boolean;
};

export function FormActionBar({
  primaryLabel,
  onPrimaryPress,
  primaryDisabled,
  secondaryLabel,
  onSecondaryPress,
  secondaryDisabled,
  destructiveLabel,
  onDestructivePress,
  destructiveDisabled,
}: FormActionBarProps): JSX.Element {
  return (
    <View style={styles.container}>
      <PrimaryButton
        label={primaryLabel}
        onPress={onPrimaryPress}
        disabled={primaryDisabled}
      />
      {secondaryLabel && onSecondaryPress ? (
        <SecondaryButton
          label={secondaryLabel}
          onPress={onSecondaryPress}
          disabled={secondaryDisabled}
        />
      ) : null}
      {destructiveLabel && onDestructivePress ? (
        <DeleteButton
          label={destructiveLabel}
          onPress={onDestructivePress}
          disabled={destructiveDisabled}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.outlineVariant,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
});
