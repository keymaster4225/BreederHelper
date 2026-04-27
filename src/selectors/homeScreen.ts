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
import { filterMares, StatusFilter } from '@/utils/filterMares';

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

export function buildPregnantInfoMap(
  mares: readonly Mare[],
  dailyLogs: readonly DailyLog[],
  breedingRecords: readonly BreedingRecord[],
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  today: string,
): Map<string, PregnancyInfo> {
  const checksByMare = groupBy(pregnancyChecks, (check) => check.mareId);
  const foalingsByMare = groupBy(foalingRecords, (record) => record.mareId);
  const logsByMare = groupBy(dailyLogs, (log) => log.mareId);
  const breedingById = new Map(breedingRecords.map((record) => [record.id, record]));

  const pregnantInfo = new Map<string, PregnancyInfo>();
  for (const mare of mares) {
    const currentCheck = findCurrentPregnancyCheck(
      checksByMare.get(mare.id) ?? [],
      foalingsByMare.get(mare.id) ?? [],
    );
    if (!currentCheck) continue;

    pregnantInfo.set(
      mare.id,
      buildPregnancyInfoForCheck(
        currentCheck,
        logsByMare.get(mare.id) ?? [],
        breedingById.get(currentCheck.breedingRecordId) ?? null,
        today,
        mare.gestationLengthDays,
      ),
    );
  }

  return pregnantInfo;
}

export function selectFilteredMares(
  mares: readonly Mare[],
  searchText: string,
  statusFilter: StatusFilter,
  pregnantInfo: ReadonlyMap<string, PregnancyInfo>,
): Mare[] {
  return filterMares(mares, searchText, statusFilter, pregnantInfo);
}
