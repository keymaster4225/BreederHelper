import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { Stallion } from '@/models/types';
import { listStallions, softDeleteStallion } from '@/storage/repositories';

type UseStallionManagementResult = {
  readonly stallions: Stallion[];
  readonly filteredStallions: Stallion[];
  readonly isLoading: boolean;
  readonly searchText: string;
  readonly selectedStallionId: string | null;
  readonly setSearchText: (value: string) => void;
  readonly setSelectedStallionId: (value: string | null) => void;
  readonly requestDeleteStallion: (stallion: Stallion) => void;
};

export function useStallionManagement(): UseStallionManagementResult {
  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedStallionId, setSelectedStallionId] = useState<string | null>(null);

  const loadStallions = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await listStallions();
      setStallions(rows);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStallions();
      setSelectedStallionId(null);
    }, [loadStallions]),
  );

  const filteredStallions = useMemo(
    () =>
      stallions.filter((stallion) =>
        stallion.name.toLowerCase().includes(searchText.toLowerCase()),
      ),
    [searchText, stallions],
  );

  const requestDeleteStallion = useCallback(
    (stallion: Stallion): void => {
      Alert.alert('Delete Stallion', `Delete ${stallion.name}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteStallion(stallion.id);
                await loadStallions();
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'Failed to delete stallion.';
                if (message.toLowerCase().includes('foreign key')) {
                  Alert.alert(
                    'Delete blocked',
                    'Cannot delete this stallion because linked records exist.',
                  );
                  return;
                }
                Alert.alert('Delete failed', message);
              }
            })();
          },
        },
      ]);
    },
    [loadStallions],
  );

  return {
    stallions,
    filteredStallions,
    isLoading,
    searchText,
    selectedStallionId,
    setSearchText,
    setSelectedStallionId,
    requestDeleteStallion,
  };
}
