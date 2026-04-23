import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Mare, PregnancyInfo } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { buildPregnancyProjectionByMare } from '@/selectors/home';
import {
  listAllBreedingRecords,
  listAllDailyLogs,
  listAllFoalingRecords,
  listAllFoals,
  listAllMedicationLogs,
  listAllPregnancyChecks,
  listMares,
  softDeleteMare,
} from '@/storage/repositories';
import { toLocalDate } from '@/utils/dates';
import { seedPreviewData } from '@/utils/devSeed';
import { DashboardAlert, generateDashboardAlerts } from '@/utils/dashboardAlerts';
import { filterMares, StatusFilter } from '@/utils/filterMares';

type HomeNavigation = NativeStackNavigationProp<RootStackParamList>;

type UseHomeScreenResult = {
  readonly mares: readonly Mare[];
  readonly filteredMares: readonly Mare[];
  readonly selectedMareId: string | null;
  readonly searchText: string;
  readonly statusFilter: StatusFilter;
  readonly dashboardAlerts: readonly DashboardAlert[];
  readonly pregnantInfo: ReadonlyMap<string, PregnancyInfo>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly setSearchText: (value: string) => void;
  readonly setStatusFilter: (value: StatusFilter) => void;
  readonly toggleSelectedMare: (mareId: string) => void;
  readonly clearSelectedMare: () => void;
  readonly loadMares: () => Promise<void>;
  readonly handleDeleteMare: (mare: Mare) => void;
  readonly handleAlertPress: (alert: DashboardAlert) => void;
  readonly handleSeedSampleData: () => Promise<void>;
};

export function useHomeScreen(navigation: HomeNavigation): UseHomeScreenResult {
  const [mares, setMares] = useState<Mare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMareId, setSelectedMareId] = useState<string | null>(null);
  const [pregnantInfo, setPregnantInfo] = useState<ReadonlyMap<string, PregnancyInfo>>(new Map());
  const [dashboardAlerts, setDashboardAlerts] = useState<readonly DashboardAlert[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredMares = useMemo(
    () => filterMares(mares, searchText, statusFilter, pregnantInfo),
    [mares, searchText, statusFilter, pregnantInfo]
  );

  const loadMares = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [nextMares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs, foals] =
        await Promise.all([
          listMares(),
          listAllDailyLogs(),
          listAllBreedingRecords(),
          listAllPregnancyChecks(),
          listAllFoalingRecords(),
          listAllMedicationLogs(),
          listAllFoals(),
        ]);

      const today = toLocalDate(new Date());

      setMares(nextMares);
      setPregnantInfo(
        buildPregnancyProjectionByMare({
          mares: nextMares,
          dailyLogs,
          breedingRecords,
          pregnancyChecks,
          foalingRecords,
          today,
        })
      );
      setDashboardAlerts(
        generateDashboardAlerts({
          mares: nextMares,
          dailyLogs,
          breedingRecords,
          pregnancyChecks,
          foalingRecords,
          medicationLogs,
          foals,
          today,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mares.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMares();
      setSelectedMareId(null);
    }, [loadMares])
  );

  const handleDeleteMare = useCallback(
    (mare: Mare) => {
      Alert.alert('Delete Mare', `Delete ${mare.name}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteMare(mare.id);
                await loadMares();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to delete mare.';
                if (message.toLowerCase().includes('foreign key')) {
                  Alert.alert('Delete blocked', 'Cannot delete this mare because linked records exist.');
                  return;
                }
                Alert.alert('Delete failed', message);
              }
            })();
          },
        },
      ]);
    },
    [loadMares]
  );

  const handleAlertPress = useCallback(
    (alert: DashboardAlert) => {
      switch (alert.kind) {
        case 'approachingDueDate':
          navigation.navigate('MareDetail', { mareId: alert.mareId });
          break;
        case 'pregnancyCheckNeeded':
          navigation.navigate('PregnancyCheckForm', { mareId: alert.mareId });
          break;
        case 'recentOvulation':
        case 'heatActivity':
        case 'noRecentLog':
          navigation.navigate('DailyLogForm', { mareId: alert.mareId });
          break;
        case 'medicationGap':
          navigation.navigate('MareDetail', { mareId: alert.mareId, initialTab: 'meds' });
          break;
        case 'foalNeedsIgg':
          if (alert.foalingRecordId) {
            navigation.navigate('FoalForm', {
              mareId: alert.mareId,
              foalingRecordId: alert.foalingRecordId,
              foalId: alert.foalId,
            });
          }
          break;
      }
    },
    [navigation]
  );

  const handleSeedSampleData = useCallback(async () => {
    try {
      await seedPreviewData();
      await loadMares();
    } catch (err) {
      Alert.alert('Seed Error', err instanceof Error ? err.message : 'Seed failed');
    }
  }, [loadMares]);

  return {
    mares,
    filteredMares,
    selectedMareId,
    searchText,
    statusFilter,
    dashboardAlerts,
    pregnantInfo,
    isLoading,
    error,
    setSearchText,
    setStatusFilter,
    toggleSelectedMare: (mareId) => setSelectedMareId((current) => (current === mareId ? null : mareId)),
    clearSelectedMare: () => setSelectedMareId(null),
    loadMares,
    handleDeleteMare,
    handleAlertPress,
    handleSeedSampleData,
  };
}
