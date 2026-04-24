import { useCallback, useState } from 'react';

import { newId } from '@/utils/id';

import { createEmptyFlushDraft } from './mappers';
import type {
  DailyLogWizardFlushDraft,
  DailyLogWizardFlushProductDraft,
  DailyLogWizardSetErrors,
} from './types';

type UseDailyLogFlushStateArgs = {
  setErrors: DailyLogWizardSetErrors;
};

export function useDailyLogFlushState({ setErrors }: UseDailyLogFlushStateArgs) {
  const [flush, setFlush] = useState<DailyLogWizardFlushDraft>(createEmptyFlushDraft);

  const hydrateFlush = useCallback((nextFlush: DailyLogWizardFlushDraft): void => {
    setFlush(nextFlush);
  }, []);

  const resetFlushDraft = useCallback((): void => {
    setFlush(createEmptyFlushDraft());
  }, []);

  const ensureFlushDraft = useCallback((): void => {
    setFlush((current) => (current.products.length === 0 ? createEmptyFlushDraft() : current));
  }, []);

  const updateFlush = useCallback(
    (updater: (current: DailyLogWizardFlushDraft) => DailyLogWizardFlushDraft): void => {
      setFlush((current) => updater(current));
      setErrors((current) => ({ ...current, flush: {} }));
    },
    [setErrors],
  );

  const setFlushBaseSolution = useCallback(
    (value: string): void => updateFlush((current) => ({ ...current, baseSolution: value })),
    [updateFlush],
  );

  const setFlushTotalVolumeMl = useCallback(
    (value: string): void => updateFlush((current) => ({ ...current, totalVolumeMl: value })),
    [updateFlush],
  );

  const setFlushNotes = useCallback(
    (value: string): void => updateFlush((current) => ({ ...current, notes: value })),
    [updateFlush],
  );

  const addFlushProduct = useCallback((): void => {
    updateFlush((current) => ({
      ...current,
      products: [
        ...current.products,
        { clientId: newId(), productName: '', dose: '', notes: '' },
      ],
    }));
  }, [updateFlush]);

  const updateFlushProduct = useCallback(
    (
      clientId: string,
      patch: Partial<Pick<DailyLogWizardFlushProductDraft, 'dose' | 'notes' | 'productName'>>,
    ): void => {
      updateFlush((current) => ({
        ...current,
        products: current.products.map((product) =>
          product.clientId === clientId ? { ...product, ...patch } : product,
        ),
      }));
    },
    [updateFlush],
  );

  const removeFlushProduct = useCallback(
    (clientId: string): void => {
      updateFlush((current) => ({
        ...current,
        products: current.products.filter((product) => product.clientId !== clientId),
      }));
    },
    [updateFlush],
  );

  return {
    flush,
    hydrateFlush,
    resetFlushDraft,
    ensureFlushDraft,
    setFlushBaseSolution,
    setFlushTotalVolumeMl,
    setFlushNotes,
    addFlushProduct,
    updateFlushProduct,
    removeFlushProduct,
  };
}
