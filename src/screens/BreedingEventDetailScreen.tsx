import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IconButton, PrimaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { StatusBadge } from '@/components/StatusBadge';
import { Screen } from '@/components/Screen';
import { useBreedingEventDetail } from '@/hooks/useBreedingEventDetail';
import { useClockDisplayMode } from '@/hooks/useClockPreference';
import { Foal, FoalingRecord, PregnancyCheck, calculateDaysPostBreeding } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { formatBreedingRecordTime } from '@/utils/breedingRecordTime';
import { formatLocalDate } from '@/utils/dates';
import {
  formatBreedingMethod,
  formatFoalSex,
  formatOutcome,
  getFoalSexColor,
  getOutcomeColor,
} from '@/utils/outcomeDisplay';

type Props = NativeStackScreenProps<RootStackParamList, 'BreedingEventDetail'>;

function formatMl(value: number | null | undefined): string | null {
  return value == null ? null : `${value} mL`;
}

function formatPercent(value: number | null | undefined): string | null {
  return value == null ? null : `${value}%`;
}

function PressableCardRow({
  label,
  value,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.pressableRow, pressed && styles.pressed]}
    >
      <Text style={cardStyles.cardLabel}>{label}</Text>
      <Text style={[cardStyles.cardValue, styles.linkValue]}>{value}</Text>
    </Pressable>
  );
}

