export type DailyLogComparable = {
  date: string;
  time: string | null;
  createdAt: string;
  id: string;
};

export type TimeDisplayMode = '12h' | '24h';

const DAILY_LOG_TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export function isDailyLogTime(value: string): boolean {
  return normalizeDailyLogTime(value) !== null;
}

export function normalizeDailyLogTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const match = DAILY_LOG_TIME_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getCurrentTimeHHMM(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDailyLogTime(time: string | null, displayMode: TimeDisplayMode = '12h'): string {
  if (time == null) {
    return '-';
  }

  const normalized = normalizeDailyLogTime(time);
  if (normalized === null) {
    return '-';
  }

  if (displayMode === '24h') {
    return normalized;
  }

  const [hoursText, minutes] = normalized.split(':');
  const hours = Number(hoursText);
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${meridiem}`;
}

export function compareDailyLogsDesc(a: DailyLogComparable, b: DailyLogComparable): number {
  return (
    b.date.localeCompare(a.date) ||
    compareDailyLogTimesDesc(a.time, b.time) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function isDailyLogAfter(
  candidate: DailyLogComparable,
  reference: DailyLogComparable,
): boolean {
  return compareDailyLogsDesc(candidate, reference) < 0;
}

function compareDailyLogTimesDesc(a: string | null, b: string | null): number {
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
