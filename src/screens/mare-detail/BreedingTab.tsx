import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { useClockDisplayMode } from '@/hooks/useClockPreference';
import { BreedingRecord } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatBreedingRecordDateTime } from '@/utils/breedingRecordTime';
import { formatBreedingMethod } from '@/utils/outcomeDisplay';
import { spacing } from '@/theme';

type Props = {
  mareId: string;
  breedingRecords: readonly BreedingRecord[];
  stallionNameById: Readonly<Record<string, string>>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function BreedingTab({ mareId, breedingRecords, stallionNameById, navigation }: Props): JSX.Element {
  const clockDisplayMode = useClockDisplayMode();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton label="Add Breeding Record" onPress={() => navigation.navigate('BreedingRecordForm', { mareId })} />
        {breedingRecords.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No breeding records yet.</Text>
          </View>
        ) : null}
        {breedingRecords.map((record) => (
          <View key={record.id} style={cardStyles.card}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.cardTitle}>
                {formatBreedingRecordDateTime(record, clockDisplayMode)}
              </Text>
              <EditIconButton onPress={() => navigation.navigate('BreedingRecordForm', { mareId, breedingRecordId: record.id })} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open breeding event from ${formatBreedingRecordDateTime(record, clockDisplayMode)}`}
              onPress={() => navigation.navigate('BreedingEventDetail', { breedingRecordId: record.id })}
              style={({ pressed }) => [styles.cardBodyPressable, pressed && styles.pressed]}
            >
              <CardRow label="Method" value={formatBreedingMethod(record.method)} />
              <CardRow label="Stallion" value={record.stallionName ?? stallionNameById[record.stallionId ?? ''] ?? 'Unknown'} />
              {record.collectionDate ? <CardRow label="Collection" value={record.collectionDate} /> : null}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  cardBodyPressable: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
});
