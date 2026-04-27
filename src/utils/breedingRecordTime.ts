import type { ClockDisplayMode } from '@/utils/clockPreferences';
import { formatLocalDate } from '@/utils/dates';
import { formatDailyLogTime, normalizeDailyLogTime } from '@/utils/dailyLogTime';
import { formatBreedingMethod } from '@/utils/outcomeDisplay';

export type BreedingRecordComparable = {
  readonly date: string;
  readonly time: string | null;
  readonly createdAt: string;
  readonly id: string;
};

export type BreedingRecordDateTimeValue = {
  readonly date: string;
  readonly time: string | null;
};

export type BreedingRecordPickerValue = BreedingRecordDateTimeValue & {
  readonly id: string;
  readonly method: string;
  readonly stallionName?: string | null;
};

export type BreedingRecordPickerOption = {
  readonly label: string;
  readonly value: string;
};

export function normalizeBreedingRecordTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeDailyLogTime(value);
  return normalized === value ? normalized : null;
}

export function isBreedingRecordTime(value: string): boolean {
  return normalizeBreedingRecordTime(value) !== null;
}

export function formatBreedingRecordTime(
  time: string | null,
  displayMode: ClockDisplayMode = '12h',
): string {
  return formatDailyLogTime(time, displayMode);
}

export function formatBreedingRecordDateTime(
  record: BreedingRecordDateTimeValue,
  displayMode: ClockDisplayMode = '12h',
  options: {
    readonly dateFormat?: 'YYYY-MM-DD' | 'MM-DD-YYYY';
    readonly includeUntimedLabel?: boolean;
  } = {},
): string {
  const date = formatLocalDate(record.date, options.dateFormat ?? 'YYYY-MM-DD');
  if (record.time == null) {
    return options.includeUntimedLabel ? `${date} - Untimed` : date;
  }

  return `${date} ${formatBreedingRecordTime(record.time, displayMode)}`;
}

export function compareBreedingRecordsDesc(
  a: BreedingRecordComparable,
  b: BreedingRecordComparable,
): number {
  return (
    b.date.localeCompare(a.date) ||
    compareBreedingRecordTimesDesc(a.time, b.time) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}

export function buildBreedingRecordPickerOptions(
  records: readonly BreedingRecordPickerValue[],
  displayMode: ClockDisplayMode = '12h',
  options: {
    readonly includeNoneOption?: boolean;
    readonly noneLabel?: string;
  } = {},
): BreedingRecordPickerOption[] {
  const baseLabels = records.map((record) => formatBreedingRecordPickerLabel(record, displayMode));
  const labelCounts = new Map<string, number>();
  for (const label of baseLabels) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  const labelOrdinals = new Map<string, number>();
  const pickerOptions = records.map((record, index) => {
    const label = baseLabels[index];
    const duplicateCount = labelCounts.get(label) ?? 0;
    if (duplicateCount <= 1) {
      return { label, value: record.id };
    }

    const ordinal = (labelOrdinals.get(label) ?? 0) + 1;
    labelOrdinals.set(label, ordinal);
    return { label: `${label} - Record ${ordinal}`, value: record.id };
  });

  if (options.includeNoneOption) {
    return [{ label: options.noneLabel ?? 'None', value: '' }, ...pickerOptions];
  }

  return pickerOptions;
}

function compareBreedingRecordTimesDesc(a: string | null, b: string | null): number {
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

function formatBreedingRecordPickerLabel(
  record: BreedingRecordPickerValue,
  displayMode: ClockDisplayMode,
): string {
  const dateTime = formatBreedingRecordDateTime(record, displayMode, {
    dateFormat: 'MM-DD-YYYY',
    includeUntimedLabel: record.time == null,
  });
  const stallionName = record.stallionName ?? 'Unknown';
  return `${dateTime} - ${stallionName} (${formatBreedingMethod(record.method)})`;
}
