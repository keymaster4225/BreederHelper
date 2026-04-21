import { StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import {
  CollectionWizardOnFarmRow,
  CollectionWizardShippedRow,
} from '@/hooks/useCollectionWizard';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';

type Props = {
  collectionDate: string;
  doseCount: number | null;
  doseSizeMillions: number | null;
  notes: string;
  rawVolumeMl: number | null;
  totalVolumeMl: number | null;
  extenderVolumeMl: number | null;
  extenderType: string;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
  shippedRows: readonly CollectionWizardShippedRow[];
  onFarmRows: readonly CollectionWizardOnFarmRow[];
  mareNameById: Record<string, string>;
  allocatedDoseCount: number;
  remainingDoseCount: number | null;
  onJumpToStep: (stepIndex: number) => void;
};

export function ReviewStep({
  collectionDate,
  doseCount,
  doseSizeMillions,
  notes,
  rawVolumeMl,
  totalVolumeMl,
  extenderVolumeMl,
  extenderType,
  concentrationMillionsPerMl,
  progressiveMotilityPercent,
  shippedRows,
  onFarmRows,
  mareNameById,
  allocatedDoseCount,
  remainingDoseCount,
  onJumpToStep,
}: Props): JSX.Element {
  return (
    <>
      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Collection Basics</Text>
        <CardRow label="Collection Date" value={formatLocalDate(collectionDate, 'MM-DD-YYYY')} />
        <CardRow label="Dose Count" value={doseCount == null ? '-' : doseCount} />
        <CardRow label="Dose Size" value={doseSizeMillions == null ? '-' : `${doseSizeMillions}M`} />
        <CardRow label="Notes" value={notes || '-'} />
        <SecondaryButton label="Edit Basics" onPress={() => onJumpToStep(0)} />
      </View>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Processing Details</Text>
        <CardRow label="Raw Volume" value={rawVolumeMl == null ? '-' : `${rawVolumeMl} mL`} />
        <CardRow label="Total Volume" value={totalVolumeMl == null ? '-' : `${totalVolumeMl} mL`} />
        <CardRow label="Extender Volume" value={extenderVolumeMl == null ? '-' : `${extenderVolumeMl} mL`} />
        <CardRow label="Extender Type" value={extenderType || '-'} />
        <CardRow label="Concentration" value={concentrationMillionsPerMl == null ? '-' : `${concentrationMillionsPerMl} M/mL`} />
        <CardRow label="Motility" value={progressiveMotilityPercent == null ? '-' : `${progressiveMotilityPercent}%`} />
        <SecondaryButton label="Edit Processing" onPress={() => onJumpToStep(1)} />
      </View>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Dose Allocation</Text>
        <CardRow label="Allocated" value={allocatedDoseCount} />
        <CardRow label="Remaining" value={remainingDoseCount == null ? '-' : remainingDoseCount} />
        <Text style={styles.subsectionTitle}>Shipped</Text>
        {shippedRows.length === 0 ? (
          <Text style={styles.emptyText}>No shipped allocations.</Text>
        ) : (
          <View style={styles.reviewList}>
            {shippedRows.map((row, index) => (
              <View key={`review-shipped-${index}`} style={styles.reviewItem}>
                <Text style={styles.itemTitle}>{row.recipient}</Text>
                <Text style={styles.itemMeta}>
                  {`${row.doseCount} doses • ${formatLocalDate(row.eventDate, 'MM-DD-YYYY')} • ${row.carrierService}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.subsectionTitle}>On-Farm</Text>
        {onFarmRows.length === 0 ? (
          <Text style={styles.emptyText}>No on-farm allocations.</Text>
        ) : (
          <View style={styles.reviewList}>
            {onFarmRows.map((row, index) => (
              <View key={`review-on-farm-${index}`} style={styles.reviewItem}>
                <Text style={styles.itemTitle}>{mareNameById[row.mareId] ?? 'Unknown mare'}</Text>
                <Text style={styles.itemMeta}>
                  {`${row.doseCount} doses • ${formatLocalDate(row.eventDate, 'MM-DD-YYYY')}`}
                </Text>
              </View>
            ))}
          </View>
        )}
        <SecondaryButton label="Edit Allocation" onPress={() => onJumpToStep(2)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subsectionTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  reviewList: {
    gap: spacing.sm,
  },
  reviewItem: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  itemTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  itemMeta: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
});
