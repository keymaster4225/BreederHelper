import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { IconButton, SecondaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import {
  CollectionWizardAllocationRow,
  CollectionWizardOnFarmRow,
  CollectionWizardOnFarmRowInput,
  CollectionWizardShippedRow,
  CollectionWizardShippedRowInput,
} from '@/hooks/useCollectionWizard';
import { useClockDisplayMode } from '@/hooks/useClockPreference';
import { Mare } from '@/models/types';
import { colors, spacing, typography } from '@/theme';
import { formatBreedingRecordTime } from '@/utils/breedingRecordTime';
import type { AllocationSummary } from '@/utils/collectionAllocation';
import { formatLocalDate } from '@/utils/dates';
import { OnFarmMareRowEditor } from './OnFarmMareRowEditor';
import { ShippedDoseRowEditor } from './ShippedDoseRowEditor';

type Props = {
  collectionDate: string;
  rawVolumeMl: number | null;
  remainingApproxDoses: number | null;
  allocationRows: readonly CollectionWizardAllocationRow[];
  allocationSummary: AllocationSummary;
  mares: readonly Mare[];
  mareNameById: Record<string, string>;
  mareLoadError: string | null;
  allocationError?: string;
  shippedPrefillDoseSemenVolumeMl: number | null;
  shippedPrefillDoseExtenderVolumeMl: number | null;
  onFarmPrefillDoseSemenVolumeMl: number | null;
  onSaveShippedRow: (row: CollectionWizardShippedRowInput, clientId?: string) => void;
  onSaveOnFarmRow: (row: CollectionWizardOnFarmRowInput, clientId?: string) => string | null;
  onRemoveAllocationRow: (clientId: string) => void;
};

function formatMl(value: number): string {
  return `${value.toFixed(2)} mL`;
}

export function DoseAllocationStep({
  collectionDate,
  rawVolumeMl,
  remainingApproxDoses,
  allocationRows,
  allocationSummary,
  mares,
  mareNameById,
  mareLoadError,
  allocationError,
  shippedPrefillDoseSemenVolumeMl,
  shippedPrefillDoseExtenderVolumeMl,
  onFarmPrefillDoseSemenVolumeMl,
  onSaveShippedRow,
  onSaveOnFarmRow,
  onRemoveAllocationRow,
}: Props): JSX.Element {
  const [editingShippedClientId, setEditingShippedClientId] = useState<string | null>(null);
  const [editingOnFarmClientId, setEditingOnFarmClientId] = useState<string | null>(null);
  const [isShippedEditorOpen, setIsShippedEditorOpen] = useState(false);
  const [isOnFarmEditorOpen, setIsOnFarmEditorOpen] = useState(false);
  const clockDisplayMode = useClockDisplayMode();

  const editingShippedRow = useMemo(() => {
    if (editingShippedClientId == null) {
      return undefined;
    }

    const match = allocationRows.find(
      (row): row is CollectionWizardShippedRow =>
        row.kind === 'shipped' && row.clientId === editingShippedClientId,
    );
    return match;
  }, [allocationRows, editingShippedClientId]);

  const editingOnFarmRow = useMemo(() => {
    if (editingOnFarmClientId == null) {
      return undefined;
    }

    const match = allocationRows.find(
      (row): row is CollectionWizardOnFarmRow =>
        row.kind === 'usedOnSite' && row.clientId === editingOnFarmClientId,
    );
    return match;
  }, [allocationRows, editingOnFarmClientId]);

  const availableMares = useMemo(() => {
    const selectedMareIds = new Set(
      allocationRows
        .filter(
          (row): row is CollectionWizardOnFarmRow =>
            row.kind === 'usedOnSite' && row.clientId !== editingOnFarmClientId,
        )
        .map((row) => row.mareId),
    );

    return mares.filter((mare) => !selectedMareIds.has(mare.id));
  }, [allocationRows, editingOnFarmClientId, mares]);

  const openNewShippedRow = (): void => {
    setEditingShippedClientId(null);
    setIsShippedEditorOpen(true);
  };

  const openEditShippedRow = (clientId: string): void => {
    setEditingShippedClientId(clientId);
    setIsShippedEditorOpen(true);
  };

  const closeShippedEditor = (): void => {
    setEditingShippedClientId(null);
    setIsShippedEditorOpen(false);
  };

  const openNewOnFarmRow = (): void => {
    setEditingOnFarmClientId(null);
    setIsOnFarmEditorOpen(true);
  };

  const openEditOnFarmRow = (clientId: string): void => {
    setEditingOnFarmClientId(clientId);
    setIsOnFarmEditorOpen(true);
  };

  const closeOnFarmEditor = (): void => {
    setEditingOnFarmClientId(null);
    setIsOnFarmEditorOpen(false);
  };

  return (
    <>
      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Allocation Summary</Text>
        {rawVolumeMl == null ? (
          <CardRow
            label="Semen Used"
            value={formatMl(allocationSummary.totalAllocatedMl)}
          />
        ) : (
          <CardRow
            label="Semen Used"
            value={`${allocationSummary.totalAllocatedMl.toFixed(2)} / ${rawVolumeMl.toFixed(2)} mL`}
          />
        )}

        {allocationSummary.remainingMl == null ? (
          <Text style={styles.infoText}>Total volume not recorded - allocation not capped.</Text>
        ) : (
          <CardRow
            label="Remaining"
            value={
              remainingApproxDoses == null
                ? `${allocationSummary.remainingMl.toFixed(2)} mL`
                : `${allocationSummary.remainingMl.toFixed(2)} mL (~${remainingApproxDoses.toFixed(1)} doses)`
            }
          />
        )}

        {allocationSummary.blankVolumeRowCount > 0 ? (
          <Text style={styles.infoText}>
            {`${allocationSummary.blankVolumeRowCount} row(s) have no semen volume entered and are not counted toward allocation.`}
          </Text>
        ) : null}

        {allocationError ? <Text style={styles.errorText}>{allocationError}</Text> : null}
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rows</Text>
          <View style={styles.addActions}>
            <SecondaryButton label="Add Shipment" onPress={openNewShippedRow} />
            <SecondaryButton
              label="Add On-Farm"
              onPress={openNewOnFarmRow}
              disabled={mares.length === 0}
            />
          </View>
        </View>

        {mareLoadError ? <Text style={styles.errorText}>{mareLoadError}</Text> : null}

        {allocationRows.length === 0 ? (
          <Text style={styles.emptyText}>No allocation rows added.</Text>
        ) : (
          <View style={cardStyles.listWrap}>
            {allocationRows.map((row) => (
              <View key={row.clientId} style={cardStyles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {row.kind === 'shipped'
                      ? `Shipped: ${row.recipient}`
                      : `On-Farm: ${mareNameById[row.mareId] ?? 'Unknown mare'}`}
                  </Text>
                  <View style={styles.cardActions}>
                    <IconButton
                      icon={'\u270E'}
                      onPress={() =>
                        row.kind === 'shipped'
                          ? openEditShippedRow(row.clientId)
                          : openEditOnFarmRow(row.clientId)
                      }
                      accessibilityLabel={
                        row.kind === 'shipped'
                          ? 'Edit shipped row'
                          : 'Edit on-farm row'
                      }
                    />
                    <IconButton
                      icon={'\u2715'}
                      onPress={() => onRemoveAllocationRow(row.clientId)}
                      accessibilityLabel="Delete allocation row"
                    />
                  </View>
                </View>

                <CardRow
                  label={row.kind === 'shipped' ? 'Ship Date' : 'Breeding Date'}
                  value={formatLocalDate(row.eventDate, 'MM-DD-YYYY')}
                />

                {row.kind === 'shipped' ? (
                  <>
                    <CardRow label="Dose Count" value={row.doseCount} />
                    <CardRow
                      label="Semen / Dose"
                      value={formatMl(row.doseSemenVolumeMl)}
                    />
                    <CardRow
                      label="Extender / Dose"
                      value={formatMl(row.doseExtenderVolumeMl)}
                    />
                    <CardRow
                      label="Total Per Dose"
                      value={formatMl(row.doseSemenVolumeMl + row.doseExtenderVolumeMl)}
                    />
                    <CardRow
                      label="Total Semen Used"
                      value={formatMl(row.doseSemenVolumeMl * row.doseCount)}
                    />
                    <CardRow
                      label="Total Extender Used"
                      value={formatMl(row.doseExtenderVolumeMl * row.doseCount)}
                    />
                  </>
                ) : (
                  <>
                    <CardRow
                      label="Breeding Time"
                      value={formatBreedingRecordTime(row.eventTime, clockDisplayMode)}
                    />
                    <CardRow
                      label="Semen Used"
                      value={
                        row.doseSemenVolumeMl == null
                          ? 'Semen volume not recorded'
                          : formatMl(row.doseSemenVolumeMl)
                      }
                    />
                  </>
                )}

                {row.notes ? <CardRow label="Notes" value={row.notes} /> : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <ShippedDoseRowEditor
        visible={isShippedEditorOpen}
        initialValue={editingShippedRow}
        defaultDate={collectionDate}
        defaultDoseSemenVolumeMl={shippedPrefillDoseSemenVolumeMl}
        defaultDoseExtenderVolumeMl={shippedPrefillDoseExtenderVolumeMl}
        onClose={closeShippedEditor}
        onSave={(row) => {
          onSaveShippedRow(row, editingShippedClientId ?? undefined);
          closeShippedEditor();
        }}
      />

      <OnFarmMareRowEditor
        visible={isOnFarmEditorOpen}
        initialValue={editingOnFarmRow}
        defaultDate={collectionDate}
        defaultDoseSemenVolumeMl={onFarmPrefillDoseSemenVolumeMl}
        availableMares={availableMares}
        onClose={closeOnFarmEditor}
        onSave={(row) => {
          const error = onSaveOnFarmRow(row, editingOnFarmClientId ?? undefined);
          if (error) {
            Alert.alert('Allocation error', error);
            return;
          }
          closeOnFarmEditor();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    gap: spacing.sm,
  },
  sectionHeader: {
    gap: spacing.sm,
  },
  addActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
