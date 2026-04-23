import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { FrozenSemenBatch, SemenCollection } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { spacing } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import {
  formatFrozenBatchDoseSummary,
  formatFrozenBatchSource,
  formatFreezingExtender,
  formatStrawColor,
} from '@/utils/frozenSemenDisplay';

type Props = {
  readonly stallionId: string;
  readonly collections: readonly SemenCollection[];
  readonly frozenBatches: readonly FrozenSemenBatch[];
  readonly isDeleted: boolean;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'StallionDetail'>;
};

export function FrozenBatchesTab({
  stallionId,
  collections,
  frozenBatches,
  isDeleted,
  navigation,
}: Props): JSX.Element {
  const collectionDateById = useMemo(() => {
    const lookup: Record<string, string> = {};
    for (const collection of collections) {
      lookup[collection.id] = collection.collectionDate;
    }
    return lookup;
  }, [collections]);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isDeleted ? (
          <PrimaryButton
            label="Add Frozen Batch"
            onPress={() => navigation.navigate('FrozenBatchCreateWizard', { stallionId })}
          />
        ) : null}

        {frozenBatches.length > 0 ? (
          <View style={cardStyles.listWrap}>
            {frozenBatches.map((batch) => {
              const source = formatFrozenBatchSource(
                batch.collectionId ? (collectionDateById[batch.collectionId] ?? null) : null,
              );
              const doseSummary = formatFrozenBatchDoseSummary(
                batch.strawsRemaining,
                batch.strawsPerDose,
              );

              return (
                <Pressable
                  key={batch.id}
                  style={({ pressed }) => [cardStyles.card, pressed && styles.pressed]}
                  onPress={() => navigation.navigate('FrozenBatchForm', {
                    stallionId,
                    frozenBatchId: batch.id,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open frozen batch from ${formatLocalDate(batch.freezeDate, 'MM-DD-YYYY')}`}
                >
                  <View style={cardStyles.cardHeader}>
                    <Text style={cardStyles.cardTitle}>
                      {formatLocalDate(batch.freezeDate, 'MM-DD-YYYY')}
                    </Text>
                  </View>
                  <CardRow label="Source" value={source} />
                  <CardRow
                    label="Straws"
                    value={`${batch.strawsRemaining}/${batch.strawCount} remaining`}
                  />
                  <CardRow
                    label="Dose Summary"
                    value={doseSummary ?? 'Not set'}
                  />
                  <CardRow
                    label="Extender"
                    value={formatFreezingExtender(batch.extender, batch.extenderOther)}
                  />
                  <CardRow
                    label="Straw Color"
                    value={formatStrawColor(batch.strawColor, batch.strawColorOther)}
                  />
                  <CardRow
                    label="Post-thaw Motility"
                    value={
                      batch.postThawMotilityPercent != null
                        ? `${batch.postThawMotilityPercent}%`
                        : null
                    }
                  />
                  <CardRow label="Storage" value={batch.storageDetails} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No frozen batches recorded.</Text>
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
  pressed: {
    opacity: 0.85,
  },
});
