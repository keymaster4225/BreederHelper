import type { MedicationLog } from '@/models/types';

import {
  formatDailyLogTime,
  normalizeDailyLogTime,
  type TimeDisplayMode,
} from './dailyLogTime';

export type MedicationLogComparable = Pick<MedicationLog, 'date' | 'time' | 'createdAt' | 'id'>;

export function normalizeMedicationLogTime(value: unknown): string | null {
  return normalizeDailyLogTime(value);
}

export function formatMedicationLogTime(
  time: string | null,
  displayMode: TimeDisplayMode = '12h',
): string {
  return formatDailyLogTime(time, displayMode);
}

export function formatMedicationLogDateTime(
  log: Pick<MedicationLog, 'date' | 'time'>,
  displayMode: TimeDisplayMode = '12h',
): string {
  if (log.time == null) {
    return log.date;
  }

  const formattedTime = formatMedicationLogTime(log.time, displayMode);
  return formattedTime === '-' ? log.date : `${log.date} at ${formattedTime}`;
}

export function compareMedicationLogsDesc(
  a: MedicationLogComparable,
  b: MedicationLogComparable,
): number {
  return (
    b.date.localeCompare(a.date) ||
    compareMedicationLogTimesDesc(a.time, b.time) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

function compareMedicationLogTimesDesc(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return b.localeCompare(a);
}
