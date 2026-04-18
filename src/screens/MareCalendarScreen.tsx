import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, DateData } from 'react-native-calendars';

import { Screen } from '@/components/Screen';
import { BreedingRecord, DailyLog, Foal, FoalingRecord, LocalDate, MedicationLog, PregnancyCheck } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  listBreedingRecordsByMare,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listFoalsByMare,
  listMedicationLogsByMare,
  listPregnancyChecksByMare,
  listStallions,
} from '@/storage/repositories';
import { buildCalendarMarking, CALENDAR_LEGEND } from '@/utils/calendarMarking';
import { toLocalDate } from '@/utils/dates';
import { TimelineTab } from '@/screens/mare-detail/TimelineTab';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MareCalendar'>;

const calendarTheme = {
  backgroundColor: colors.surface,
  calendarBackground: colors.surface,
  todayTextColor: colors.primary,
  selectedDayBackgroundColor: colors.primary,
  selectedDayTextColor: '#FFFFFF',
  arrowColor: colors.primary,
  monthTextColor: colors.onSurface,
  textDayFontFamily: 'Inter_400Regular',
  textMonthFontFamily: 'Lora_700Bold',
  textDayHeaderFontFamily: 'Inter_400Regular',
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 12,
  dotStyle: { width: 6, height: 6, borderRadius: 3 },
};

export function MareCalendarScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;

  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [foalByFoalingRecordId, setFoalByFoalingRecordId] = useState<Record<string, Foal>>({});
  const [stallionNameById, setStallionNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<LocalDate>(toLocalDate(new Date()));

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [logs, breeding, checks, foaling, foals, stallions, meds] = await Promise.all([
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listFoalsByMare(mareId),
        listStallions(),
        listMedicationLogsByMare(mareId),
      ]);

      const stallionMap = Object.fromEntries(stallions.map((s) => [s.id, s.name]));
      const foalMap = Object.fromEntries(foals.map((f) => [f.foalingRecordId, f]));

      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setMedicationLogs(meds);
      setFoalByFoalingRecordId(foalMap);
      setStallionNameById(stallionMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load calendar data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [mareId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const markedDates = useMemo(
    () => buildCalendarMarking(dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, selectedDay, medicationLogs),
    [dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, selectedDay, medicationLogs]
  );

  const breedingById = useMemo(
    () => Object.fromEntries(breedingRecords.map((r) => [r.id, r])),
    [breedingRecords]
  );

  const filteredLogs = useMemo(
    () => dailyLogs.filter((l) => l.date === selectedDay),
    [dailyLogs, selectedDay]
  );
  const filteredBreedings = useMemo(
    () => breedingRecords.filter((r) => r.date === selectedDay),
    [breedingRecords, selectedDay]
  );
  const filteredChecks = useMemo(
    () => pregnancyChecks.filter((c) => c.date === selectedDay),
    [pregnancyChecks, selectedDay]
  );
  const filteredFoalings = useMemo(
    () => foalingRecords.filter((f) => f.date === selectedDay),
    [foalingRecords, selectedDay]
  );
  const filteredMedicationLogs = useMemo(
    () => medicationLogs.filter((m) => m.date === selectedDay),
    [medicationLogs, selectedDay]
  );

  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDay(day.dateString as LocalDate);
  }, []);

  const renderCalendarArrow = useCallback((direction: 'left' | 'right') => {
    return (
      <MaterialCommunityIcons
        name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
        size={24}
        color={colors.primary}
      />
    );
  }, []);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Text style={styles.errorText}>{error}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={handleDayPress}
          renderArrow={renderCalendarArrow}
          theme={calendarTheme}
          enableSwipeMonths
        />

        <View style={styles.legend}>
          {CALENDAR_LEGEND.map((item) => (
            <View key={item.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.daySection}>
          <Text style={styles.dayHeader}>{selectedDay}</Text>
          <TimelineTab
            mareId={mareId}
            dailyLogs={filteredLogs}
            breedingRecords={filteredBreedings}
            pregnancyChecks={filteredChecks}
            foalingRecords={filteredFoalings}
            medicationLogs={filteredMedicationLogs}
            foalByFoalingRecordId={foalByFoalingRecordId}
            stallionNameById={stallionNameById}
            breedingById={breedingById}
            navigation={navigation}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  daySection: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  dayHeader: {
    ...typography.titleSmall,
    color: colors.onSurface,
    paddingBottom: spacing.sm,
  },
  errorText: {
    color: colors.error,
  },
});
