import type { BreedingRecord, DailyLog, FoalingRecord, LocalDate, PregnancyCheck } from '@/models/types';

export type TimelineEventType = 'foaling' | 'pregnancyCheck' | 'breeding' | 'ovulation' | 'heat';

export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly date: LocalDate;
  readonly data: DailyLog | BreedingRecord | PregnancyCheck | FoalingRecord;
}

const TYPE_PRIORITY: Record<TimelineEventType, number> = {
  foaling: 0,
  pregnancyCheck: 1,
  breeding: 2,
  ovulation: 3,
  heat: 4,
};

function filterDailyLogs(dailyLogs: readonly DailyLog[]): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const log of dailyLogs) {
    if (log.ovulationDetected) {
      events.push({ id: log.id, type: 'ovulation', date: log.date, data: log });
    } else if (log.teasingScore != null && log.teasingScore >= 4) {
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

  const all = [...logEvents, ...breedingEvents, ...checkEvents, ...foalingEvents];

  return all.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
  });
}
