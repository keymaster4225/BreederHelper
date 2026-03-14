import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, spacing, typography } from '@/theme';

type StatusBadgeProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
};

export function StatusBadge({ label, backgroundColor, textColor }: StatusBadgeProps): JSX.Element {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.labelMedium,
  },
});
