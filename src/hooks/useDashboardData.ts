import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listAllBreedingRecords,
  listAllDailyLogs,
  listAllFoalingRecords,
  listAllPregnancyChecks,
  listOpenDashboardTasks,
  listMares,
  listStallions,
} from '@/storage/repositories';
import {
  DataInvalidationDomain,
  subscribeDataInvalidationForDomains,
} from '@/storage/dataInvalidation';
import { TaskWithMare } from '@/models/types';
import { buildPregnantInfoMap } from '@/selectors/homeScreen';
import { toLocalDate } from '@/utils/dates';

type DashboardData = {
  readonly totalMares: number;
  readonly pregnantMares: number;
  readonly totalStallions: number;
  readonly tasks: readonly TaskWithMare[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
  readonly reloadIfStale: () => Promise<void>;
};

const DASHBOARD_INVALIDATION_DOMAINS: readonly DataInvalidationDomain[] = [
  'mares',
  'stallions',
  'dailyLogs',
  'breedingRecords',
  'pregnancyChecks',
  'foalingRecords',
  'tasks',
];
const FOCUS_REFRESH_STALE_MS = 30_000;

export function useDashboardData(): DashboardData {
  const [totalMares, setTotalMares] = useState(0);
  const [pregnantMares, setPregnantMares] = useState(0);
  const [totalStallions, setTotalStallions] = useState(0);
  const [tasks, setTasks] = useState<readonly TaskWithMare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastLoadedAtRef = useRef(0);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const today = toLocalDate(new Date());
      const [mares, stallions, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, dashboardTasks] =
        await Promise.all([
          listMares(),
          listStallions(),
          listAllDailyLogs(),
          listAllBreedingRecords(),
          listAllPregnancyChecks(),
          listAllFoalingRecords(),
          listOpenDashboardTasks(today, 14),
        ]);
      const pregnantInfo = buildPregnantInfoMap(mares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, today);

      setTotalMares(mares.length);
      setPregnantMares(pregnantInfo.size);
      setTotalStallions(stallions.length);
      setTasks(dashboardTasks);
      lastLoadedAtRef.current = Date.now();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reloadIfStale = useCallback(async () => {
    if (
      lastLoadedAtRef.current > 0 &&
      Date.now() - lastLoadedAtRef.current < FOCUS_REFRESH_STALE_MS
    ) {
      return;
    }
    await reload();
  }, [reload]);

  useEffect(() => {
    return subscribeDataInvalidationForDomains(DASHBOARD_INVALIDATION_DOMAINS, () => {
      void reload();
    });
  }, [reload]);

  return {
    totalMares,
    pregnantMares,
    totalStallions,
    tasks,
    isLoading,
    error,
    reload,
    reloadIfStale,
  };
}