export function BreedingEventDetailScreen({ navigation, route }: Props): JSX.Element {
  const handledInvalidRouteRef = useRef(false);
  const clockDisplayMode = useClockDisplayMode();
  const {
    isLoading,
    error,
    invalidRouteMessage,
    recordMissingAfterPriorLoad,
    record,
    mare,
    stallion,
    collection,
    pregnancyChecks,
    foalingRecords,
    foalByFoalingRecordId,
  } = useBreedingEventDetail({ breedingRecordId: route.params.breedingRecordId });

  useEffect(() => {
    if (!record) {
      return;
    }

    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon={'\u270E'}
          accessibilityLabel="Edit breeding event"
          onPress={() =>
            navigation.navigate('BreedingRecordForm', {
              mareId: record.mareId,
              breedingRecordId: record.id,
            })
          }
        />
      ),
    });
  }, [navigation, record]);

  useEffect(() => {
    if (handledInvalidRouteRef.current) {
      return;
    }

    if (recordMissingAfterPriorLoad) {
      handledInvalidRouteRef.current = true;
      navigation.goBack();
      return;
    }

    if (invalidRouteMessage) {
      handledInvalidRouteRef.current = true;
      Alert.alert('Unable to open breeding event', invalidRouteMessage);
      navigation.goBack();
    }
  }, [invalidRouteMessage, navigation, recordMissingAfterPriorLoad]);

  if (isLoading && !record) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (error && !record) {
    return (
      <Screen>
        <Text style={styles.errorText}>{error}</Text>
      </Screen>
    );
  }

  if (!record || !mare) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const mareName = mare.deletedAt ? `${mare.name} (Deleted)` : mare.name;
  const stallionName = record.stallionName ?? stallion?.name ?? 'Unknown';
  const stallionDisplay = stallion?.deletedAt ? `${stallionName} (Deleted)` : stallionName;
  const canOpenMare = mare.deletedAt == null;
  const canOpenStallion = record.stallionId != null && stallion != null && stallion.deletedAt == null;
  const canOpenCollection = canOpenStallion && record.collectionId != null && collection != null;
  const hasServiceDetails =
    record.collectionId != null ||
    record.collectionDate != null ||
    record.notes != null ||
    record.volumeMl != null ||
    record.concentrationMPerMl != null ||
    record.motilityPercent != null ||
    record.numberOfStraws != null ||
    record.strawVolumeMl != null ||
    record.strawDetails != null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={cardStyles.card}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <CardRow label="Date" value={formatLocalDate(record.date, 'MM-DD-YYYY')} />
          {record.time ? (
            <CardRow label="Time" value={formatBreedingRecordTime(record.time, clockDisplayMode)} />
          ) : null}
          {canOpenMare ? (
            <PressableCardRow
              label="Mare"
              value={mareName}
              accessibilityLabel={`Open mare profile for ${mare.name}`}
              onPress={() => navigation.navigate('MareDetail', { mareId: record.mareId, initialTab: 'breeding' })}
            />
          ) : (
            <CardRow label="Mare" value={mareName} />
          )}
          <CardRow label="Method" value={formatBreedingMethod(record.method)} />
          {canOpenStallion && record.stallionId ? (
            <PressableCardRow
              label="Stallion"
              value={stallionDisplay}
              accessibilityLabel={`Open stallion profile for ${stallionName}`}
              onPress={() => navigation.navigate('StallionDetail', { stallionId: record.stallionId!, initialTab: 'breeding' })}
            />
          ) : (
            <CardRow label="Stallion" value={stallionDisplay} />
          )}
        </View>

        {hasServiceDetails ? (
          <View style={cardStyles.card}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            {record.collectionId ? (
              canOpenCollection && record.stallionId ? (
                <PressableCardRow
                  label="Collection"
                  value={collection ? formatLocalDate(collection.collectionDate, 'MM-DD-YYYY') : 'Linked collection'}
                  accessibilityLabel="Open linked collection"
                  onPress={() =>
                    navigation.navigate('CollectionForm', {
                      stallionId: record.stallionId!,
                      collectionId: record.collectionId!,
                    })
                  }
                />
              ) : (
                <CardRow
                  label="Collection"
                  value={collection ? formatLocalDate(collection.collectionDate, 'MM-DD-YYYY') : 'Linked collection'}
                />
              )
            ) : null}
            {collection?.rawVolumeMl != null ? <CardRow label="Raw volume" value={formatMl(collection.rawVolumeMl)} /> : null}
            {collection?.motilityPercent != null ? (
              <CardRow label="Collection motility" value={formatPercent(collection.motilityPercent)} />
            ) : null}
            {collection?.progressiveMotilityPercent != null ? (
              <CardRow label="Collection progressive motility" value={formatPercent(collection.progressiveMotilityPercent)} />
            ) : null}
            {record.collectionDate ? <CardRow label="Collection date" value={formatLocalDate(record.collectionDate, 'MM-DD-YYYY')} /> : null}
            {(record.method === 'freshAI' || record.method === 'shippedCooledAI') ? (
              <>
                {record.volumeMl != null ? <CardRow label="Volume" value={formatMl(record.volumeMl)} /> : null}
                {record.concentrationMPerMl != null ? <CardRow label="Concentration" value={`${record.concentrationMPerMl} M/mL`} /> : null}
                {record.motilityPercent != null ? <CardRow label="Motility" value={formatPercent(record.motilityPercent)} /> : null}
              </>
            ) : null}
            {record.method === 'frozenAI' ? (
              <>
                {record.numberOfStraws != null ? <CardRow label="Number of straws" value={record.numberOfStraws} /> : null}
                {record.strawVolumeMl != null ? <CardRow label="Straw volume" value={formatMl(record.strawVolumeMl)} /> : null}
                {record.strawDetails ? <CardRow label="Straw details" value={record.strawDetails} /> : null}
              </>
            ) : null}
            {record.notes ? <CardRow label="Notes" value={record.notes} /> : null}
          </View>
        ) : null}

        <RelatedPregnancySection
          mareId={record.mareId}
          breedingRecordId={record.id}
          breedingDate={record.date}
          pregnancyChecks={pregnancyChecks}
          navigation={navigation}
        />

        <RelatedFoalingSection
          mareId={record.mareId}
          foalingRecords={foalingRecords}
          foalByFoalingRecordId={foalByFoalingRecordId}
          navigation={navigation}
        />
      </ScrollView>
    </Screen>
  );
}

