import { useCallback, useState, type MutableRefObject } from 'react';
import { Alert } from 'react-native';

import type { CervicalFirmness, UterineToneCategory } from '@/models/types';
import { newId } from '@/utils/id';

import { createEmptyUterusDraft } from './mappers';
import type {
  DailyLogWizardSetErrors,
  DailyLogWizardUterusDraft,
  FlushDecision,
  ScoreOption,
  UpsertFluidPocketInput,
} from './types';

type UseDailyLogUterusStateArgs = {
  setErrors: DailyLogWizardSetErrors;
  hadPersistedFlushRef: MutableRefObject<boolean>;
  flushProductCount: number;
  ensureFlushDraft: () => void;
};

export function useDailyLogUterusState({
  setErrors,
  hadPersistedFlushRef,
  flushProductCount,
  ensureFlushDraft,
}: UseDailyLogUterusStateArgs) {
  const [uterus, setUterus] = useState<DailyLogWizardUterusDraft>(createEmptyUterusDraft);
  const [flushDecision, setFlushDecisionState] = useState<FlushDecision>(null);

  const hydrateUterus = useCallback(
    (nextUterus: DailyLogWizardUterusDraft, nextFlushDecision: FlushDecision): void => {
      setUterus(nextUterus);
      setFlushDecisionState(nextFlushDecision);
    },
    [],
  );

  const resetCreateFlushDecision = useCallback((): void => {
    setFlushDecisionState(null);
  }, []);

  const updateUterus = useCallback(
    (updater: (current: DailyLogWizardUterusDraft) => DailyLogWizardUterusDraft): void => {
      setUterus((current) => updater(current));
    },
    [],
  );

  const setEdema = useCallback((value: ScoreOption): void => {
    updateUterus((current) => ({ ...current, edema: value }));
  }, [updateUterus]);

  const setUterineToneCategory = useCallback((value: UterineToneCategory | null): void => {
    updateUterus((current) => ({ ...current, uterineToneCategory: value }));
  }, [updateUterus]);

  const setCervicalFirmness = useCallback((value: CervicalFirmness | null): void => {
    updateUterus((current) => ({ ...current, cervicalFirmness: value }));
  }, [updateUterus]);

  const setDischargeObserved = useCallback((value: boolean | null): void => {
    updateUterus((current) => ({ ...current, dischargeObserved: value }));
    setErrors((current) => ({ ...current, uterus: { ...current.uterus, dischargeNotes: undefined } }));
  }, [setErrors, updateUterus]);

  const setDischargeNotes = useCallback((value: string): void => {
    updateUterus((current) => ({ ...current, dischargeNotes: value }));
    setErrors((current) => ({ ...current, uterus: { ...current.uterus, dischargeNotes: undefined } }));
  }, [setErrors, updateUterus]);

  const setUterineCysts = useCallback((value: string): void => {
    updateUterus((current) => ({ ...current, uterineCysts: value }));
  }, [updateUterus]);

  const upsertFluidPocket = useCallback(
    (value: UpsertFluidPocketInput, clientId?: string): void => {
      updateUterus((current) => {
        if (!clientId) {
          return {
            ...current,
            fluidPockets: [
              ...current.fluidPockets,
              {
                clientId: newId(),
                depthMm: value.depthMm,
                location: value.location,
              },
            ],
          };
        }

        let updated = false;
        const nextRows = current.fluidPockets.map((row) => {
          if (row.clientId !== clientId) {
            return row;
          }

          updated = true;
          return {
            ...row,
            depthMm: value.depthMm,
            location: value.location,
          };
        });

        return updated ? { ...current, fluidPockets: nextRows } : current;
      });

      setErrors((current) => ({ ...current, uterus: { ...current.uterus, fluidPockets: undefined } }));
    },
    [setErrors, updateUterus],
  );

  const removeFluidPocket = useCallback((clientId: string): void => {
    const applyRemoval = (): void => {
      updateUterus((current) => {
        const nextPockets = current.fluidPockets.filter((row) => row.clientId !== clientId);
        if (nextPockets.length === 0) {
          setFlushDecisionState(null);
        }
        return {
          ...current,
          fluidPockets: nextPockets,
        };
      });
    };

    if (
      hadPersistedFlushRef.current &&
      flushDecision === 'yes' &&
      uterus.fluidPockets.length === 1 &&
      uterus.fluidPockets[0]?.clientId === clientId
    ) {
      Alert.alert(
        'Clear flush data?',
        'Removing the last fluid pocket will clear the saved flush details for this daily log.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: applyRemoval },
        ],
      );
      return;
    }

    applyRemoval();
  }, [flushDecision, hadPersistedFlushRef, updateUterus, uterus.fluidPockets]);

  const setFlushDecision = useCallback(
    (value: FlushDecision): void => {
      if (value === 'yes' && flushProductCount === 0) {
        ensureFlushDraft();
      }

      if (value === 'no' && hadPersistedFlushRef.current && flushDecision === 'yes') {
        Alert.alert(
          'Clear flush data?',
          'Changing this answer to No will clear the saved flush details for this daily log.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => setFlushDecisionState('no') },
          ],
        );
        return;
      }

      setFlushDecisionState(value);
      setErrors((current) => ({
        ...current,
        uterus: { ...current.uterus, flushDecision: undefined },
      }));
    },
    [ensureFlushDraft, flushDecision, flushProductCount, hadPersistedFlushRef, setErrors],
  );

  return {
    uterus,
    flushDecision,
    hydrateUterus,
    resetCreateFlushDecision,
    setEdema,
    setUterineToneCategory,
    setCervicalFirmness,
    setDischargeObserved,
    setDischargeNotes,
    setUterineCysts,
    upsertFluidPocket,
    removeFluidPocket,
    setFlushDecision,
  };
}
