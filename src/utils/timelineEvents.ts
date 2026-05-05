import type { BreedingRecord, DailyLog, FoalingRecord, LocalDate, MedicationLog, PregnancyCheck } from '@/models/types';
import { compareBreedingRecordsDesc } from '@/utils/breedingRecordTime';
import { compareDailyLogsDesc } from '@/utils/dailyLogTime';
import { compareMedicationLogsDesc } from '@/utils/medicationLogTime';

export type TimelineEventType = 'foaling' | 'pregnancyCheck' | 'breeding' | 'ovulation' | 'heat' | 'medication';

export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly date: LocalDate;
  readonly data: DailyLog | BreedingRecord | PregnancyCheck | FoalingRecord | MedicationLog;
}

const TYPE_PRIORITY: Record<TimelineEventType, number> = {
  foaling: 0,
  pregnancyCheck: 1,
  breeding: 2,
  ovulation: 3,
  heat: 4,
  medication: 5,
};

const DAILY_LOG_EVENT_TYPES = new Set<TimelineEventType>(['ovulation', 'heat']);

function filterDailyLogs(dailyLogs: readonly DailyLog[]): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const log of dailyLogs) {
    if (log.ovulationDetected) {
      events.push({ id: log.id, type: 'ovulation', date: log.date, data: log });
    } else if ((log.teasingScore != null && log.teasingScore >= 4) || (log.edema != null && log.edema >= 4)) {
      events.push({ id: log.id, type: 'heat', date: log.date, data: log });
    }
  }
  return events;
}

export function buildTimelineEvents(
  dailyLogs: readonly DailyLog[],
  breedingRecords: readonly BreedingRecord[],
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  medicationLogs: readonly MedicationLog[] = [],
): readonly TimelineEvent[] {
  const logEvents = filterDailyLogs(dailyLogs);

  const breedingEvents: readonly TimelineEvent[] = breedingRecords.map((r) => ({
    id: r.id,
    type: 'breeding' as const,
    date: r.date,
    data: r,
  }));

  const checkEvents: readonly TimelineEvent[] = pregnancyChecks.map((r) => ({
    id: r.id,
    type: 'pregnancyCheck' as const,
    date: r.date,
    data: r,
  }));

  const foalingEvents: readonly TimelineEvent[] = foalingRecords.map((r) => ({
    id: r.id,
    type: 'foaling' as const,
    date: r.date,
    data: r,
  }));

  const medicationEvents: readonly TimelineEvent[] = medicationLogs.map((r) => ({
    id: r.id,
    type: 'medication' as const,
    date: r.date,
    data: r,
  }));

  const all = [...logEvents, ...breedingEvents, ...checkEvents, ...foalingEvents, ...medicationEvents];

  return all.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;

    if (DAILY_LOG_EVENT_TYPES.has(a.type) && DAILY_LOG_EVENT_TYPES.has(b.type)) {
      const logCompare = compareDailyLogsDesc(a.data as DailyLog, b.data as DailyLog);
      if (logCompare !== 0) {
        return logCompare;
      }
    }

    if (a.type === 'breeding' && b.type === 'breeding') {
      const breedingCompare = compareBreedingRecordsDesc(a.data as BreedingRecord, b.data as BreedingRecord);
      if (breedingCompare !== 0) {
        return breedingCompare;
      }
    }

    if (a.type === 'medication' && b.type === 'medication') {
      const medicationCompare = compareMedicationLogsDesc(
        a.data as MedicationLog,
        b.data as MedicationLog,
      );
      if (medicationCompare !== 0) {
        return medicationCompare;
      }
    }

    const typeCompare = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    if (typeCompare !== 0) {
      return typeCompare;
    }

    return b.id.localeCompare(a.id);
  });
}
