import { useCallback, useMemo, useState } from 'react';

import {
  BreedingRecord,
  DailyLog,
  findCurrentPregnancyCheck,
  Foal,
  FoalingRecord,
  Mare,
  MedicationLog,
  PregnancyCheck,
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
import { deriveAgeYears } from '@/utils/dates';

type UseMareDetailDataArgs = {
  readonly mareId: string;
  readonly setTitle: (title: string) => void;
};

type MareDetailData = {
  readonly mare: Mare | null;
  readonly dailyLogs: DailyLog[];
  readonly breedingRecords: BreedingRecord[];
  readonly pregnancyChecks: PregnancyCheck[];
  readonly foalingRecords: FoalingRecord[];
  readonly medicationLogs: MedicationLog[];
  readonly foalByFoalingRecordId: Record<string, Foal>;
  readonly stallionNameById: Record<string, string>;
  readonly breedingById: Record<string, BreedingRecord>;
  readonly age: number | null;
  readonly isCurrentlyPregnant: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadData: () => Promise<void>;
};

export function useMareDetailData({ mareId, setTitle }: UseMareDetailDataArgs): MareDetailData {
  const [mare, setMare] = useState<Mare | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [foalByFoalingRecordId, setFoalByFoalingRecordId] = useState<Record<string, Foal>>({});
  const [stallionNameById, setStallionNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [mareRecord, logs, breeding, checks, foaling, foals, stallions, meds] = await Promise.all([
        getMareById(mareId),
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listFoalsByMare(mareId),
        listStallions(),
        listMedicationLogsByMare(mareId),
      ]);

      if (!mareRecord) {
        setError('Mare not found.');
        setMare(null);
        return;
      }

      setMare(mareRecord);
      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setMedicationLogs(meds);
      setFoalByFoalingRecordId(Object.fromEntries(foals.map((foal) => [foal.foalingRecordId, foal])));
      setStallionNameById(Object.fromEntries(stallions.map((stallion) => [stallion.id, stallion.name])));
      setTitle(mareRecord.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mare details.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [mareId, setTitle]);

  const breedingById = useMemo(
    () => Object.fromEntries(breedingRecords.map((record) => [record.id, record])),
    [breedingRecords],
  );
  const isCurrentlyPregnant = useMemo(
    () => findCurrentPregnancyCheck(pregnancyChecks, foalingRecords) !== null,
    [foalingRecords, pregnancyChecks],
  );

  return {
    mare,
    dailyLogs,
    breedingRecords,
    pregnancyChecks,
    foalingRecords,
    medicationLogs,
    foalByFoalingRecordId,
    stallionNameById,
    breedingById,
    age: deriveAgeYears(mare?.dateOfBirth ?? null),
    isCurrentlyPregnant,
    isLoading,
    error,
    loadData,
  };
}
