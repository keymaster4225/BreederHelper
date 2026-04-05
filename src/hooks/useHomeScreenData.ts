import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { Mare, PregnancyInfo } from '@/models/types';
import {
  listAllBreedingRecords,
  listAllDailyLogs,
  listAllFoalingRecords,
  listAllPregnancyChecks,
  listMares,
  softDeleteMare,
} from '@/storage/repositories';
import { buildPregnantInfoMap, selectFilteredMares } from '@/selectors/homeScreen';
import { toLocalDate } from '@/utils/dates';
import { StatusFilter } from '@/utils/filterMares';

type HomeScreenData = {
  readonly mares: Mare[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly selectedMareId: string | null;
  readonly pregnantInfo: ReadonlyMap<string, PregnancyInfo>;
  readonly searchText: string;
  readonly statusFilter: StatusFilter;
  readonly filteredMares: Mare[];
  readonly loadMares: () => Promise<void>;
  readonly onDeleteMare: (mare: Mare) => void;
  readonly setSelectedMareId: (mareId: string | null) => void;
  readonly setSearchText: (value: string) => void;
  readonly setStatusFilter: (value: StatusFilter) => void;
};

export function useHomeScreenData(): HomeScreenData {
  const [mares, setMares] = useState<Mare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMareId, setSelectedMareId] = useState<string | null>(null);
  const [pregnantInfo, setPregnantInfo] = useState<Map<string, PregnancyInfo>>(new Map());
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadMares = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [nextMares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords] = await Promise.all([
        listMares(),
        listAllDailyLogs(),
        listAllBreedingRecords(),
        listAllPregnancyChecks(),
        listAllFoalingRecords(),
      ]);

      const today = toLocalDate(new Date());
      setMares(nextMares);
      setPregnantInfo(
        buildPregnantInfoMap(nextMares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, today),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mares.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onDeleteMare = useCallback(
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
    [loadMares],
  );

  const filteredMares = useMemo(
    () => selectFilteredMares(mares, searchText, statusFilter, pregnantInfo),
    [mares, pregnantInfo, searchText, statusFilter],
  );

  return {
    mares,
    isLoading,
    error,
    selectedMareId,
    pregnantInfo,
    searchText,
    statusFilter,
    filteredMares,
    loadMares,
    onDeleteMare,
    setSelectedMareId,
    setSearchText,
    setStatusFilter,
  };
}
