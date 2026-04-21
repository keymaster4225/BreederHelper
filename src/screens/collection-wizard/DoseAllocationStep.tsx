import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { IconButton, SecondaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import {
  CollectionWizardOnFarmRow,
  CollectionWizardShippedRow,
} from '@/hooks/useCollectionWizard';
import { Mare } from '@/models/types';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import { OnFarmMareRowEditor } from './OnFarmMareRowEditor';
import { ShippedDoseRowEditor } from './ShippedDoseRowEditor';

type Props = {
  collectionDate: string;
  totalDoseCount: number | null;
  allocatedDoseCount: number;
  remainingDoseCount: number | null;
  isOverAllocated: boolean;
  shippedRows: readonly CollectionWizardShippedRow[];
  onFarmRows: readonly CollectionWizardOnFarmRow[];
  mares: readonly Mare[];
  mareNameById: Record<string, string>;
  mareLoadError: string | null;
  allocationError?: string;
  onSaveShippedRow: (row: CollectionWizardShippedRow, index?: number) => void;
  onRemoveShippedRow: (index: number) => void;
  onSaveOnFarmRow: (row: CollectionWizardOnFarmRow, index?: number) => string | null;
  onRemoveOnFarmRow: (index: number) => void;
};

export function DoseAllocationStep({
  collectionDate,
  totalDoseCount,
  allocatedDoseCount,
  remainingDoseCount,
  isOverAllocated,
  shippedRows,
  onFarmRows,
  mares,
  mareNameById,
  mareLoadError,
  allocationError,
  onSaveShippedRow,
  onRemoveShippedRow,
  onSaveOnFarmRow,
  onRemoveOnFarmRow,
}: Props): JSX.Element {
  const [editingShippedIndex, setEditingShippedIndex] = useState<number | null>(null);
  const [editingOnFarmIndex, setEditingOnFarmIndex] = useState<number | null>(null);
  const [isShippedEditorOpen, setIsShippedEditorOpen] = useState(false);
  const [isOnFarmEditorOpen, setIsOnFarmEditorOpen] = useState(false);

  const editingShippedRow = editingShippedIndex == null ? undefined : shippedRows[editingShippedIndex];
  const editingOnFarmRow = editingOnFarmIndex == null ? undefined : onFarmRows[editingOnFarmIndex];

  const availableMares = useMemo(() => {
    const selectedMareIds = new Set(
      onFarmRows
        .filter((_, index) => index !== editingOnFarmIndex)
        .map((row) => row.mareId),
    );

    return mares.filter((mare) => !selectedMareIds.has(mare.id));
  }, [editingOnFarmIndex, mares, onFarmRows]);

  const openNewShippedRow = (): void => {
    setEditingShippedIndex(null);
    setIsShippedEditorOpen(true);
  };

  const openEditShippedRow = (index: number): void => {
    setEditingShippedIndex(index);
    setIsShippedEditorOpen(true);
  };

  const closeShippedEditor = (): void => {
    setEditingShippedIndex(null);
    setIsShippedEditorOpen(false);
  };

  const openNewOnFarmRow = (): void => {
    setEditingOnFarmIndex(null);
    setIsOnFarmEditorOpen(true);
  };

  const openEditOnFarmRow = (index: number): void => {
    setEditingOnFarmIndex(index);
    setIsOnFarmEditorOpen(true);
  };

  const closeOnFarmEditor = (): void => {
    setEditingOnFarmIndex(null);
    setIsOnFarmEditorOpen(false);
  };

  return (
    <>
      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Allocation Summary</Text>
        <CardRow label="Total Doses" value={totalDoseCount == null ? '-' : totalDoseCount} />
        <CardRow label="Allocated" value={allocatedDoseCount} />
        <CardRow label="Remaining" value={remainingDoseCount == null ? '-' : remainingDoseCount} />
        {allocationError ? <Text style={styles.errorText}>{allocationError}</Text> : null}
        {!allocationError && isOverAllocated ? (
          <Text style={styles.errorText}>Allocated doses cannot exceed the collection dose count.</Text>
        ) : null}
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shipped</Text>
          <SecondaryButton label="Add Shipment" onPress={openNewShippedRow} />
        </View>

        {shippedRows.length === 0 ? (
          <Text style={styles.emptyText}>No shipped allocations added.</Text>
        ) : (
          <View style={cardStyles.listWrap}>
            {shippedRows.map((row, index) => (
              <View key={`shipped-${index}`} style={cardStyles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{row.recipient}</Text>
                  <View style={styles.cardActions}>
                    <IconButton icon={'\u270E'} onPress={() => openEditShippedRow(index)} accessibilityLabel="Edit shipment" />
                    <IconButton icon={'\u2715'} onPress={() => onRemoveShippedRow(index)} accessibilityLabel="Delete shipment" />
                  </View>
                </View>
                <CardRow label="Ship Date" value={formatLocalDate(row.eventDate, 'MM-DD-YYYY')} />
                <CardRow label="Dose Count" value={row.doseCount} />
                <CardRow label="Carrier / Service" value={row.carrierService} />
                <CardRow label="Container" value={row.containerType} />
                <CardRow label="Phone" value={row.recipientPhone} />
                <CardRow
                  label="Address"
                  value={`${row.recipientStreet}, ${row.recipientCity}, ${row.recipientState} ${row.recipientZip}`}
                />
                {row.trackingNumber ? <CardRow label="Tracking" value={row.trackingNumber} /> : null}
                {row.notes ? <CardRow label="Notes" value={row.notes} /> : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>On-Farm</Text>
          <SecondaryButton
            label="Add On-Farm"
            onPress={openNewOnFarmRow}
            disabled={mares.length === 0}
          />
        </View>

        {mareLoadError ? <Text style={styles.errorText}>{mareLoadError}</Text> : null}

        {onFarmRows.length === 0 ? (
          <Text style={styles.emptyText}>No on-farm allocations added.</Text>
        ) : (
          <View style={cardStyles.listWrap}>
            {onFarmRows.map((row, index) => (
              <View key={`on-farm-${index}`} style={cardStyles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{mareNameById[row.mareId] ?? 'Unknown mare'}</Text>
                  <View style={styles.cardActions}>
                    <IconButton icon={'\u270E'} onPress={() => openEditOnFarmRow(index)} accessibilityLabel="Edit on-farm allocation" />
                    <IconButton icon={'\u2715'} onPress={() => onRemoveOnFarmRow(index)} accessibilityLabel="Delete on-farm allocation" />
                  </View>
                </View>
                <CardRow label="Breeding Date" value={formatLocalDate(row.eventDate, 'MM-DD-YYYY')} />
                <CardRow label="Dose Count" value={row.doseCount} />
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
        onClose={closeShippedEditor}
        onSave={(row) => {
          onSaveShippedRow(row, editingShippedIndex ?? undefined);
          closeShippedEditor();
        }}
      />

      <OnFarmMareRowEditor
        visible={isOnFarmEditorOpen}
        initialValue={editingOnFarmRow}
        defaultDate={collectionDate}
        availableMares={availableMares}
        onClose={closeOnFarmEditor}
        onSave={(row) => {
          const error = onSaveOnFarmRow(row, editingOnFarmIndex ?? undefined);
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
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
