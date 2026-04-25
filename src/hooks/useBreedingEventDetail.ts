import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type {
  BreedingRecord,
  Foal,
  FoalingRecord,
  Mare,
  PregnancyCheck,
  SemenCollection,
  Stallion,
} from '@/models/types';
import {
  getBreedingRecordById,
  getMareById,
  getSemenCollectionById,
  getStallionById,
  listFoalingRecordsByMare,
  listFoalsByMare,
  listPregnancyChecksByMare,
} from '@/storage/repositories';

type UseBreedingEventDetailArgs = {
  readonly breedingRecordId: string;
};

type BreedingEventDetailState = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly invalidRouteMessage: string | null;
  readonly recordMissingAfterPriorLoad: boolean;
  readonly record: BreedingRecord | null;
  readonly mare: Mare | null;
  readonly stallion: Stallion | null;
  readonly collection: SemenCollection | null;
  readonly pregnancyChecks: PregnancyCheck[];
  readonly foalingRecords: FoalingRecord[];
  readonly foalByFoalingRecordId: Record<string, Foal>;
};

const initialState: BreedingEventDetailState = {
  isLoading: true,
  error: null,
  invalidRouteMessage: null,
  recordMissingAfterPriorLoad: false,
  record: null,
  mare: null,
  stallion: null,
  collection: null,
  pregnancyChecks: [],
  foalingRecords: [],
  foalByFoalingRecordId: {},
};

export function useBreedingEventDetail({ breedingRecordId }: UseBreedingEventDetailArgs) {
  const [state, setState] = useState<BreedingEventDetailState>(initialState);
  const loadGenerationRef = useRef(0);
  const hasLoadedRecordRef = useRef(false);

  const reload = useCallback(async (): Promise<void> => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
      invalidRouteMessage: null,
      recordMissingAfterPriorLoad: false,
    }));

    try {
      const record = await getBreedingRecordById(breedingRecordId);

      if (generation !== loadGenerationRef.current) {
        return;
      }

      if (!record) {
        setState((current) => ({
          ...current,
          isLoading: false,
          invalidRouteMessage: hasLoadedRecordRef.current
            ? null
            : 'This breeding record no longer exists.',
          recordMissingAfterPriorLoad: hasLoadedRecordRef.current,
        }));
        return;
      }

      const [
        mare,
        stallion,
        collection,
        pregnancyRows,
        foalingRows,
        foals,
      ] = await Promise.all([
        getMareById(record.mareId),
        record.stallionId ? getStallionById(record.stallionId) : Promise.resolve(null),
        record.collectionId ? getSemenCollectionById(record.collectionId) : Promise.resolve(null),
        listPregnancyChecksByMare(record.mareId),
        listFoalingRecordsByMare(record.mareId),
        listFoalsByMare(record.mareId),
      ]);

      if (generation !== loadGenerationRef.current) {
        return;
      }

      if (!mare) {
        setState((current) => ({
          ...current,
          isLoading: false,
          invalidRouteMessage: 'This mare no longer exists.',
        }));
        return;
      }

      hasLoadedRecordRef.current = true;
      setState({
        isLoading: false,
        error: null,
        invalidRouteMessage: null,
        recordMissingAfterPriorLoad: false,
        record,
        mare,
        stallion,
        collection,
        pregnancyChecks: pregnancyRows.filter((check) => check.breedingRecordId === breedingRecordId),
        foalingRecords: foalingRows.filter((foaling) => foaling.breedingRecordId === breedingRecordId),
        foalByFoalingRecordId: Object.fromEntries(foals.map((foal) => [foal.foalingRecordId, foal])),
      });
    } catch (error) {
      if (generation !== loadGenerationRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Failed to load breeding event.';
      setState((current) => ({
        ...current,
        isLoading: false,
        error: message,
      }));
    }
  }, [breedingRecordId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return {
    ...state,
    reload,
  };
}
