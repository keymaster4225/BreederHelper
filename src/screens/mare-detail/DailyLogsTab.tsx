import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { StatusBadge } from '@/components/StatusBadge';
import { CardRow, EditIconButton, ScoreBadge, cardStyles } from '@/components/RecordCardParts';
import { DailyLog } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing } from '@/theme';

type Props = {
  mareId: string;
  dailyLogs: readonly DailyLog[];
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function DailyLogsTab({ mareId, dailyLogs, navigation }: Props): JSX.Element {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton label="Add Daily Log" onPress={() => navigation.navigate('DailyLogForm', { mareId })} />
        {dailyLogs.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No daily logs yet.</Text>
          </View>
        ) : null}
        {dailyLogs.map((log) => (
          <View key={log.id} style={cardStyles.card}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.cardTitle}>{log.date}</Text>
              <EditIconButton onPress={() => navigation.navigate('DailyLogForm', { mareId, logId: log.id })} />
            </View>
            <View style={cardStyles.cardRow}>
              <Text style={cardStyles.cardLabel}>Teasing</Text>
              <ScoreBadge score={log.teasingScore} />
            </View>
            <View style={cardStyles.cardRow}>
              <Text style={cardStyles.cardLabel}>Edema</Text>
              <ScoreBadge score={log.edema} />
            </View>
            {log.ovulationDetected ? (
              <View style={cardStyles.cardRow}>
                <Text style={cardStyles.cardLabel}>Ovulation</Text>
                <StatusBadge label="Detected" backgroundColor={colors.positive} textColor="#FFFFFF" />
              </View>
            ) : null}
            <CardRow label="Right ovary" value={log.rightOvary || '-'} />
            <CardRow label="Left ovary" value={log.leftOvary || '-'} />
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
