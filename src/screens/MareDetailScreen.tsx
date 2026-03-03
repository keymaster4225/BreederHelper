import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IconButton, PrimaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { formatOutcome, getOutcomeColor } from '@/utils/outcomeDisplay';
import { getScoreColors } from '@/utils/scoreColors';
import { BreedingRecord, DailyLog, FoalingRecord, Mare, PregnancyCheck, calculateDaysPostBreeding } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getMareById,
  listBreedingRecordsByMare,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listPregnancyChecksByMare,
  listStallions,
} from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MareDetail'>;
type DetailTab = 'dailyLogs' | 'breedingRecords' | 'pregnancyChecks' | 'foalingRecords';

const TAB_OPTIONS: { label: string; value: DetailTab }[] = [
  { label: 'Daily Logs', value: 'dailyLogs' },
  { label: 'Breeding', value: 'breedingRecords' },
  { label: 'Pregnancy', value: 'pregnancyChecks' },
  { label: 'Foaling', value: 'foalingRecords' },
];

export function MareDetailScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;

  const [mare, setMare] = useState<Mare | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [stallionNameById, setStallionNameById] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<DetailTab>('dailyLogs');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [mareRecord, logs, breeding, checks, foaling, stallions] = await Promise.all([
        getMareById(mareId),
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listStallions(),
      ]);

      if (!mareRecord) {
        setError('Mare not found.');
        setMare(null);
        return;
      }

      const stallionMap = Object.fromEntries(stallions.map((stallion) => [stallion.id, stallion.name]));

      setMare(mareRecord);
      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setStallionNameById(stallionMap);

      navigation.setOptions({ title: mareRecord.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mare details.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [mareId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const breedingById = useMemo(
    () => Object.fromEntries(breedingRecords.map((record) => [record.id, record])),
    [breedingRecords]
  );

  const age = deriveAgeYears(mare?.dateOfBirth ?? null);

  const renderEditIconButton = (onPress: () => void): JSX.Element => (
    <IconButton icon={'\u270E'} onPress={onPress} />
  );

  const renderCardRow = (label: string, value: string | number | null | undefined): JSX.Element => (
    <View style={styles.cardRow}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value ?? '-'}</Text>
    </View>
  );

  const renderScoreBadge = (score: number | null | undefined): JSX.Element => {
    const display = score != null ? String(score) : 'N/A';
    const badgeColors = getScoreColors(score);
    return <StatusBadge label={display} backgroundColor={badgeColors.backgroundColor} textColor={badgeColors.textColor} />;
  };

  const renderTabContent = (): JSX.Element => {
    if (activeTab === 'dailyLogs') {
      return (
        <View style={styles.listWrap}>
          <PrimaryButton label="Add Daily Log" onPress={() => navigation.navigate('DailyLogForm', { mareId })} />
          {dailyLogs.length === 0 ? <Text style={styles.emptyText}>No daily logs yet.</Text> : null}
          {dailyLogs.map((log) => (
            <View key={log.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{log.date}</Text>
                {renderEditIconButton(() => navigation.navigate('DailyLogForm', { mareId, logId: log.id }))}
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Teasing</Text>
                {renderScoreBadge(log.teasingScore)}
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Edema</Text>
                {renderScoreBadge(log.edema)}
              </View>
              {renderCardRow('Right ovary', log.rightOvary || '-')}
              {renderCardRow('Left ovary', log.leftOvary || '-')}
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === 'breedingRecords') {
      return (
        <View style={styles.listWrap}>
          <PrimaryButton label="Add Breeding Record" onPress={() => navigation.navigate('BreedingRecordForm', { mareId })} />
          {breedingRecords.length === 0 ? <Text style={styles.emptyText}>No breeding records yet.</Text> : null}
          {breedingRecords.map((record) => (
            <View key={record.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{record.date}</Text>
                {renderEditIconButton(() =>
                  navigation.navigate('BreedingRecordForm', { mareId, breedingRecordId: record.id })
                )}
              </View>
              {renderCardRow('Method', record.method)}
              {renderCardRow('Stallion', record.stallionName ?? stallionNameById[record.stallionId ?? ''] ?? 'Unknown')}
              {record.collectionDate ? renderCardRow('Collection', record.collectionDate) : null}
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === 'pregnancyChecks') {
      return (
        <View style={styles.listWrap}>
          <PrimaryButton label="Add Pregnancy Check" onPress={() => navigation.navigate('PregnancyCheckForm', { mareId })} />
          {pregnancyChecks.length === 0 ? <Text style={styles.emptyText}>No pregnancy checks yet.</Text> : null}
          {pregnancyChecks.map((check) => {
            const breeding = breedingById[check.breedingRecordId];
            const daysPost = breeding ? calculateDaysPostBreeding(check.date, breeding.date) : null;

            return (
              <View key={check.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{check.date}</Text>
                  {renderEditIconButton(() =>
                    navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })
                  )}
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Result</Text>
                  <StatusBadge
                    label={check.result === 'positive' ? 'Positive' : 'Negative'}
                    backgroundColor={check.result === 'positive' ? colors.positive : colors.negative}
                    textColor="#FFFFFF"
                  />
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Heartbeat</Text>
                  <StatusBadge
                    label={check.heartbeatDetected ? 'Yes' : 'No'}
                    backgroundColor={check.heartbeatDetected ? colors.heartbeat : colors.score0}
                    textColor={check.heartbeatDetected ? '#FFFFFF' : colors.onSurfaceVariant}
                  />
                </View>
                {renderCardRow('Days post-breeding', daysPost ?? '-')}
              </View>
            );
          })}
        </View>
      );
    }

    return (
      <View style={styles.listWrap}>
        <PrimaryButton label="Add Foaling Record" onPress={() => navigation.navigate('FoalingRecordForm', { mareId })} />
        {foalingRecords.length === 0 ? <Text style={styles.emptyText}>No foaling records yet.</Text> : null}
        {foalingRecords.map((record) => (
          <View key={record.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{record.date}</Text>
              {renderEditIconButton(() =>
                navigation.navigate('FoalingRecordForm', { mareId, foalingRecordId: record.id })
              )}
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Outcome</Text>
              <Text style={[styles.cardValue, { color: getOutcomeColor(record.outcome) }]}>
                {formatOutcome(record.outcome)}
              </Text>
            </View>
            {renderCardRow('Foal sex', record.foalSex ?? '-')}
            {record.complications ? renderCardRow('Complications', record.complications) : null}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen>
      {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {mare ? (
        <>
          <View style={styles.headerCard}>
            <Text style={styles.headerName}>{mare.name}</Text>
            <Text style={styles.headerLine}>{mare.breed}</Text>
            {age !== null ? <Text style={styles.headerLine}>Age {age}</Text> : null}
            {mare.registrationNumber ? <Text style={styles.headerLine}>Reg #: {mare.registrationNumber}</Text> : null}
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('EditMare', { mareId })}>
              <Text style={styles.secondaryButtonText}>Edit Mare</Text>
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            {TAB_OPTIONS.map((tab) => {
              const active = tab.value === activeTab;
              return (
                <Pressable key={tab.value} style={({ pressed }) => [styles.tabButton, active ? styles.tabButtonActive : null, pressed && !active && styles.tabPressed]} onPress={() => setActiveTab(tab.value)}>
                  <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>{renderTabContent()}</ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...elevation.level2,
  },
  headerName: {
    ...typography.titleMedium,
    fontWeight: '700',
  },
  headerLine: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabButton: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  tabButtonTextActive: {
    color: colors.onPrimary,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  listWrap: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
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
  emptyText: {
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    ...typography.bodyMedium,
  },
  tabPressed: {
    opacity: 0.7,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
