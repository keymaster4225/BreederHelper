import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { StatusBadge } from '@/components/StatusBadge';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { BreedingRecord, DailyLog, PregnancyCheck, calculateDaysPostBreeding, estimateFoalingDate, findMostRecentOvulationDate } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatLocalDate } from '@/utils/dates';
import { colors, spacing } from '@/theme';

type Props = {
  mareId: string;
  pregnancyChecks: readonly PregnancyCheck[];
  breedingById: Readonly<Record<string, BreedingRecord>>;
  dailyLogs: DailyLog[];
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function PregnancyTab({ mareId, pregnancyChecks, breedingById, dailyLogs, navigation }: Props): JSX.Element {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton label="Add Pregnancy Check" onPress={() => navigation.navigate('PregnancyCheckForm', { mareId })} />
        {pregnancyChecks.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No pregnancy checks yet.</Text>
          </View>
        ) : null}
        {pregnancyChecks.map((check) => {
          const breeding = breedingById[check.breedingRecordId];
          const daysPost = breeding ? calculateDaysPostBreeding(check.date, breeding.date) : null;
          const ovulationDate = findMostRecentOvulationDate(dailyLogs, check.date);
          const daysPostOvulation = ovulationDate
            ? calculateDaysPostBreeding(check.date, ovulationDate)
            : null;
          const dueDate = breeding && check.result === 'positive'
            ? estimateFoalingDate(breeding.date)
            : null;

          return (
            <View key={check.id} style={cardStyles.card}>
              <View style={cardStyles.cardHeader}>
                <Text style={cardStyles.cardTitle}>{check.date}</Text>
                <EditIconButton onPress={() => navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })} />
              </View>
              <View style={cardStyles.cardRow}>
                <Text style={cardStyles.cardLabel}>Result</Text>
                <StatusBadge
                  label={check.result === 'positive' ? 'Positive' : 'Negative'}
                  backgroundColor={check.result === 'positive' ? colors.positive : colors.negative}
                  textColor="#FFFFFF"
                />
              </View>
              <View style={cardStyles.cardRow}>
                <Text style={cardStyles.cardLabel}>Heartbeat</Text>
                <StatusBadge
                  label={check.heartbeatDetected ? 'Yes' : 'No'}
                  backgroundColor={check.heartbeatDetected ? colors.heartbeat : colors.score0}
                  textColor={check.heartbeatDetected ? '#FFFFFF' : colors.onSurfaceVariant}
                />
              </View>
              <CardRow label="Days post-breeding" value={daysPost ?? '-'} />
              {daysPostOvulation !== null && <CardRow label="Days post-ovulation" value={daysPostOvulation} />}
              {dueDate && <CardRow label="Est. due date" value={formatLocalDate(dueDate, 'MM-DD-YYYY')} />}
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
