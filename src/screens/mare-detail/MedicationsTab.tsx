import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { MedicationLog } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatRoute } from '@/utils/medications';
import { spacing } from '@/theme';

type Props = {
  readonly mareId: string;
  readonly medicationLogs: readonly MedicationLog[];
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function MedicationsTab({ mareId, medicationLogs, navigation }: Props): JSX.Element {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton
          label="Add Medication"
          onPress={() => navigation.navigate('MedicationForm', { mareId })}
        />
        {medicationLogs.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No medications logged yet.</Text>
          </View>
        ) : null}
        {medicationLogs.map((log) => (
          <View key={log.id} style={cardStyles.card}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.cardTitle}>{log.date}</Text>
              <EditIconButton
                onPress={() => navigation.navigate('MedicationForm', { mareId, medicationLogId: log.id })}
              />
            </View>
            <CardRow label="Medication" value={log.medicationName} />
            {log.dose ? <CardRow label="Dose" value={log.dose} /> : null}
            {log.route ? <CardRow label="Route" value={formatRoute(log.route)} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xxxl },
});
