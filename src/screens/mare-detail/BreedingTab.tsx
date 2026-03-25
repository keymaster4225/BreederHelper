import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { BreedingRecord } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatBreedingMethod } from '@/utils/outcomeDisplay';
import { spacing } from '@/theme';

type Props = {
  mareId: string;
  breedingRecords: readonly BreedingRecord[];
  stallionNameById: Readonly<Record<string, string>>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function BreedingTab({ mareId, breedingRecords, stallionNameById, navigation }: Props): JSX.Element {
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
              <Text style={cardStyles.cardTitle}>{record.date}</Text>
              <EditIconButton onPress={() => navigation.navigate('BreedingRecordForm', { mareId, breedingRecordId: record.id })} />
            </View>
            <CardRow label="Method" value={formatBreedingMethod(record.method)} />
            <CardRow label="Stallion" value={record.stallionName ?? stallionNameById[record.stallionId ?? ''] ?? 'Unknown'} />
            {record.collectionDate ? <CardRow label="Collection" value={record.collectionDate} /> : null}
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
});
