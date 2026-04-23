import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '../../components/Buttons';
import { StatusBadge } from '../../components/StatusBadge';
import { CardRow, EditIconButton, ScoreBadge, cardStyles } from '../../components/RecordCardParts';
import type { DailyLog } from '../../models/types';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, spacing } from '../../theme';
import { buildOvarySummary, buildUterusSummary } from '../../utils/dailyLogDisplay';

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
        {dailyLogs.map((log) => {
          const rightOvarySummary = buildOvarySummary(log, 'right');
          const leftOvarySummary = buildOvarySummary(log, 'left');
          const uterusSummary = buildUterusSummary(log);

          return (
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
              <CardRow label="Right ovary" value={rightOvarySummary || '-'} />
              <CardRow label="Left ovary" value={leftOvarySummary || '-'} />
              {uterusSummary ? <CardRow label="Uterus" value={uterusSummary} /> : null}
            </View>
          );
        })}
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
