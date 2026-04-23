import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { seedPreviewData } from '@/utils/devSeed';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useHomeScreenData } from '@/hooks/useHomeScreenData';
import { IconButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { Mare } from '@/models/types';
import { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { isPreviewBuild } from '@/utils/buildProfile';
import { deriveAgeYears, formatLocalDate } from '@/utils/dates';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Mares'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation, route }: Props): JSX.Element {
  const previewBuild = isPreviewBuild();
  const {
    mares,
    isLoading,
    error,
    selectedMareId,
    pregnantInfo,
    searchText,
    statusFilter,
    filteredMares,
    loadMares,
    loadMaresIfStale,
    onDeleteMare,
    setSelectedMareId,
    setSearchText,
    setStatusFilter,
  } = useHomeScreenData();
  const { initialFilter, requestKey } = route.params ?? {};
  const lastRequestKeyRef = useRef<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      void loadMaresIfStale();
      setSelectedMareId(null);
    }, [loadMaresIfStale, setSelectedMareId])
  );

  useEffect(() => {
    if (requestKey && requestKey !== lastRequestKeyRef.current) {
      lastRequestKeyRef.current = requestKey;
      if (initialFilter) {
        setStatusFilter(initialFilter);
      }
      navigation.setParams({ initialFilter: undefined, requestKey: undefined });
    }
  }, [initialFilter, navigation, requestKey, setStatusFilter]);

  const handleSeedSampleData = useCallback(() => {
    void (async () => {
      try {
        const result = await seedPreviewData();
        await loadMares();
        Alert.alert(
          'Preview Data',
          result === 'inserted'
            ? 'Preview sample data is ready.'
            : 'Preview sample data is already loaded.',
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Seed failed';
        Alert.alert('Seed Error', msg);
      }
    })();
  }, [loadMares]);

  const handleMarePress = useCallback(
    (mare: Mare, isSelected: boolean) => {
      if (isSelected) {
        setSelectedMareId(null);
      } else {
        navigation.navigate('MareDetail', { mareId: mare.id });
      }
    },
    [navigation, setSelectedMareId]
  );

  return (
    <Screen>
      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
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
          {previewBuild ? (
            <Pressable
              style={({ pressed }) => [styles.previewSeedButton, pressed && styles.pressedOpacity]}
              onPress={handleSeedSampleData}
              accessibilityRole="button"
              accessibilityLabel="Seed preview data"
            >
              <Text style={styles.previewSeedButtonText}>Seed Preview Data</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {mares.length > 0 ? <Text style={styles.listHint}>Tap a mare to view details. Long press to delete.</Text> : null}

      {mares.length > 0 ? (
        <>
          {previewBuild ? (
            <Pressable
              style={({ pressed }) => [styles.previewSeedBanner, pressed && styles.pressedOpacity]}
              onPress={handleSeedSampleData}
              accessibilityRole="button"
              accessibilityLabel="Seed preview data"
            >
              <View style={styles.previewSeedBannerTextWrap}>
                <Text style={styles.previewSeedBannerTitle}>Preview Data</Text>
                <Text style={styles.previewSeedBannerSubtitle}>
                  Import the built-in sample mares, stallions, and records.
                </Text>
              </View>
              <MaterialCommunityIcons name="database-import-outline" size={22} color={colors.onTertiaryContainer} />
            </Pressable>
          ) : null}
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

      {!isLoading && mares.length > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.pressedOpacity]}
          onPress={() => navigation.navigate('EditMare')}
          accessibilityRole="button"
          accessibilityLabel="Add mare"
        >
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </Pressable>
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
              onPress={() => handleMarePress(item, isSelected)}
              onLongPress={() => setSelectedMareId(isSelected ? null : item.id)}
            >
              <View style={styles.rowMain}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.isRecipient ? (
                    <StatusBadge
                      label="Recipient"
                      backgroundColor={colors.secondaryContainer}
                      textColor={colors.onSecondaryContainer}
                    />
                  ) : null}
                </View>
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
  loadingOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
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
  rowTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowTitle: {
    flexShrink: 1,
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
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    bottom: spacing.xl,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 56,
    zIndex: 10,
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
  previewSeedButton: {
    backgroundColor: colors.tertiaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  previewSeedButtonText: {
    ...typography.labelLarge,
    color: colors.onTertiaryContainer,
  },
  previewSeedBanner: {
    alignItems: 'center',
    backgroundColor: colors.tertiaryContainer,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  previewSeedBannerTextWrap: {
    flex: 1,
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  previewSeedBannerTitle: {
    ...typography.titleMedium,
    color: colors.onTertiaryContainer,
  },
  previewSeedBannerSubtitle: {
    ...typography.bodySmall,
    color: colors.onTertiaryContainer,
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
    color: colors.onPrimary,
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
