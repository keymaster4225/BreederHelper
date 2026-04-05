import { useCallback, useState } from 'react';

import {
  listAllBreedingRecords,
  listAllDailyLogs,
  listAllFoals,
  listAllFoalingRecords,
  listAllMedicationLogs,
  listAllPregnancyChecks,
  listMares,
  listStallions,
} from '@/storage/repositories';
import { buildHomeDashboardInput, buildPregnantInfoMap } from '@/selectors/homeScreen';
import { DashboardAlert, generateDashboardAlerts } from '@/utils/dashboardAlerts';
import { toLocalDate } from '@/utils/dates';

type DashboardData = {
  readonly totalMares: number;
  readonly pregnantMares: number;
  readonly totalStallions: number;
  readonly alerts: readonly DashboardAlert[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
};

export function useDashboardData(): DashboardData {
  const [totalMares, setTotalMares] = useState(0);
  const [pregnantMares, setPregnantMares] = useState(0);
  const [totalStallions, setTotalStallions] = useState(0);
  const [alerts, setAlerts] = useState<readonly DashboardAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [mares, stallions, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs, foals] =
        await Promise.all([
          listMares(),
          listStallions(),
          listAllDailyLogs(),
          listAllBreedingRecords(),
          listAllPregnancyChecks(),
          listAllFoalingRecords(),
          listAllMedicationLogs(),
          listAllFoals(),
        ]);

      const today = toLocalDate(new Date());
      const pregnantInfo = buildPregnantInfoMap(mares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, today);

      setTotalMares(mares.length);
      setPregnantMares(pregnantInfo.size);
      setTotalStallions(stallions.length);
      setAlerts(
        generateDashboardAlerts(
          buildHomeDashboardInput(
            { mares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs, foals },
            today,
          ),
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    totalMares,
    pregnantMares,
    totalStallions,
    alerts,
    isLoading,
    error,
    reload,
  };
}
