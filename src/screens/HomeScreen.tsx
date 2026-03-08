import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Mare } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { listMares, softDeleteMare } from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): JSX.Element {
  const [mares, setMares] = useState<Mare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMareId, setSelectedMareId] = useState<string | null>(null);

  const loadMares = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listMares();
      setMares(result);
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

      {mares.length > 0 ? <Text style={styles.listHint}>Tap a mare to view or add records</Text> : null}

      {mares.length > 0 ? <FlatList
        data={mares}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const age = deriveAgeYears(item.dateOfBirth);
          const isSelected = selectedMareId === item.id;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
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
              </View>
              {isSelected ? (
                <Pressable
                  style={({ pressed }) => [styles.inlineDeleteButton, pressed && styles.inlineEditPressed]}
                  onPress={() => onDeleteMare(item)}
                >
                  <Text style={styles.inlineDeleteButtonText}>Delete</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.inlineEditButton, pressed && styles.inlineEditPressed]}
                  onPress={() => navigation.navigate('EditMare', { mareId: item.id })}
                >
                  <Text style={styles.inlineEditButtonText}>Edit</Text>
                </Pressable>
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
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
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
    ...typography.titleSmall,
  },
  rowSubtitle: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
  rowMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  inlineEditButton: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineEditButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  inlineEditPressed: {
    opacity: 0.7,
  },
  inlineDeleteButton: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineDeleteButtonText: {
    color: colors.onErrorContainer,
    ...typography.labelMedium,
  },
  headerAddButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
});
