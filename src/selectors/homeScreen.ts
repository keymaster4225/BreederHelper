import {
  BreedingRecord,
  DailyLog,
  Foal,
  FoalingRecord,
  Mare,
  MedicationLog,
  PregnancyCheck,
  PregnancyInfo,
  buildPregnancyInfoForCheck,
  findCurrentPregnancyCheck,
} from '@/models/types';
import { DashboardInput } from '@/utils/dashboardAlerts';
import { filterMares, StatusFilter } from '@/utils/filterMares';

type HomeScreenRecords = {
  readonly mares: readonly Mare[];
  readonly dailyLogs: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly medicationLogs: readonly MedicationLog[];
  readonly foals: readonly Foal[];
};

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
      ),
    );
  }

  return pregnantInfo;
}

export function buildHomeDashboardInput(records: HomeScreenRecords, today: string): DashboardInput {
  return {
    mares: records.mares,
    dailyLogs: records.dailyLogs,
    breedingRecords: records.breedingRecords,
    pregnancyChecks: records.pregnancyChecks,
    foalingRecords: records.foalingRecords,
    medicationLogs: records.medicationLogs,
    foals: records.foals,
    today,
  };
}

export function selectFilteredMares(
  mares: readonly Mare[],
  searchText: string,
  statusFilter: StatusFilter,
  pregnantInfo: ReadonlyMap<string, PregnancyInfo>,
): Mare[] {
  return filterMares(mares, searchText, statusFilter, pregnantInfo);
}
