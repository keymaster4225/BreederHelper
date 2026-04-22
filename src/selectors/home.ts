import {
  BreedingRecord,
  DailyLog,
  FoalingRecord,
  Mare,
  PregnancyCheck,
  PregnancyInfo,
  buildPregnancyInfoForCheck,
  findCurrentPregnancyCheck,
} from '@/models/types';

type PregnancyProjectionInput = {
  readonly mares: readonly Mare[];
  readonly dailyLogs: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly today: string;
};

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): ReadonlyMap<string, readonly T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
}

export function buildPregnancyProjectionByMare({
  mares,
  dailyLogs,
  breedingRecords,
  pregnancyChecks,
  foalingRecords,
  today,
}: PregnancyProjectionInput): ReadonlyMap<string, PregnancyInfo> {
  const checksByMare = groupBy(pregnancyChecks, (check) => check.mareId);
  const foalingsByMare = groupBy(foalingRecords, (record) => record.mareId);
  const logsByMare = groupBy(dailyLogs, (log) => log.mareId);
  const breedingById = new Map(breedingRecords.map((record) => [record.id, record]));

  const pregnancyInfo = new Map<string, PregnancyInfo>();

  for (const mare of mares) {
    const currentCheck = findCurrentPregnancyCheck(
      [...(checksByMare.get(mare.id) ?? [])],
      [...(foalingsByMare.get(mare.id) ?? [])]
    );
    if (!currentCheck) {
      continue;
    }

    pregnancyInfo.set(
      mare.id,
      buildPregnancyInfoForCheck(
        currentCheck,
        [...(logsByMare.get(mare.id) ?? [])],
        breedingById.get(currentCheck.breedingRecordId) ?? null,
        today
      )
    );
  }

  return pregnancyInfo;
}
