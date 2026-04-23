import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { IconButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import {
  BreedingRecord,
  CollectionDoseEvent,
  FrozenSemenBatch,
  SemenCollection,
  Stallion,
} from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { deleteDoseEvent, deleteFrozenSemenBatch } from '@/storage/repositories';
import { colors, spacing, typography } from '@/theme';
import {
  getCollectionCardTargetPostExtensionLabel,
  getCollectionCardTargetSpermLabel,
} from '@/utils/collectionCalculatorCopy';
import { formatLocalDate } from '@/utils/dates';
import { formatFrozenBatchDoseSummary, formatFreezingExtender, formatStrawColor } from '@/utils/frozenSemenDisplay';
import { DOSE_EVENT_TYPE_LABELS } from '@/utils/outcomeDisplay';
import { DoseEventModal } from './DoseEventModal';

type Props = {
  readonly stallionId: string;
  readonly stallion: Stallion;
  readonly collections: readonly SemenCollection[];
  readonly doseEventsByCollectionId: Record<string, CollectionDoseEvent[]>;
  readonly frozenBatchesByCollectionId: Record<string, FrozenSemenBatch[]>;
  readonly breedingRecordById: Record<string, BreedingRecord>;
  readonly mareNameById: Record<string, string>;
  readonly isDeleted: boolean;
  readonly onDoseEventsChanged: () => Promise<void>;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'StallionDetail'>;
};

function formatMl(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return `${value.toFixed(2)} mL`;
}

function hasAnyAvPref(s: Stallion): boolean {
  return (
    s.avTemperatureF != null ||
    s.avType != null ||
    s.avLinerType != null ||
    s.avWaterVolumeMl != null ||
    s.avNotes != null
  );
}

type AllocationListItem =
  | {
      kind: 'event';
      id: string;
      sortDate: string;
      event: CollectionDoseEvent;
    }
  | {
      kind: 'frozen';
      id: string;
      sortDate: string;
      batch: FrozenSemenBatch;
    };

function buildAllocationRows(
  events: readonly CollectionDoseEvent[],
  frozenBatches: readonly FrozenSemenBatch[],
): AllocationListItem[] {
  const rows: AllocationListItem[] = [
    ...events.map((event) => ({
      kind: 'event' as const,
      id: event.id,
      sortDate: event.eventDate ?? event.createdAt,
      event,
    })),
    ...frozenBatches.map((batch) => ({
      kind: 'frozen' as const,
      id: batch.id,
      sortDate: batch.freezeDate,
      batch,
    })),
  ];

  rows.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  return rows;
}

export function CollectionsTab({
  stallionId,
  stallion,
  collections,
  doseEventsByCollectionId,
  frozenBatchesByCollectionId,
  breedingRecordById,
  mareNameById,
  isDeleted,
  onDoseEventsChanged,
  navigation,
}: Props): JSX.Element {
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CollectionDoseEvent | undefined>();

  const modalCollectionId = activeCollectionId ?? collections[0]?.id ?? null;

  const activeEvent = useMemo(() => {
    if (!activeCollectionId || !editingEvent) {
      return undefined;
    }

    return editingEvent.collectionId === activeCollectionId ? editingEvent : undefined;
  }, [activeCollectionId, editingEvent]);

  const handleCloseModal = (): void => {
    setActiveCollectionId(null);
    setEditingEvent(undefined);
  };

  const handleAddEvent = (collectionId: string): void => {
    setEditingEvent(undefined);
    setActiveCollectionId(collectionId);
  };

  const handleEditEvent = (event: CollectionDoseEvent): void => {
    setEditingEvent(event);
    setActiveCollectionId(event.collectionId);
  };

  const handleDeleteEvent = (event: CollectionDoseEvent): void => {
    Alert.alert(
      'Delete Dose Event',
      'Are you sure you want to delete this dose event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteDoseEvent(event.id);
                await onDoseEventsChanged();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unable to delete dose event.';
                Alert.alert('Delete error', message);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDeleteFrozenBatch = (batch: FrozenSemenBatch): void => {
    Alert.alert(
      'Delete Frozen Batch',
      'Are you sure you want to delete this frozen batch?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteFrozenSemenBatch(batch.id);
                await onDoseEventsChanged();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unable to delete frozen batch.';
                Alert.alert('Delete error', message);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          style={({ pressed }) => [cardStyles.card, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AVPreferencesForm', { stallionId })}
          accessibilityRole="button"
          accessibilityLabel="Edit AV Preferences"
        >
          <Text style={styles.sectionTitle}>AV Preferences</Text>
          {hasAnyAvPref(stallion) ? (
            <>
              <CardRow label="Temperature" value={stallion.avTemperatureF != null ? `${stallion.avTemperatureF}\u00B0F` : null} />
              <CardRow label="AV Type" value={stallion.avType} />
              <CardRow label="Liner" value={stallion.avLinerType} />
              <CardRow label="Water Volume" value={stallion.avWaterVolumeMl != null ? `${stallion.avWaterVolumeMl} mL` : null} />
              <CardRow label="Notes" value={stallion.avNotes} />
            </>
          ) : (
            <Text style={styles.mutedText}>Tap to set AV preferences.</Text>
          )}
        </Pressable>

        {!isDeleted ? (
          <PrimaryButton
            label="Add Collection"
            onPress={() => navigation.navigate('CollectionCreateWizard', { stallionId })}
          />
        ) : null}

        {collections.length > 0 ? (
          <View style={cardStyles.listWrap}>
            {collections.map((collection) => {
              const events = doseEventsByCollectionId[collection.id] ?? [];
              const frozenBatches = frozenBatchesByCollectionId[collection.id] ?? [];
              const allocationRows = buildAllocationRows(events, frozenBatches);

              return (
                <View key={collection.id} style={cardStyles.card}>
                  <View style={cardStyles.cardHeader}>
                    <Text style={cardStyles.cardTitle}>
                      {formatLocalDate(collection.collectionDate, 'MM-DD-YYYY')}
                    </Text>
                    <EditIconButton
                      onPress={() =>
                        navigation.navigate('CollectionForm', {
                          stallionId,
                          collectionId: collection.id,
                        })
                      }
                    />
                  </View>
                  <CardRow label="Raw Volume" value={formatMl(collection.rawVolumeMl)} />
                  <CardRow label="Extender Type" value={collection.extenderType} />
                  <CardRow
                    label="Concentration"
                    value={
                      collection.concentrationMillionsPerMl != null
                        ? `${collection.concentrationMillionsPerMl} M/mL`
                        : null
                    }
                  />
                  <CardRow
                    label="Motility"
                    value={
                      collection.progressiveMotilityPercent != null
                        ? `${collection.progressiveMotilityPercent}%`
                        : null
                    }
                  />
                  <CardRow
                    label={getCollectionCardTargetSpermLabel(collection.targetMode)}
                    value={
                      collection.targetSpermMillionsPerDose != null
                        ? `${collection.targetSpermMillionsPerDose} M`
                        : null
                    }
                  />
                  <CardRow
                    label={getCollectionCardTargetPostExtensionLabel(collection.targetMode)}
                    value={
                      collection.targetPostExtensionConcentrationMillionsPerMl != null
                        ? `${collection.targetPostExtensionConcentrationMillionsPerMl} M/mL`
                        : null
                    }
                  />

                  <View style={styles.doseSection}>
                    <View style={styles.doseSectionHeader}>
                      <Text style={styles.sectionTitle}>Allocations</Text>
                      {!isDeleted ? (
                        <View style={styles.actionRow}>
                          <SecondaryButton label="Add Shipment" onPress={() => handleAddEvent(collection.id)} />
                          <SecondaryButton
                            label="Freeze"
                            onPress={() => navigation.navigate('FrozenBatchCreateWizard', {
                              stallionId,
                              collectionId: collection.id,
                            })}
                          />
                        </View>
                      ) : null}
                    </View>

                    {allocationRows.length === 0 ? (
                      <Text style={styles.mutedText}>No allocations recorded.</Text>
                    ) : (
                      <View style={styles.eventList}>
                        {allocationRows.map((row) => {
                          if (row.kind === 'frozen') {
                            const batch = row.batch;
                            const freezeDateLabel = formatLocalDate(batch.freezeDate, 'MM-DD-YYYY');
                            const strawLabel = batch.strawCount === 1 ? 'straw' : 'straws';
                            const doseSummary = formatFrozenBatchDoseSummary(
                              batch.strawsRemaining,
                              batch.strawsPerDose,
                            );

                            return (
                              <Pressable
                                key={row.id}
                                style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
                                onPress={() => navigation.navigate('FrozenBatchForm', {
                                  stallionId,
                                  frozenBatchId: batch.id,
                                })}
                                accessibilityRole="button"
                                accessibilityLabel={`Open frozen batch from ${freezeDateLabel}`}
                              >
                                <View style={styles.eventContent}>
                                  <Text style={styles.eventTitle}>{`Frozen: ${batch.strawCount} ${strawLabel}`}</Text>
                                  <Text style={styles.eventMeta}>{`Freeze date: ${freezeDateLabel}`}</Text>
                                  <Text style={styles.eventMeta}>
                                    {`Remaining: ${batch.strawsRemaining}/${batch.strawCount}`}
                                  </Text>
                                  {doseSummary ? (
                                    <Text style={styles.eventMeta}>{`Dose summary: ${doseSummary}`}</Text>
                                  ) : null}
                                  <Text style={styles.eventMeta}>
                                    {`Extender: ${formatFreezingExtender(batch.extender, batch.extenderOther)}`}
                                  </Text>
                                  <Text style={styles.eventMeta}>
                                    {`Color: ${formatStrawColor(batch.strawColor, batch.strawColorOther)}`}
                                  </Text>
                                </View>
                                {!isDeleted ? (
                                  <View style={styles.eventActions}>
                                    <IconButton
                                      icon={'\u270E'}
                                      onPress={() => navigation.navigate('FrozenBatchForm', {
                                        stallionId,
                                        frozenBatchId: batch.id,
                                      })}
                                      accessibilityLabel="Edit frozen batch"
                                    />
                                    <IconButton
                                      icon={'\u2715'}
                                      onPress={() => handleDeleteFrozenBatch(batch)}
                                      accessibilityLabel="Delete frozen batch"
                                    />
                                  </View>
                                ) : null}
                              </Pressable>
                            );
                          }

                          const event = row.event;
                          const linkedBreeding = event.breedingRecordId
                            ? breedingRecordById[event.breedingRecordId]
                            : undefined;
                          const linkedMareName = linkedBreeding
                            ? (mareNameById[linkedBreeding.mareId] ?? event.recipient)
                            : event.recipient;
                          const isUsedOnSite = event.eventType === 'usedOnSite';
                          const eventMeta = isUsedOnSite
                            ? [
                                event.doseCount != null ? `${event.doseCount} doses` : null,
                                event.eventDate ? formatLocalDate(event.eventDate, 'MM-DD-YYYY') : null,
                                'Fresh AI',
                              ].filter(Boolean).join(' | ')
                            : [
                                event.doseCount != null ? `${event.doseCount} doses` : null,
                                event.eventDate ? formatLocalDate(event.eventDate, 'MM-DD-YYYY') : null,
                                event.carrierService ?? null,
                                event.containerType ?? null,
                              ].filter(Boolean).join(' | ');
                          const titleLabel = `${DOSE_EVENT_TYPE_LABELS[event.eventType]}: ${linkedMareName}`;
                          const shippedSemenPerDose = formatMl(event.doseSemenVolumeMl);
                          const shippedExtenderPerDose = formatMl(event.doseExtenderVolumeMl);
                          const shippedTotalSemen =
                            event.doseCount != null && event.doseSemenVolumeMl != null
                              ? formatMl(event.doseSemenVolumeMl * event.doseCount)
                              : null;
                          const shippedTotalExtender =
                            event.doseCount != null && event.doseExtenderVolumeMl != null
                              ? formatMl(event.doseExtenderVolumeMl * event.doseCount)
                              : null;
                          const content = (
                            <>
                              <View style={styles.eventContent}>
                                <Text style={styles.eventTitle}>{titleLabel}</Text>
                                <Text style={styles.eventMeta}>{eventMeta || 'No extra details'}</Text>
                                {!isUsedOnSite && event.recipientCity && event.recipientState ? (
                                  <Text style={styles.eventMeta}>{`${event.recipientCity}, ${event.recipientState}`}</Text>
                                ) : null}
                                {isUsedOnSite ? (
                                  <Text style={styles.eventMeta}>
                                    {event.doseSemenVolumeMl == null
                                      ? 'Semen used: not recorded'
                                      : `Semen used: ${event.doseSemenVolumeMl.toFixed(2)} mL`}
                                  </Text>
                                ) : (
                                  <>
                                    <Text style={styles.eventMeta}>
                                      {shippedSemenPerDose != null && shippedExtenderPerDose != null
                                        ? `Semen/Extender per dose: ${shippedSemenPerDose} + ${shippedExtenderPerDose}`
                                        : 'Semen/Extender per dose: not recorded'}
                                    </Text>
                                    <Text style={styles.eventMeta}>
                                      {shippedTotalSemen != null && shippedTotalExtender != null
                                        ? `Total semen/extender: ${shippedTotalSemen} + ${shippedTotalExtender}`
                                        : 'Total semen/extender: not recorded'}
                                    </Text>
                                  </>
                                )}
                                {event.notes ? <Text style={styles.eventNote}>{event.notes}</Text> : null}
                              </View>
                              {!isDeleted && !isUsedOnSite ? (
                                <View style={styles.eventActions}>
                                  <IconButton icon={'\u270E'} onPress={() => handleEditEvent(event)} accessibilityLabel="Edit shipment" />
                                  <IconButton icon={'\u2715'} onPress={() => handleDeleteEvent(event)} accessibilityLabel="Delete shipment" />
                                </View>
                              ) : null}
                            </>
                          );

                          if (isUsedOnSite && linkedBreeding) {
                            return (
                              <Pressable
                                key={row.id}
                                style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
                                onPress={() => navigation.navigate('BreedingRecordForm', {
                                  mareId: linkedBreeding.mareId,
                                  breedingRecordId: linkedBreeding.id,
                                })}
                                accessibilityRole="button"
                                accessibilityLabel={`Open breeding record for ${linkedMareName}`}
                              >
                                {content}
                              </Pressable>
                            );
                          }

                          return (
                            <View key={row.id} style={styles.eventRow}>
                              {content}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No collections recorded.</Text>
          </View>
        )}
      </ScrollView>
      {modalCollectionId ? (
        <DoseEventModal
          visible={activeCollectionId != null}
          collectionId={modalCollectionId}
          event={activeEvent}
          onSaved={() => {
            void onDoseEventsChanged();
          }}
          onClose={handleCloseModal}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  mutedText: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  pressed: {
    opacity: 0.85,
  },
  doseSection: {
    borderTopColor: colors.outlineVariant,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  doseSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventList: {
    gap: spacing.sm,
  },
  eventRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  eventContent: {
    flex: 1,
    gap: spacing.xs,
  },
  eventTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  eventMeta: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  eventNote: {
    ...typography.bodySmall,
    color: colors.onSurface,
  },
  eventActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
