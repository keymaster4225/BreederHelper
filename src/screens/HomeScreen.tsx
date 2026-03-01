import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Mare } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { listMares } from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';
import { borderRadius, colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): JSX.Element {
  const [mares, setMares] = useState<Mare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    }, [loadMares])
  );

  return (
    <Screen>
      <View style={styles.headerActions}>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('EditMare')}>
          <Text style={styles.primaryButtonText}>Add Mare</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Stallions')}>
          <Text style={styles.secondaryButtonText}>Stallions</Text>
        </Pressable>
      </View>

      {isLoading ? <Text>Loading mares...</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!isLoading && mares.length === 0 ? <Text>No mares yet. Add your first mare.</Text> : null}

      <FlatList
        data={mares}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const age = deriveAgeYears(item.dateOfBirth);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('MareDetail', { mareId: item.id })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.breed}</Text>
                {age !== null ? <Text style={styles.rowMeta}>Age {age}</Text> : null}
              </View>
              <Pressable
                style={styles.inlineEditButton}
                onPress={() => navigation.navigate('EditMare', { mareId: item.id })}
              >
                <Text style={styles.inlineEditButtonText}>Edit</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  listContent: {
    gap: 10,
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
  },
  rowMain: {
    flex: 1,
    gap: 2,
    marginRight: 10,
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
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
