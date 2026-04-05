import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton } from '@/components/Buttons';
import { EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { Screen } from '@/components/Screen';
import { Stallion } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { listStallions } from '@/storage/repositories';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Stallions'>;

function deriveHorseAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const birthYear = parseInt(dateOfBirth.slice(0, 4), 10);
  if (Number.isNaN(birthYear)) return null;
  return new Date().getFullYear() - birthYear;
}

export function StallionManagementScreen({ navigation }: Props): JSX.Element {
  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    }, [loadStallions]),
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PrimaryButton
          label="Add Stallion"
          onPress={() => navigation.navigate('StallionForm', {})}
        />

        {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : null}

        {!isLoading && stallions.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="horse-variant" size={56} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyHeading}>No stallions yet</Text>
            <Text style={styles.emptySubtitle}>Add stallions to reference in breeding records.</Text>
          </View>
        ) : null}

        <View style={cardStyles.listWrap}>
          {stallions.map((stallion) => {
            const age = deriveHorseAge(stallion.dateOfBirth);
            return (
              <Pressable
                key={stallion.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => navigation.navigate('StallionDetail', { stallionId: stallion.id })}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{stallion.name}</Text>
                  {stallion.breed ? <Text style={styles.cardMeta}>{stallion.breed}</Text> : null}
                  {age !== null ? <Text style={styles.cardMeta}>Age {age}</Text> : null}
                </View>
                <EditIconButton onPress={() => navigation.navigate('StallionForm', { stallionId: stallion.id })} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    ...elevation.level1,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardMain: {
    flex: 1,
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  cardTitle: {
    ...typography.titleSmall,
  },
  cardMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyHeading: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
