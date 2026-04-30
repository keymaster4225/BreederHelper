import type { BreedingRecord, DailyLog, FoalingRecord, LocalDate, MedicationLog, PregnancyCheck } from '@/models/types';
import { buildTimelineEvents, type TimelineEventType } from '@/utils/timelineEvents';

interface CalendarDot {
  readonly key: string;
  readonly color: string;
}

interface DayMarking {
  readonly dots: CalendarDot[];
  readonly marked?: boolean;
  readonly selected?: boolean;
  readonly selectedColor?: string;
}

export type MarkedDates = Readonly<Record<string, DayMarking>>;

const DOT_COLORS: Record<TimelineEventType, string> = {
  heat: '#FF9800',
  ovulation: '#9C27B0',
  breeding: '#2196F3',
  pregnancyCheck: '#4CAF50',
  foaling: '#E91E63',
  medication: '#009688',
};

export const CALENDAR_LEGEND: readonly { readonly key: TimelineEventType; readonly label: string; readonly color: string }[] = [
  { key: 'heat', label: 'Heat', color: DOT_COLORS.heat },
  { key: 'ovulation', label: 'Ovulation', color: DOT_COLORS.ovulation },
  { key: 'breeding', label: 'Breeding', color: DOT_COLORS.breeding },
  { key: 'pregnancyCheck', label: 'Preg Check', color: DOT_COLORS.pregnancyCheck },
  { key: 'foaling', label: 'Foaling', color: DOT_COLORS.foaling },
  { key: 'medication', label: 'Medication', color: DOT_COLORS.medication },
];

const SELECTED_COLOR = '#97B498';

export function buildCalendarMarking(
  dailyLogs: readonly DailyLog[],
  breedingRecords: readonly BreedingRecord[],
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  selectedDay: LocalDate | null,
  medicationLogs: readonly MedicationLog[] = [],
): MarkedDates {
  const events = buildTimelineEvents(dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs);

  const dotsByDate = new Map<string, Map<TimelineEventType, CalendarDot>>();

  for (const event of events) {
    let dateDots = dotsByDate.get(event.date);
    if (!dateDots) {
      dateDots = new Map();
      dotsByDate.set(event.date, dateDots);
    }
    if (!dateDots.has(event.type)) {
      dateDots.set(event.type, { key: event.type, color: DOT_COLORS[event.type] });
    }
  }

  const result: Record<string, DayMarking> = {};

  for (const [date, dots] of dotsByDate) {
    const isSelected = date === selectedDay;
    result[date] = {
      dots: Array.from(dots.values()),
      marked: true,
      ...(isSelected ? { selected: true, selectedColor: SELECTED_COLOR } : {}),
    };
  }

  if (selectedDay && !result[selectedDay]) {
    result[selectedDay] = {
      dots: [],
      selected: true,
      selectedColor: SELECTED_COLOR,
    };
  }

  return result;
}
