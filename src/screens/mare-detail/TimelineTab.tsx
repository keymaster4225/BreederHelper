import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { StatusBadge } from '@/components/StatusBadge';
import { CardRow, EditIconButton, ScoreBadge, cardStyles } from '@/components/RecordCardParts';
import {
  BreedingRecord,
  DailyLog,
  Foal,
  FoalingRecord,
  MedicationLog,
  PregnancyCheck,
  calculateDaysPostBreeding,
  estimateFoalingDate,
} from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatBreedingRecordDateTime } from '@/utils/breedingRecordTime';
import { formatDailyLogTime } from '@/utils/dailyLogTime';
import { formatLocalDate } from '@/utils/dates';
import { useClockDisplayMode } from '@/hooks/useClockPreference';
import { formatMedicationLogDateTime } from '@/utils/medicationLogTime';
import { formatRoute } from '@/utils/medications';
import { formatBreedingMethod, formatFoalSex, formatOutcome, getFoalSexColor, getOutcomeColor } from '@/utils/outcomeDisplay';
import { buildTimelineEvents, TimelineEvent } from '@/utils/timelineEvents';
import { colors, spacing, typography } from '@/theme';

type Props = {
  readonly mareId: string;
  readonly gestationLengthDays: number;
  readonly dailyLogs: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly medicationLogs?: readonly MedicationLog[];
  readonly foalByFoalingRecordId: Readonly<Record<string, Foal>>;
  readonly stallionNameById: Readonly<Record<string, string>>;
  readonly breedingById: Readonly<Record<string, BreedingRecord>>;
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail' | 'MareCalendar'>;
};

const EVENT_COLORS = {
  heat: '#FF9800',
  ovulation: '#9C27B0',
  breeding: '#2196F3',
  pregnancyCheck: '#4CAF50',
  foaling: '#E91E63',
  medication: '#009688',
} as const;

function EventTypeBadge({ type, result }: { type: TimelineEvent['type']; result?: string }): JSX.Element {
  const labels: Record<TimelineEvent['type'], string> = {
    heat: 'Heat',
    ovulation: 'Ovulation',
    breeding: 'Breeding',
    pregnancyCheck: 'Preg Check',
    foaling: 'Foaling',
    medication: 'Medication',
  };

  let bgColor: string = EVENT_COLORS[type];
  if (type === 'pregnancyCheck' && result === 'negative') {
    bgColor = colors.negative;
  }
  if (type === 'foaling') {
    bgColor = result === 'liveFoal' ? colors.positive : colors.negative;
  }

  return <StatusBadge label={labels[type]} backgroundColor={bgColor} textColor="#FFFFFF" />;
}

function formatDailyLogEventTitle(log: DailyLog, clockDisplayMode: '12h' | '24h'): string {
  return `${log.date} at ${formatDailyLogTime(log.time, clockDisplayMode)}`;
}

function HeatCard({
  event,
  navigation,
  mareId,
  clockDisplayMode,
}: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  clockDisplayMode: '12h' | '24h';
}): JSX.Element {
  const log = event.data as DailyLog;
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>{formatDailyLogEventTitle(log, clockDisplayMode)}</Text>
        <EditIconButton onPress={() => navigation.navigate('DailyLogForm', { mareId, logId: log.id })} />
      </View>
      <View style={cardStyles.cardRow}>
        <EventTypeBadge type="heat" />
        <ScoreBadge score={log.teasingScore} />
      </View>
    </View>
  );
}

function OvulationCard({
  event,
  navigation,
  mareId,
  clockDisplayMode,
}: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  clockDisplayMode: '12h' | '24h';
}): JSX.Element {
  const log = event.data as DailyLog;
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>{formatDailyLogEventTitle(log, clockDisplayMode)}</Text>
        <EditIconButton onPress={() => navigation.navigate('DailyLogForm', { mareId, logId: log.id })} />
      </View>
      <View style={cardStyles.cardRow}>
        <EventTypeBadge type="ovulation" />
        <StatusBadge label="Detected" backgroundColor={colors.positive} textColor="#FFFFFF" />
      </View>
    </View>
  );
}

