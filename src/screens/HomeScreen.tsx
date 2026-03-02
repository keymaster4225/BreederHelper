import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Mare } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { listMares } from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

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
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedOpacity]}
          onPress={() => navigation.navigate('EditMare')}
        >
          <Text style={styles.primaryButtonText}>Add Mare</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedOpacity]}
          onPress={() => navigation.navigate('Stallions')}
        >
          <Text style={styles.secondaryButtonText}>Stallions</Text>
        </Pressable>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!isLoading && mares.length === 0 ? <Text style={styles.emptyText}>No mares yet. Add your first mare.</Text> : null}

      <FlatList
        data={mares}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const age = deriveAgeYears(item.dateOfBirth);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate('MareDetail', { mareId: item.id })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.breed}</Text>
                {age !== null ? <Text style={styles.rowMeta}>Age {age}</Text> : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.inlineEditButton, pressed && styles.inlineEditPressed]}
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
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
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
  pressedOpacity: {
    opacity: 0.85,
  },
  pressedOpacityLight: {
    opacity: 0.7,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    ...typography.bodyMedium,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