function RelatedPregnancySection({
  mareId,
  breedingRecordId,
  breedingDate,
  pregnancyChecks,
  navigation,
}: {
  mareId: string;
  breedingRecordId: string;
  breedingDate: string;
  pregnancyChecks: readonly PregnancyCheck[];
  navigation: Props['navigation'];
}): JSX.Element {
  return (
    <View style={cardStyles.card}>
      <Text style={styles.sectionTitle}>Pregnancy Checks</Text>
      <PrimaryButton
        label="Add Pregnancy Check"
        onPress={() => navigation.navigate('PregnancyCheckForm', { mareId, breedingRecordId })}
      />
      {pregnancyChecks.length === 0 ? (
        <Text style={styles.emptyText}>No pregnancy checks linked to this breeding event.</Text>
      ) : null}
      {pregnancyChecks.map((check) => {
        const daysPost = calculateDaysPostBreeding(check.date, breedingDate);
        return (
          <View key={check.id} style={styles.relatedCard}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.cardTitle}>{formatLocalDate(check.date, 'MM-DD-YYYY')}</Text>
              <EditIconButton onPress={() => navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open pregnancy check from ${formatLocalDate(check.date, 'MM-DD-YYYY')}`}
              onPress={() => navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })}
              style={({ pressed }) => [styles.cardBodyPressable, pressed && styles.pressed]}
            >
              <View style={cardStyles.cardRow}>
                <Text style={cardStyles.cardLabel}>Result</Text>
                <StatusBadge
                  label={check.result === 'positive' ? 'Positive' : 'Negative'}
                  backgroundColor={check.result === 'positive' ? colors.positive : colors.negative}
                  textColor="#FFFFFF"
                />
              </View>
              <CardRow label="Heartbeat" value={check.heartbeatDetected == null ? 'N/A' : check.heartbeatDetected ? 'Yes' : 'No'} />
              <CardRow label="Days post-breeding" value={daysPost} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function RelatedFoalingSection({
  mareId,
  foalingRecords,
  foalByFoalingRecordId,
  navigation,
}: {
  mareId: string;
  foalingRecords: readonly FoalingRecord[];
  foalByFoalingRecordId: Record<string, Foal>;
  navigation: Props['navigation'];
}): JSX.Element {
  return (
    <View style={cardStyles.card}>
      <Text style={styles.sectionTitle}>Foaling Records</Text>
      {foalingRecords.length === 0 ? (
        <Text style={styles.emptyText}>No foaling records linked to this breeding event.</Text>
      ) : null}
      {foalingRecords.map((record) => {
        const foal = foalByFoalingRecordId[record.id];
        const foalDateLabel = formatLocalDate(record.date, 'MM-DD-YYYY');

        const cardBody = (
          <>
            <View style={cardStyles.cardRow}>
              <Text style={cardStyles.cardLabel}>Outcome</Text>
              <StatusBadge label={formatOutcome(record.outcome)} backgroundColor={getOutcomeColor(record.outcome)} textColor="#FFFFFF" />
            </View>
            {record.foalSex && getFoalSexColor(record.foalSex) ? (
              <View style={cardStyles.cardRow}>
                <Text style={cardStyles.cardLabel}>Foal sex</Text>
                <StatusBadge label={formatFoalSex(record.foalSex)} backgroundColor={getFoalSexColor(record.foalSex)!} textColor="#FFFFFF" />
              </View>
            ) : null}
            {foal ? <CardRow label="Foal" value={foal.name || 'Unnamed foal'} /> : null}
          </>
        );

        return (
          <View key={record.id} style={styles.relatedCard}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.cardTitle}>{foalDateLabel}</Text>
              <EditIconButton onPress={() => navigation.navigate('FoalingRecordForm', { mareId, foalingRecordId: record.id })} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open foaling record from ${foalDateLabel}`}
              onPress={() => navigation.navigate('FoalingEventDetail', { foalingRecordId: record.id })}
              style={({ pressed }) => [styles.cardBodyPressable, pressed && styles.pressed]}
            >
              {cardBody}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  pressableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkValue: {
    color: colors.primary,
  },
  relatedCard: {
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  cardBodyPressable: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  errorText: {
    color: colors.error,
  },
});