function BreedingCard({
  event,
  navigation,
  mareId,
  stallionNameById,
  clockDisplayMode,
}: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  stallionNameById: Readonly<Record<string, string>>;
  clockDisplayMode: '12h' | '24h';
}): JSX.Element {
  const record = event.data as BreedingRecord;
  const stallionName = record.stallionName ?? stallionNameById[record.stallionId ?? ''] ?? 'Unknown';
  const eventTitle = formatBreedingRecordDateTime(record, clockDisplayMode);
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>{eventTitle}</Text>
        <EditIconButton onPress={() => navigation.navigate('BreedingRecordForm', { mareId, breedingRecordId: record.id })} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open breeding event from ${eventTitle}`}
        onPress={() => navigation.navigate('BreedingEventDetail', { breedingRecordId: record.id })}
        style={({ pressed }) => [styles.cardBodyPressable, pressed && styles.pressed]}
      >
        <View style={cardStyles.cardRow}>
          <EventTypeBadge type="breeding" />
          <Text style={styles.cardDetail}>{formatBreedingMethod(record.method)}</Text>
        </View>
        <CardRow label="Stallion" value={stallionName} />
      </Pressable>
    </View>
  );
}

function PregCheckCard({
  event,
  navigation,
  mareId,
  gestationLengthDays,
  breedingById,
}: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  gestationLengthDays: number;
  breedingById: Readonly<Record<string, BreedingRecord>>;
}): JSX.Element {
  const check = event.data as PregnancyCheck;
  const breeding = breedingById[check.breedingRecordId];
  const daysPost = breeding ? calculateDaysPostBreeding(check.date, breeding.date) : null;
  const dueDate = breeding && check.result === 'positive'
    ? estimateFoalingDate(breeding.date, gestationLengthDays)
    : null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>{event.date}</Text>
        <EditIconButton onPress={() => navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open pregnancy check from ${event.date}`}
        onPress={() => navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })}
        style={({ pressed }) => [styles.cardBodyPressable, pressed && styles.pressed]}
      >
        <View style={cardStyles.cardRow}>
          <EventTypeBadge type="pregnancyCheck" result={check.result} />
          <StatusBadge
            label={check.result === 'positive' ? 'Positive' : 'Negative'}
            backgroundColor={check.result === 'positive' ? colors.positive : colors.negative}
            textColor="#FFFFFF"
          />
        </View>
        {daysPost != null ? <CardRow label="Days post-breeding" value={daysPost} /> : null}
        {dueDate ? <CardRow label="Est. due date" value={formatLocalDate(dueDate, 'MM-DD-YYYY')} /> : null}
      </Pressable>
    </View>
  );
}

function FoalingCard({
  event,
  navigation,
  mareId,
  foalByFoalingRecordId,
}: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  foalByFoalingRecordId: Readonly<Record<string, Foal>>;
}): JSX.Element {
  const record = event.data as FoalingRecord;
  const foal = foalByFoalingRecordId[record.id];

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>{event.date}</Text>
        <EditIconButton onPress={() => navigation.navigate('FoalingRecordForm', { mareId, foalingRecordId: record.id })} />
      </View>
      <View style={cardStyles.cardRow}>
        <EventTypeBadge type="foaling" result={record.outcome} />
        <StatusBadge
          label={formatOutcome(record.outcome)}
          backgroundColor={getOutcomeColor(record.outcome)}
          textColor="#FFFFFF"
        />
      </View>
      {record.foalSex && getFoalSexColor(record.foalSex) ? (
        <View style={cardStyles.cardRow}>
          <Text style={cardStyles.cardLabel}>Foal sex</Text>
          <StatusBadge label={formatFoalSex(record.foalSex)} backgroundColor={getFoalSexColor(record.foalSex)!} textColor="#FFFFFF" />
        </View>
      ) : null}
      {foal ? <CardRow label="Foal" value={foal.name || 'Unnamed foal'} /> : null}
    </View>
  );
}

