import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, DateData } from 'react-native-calendars';

import { useMareCalendarData } from '@/hooks/useMareCalendarData';
import { Screen } from '@/components/Screen';
import { LocalDate } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { CALENDAR_LEGEND } from '@/utils/calendarMarking';
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
  const {
    gestationLengthDays,
    foalByFoalingRecordId,
    stallionNameById,
    breedingById,
    markedDates,
    filteredLogs,
    filteredBreedings,
    filteredChecks,
    filteredFoalings,
    filteredMedicationLogs,
    selectedDay,
    isLoading,
    error,
    setSelectedDay,
  } = useMareCalendarData({ mareId });

  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDay(day.dateString as LocalDate);
  }, [setSelectedDay]);

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
          initialDate={selectedDay}
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
            gestationLengthDays={gestationLengthDays}
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
