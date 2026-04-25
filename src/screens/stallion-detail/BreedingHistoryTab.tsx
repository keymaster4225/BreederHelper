import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { cardStyles } from '@/components/RecordCardParts';
import { BreedingRecord } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import { formatBreedingMethod } from '@/utils/outcomeDisplay';

type Props = {
  readonly linkedBreedings: readonly BreedingRecord[];
  readonly legacyBreedings: readonly BreedingRecord[];
  readonly mareNameById: Readonly<Record<string, string>>;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'StallionDetail'>;
};

export function BreedingHistoryTab({ linkedBreedings, legacyBreedings, mareNameById, navigation }: Props): JSX.Element {
  const hasAny = linkedBreedings.length > 0 || legacyBreedings.length > 0;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {linkedBreedings.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Linked Breeding Records</Text>
          <View style={cardStyles.listWrap}>
            {linkedBreedings.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`Open breeding event for ${mareNameById[r.mareId] ?? 'unknown mare'}`}
                style={({ pressed }) => [cardStyles.card, pressed && styles.pressed]}
                onPress={() => navigation.navigate('BreedingEventDetail', { breedingRecordId: r.id })}
              >
                <Text style={cardStyles.cardTitle}>{formatLocalDate(r.date, 'MM-DD-YYYY')}</Text>
                <Text style={styles.cardMeta}>Mare: {mareNameById[r.mareId] ?? 'Unknown'}</Text>
                <Text style={styles.cardMeta}>Method: {formatBreedingMethod(r.method)}</Text>
                {r.collectionId ? <Text style={styles.collectionTag}>Collection linked</Text> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {legacyBreedings.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, styles.mutedTitle]}>Unlinked Legacy Records</Text>
          <View style={cardStyles.listWrap}>
            {legacyBreedings.map((r) => (
              <View key={r.id} style={[cardStyles.card, styles.legacyCard]}>
                <Text style={cardStyles.cardTitle}>{formatLocalDate(r.date, 'MM-DD-YYYY')}</Text>
                <Text style={styles.cardMeta}>Mare: {mareNameById[r.mareId] ?? 'Unknown'}</Text>
                <Text style={styles.cardMeta}>Method: {formatBreedingMethod(r.method)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {!hasAny ? (
        <View style={cardStyles.emptyTabState}>
          <Text style={cardStyles.emptyText}>No breeding records found.</Text>
        </View>
      ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  mutedTitle: {
    color: colors.onSurfaceVariant,
  },
  cardMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  collectionTag: {
    color: colors.primary,
    ...typography.labelSmall,
  },
  legacyCard: {
    opacity: 0.75,
  },
  pressed: {
    opacity: 0.7,
  },
});
