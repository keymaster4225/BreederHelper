import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { EditIconButton } from '@/components/RecordCardParts';
import { Stallion } from '@/models/types';
import { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { listStallions, softDeleteStallion } from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Stallions'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function StallionManagementScreen({ navigation }: Props): JSX.Element {
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

  const filteredStallions = stallions.filter((s) =>
    s.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const handleDeleteStallion = useCallback(
    (stallion: Stallion) => {
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
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to delete stallion.';
                if (message.toLowerCase().includes('foreign key')) {
                  Alert.alert('Delete blocked', 'Cannot delete this stallion because linked records exist.');
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

  const handleStallionPress = useCallback(
    (stallion: Stallion, isSelected: boolean) => {
      if (isSelected) {
        setSelectedStallionId(null);
      } else {
        navigation.navigate('StallionDetail', { stallionId: stallion.id });
      }
    },
    [navigation],
  );

  return (
    <Screen>
      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {!isLoading && stallions.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="horse-variant" size={72} color={colors.primary} />
          <Text style={styles.emptyHeading}>No stallions yet</Text>
          <Text style={styles.emptySubtitle}>Add your first stallion to get started.</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressedOpacity]}
            onPress={() => navigation.navigate('StallionForm', {})}
          >
            <Text style={styles.emptyButtonText}>Add your first stallion</Text>
          </Pressable>
        </View>
      ) : null}

      {stallions.length > 0 ? <Text style={styles.listHint}>Tap a stallion to view details. Long press to delete.</Text> : null}

      {stallions.length > 0 ? (
        <View style={styles.searchBar}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.onSurfaceVariant}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stallions..."
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
      ) : null}

      {stallions.length > 0 && filteredStallions.length === 0 ? (
        <View style={styles.filteredEmptyState}>
          <Text style={styles.filteredEmptyText}>No stallions match your search.</Text>
        </View>
      ) : null}

      {!isLoading && stallions.length > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.pressedOpacity]}
          onPress={() => navigation.navigate('StallionForm', {})}
          accessibilityRole="button"
          accessibilityLabel="Add stallion"
        >
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </Pressable>
      ) : null}

      {filteredStallions.length > 0 ? (
        <FlatList
          data={filteredStallions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const age = deriveAgeYears(item.dateOfBirth);
            const isSelected = selectedStallionId === item.id;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                onPress={() => handleStallionPress(item, isSelected)}
                onLongPress={() => setSelectedStallionId(isSelected ? null : item.id)}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.breed ? <Text style={styles.rowSubtitle}>{item.breed}</Text> : null}
                  {age !== null ? <Text style={styles.rowMeta}>Age {age}</Text> : null}
                </View>
                {isSelected ? (
                  <Pressable
                    style={({ pressed }) => [styles.inlineDeleteButton, pressed && styles.inlineEditPressed]}
                    onPress={() => handleDeleteStallion(item)}
                  >
                    <Text style={styles.inlineDeleteButtonText}>Delete</Text>
                  </Pressable>
                ) : (
                  <EditIconButton onPress={() => navigation.navigate('StallionForm', { stallionId: item.id })} />
                )}
              </Pressable>
            );
          }}
        />
      ) : null}
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
  listHint: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
    textAlign: 'center',
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
  filteredEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  filteredEmptyText: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
});