function MedicationCard({ event, navigation, mareId, clockDisplayMode }: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  clockDisplayMode: '12h' | '24h';
}): JSX.Element {
  const log = event.data as MedicationLog;
  const handleEdit = (): void => {
    if (log.sourceDailyLogId) {
      navigation.navigate('DailyLogForm', { mareId, logId: log.sourceDailyLogId });
      return;
    }

    navigation.navigate('MedicationForm', { mareId, medicationLogId: log.id });
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>
          {formatMedicationLogDateTime(log, clockDisplayMode)}
        </Text>
        <EditIconButton onPress={handleEdit} />
      </View>
      <View style={cardStyles.cardRow}>
        <EventTypeBadge type="medication" />
        <Text style={styles.cardDetail}>{log.medicationName}</Text>
      </View>
      {log.sourceDailyLogId ? <CardRow label="Source" value="Daily log flush" /> : null}
      {log.dose ? <CardRow label="Dose" value={log.dose} /> : null}
      {log.route ? <CardRow label="Route" value={formatRoute(log.route)} /> : null}
    </View>
  );
}

function TimelineCard({
  event,
  navigation,
  mareId,
  gestationLengthDays,
  stallionNameById,
  breedingById,
  foalByFoalingRecordId,
  clockDisplayMode,
}: {
  event: TimelineEvent;
  navigation: Props['navigation'];
  mareId: string;
  gestationLengthDays: number;
  stallionNameById: Readonly<Record<string, string>>;
  breedingById: Readonly<Record<string, BreedingRecord>>;
  foalByFoalingRecordId: Readonly<Record<string, Foal>>;
  clockDisplayMode: '12h' | '24h';
}): JSX.Element {
  switch (event.type) {
    case 'heat':
      return <HeatCard event={event} navigation={navigation} mareId={mareId} clockDisplayMode={clockDisplayMode} />;
    case 'ovulation':
      return <OvulationCard event={event} navigation={navigation} mareId={mareId} clockDisplayMode={clockDisplayMode} />;
    case 'breeding':
      return (
        <BreedingCard
          event={event}
          navigation={navigation}
          mareId={mareId}
          stallionNameById={stallionNameById}
          clockDisplayMode={clockDisplayMode}
        />
      );
    case 'pregnancyCheck':
      return (
        <PregCheckCard
          event={event}
          navigation={navigation}
          mareId={mareId}
          gestationLengthDays={gestationLengthDays}
          breedingById={breedingById}
        />
      );
    case 'foaling':
      return <FoalingCard event={event} navigation={navigation} mareId={mareId} foalByFoalingRecordId={foalByFoalingRecordId} />;
    case 'medication':
      return (
        <MedicationCard
          event={event}
          navigation={navigation}
          mareId={mareId}
          clockDisplayMode={clockDisplayMode}
        />
      );
  }
}

export function TimelineTab({
  mareId,
  gestationLengthDays,
  dailyLogs,
  breedingRecords,
  pregnancyChecks,
  foalingRecords,
  medicationLogs = [],
  foalByFoalingRecordId,
  stallionNameById,
  breedingById,
  navigation,
}: Props): JSX.Element {
  const events = buildTimelineEvents(dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs);
  const clockDisplayMode = useClockDisplayMode();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {events.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No reproductive events recorded yet.</Text>
          </View>
        ) : null}
        {events.map((event) => (
          <TimelineCard
            key={`${event.type}-${event.id}`}
            event={event}
            navigation={navigation}
            mareId={mareId}
            gestationLengthDays={gestationLengthDays}
            stallionNameById={stallionNameById}
            breedingById={breedingById}
            foalByFoalingRecordId={foalByFoalingRecordId}
            clockDisplayMode={clockDisplayMode}
          />
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
  cardDetail: {
    color: colors.onSurface,
    ...typography.bodyMedium,
  },
  cardBodyPressable: {
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
});
