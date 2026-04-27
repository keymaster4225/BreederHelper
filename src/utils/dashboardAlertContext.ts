import {
  BreedingRecord,
  DailyLog,
  Foal,
  FoalingRecord,
  Mare,
  MedicationLog,
  PregnancyCheck,
  findCurrentPregnancyCheck,
} from '@/models/types';
import { compareBreedingRecordsDesc } from '@/utils/breedingRecordTime';
import { compareDailyLogsDesc } from '@/utils/dailyLogTime';

import { DashboardInput } from '@/utils/dashboardAlertTypes';

export type MareAlertContext = {
  readonly mare: Mare;
  readonly dailyLogs: readonly DailyLog[];
  readonly dailyLogsDesc: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly breedingRecordsDesc: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly medicationLogs: readonly MedicationLog[];
  readonly currentPregnancyCheck: PregnancyCheck | null;
};

export type DashboardAlertContext = {
  readonly mareContexts: readonly MareAlertContext[];
  readonly foalByFoalingRecordId: ReadonlyMap<string, Foal>;
};

function groupByMareId<T extends { mareId: string }>(
  records: readonly T[],
): ReadonlyMap<string, readonly T[]> {
  const map = new Map<string, T[]>();
  for (const record of records) {
    const existing = map.get(record.mareId);
    if (existing) {
      existing.push(record);
    } else {
      map.set(record.mareId, [record]);
    }
  }
  return map;
}

function sortDailyLogsDesc(records: readonly DailyLog[]): DailyLog[] {
  return [...records].sort(compareDailyLogsDesc);
}

function sortBreedingRecordsDesc(records: readonly BreedingRecord[]): BreedingRecord[] {
  return [...records].sort(compareBreedingRecordsDesc);
}

export function buildDashboardAlertContext(input: DashboardInput): DashboardAlertContext {
  const logsByMare = groupByMareId(input.dailyLogs);
  const breedingsByMare = groupByMareId(input.breedingRecords);
  const checksByMare = groupByMareId(input.pregnancyChecks);
  const foalingsByMare = groupByMareId(input.foalingRecords);
  const manualMedicationLogs = (input.medicationLogs ?? []).filter(
    (log) => log.sourceDailyLogId == null,
  );
  const medsByMare = groupByMareId(manualMedicationLogs);

  const foalByFoalingRecordId = new Map<string, Foal>();
  for (const foal of input.foals ?? []) {
    foalByFoalingRecordId.set(foal.foalingRecordId, foal);
  }

  const mareContexts: MareAlertContext[] = input.mares.map((mare) => {
    const dailyLogs = logsByMare.get(mare.id) ?? [];
    const breedingRecords = breedingsByMare.get(mare.id) ?? [];
    const pregnancyChecks = checksByMare.get(mare.id) ?? [];
    const foalingRecords = foalingsByMare.get(mare.id) ?? [];

    return {
      mare,
      dailyLogs,
      dailyLogsDesc: sortDailyLogsDesc(dailyLogs),
      breedingRecords,
      breedingRecordsDesc: sortBreedingRecordsDesc(breedingRecords),
      pregnancyChecks,
      foalingRecords,
      medicationLogs: medsByMare.get(mare.id) ?? [],
      currentPregnancyCheck: findCurrentPregnancyCheck([...pregnancyChecks], [...foalingRecords]),
    };
  });

  return {
    mareContexts,
    foalByFoalingRecordId,
  };
}
