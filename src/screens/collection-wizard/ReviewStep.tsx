import { StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { CollectionWizardAllocationRow } from '@/hooks/useCollectionWizard';
import { colors, spacing, typography } from '@/theme';
import type { AllocationSummary } from '@/utils/collectionAllocation';
import type { CollectionMathDerived } from '@/utils/collectionCalculator';
import { formatLocalDate } from '@/utils/dates';

type Props = {
  collectionDate: string;
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
  targetMotileSpermMillionsPerDose: number | null;
  targetPostExtensionConcentrationMillionsPerMl: number | null;
  extenderType: string;
  notes: string;
  derivedMath: CollectionMathDerived;
  allocationRows: readonly CollectionWizardAllocationRow[];
  mareNameById: Record<string, string>;
  allocationSummary: AllocationSummary;
  remainingApproxDoses: number | null;
  onJumpToStep: (stepIndex: number) => void;
};

function formatMl(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} mL`;
}

export function ReviewStep({
  collectionDate,
  rawVolumeMl,
  concentrationMillionsPerMl,
  progressiveMotilityPercent,
  targetMotileSpermMillionsPerDose,
  targetPostExtensionConcentrationMillionsPerMl,
  extenderType,
  notes,
  derivedMath,
  allocationRows,
  mareNameById,
  allocationSummary,
  remainingApproxDoses,
  onJumpToStep,
}: Props): JSX.Element {
  const shippedRows = allocationRows.filter(
    (row): row is Extract<CollectionWizardAllocationRow, { kind: 'shipped' }> =>
      row.kind === 'shipped',
  );
  const onFarmRows = allocationRows.filter(
    (row): row is Extract<CollectionWizardAllocationRow, { kind: 'usedOnSite' }> =>
      row.kind === 'usedOnSite',
  );

  return (
    <>
      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Collection</Text>
        <CardRow label="Collection Date" value={formatLocalDate(collectionDate, 'MM-DD-YYYY')} />
        <CardRow label="Total Volume" value={formatMl(rawVolumeMl)} />
        <CardRow
          label="Concentration"
          value={
            concentrationMillionsPerMl == null
              ? '-'
              : `${concentrationMillionsPerMl.toFixed(2)} M/mL`
          }
        />
        <CardRow
          label="Motility"
          value={
            progressiveMotilityPercent == null ? '-' : `${progressiveMotilityPercent}%`
          }
        />
        <SecondaryButton label="Edit Collection" onPress={() => onJumpToStep(0)} />
      </View>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Processing Plan</Text>
        <CardRow
          label="Target Motile Sperm / Dose"
          value={
            targetMotileSpermMillionsPerDose == null
              ? '-'
              : `${targetMotileSpermMillionsPerDose.toFixed(2)} M`
          }
        />
        <CardRow
          label="Target Post-Extension Concentration"
          value={
            targetPostExtensionConcentrationMillionsPerMl == null
              ? '-'
              : `${targetPostExtensionConcentrationMillionsPerMl.toFixed(2)} M motile/mL`
          }
        />
        <CardRow label="Extender Type" value={extenderType || '-'} />
        <CardRow label="Notes" value={notes || '-'} />
        <CardRow label="Semen Per Dose" value={formatMl(derivedMath.semenPerDoseMl)} />
        <CardRow label="Extender Per Dose" value={formatMl(derivedMath.extenderPerDoseMl)} />
        <CardRow label="Dose Volume" value={formatMl(derivedMath.doseVolumeMl)} />
        <CardRow
          label="Max Doses"
          value={derivedMath.maxDoses == null ? '-' : `~${derivedMath.maxDoses.toFixed(1)}`}
        />
        <SecondaryButton label="Edit Processing" onPress={() => onJumpToStep(1)} />
      </View>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Shipped</Text>
        {shippedRows.length === 0 ? (
          <Text style={styles.emptyText}>No shipped allocations.</Text>
        ) : (
          <View style={styles.reviewList}>
            {shippedRows.map((row) => (
              <View key={row.clientId} style={styles.reviewItem}>
                <Text style={styles.itemTitle}>{row.recipient}</Text>
                <Text style={styles.itemMeta}>
                  {`${formatLocalDate(row.eventDate, 'MM-DD-YYYY')} | ${row.doseCount} dose(s)`}
                </Text>
                <Text style={styles.itemMeta}>
                  {`${row.doseSemenVolumeMl.toFixed(2)} + ${row.doseExtenderVolumeMl.toFixed(2)} mL per dose`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>On-Farm</Text>
        {onFarmRows.length === 0 ? (
          <Text style={styles.emptyText}>No on-farm allocations.</Text>
        ) : (
          <View style={styles.reviewList}>
            {onFarmRows.map((row) => (
              <View key={row.clientId} style={styles.reviewItem}>
                <Text style={styles.itemTitle}>{mareNameById[row.mareId] ?? 'Unknown mare'}</Text>
                <Text style={styles.itemMeta}>
                  {formatLocalDate(row.eventDate, 'MM-DD-YYYY')}
                </Text>
                <Text style={styles.itemMeta}>
                  {row.doseSemenVolumeMl == null
                    ? 'Semen volume not recorded'
                    : `Semen: ${row.doseSemenVolumeMl.toFixed(2)} mL`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Totals</Text>
        {rawVolumeMl == null ? (
          <CardRow
            label="Semen Allocated"
            value={formatMl(allocationSummary.totalAllocatedMl)}
          />
        ) : (
          <CardRow
            label="Semen Allocated"
            value={`${allocationSummary.totalAllocatedMl.toFixed(2)} / ${rawVolumeMl.toFixed(2)} mL`}
          />
        )}
        <CardRow
          label="Remaining"
          value={
            allocationSummary.remainingMl == null
              ? 'Not capped'
              : remainingApproxDoses == null
                ? `${allocationSummary.remainingMl.toFixed(2)} mL`
                : `${allocationSummary.remainingMl.toFixed(2)} mL (~${remainingApproxDoses.toFixed(1)} doses)`
          }
        />
        {allocationSummary.blankVolumeRowCount > 0 ? (
          <Text style={styles.warningText}>
            {`${allocationSummary.blankVolumeRowCount} row(s) have blank semen volume and are excluded from cap math.`}
          </Text>
        ) : null}
        {derivedMath.warnings.includes('negative-extender') ? (
          <Text style={styles.warningText}>
            Extender amount is negative for this target profile.
          </Text>
        ) : null}
        {derivedMath.warnings.includes('target-exceeds-capacity') ? (
          <Text style={styles.warningText}>
            Target appears to exceed collection capacity.
          </Text>
        ) : null}
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
  warningText: {
    ...typography.bodySmall,
    color: colors.error,
  },
});
