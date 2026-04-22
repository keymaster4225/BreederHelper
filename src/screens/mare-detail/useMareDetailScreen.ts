import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

import { BreedingRecord, DailyLog, Foal, FoalingRecord, Mare, MedicationLog, PregnancyCheck } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { buildBreedingById, buildFoalByFoalingRecordId, buildStallionNameById } from '@/selectors/mareDetail';
import {
  getMareById,
  listBreedingRecordsByMare,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listFoalsByMare,
  listMedicationLogsByMare,
  listPregnancyChecksByMare,
  listStallions,
} from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';

import { TAB_KEY_TO_INDEX } from './MareDetailTabStrip';

type MareDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
type MareDetailRoute = RouteProp<RootStackParamList, 'MareDetail'>;

type MareDetailScreenState = {
  readonly mareId: string;
  readonly mare: Mare | null;
  readonly dailyLogs: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly medicationLogs: readonly MedicationLog[];
  readonly foalByFoalingRecordId: Readonly<Record<string, Foal>>;
  readonly stallionNameById: Readonly<Record<string, string>>;
  readonly breedingById: Readonly<Record<string, BreedingRecord>>;
  readonly age: number | null;
  readonly initialTabIndex: number;
  readonly activeTabIndex: number;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly pagerRef: React.RefObject<PagerView | null>;
  readonly handlePageSelected: (event: PagerViewOnPageSelectedEvent) => void;
  readonly handleTabPress: (index: number) => void;
};

export function useMareDetailScreen(
  navigation: MareDetailNavigation,
  route: MareDetailRoute
): MareDetailScreenState {
  const mareId = route.params.mareId;
  const initialTabIndex = TAB_KEY_TO_INDEX[route.params.initialTab ?? ''] ?? 0;

  const [mare, setMare] = useState<Mare | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [foalByFoalingRecordId, setFoalByFoalingRecordId] = useState<Readonly<Record<string, Foal>>>({});
  const [stallionNameById, setStallionNameById] = useState<Readonly<Record<string, string>>>({});
  const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pagerRef = useRef<PagerView>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [mareRecord, logs, breeding, checks, foaling, foals, stallions, meds] = await Promise.all([
        getMareById(mareId),
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listFoalsByMare(mareId),
        listStallions(),
        listMedicationLogsByMare(mareId),
      ]);

      if (!mareRecord) {
        setMare(null);
        setError('Mare not found.');
        return;
      }

      setMare(mareRecord);
      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setMedicationLogs(meds);
      setFoalByFoalingRecordId(buildFoalByFoalingRecordId(foals));
      setStallionNameById(buildStallionNameById(stallions));

      navigation.setOptions({ title: mareRecord.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mare details.');
    } finally {
      setIsLoading(false);
    }
  }, [mareId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const breedingById = useMemo(() => buildBreedingById(breedingRecords), [breedingRecords]);
  const age = deriveAgeYears(mare?.dateOfBirth ?? null);

  const handlePageSelected = useCallback((event: PagerViewOnPageSelectedEvent) => {
    setActiveTabIndex(event.nativeEvent.position);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  return {
    mareId,
    mare,
    dailyLogs,
    breedingRecords,
    pregnancyChecks,
    foalingRecords,
    medicationLogs,
    foalByFoalingRecordId,
    stallionNameById,
    breedingById,
    age,
    initialTabIndex,
    activeTabIndex,
    isLoading,
    error,
    pagerRef,
    handlePageSelected,
    handleTabPress,
  };
}
