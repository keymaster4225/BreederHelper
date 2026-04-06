import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { StatusBadge } from '@/components/StatusBadge';
import { SemenCollection, Stallion } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';

type Props = {
  readonly stallionId: string;
  readonly stallion: Stallion;
  readonly collections: readonly SemenCollection[];
  readonly isDeleted: boolean;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'StallionDetail'>;
};

function hasAnyAvPref(s: Stallion): boolean {
  return (
    s.avTemperatureF != null ||
    s.avType != null ||
    s.avLinerType != null ||
    s.avWaterVolumeMl != null ||
    s.avNotes != null
  );
}

export function CollectionsTab({ stallionId, stallion, collections, isDeleted, navigation }: Props): JSX.Element {
  return (
    <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable
        style={({ pressed }) => [cardStyles.card, pressed && styles.pressed]}
        onPress={() => navigation.navigate('AVPreferencesForm', { stallionId })}
        accessibilityRole="button"
        accessibilityLabel="Edit AV Preferences"
      >
        <Text style={styles.sectionTitle}>AV Preferences</Text>
        {hasAnyAvPref(stallion) ? (
          <>
            <CardRow label="Temperature" value={stallion.avTemperatureF != null ? `${stallion.avTemperatureF}\u00B0F` : null} />
            <CardRow label="AV Type" value={stallion.avType} />
            <CardRow label="Liner" value={stallion.avLinerType} />
            <CardRow label="Water Volume" value={stallion.avWaterVolumeMl != null ? `${stallion.avWaterVolumeMl} mL` : null} />
            <CardRow label="Notes" value={stallion.avNotes} />
          </>
        ) : (
          <Text style={styles.mutedText}>Tap to set AV preferences.</Text>
        )}
      </Pressable>

      {!isDeleted ? (
        <PrimaryButton
          label="Add Collection"
          onPress={() => navigation.navigate('CollectionForm', { stallionId })}
        />
      ) : null}

      {collections.length > 0 ? (
        <View style={cardStyles.listWrap}>
          {collections.map((c) => (
            <View key={c.id} style={cardStyles.card}>
              <View style={cardStyles.cardHeader}>
                <Text style={cardStyles.cardTitle}>{formatLocalDate(c.collectionDate, 'MM-DD-YYYY')}</Text>
                <EditIconButton onPress={() => navigation.navigate('CollectionForm', { stallionId, collectionId: c.id })} />
              </View>
              <CardRow label="Raw Volume" value={c.rawVolumeMl != null ? `${c.rawVolumeMl} mL` : null} />
              <CardRow label="Concentration" value={c.concentrationMillionsPerMl != null ? `${c.concentrationMillionsPerMl} M/mL` : null} />
              <CardRow label="Motility" value={c.progressiveMotilityPercent != null ? `${c.progressiveMotilityPercent}%` : null} />
              <CardRow
                label="Doses"
                value={
                  c.doseCount != null
                    ? c.doseSizeMillions != null
                      ? `${c.doseCount} x ${c.doseSizeMillions}M`
                      : String(c.doseCount)
                    : null
                }
              />
              {c.shipped ? (
                <>
                  <StatusBadge
                    label="Shipped"
                    backgroundColor={colors.secondaryContainer}
                    textColor={colors.onSecondaryContainer}
                  />
                  <CardRow label="Shipped To" value={c.shippedTo} />
                </>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={cardStyles.emptyTabState}>
          <Text style={cardStyles.emptyText}>No collections recorded.</Text>
        </View>
      )}
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
  mutedText: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  pressed: {
    opacity: 0.85,
  },
});
