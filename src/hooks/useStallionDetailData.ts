import { useCallback, useState } from 'react';

import {
  BreedingRecord,
  CollectionDoseEvent,
  SemenCollection,
  Stallion,
} from '@/models/types';
import {
  getStallionById,
  listDoseEventsByCollectionIds,
  listBreedingRecordsForStallion,
  listLegacyBreedingRecordsMatchingStallionName,
  listMares,
  listSemenCollectionsByStallion,
} from '@/storage/repositories';

type UseStallionDetailDataArgs = {
  readonly stallionId: string;
  readonly setTitle: (title: string) => void;
};

type StallionDetailData = {
  readonly stallion: Stallion | null;
  readonly collections: SemenCollection[];
  readonly linkedBreedings: BreedingRecord[];
  readonly legacyBreedings: BreedingRecord[];
  readonly breedingRecordById: Record<string, BreedingRecord>;
  readonly doseEventsByCollectionId: Record<string, CollectionDoseEvent[]>;
  readonly mareNameById: Record<string, string>;
  readonly age: number | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadData: () => Promise<void>;
};

function deriveHorseAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const birthYear = parseInt(dateOfBirth.slice(0, 4), 10);
  if (Number.isNaN(birthYear)) return null;
  return new Date().getFullYear() - birthYear;
}

export function useStallionDetailData({ stallionId, setTitle }: UseStallionDetailDataArgs): StallionDetailData {
  const [stallion, setStallion] = useState<Stallion | null>(null);
  const [collections, setCollections] = useState<SemenCollection[]>([]);
  const [linkedBreedings, setLinkedBreedings] = useState<BreedingRecord[]>([]);
  const [legacyBreedings, setLegacyBreedings] = useState<BreedingRecord[]>([]);
  const [breedingRecordById, setBreedingRecordById] = useState<Record<string, BreedingRecord>>({});
  const [doseEventsByCollectionId, setDoseEventsByCollectionId] = useState<
    Record<string, CollectionDoseEvent[]>
  >({});
  const [mareNameById, setMareNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const age = stallion ? deriveHorseAge(stallion.dateOfBirth) : null;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const stallionRecord = await getStallionById(stallionId);
      if (!stallionRecord) {
        setError('Stallion not found.');
        setStallion(null);
        return;
      }

      setStallion(stallionRecord);
      setTitle(stallionRecord.name);

      const [cols, linked, legacy, allMares] = await Promise.all([
        listSemenCollectionsByStallion(stallionId),
        listBreedingRecordsForStallion(stallionId),
        listLegacyBreedingRecordsMatchingStallionName(stallionRecord.name),
        listMares(),
      ]);
      const doseEvents = await listDoseEventsByCollectionIds(cols.map((collection) => collection.id));

      setCollections(cols);
      setLinkedBreedings(linked);
      setLegacyBreedings(legacy);
      setDoseEventsByCollectionId(doseEvents);

      const breedingLookup: Record<string, BreedingRecord> = {};
      for (const record of linked) {
        breedingLookup[record.id] = record;
      }
      setBreedingRecordById(breedingLookup);

      const nameMap: Record<string, string> = {};
      for (const mare of allMares) {
        nameMap[mare.id] = mare.name;
      }
      setMareNameById(nameMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stallion data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [stallionId, setTitle]);

  return {
    stallion,
    collections,
    linkedBreedings,
    legacyBreedings,
    breedingRecordById,
    doseEventsByCollectionId,
    mareNameById,
    age,
    isLoading,
    error,
    loadData,
  };
}
