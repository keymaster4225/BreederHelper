import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { Foal, FoalingRecord, Mare } from '@/models/types';
import {
  getFoalByFoalingRecordId,
  getFoalingRecordById,
  getMareById,
} from '@/storage/repositories';

type UseFoalingEventDetailArgs = {
  readonly foalingRecordId: string;
};

type FoalingEventDetailState = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly invalidRouteMessage: string | null;
  readonly recordMissingAfterPriorLoad: boolean;
  readonly record: FoalingRecord | null;
  readonly mare: Mare | null;
  readonly foal: Foal | null;
};

const initialState: FoalingEventDetailState = {
  isLoading: true,
  error: null,
  invalidRouteMessage: null,
  recordMissingAfterPriorLoad: false,
  record: null,
  mare: null,
  foal: null,
};

export function useFoalingEventDetail({ foalingRecordId }: UseFoalingEventDetailArgs) {
  const [state, setState] = useState<FoalingEventDetailState>(initialState);
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
      const record = await getFoalingRecordById(foalingRecordId);

      if (generation !== loadGenerationRef.current) {
        return;
      }

      if (!record) {
        setState((current) => ({
          ...current,
          isLoading: false,
          invalidRouteMessage: hasLoadedRecordRef.current ? null : 'This foaling record no longer exists.',
          recordMissingAfterPriorLoad: hasLoadedRecordRef.current,
        }));
        return;
      }

      const [mare, foal] = await Promise.all([
        getMareById(record.mareId),
        getFoalByFoalingRecordId(record.id),
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
        foal,
      });
    } catch (error) {
      if (generation !== loadGenerationRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Failed to load foaling record.';
      setState((current) => ({
        ...current,
        isLoading: false,
        error: message,
      }));
    }
  }, [foalingRecordId]);

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
