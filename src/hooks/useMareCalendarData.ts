import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  type BreedingRecord,
  type DailyLog,
  DEFAULT_GESTATION_LENGTH_DAYS,
  type Foal,
  type FoalingRecord,
  type LocalDate,
  type MedicationLog,
  type PregnancyCheck,
} from '@/models/types';
import {
  getMareById,
  listBreedingRecordsByMare,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listFoalsByMare,
  listMedicationLogsByMare,
  listPregnancyChecksByMare,
  listStallions,
} from '@/storage/repositories';
import { buildCalendarMarking } from '@/utils/calendarMarking';
import { toLocalDate } from '@/utils/dates';

type UseMareCalendarDataArgs = {
  readonly mareId: string;
};

export function useMareCalendarData({ mareId }: UseMareCalendarDataArgs) {
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [foalByFoalingRecordId, setFoalByFoalingRecordId] = useState<Record<string, Foal>>({});
  const [stallionNameById, setStallionNameById] = useState<Record<string, string>>({});
  const [gestationLengthDays, setGestationLengthDays] = useState(DEFAULT_GESTATION_LENGTH_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<LocalDate>(toLocalDate(new Date()));

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [mare, logs, breeding, checks, foaling, foals, stallions, meds] = await Promise.all([
        getMareById(mareId),
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listFoalsByMare(mareId),
        listStallions(),
        listMedicationLogsByMare(mareId),
      ]);

      if (!mare) {
        throw new Error('Failed to load mare.');
      }

      setGestationLengthDays(mare.gestationLengthDays);
      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setMedicationLogs(meds);
      setFoalByFoalingRecordId(
        Object.fromEntries(foals.map((foal) => [foal.foalingRecordId, foal])),
      );
      setStallionNameById(
        Object.fromEntries(stallions.map((stallion) => [stallion.id, stallion.name])),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load calendar data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [mareId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const markedDates = useMemo(
    () =>
      buildCalendarMarking(
        dailyLogs,
        breedingRecords,
        pregnancyChecks,
        foalingRecords,
        selectedDay,
        medicationLogs,
      ),
    [breedingRecords, dailyLogs, foalingRecords, medicationLogs, pregnancyChecks, selectedDay],
  );

  const breedingById = useMemo(
    () => Object.fromEntries(breedingRecords.map((record) => [record.id, record])),
    [breedingRecords],
  );

  const filteredLogs = useMemo(
    () => dailyLogs.filter((log) => log.date === selectedDay),
    [dailyLogs, selectedDay],
  );
  const filteredBreedings = useMemo(
    () => breedingRecords.filter((record) => record.date === selectedDay),
    [breedingRecords, selectedDay],
  );
  const filteredChecks = useMemo(
    () => pregnancyChecks.filter((check) => check.date === selectedDay),
    [pregnancyChecks, selectedDay],
  );
  const filteredFoalings = useMemo(
    () => foalingRecords.filter((record) => record.date === selectedDay),
    [foalingRecords, selectedDay],
  );
  const filteredMedicationLogs = useMemo(
    () => medicationLogs.filter((record) => record.date === selectedDay),
    [medicationLogs, selectedDay],
  );

  return {
    gestationLengthDays,
    foalByFoalingRecordId,
    stallionNameById,
    breedingById,
    markedDates,
    filteredLogs,
    filteredBreedings,
    filteredChecks,
    filteredFoalings,
    filteredMedicationLogs,
    selectedDay,
    isLoading,
    error,
    setSelectedDay,
  };
}
