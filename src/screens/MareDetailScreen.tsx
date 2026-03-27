import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

import { MaterialIcons } from '@expo/vector-icons';

import { IconButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { BreedingRecord, DailyLog, Foal, FoalingRecord, Mare, PregnancyCheck } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getMareById,
  listBreedingRecordsByMare,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listFoalsByMare,
  listPregnancyChecksByMare,
  listStallions,
} from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';
import { DailyLogsTab, BreedingTab, PregnancyTab, FoalingTab } from '@/screens/mare-detail';

type Props = NativeStackScreenProps<RootStackParamList, 'MareDetail'>;

const TAB_OPTIONS = [
  { label: 'Daily Logs' },
  { label: 'Breeding' },
  { label: 'Pregnancy' },
  { label: 'Foaling' },
] as const;

export function MareDetailScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;

  const [mare, setMare] = useState<Mare | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [foalByFoalingRecordId, setFoalByFoalingRecordId] = useState<Record<string, Foal>>({});
  const [stallionNameById, setStallionNameById] = useState<Record<string, string>>({});
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pagerRef = useRef<PagerView>(null);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [mareRecord, logs, breeding, checks, foaling, foals, stallions] = await Promise.all([
        getMareById(mareId),
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listFoalsByMare(mareId),
        listStallions(),
      ]);

      if (!mareRecord) {
        setError('Mare not found.');
        setMare(null);
        return;
      }

      const stallionMap = Object.fromEntries(stallions.map((stallion) => [stallion.id, stallion.name]));
      const foalMap = Object.fromEntries(foals.map((foal) => [foal.foalingRecordId, foal]));

      setMare(mareRecord);
      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setFoalByFoalingRecordId(foalMap);
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

  const handlePageSelected = useCallback((e: PagerViewOnPageSelectedEvent) => {
    setActiveTabIndex(e.nativeEvent.position);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  return (
    <Screen>
      {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {mare ? (
        <>
          <View style={styles.headerCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.headerName}>{mare.name}</Text>
              <View style={styles.headerActions}>
                <IconButton icon={<MaterialIcons name="history" size={20} color={colors.onSurface} />} onPress={() => navigation.navigate('MareTimeline', { mareId })} accessibilityLabel="View History" />
              </View>
            </View>
            <Text style={styles.headerLine}>{mare.breed}</Text>
            {age !== null ? <Text style={styles.headerLine}>Age {age}</Text> : null}
            {mare.registrationNumber ? <Text style={styles.headerLine}>Reg #: {mare.registrationNumber}</Text> : null}
          </View>

          <View style={styles.tabRow}>
            {TAB_OPTIONS.map((tab, index) => {
              const active = index === activeTabIndex;
              return (
                <Pressable
                  key={tab.label}
                  style={({ pressed }) => [styles.tabButton, active ? styles.tabButtonActive : null, pressed && !active && styles.tabPressed]}
                  onPress={() => handleTabPress(index)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={0}
            onPageSelected={handlePageSelected}
          >
            <DailyLogsTab key="0" mareId={mareId} dailyLogs={dailyLogs} navigation={navigation} />
            <BreedingTab key="1" mareId={mareId} breedingRecords={breedingRecords} stallionNameById={stallionNameById} navigation={navigation} />
            <PregnancyTab key="2" mareId={mareId} pregnancyChecks={pregnancyChecks} breedingById={breedingById} dailyLogs={dailyLogs} navigation={navigation} />
            <FoalingTab key="3" mareId={mareId} foalingRecords={foalingRecords} foalByFoalingRecordId={foalByFoalingRecordId} navigation={navigation} />
          </PagerView>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...elevation.level2,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerName: {
    ...typography.titleMedium,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
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
    justifyContent: 'center',
    minHeight: 44,
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
  tabPressed: {
    opacity: 0.7,
  },
  pager: {
    flex: 1,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
