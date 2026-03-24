import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IconButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Mare,
  PregnancyInfo,
  buildPregnancyInfoForCheck,
  findCurrentPregnancyCheck,
} from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getBreedingRecordById,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listMares,
  listPregnancyChecksByMare,
  softDeleteMare,
} from '@/storage/repositories';
import { deriveAgeYears, formatLocalDate, toLocalDate } from '@/utils/dates';
import { filterMares, StatusFilter } from '@/utils/filterMares';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): JSX.Element {
  const [mares, setMares] = useState<Mare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMareId, setSelectedMareId] = useState<string | null>(null);
  const [pregnantInfo, setPregnantInfo] = useState<Map<string, PregnancyInfo>>(new Map());
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredMares = useMemo(
    () => filterMares(mares, searchText, statusFilter, pregnantInfo),
    [mares, searchText, statusFilter, pregnantInfo],
  );

  const loadMares = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listMares();
      setMares(result);

      const today = toLocalDate(new Date());
      const nextPregnantInfo = new Map<string, PregnancyInfo>();
      await Promise.all(
        result.map(async (mare) => {
          const [checks, foalings] = await Promise.all([
            listPregnancyChecksByMare(mare.id),
            listFoalingRecordsByMare(mare.id),
          ]);

          const currentCheck = findCurrentPregnancyCheck(checks, foalings);
          if (!currentCheck) {
            return;
          }

          const [breedingRecord, dailyLogs] = await Promise.all([
            getBreedingRecordById(currentCheck.breedingRecordId),
            listDailyLogsByMare(mare.id),
          ]);

          nextPregnantInfo.set(
            mare.id,
            buildPregnancyInfoForCheck(currentCheck, dailyLogs, breedingRecord, today)
          );
        })
      );
      setPregnantInfo(nextPregnantInfo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mares.';
      setError(message);
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

  const onDeleteMare = useCallback((mare: Mare): void => {
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
  }, [loadMares]);

  useEffect(() => {
    if (!isLoading && mares.length > 0) {
      navigation.setOptions({
        headerRight: () => (
          <Pressable
            onPress={() => navigation.navigate('EditMare')}
            style={({ pressed }) => [styles.headerAddButton, pressed && styles.pressedOpacity]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Add mare"
          >
            <MaterialCommunityIcons name="plus" size={26} color={colors.primary} />
          </Pressable>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [isLoading, mares.length, navigation]);

  return (
    <Screen>
{isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!isLoading && mares.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="horse" size={72} color={colors.primary} />
          <Text style={styles.emptyHeading}>No mares yet</Text>
          <Text style={styles.emptySubtitle}>Add your first mare to get started.</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressedOpacity]}
            onPress={() => navigation.navigate('EditMare')}
          >
            <Text style={styles.emptyButtonText}>Add your first mare</Text>
          </Pressable>
        </View>
      ) : null}

      {mares.length > 0 ? <Text style={styles.listHint}>Tap a mare to view details. Long press to delete.</Text> : null}

      {mares.length > 0 ? (
        <>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={colors.onSurfaceVariant}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search mares..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchText !== '' ? (
              <Pressable
                onPress={() => setSearchText('')}
                hitSlop={8}
                accessibilityLabel="Clear search"
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            {(['all', 'pregnant', 'open'] as const).map((value) => {
              const isActive = statusFilter === value;
              const label = value === 'all' ? 'All' : value === 'pregnant' ? 'Pregnant' : 'Open';
              return (
                <Pressable
                  key={value}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : styles.filterChipInactive]}
                  onPress={() => setStatusFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={isActive ? styles.filterChipTextActive : styles.filterChipTextInactive}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {mares.length > 0 && filteredMares.length === 0 ? (
        <View style={styles.filteredEmptyState}>
          <Text style={styles.filteredEmptyText}>No mares match your search.</Text>
        </View>
      ) : null}

      {filteredMares.length > 0 ? <FlatList
        data={filteredMares}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const age = deriveAgeYears(item.dateOfBirth);
          const isSelected = selectedMareId === item.id;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              onPress={() => {
                if (isSelected) {
                  setSelectedMareId(null);
                } else {
                  navigation.navigate('MareDetail', { mareId: item.id });
                }
              }}
              onLongPress={() => setSelectedMareId(isSelected ? null : item.id)}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.breed}</Text>
                {age !== null ? <Text style={styles.rowMeta}>Age {age}</Text> : null}
                {pregnantInfo.has(item.id) ? (
                  <>
                    <StatusBadge label="Pregnant" backgroundColor={colors.pregnant} textColor="#fff" />
                    {(() => {
                      const pregnancy = pregnantInfo.get(item.id)!;
                      const parts: string[] = [];
                      if (pregnancy.daysPostOvulation !== null) {
                        parts.push(`DPO ${pregnancy.daysPostOvulation}`);
                      }
                      if (pregnancy.estimatedDueDate) {
                        parts.push(`Due ${formatLocalDate(pregnancy.estimatedDueDate, 'MM-DD-YYYY')}`);
                      }
                      return parts.length > 0 ? (
                        <Text style={styles.rowMeta}>{parts.join(' | ')}</Text>
                      ) : null;
                    })()}
                  </>
                ) : null}
              </View>
              {isSelected ? (
                <Pressable
                  style={({ pressed }) => [styles.inlineDeleteButton, pressed && styles.inlineEditPressed]}
                  onPress={() => onDeleteMare(item)}
                >
                  <Text style={styles.inlineDeleteButtonText}>Delete</Text>
                </Pressable>
              ) : (
                <IconButton icon="✎" onPress={() => navigation.navigate('EditMare', { mareId: item.id })} accessibilityLabel="Edit Mare" />
              )}
            </Pressable>
          );
        }}
      /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
listContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    ...elevation.level1,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  rowTitle: {
    ...typography.titleMedium,
  },
  rowSubtitle: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
  rowMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  inlineEditPressed: {
    opacity: 0.7,
  },
  inlineDeleteButton: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineDeleteButtonText: {
    color: colors.onErrorContainer,
    ...typography.labelMedium,
  },
  headerAddButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pressedOpacity: {
    opacity: 0.85,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  emptyHeading: {
    ...typography.titleLarge,
    color: colors.onSurface,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emptyButtonText: {
    ...typography.labelLarge,
    color: colors.onPrimaryContainer,
  },
  listHint: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.onSurface,
    flex: 1,
    marginHorizontal: spacing.sm,
    ...typography.bodyMedium,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    borderRadius: borderRadius.full,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderWidth: 1,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    ...typography.labelMedium,
  },
  filterChipTextInactive: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  filteredEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  filteredEmptyText: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
});
