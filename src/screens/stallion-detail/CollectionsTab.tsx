import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { IconButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { BreedingRecord, CollectionDoseEvent, SemenCollection, Stallion } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { deleteDoseEvent } from '@/storage/repositories';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import { DOSE_EVENT_TYPE_LABELS } from '@/utils/outcomeDisplay';
import { DoseEventModal } from './DoseEventModal';

type Props = {
  readonly stallionId: string;
  readonly stallion: Stallion;
  readonly collections: readonly SemenCollection[];
  readonly doseEventsByCollectionId: Record<string, CollectionDoseEvent[]>;
  readonly breedingRecordById: Record<string, BreedingRecord>;
  readonly mareNameById: Record<string, string>;
  readonly isDeleted: boolean;
  readonly onDoseEventsChanged: () => Promise<void>;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'StallionDetail'>;
};

function hasAnyAvPref(s: Stallion): boolean {
  return (
    s.avTemperatureF != null ||
    s.avType != null ||
    s.avLinerType != null ||
    s.avWaterVolumeMl != null ||
    s.avNotes != null
  );
}

export function CollectionsTab({
  stallionId,
  stallion,
  collections,
  doseEventsByCollectionId,
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
            {collections.map((c) => {
              const events = doseEventsByCollectionId[c.id] ?? [];

              return (
                <View key={c.id} style={cardStyles.card}>
                  <View style={cardStyles.cardHeader}>
                    <Text style={cardStyles.cardTitle}>{formatLocalDate(c.collectionDate, 'MM-DD-YYYY')}</Text>
                    <EditIconButton onPress={() => navigation.navigate('CollectionForm', { stallionId, collectionId: c.id })} />
                  </View>
                  <CardRow label="Raw Volume" value={c.rawVolumeMl != null ? `${c.rawVolumeMl} mL` : null} />
                  <CardRow label="Total Volume" value={c.totalVolumeMl != null ? `${c.totalVolumeMl} mL` : null} />
                  <CardRow label="Extender Volume" value={c.extenderVolumeMl != null ? `${c.extenderVolumeMl} mL` : null} />
                  <CardRow label="Extender Type" value={c.extenderType} />
                  <CardRow label="Concentration" value={c.concentrationMillionsPerMl != null ? `${c.concentrationMillionsPerMl} M/mL` : null} />
                  <CardRow label="Motility" value={c.progressiveMotilityPercent != null ? `${c.progressiveMotilityPercent}%` : null} />
                  <CardRow
                    label="Doses"
                    value={
                      c.doseCount != null
                        ? c.doseSizeMillions != null
                          ? `${c.doseCount} x ${c.doseSizeMillions}M`
                          : String(c.doseCount)
                        : null
                    }
                  />

                  <View style={styles.doseSection}>
                    <View style={styles.doseSectionHeader}>
                      <Text style={styles.sectionTitle}>Allocations</Text>
                      {!isDeleted ? (
                        <SecondaryButton label="Add Shipment" onPress={() => handleAddEvent(c.id)} />
                      ) : null}
                    </View>

                    {events.length === 0 ? (
                      <Text style={styles.mutedText}>No allocations recorded.</Text>
                    ) : (
                      <View style={styles.eventList}>
                        {events.map((event) => {
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
                              ].filter(Boolean).join(' • ')
                            : [
                                event.doseCount != null ? `${event.doseCount} doses` : null,
                                event.eventDate ? formatLocalDate(event.eventDate, 'MM-DD-YYYY') : null,
                                event.carrierService ?? null,
                                event.containerType ?? null,
                              ].filter(Boolean).join(' • ');
                          const titleLabel = `${DOSE_EVENT_TYPE_LABELS[event.eventType]}: ${linkedMareName}`;
                          const content = (
                            <>
                              <View style={styles.eventContent}>
                                <Text style={styles.eventTitle}>{titleLabel}</Text>
                                <Text style={styles.eventMeta}>{eventMeta || 'No extra details'}</Text>
                                {!isUsedOnSite && event.recipientCity && event.recipientState ? (
                                  <Text style={styles.eventMeta}>{`${event.recipientCity}, ${event.recipientState}`}</Text>
                                ) : null}
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
                                key={event.id}
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
                            <View key={event.id} style={styles.eventRow}>
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
