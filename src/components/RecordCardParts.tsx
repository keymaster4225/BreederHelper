import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/Buttons';
import { StatusBadge } from '@/components/StatusBadge';
import { getScoreColors } from '@/utils/scoreColors';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

export function CardRow({ label, value }: { label: string; value: string | number | null | undefined }): JSX.Element {
  return (
    <View style={styles.cardRow}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value ?? '-'}</Text>
    </View>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }): JSX.Element {
  const display = score != null ? String(score) : 'N/A';
  const badgeColors = getScoreColors(score);
  return <StatusBadge label={display} backgroundColor={badgeColors.backgroundColor} textColor={badgeColors.textColor} />;
}

export function EditIconButton({ onPress }: { onPress: () => void }): JSX.Element {
  return <IconButton icon={'\u270E'} onPress={onPress} accessibilityLabel="Edit" />;
}

export const cardStyles = StyleSheet.create({
  listWrap: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
    ...elevation.level1,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.titleSmall,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  cardValue: {
    color: colors.onSurface,
    ...typography.bodyMedium,
  },
  emptyTabState: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    ...typography.bodyMedium,
  },
});

const styles = cardStyles;
