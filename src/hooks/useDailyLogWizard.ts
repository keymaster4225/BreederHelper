import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { DailyLogDetail } from '@/models/types';
import { createDailyLog, deleteDailyLog, getDailyLogById, updateDailyLog } from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';

import {
  buildDailyLogWizardSteps,
  DAILY_LOG_WIZARD_STEPS,
  SCORE_OPTIONS,
  TRI_STATE_OPTIONS,
} from './dailyLogWizard/constants';
import {
  buildDailyLogPayload,
  createEmptyErrors,
  hydrateDailyLogWizardRecord,
} from './dailyLogWizard/mappers';
import {
  fromTriStateOption,
  toTriStateOption,
} from './dailyLogWizard/measurementUtils';
import {
  validateBasics,
  validateFlush,
  validateOvary,
  validateUterus,
} from './dailyLogWizard/validation';
import { completeLinkedTaskAfterSave } from './completeLinkedTaskAfterSave';
import { useDailyLogBasicsState } from './dailyLogWizard/useDailyLogBasicsState';
import { useDailyLogFlushState } from './dailyLogWizard/useDailyLogFlushState';
import { useDailyLogOvaryState } from './dailyLogWizard/useDailyLogOvaryState';
import { useDailyLogReviewState } from './dailyLogWizard/useDailyLogReviewState';
import { useDailyLogUterusState } from './dailyLogWizard/useDailyLogUterusState';
import { useRecordForm } from './useRecordForm';

import type {
  DailyLogWizardErrors,
  DailyLogWizardFlushDraft,
  DailyLogWizardFlushProductDraft,
  DailyLogWizardFluidPocketDraft,
  DailyLogWizardLegacyNotes,
  DailyLogWizardMeasurementDraft,
  DailyLogWizardOvaryDraft,
  DailyLogWizardStepId,
  DailyLogWizardUterusDraft,
  ScoreOption,
  FlushDecision,
  TriStateOption,
} from './dailyLogWizard/types';

export {
  DAILY_LOG_WIZARD_STEPS,
  SCORE_OPTIONS,
  TRI_STATE_OPTIONS,
  fromTriStateOption,
  toTriStateOption,
};

export type {
  DailyLogWizardErrors,
  DailyLogWizardFlushDraft,
  DailyLogWizardFlushProductDraft,
  DailyLogWizardFluidPocketDraft,
  DailyLogWizardLegacyNotes,
  DailyLogWizardMeasurementDraft,
  DailyLogWizardOvaryDraft,
  DailyLogWizardStepId,
  DailyLogWizardUterusDraft,
  ScoreOption,
  FlushDecision,
  TriStateOption,
};

type UseDailyLogWizardArgs = {
  mareId: string;
  logId?: string;
  taskId?: string;
  defaultDate?: string;
  defaultTime?: string | null;
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

const REQUIRED_TIME_ERROR = 'Time is required.';
const INVALID_TIME_ERROR = 'Time must be a valid HH:MM value.';
const DUPLICATE_TIME_ERROR = 'A daily log already exists for this mare at that date and time.';

function getBasicsTimeErrorForSaveFailure(message: string): string | null {
  const normalized = message.toLowerCase();

  if (message.includes('Daily log time is required.')) {
    return REQUIRED_TIME_ERROR;
  }

  if (
    message.includes('Daily log time must be a valid HH:MM value.') ||
    message.includes('Timed daily logs cannot be cleared back to untimed.')
  ) {
    return INVALID_TIME_ERROR;
  }

  if (
    (normalized.includes('unique') &&
      normalized.includes('daily_logs') &&
      normalized.includes('date') &&
      normalized.includes('time')) ||
    normalized.includes('idx_daily_logs_mare_date_time_unique')
  ) {
    return DUPLICATE_TIME_ERROR;
  }

  return null;
}

export function useDailyLogWizard({
  mareId,
  logId,
  taskId,
  defaultDate,
  defaultTime,
  onGoBack,
  setTitle,
}: UseDailyLogWizardArgs) {
  const isEdit = Boolean(logId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);
  const hadPersistedFlushRef = useRef(false);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errors, setErrors] = useState<DailyLogWizardErrors>(createEmptyErrors);

  const {
    notes,
    legacyNotes,
    legacyOvulationDetected,
    ovulationSource,
    setNotes,
    markOvulationStructured,
    hydrateReview,
  } = useDailyLogReviewState();

  const {
    date,
    time,
    teasingScore,
    isTimeClearable,
    hydrateBasics,
    resetCreateTimeDefaults,
    setDate,
    setTime,
    setTeasingScore,
  } = useDailyLogBasicsState({ isEdit, today, defaultDate, defaultTime, setErrors });

  const {
    rightOvary,
    leftOvary,
    hydrateOvaries,
    setOvaryOvulation,
    setOvaryFollicleState,
    setOvaryFollicleSize,
    setOvaryConsistency,
    toggleOvaryStructure,
    addOvaryMeasurement,
    updateOvaryMeasurement,
    removeOvaryMeasurement,
  } = useDailyLogOvaryState({
    setErrors,
    onStructuredOvulationChange: markOvulationStructured,
  });

  const {
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
  } = useDailyLogFlushState({ setErrors });

  const {
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
  } = useDailyLogUterusState({
    setErrors,
    hadPersistedFlushRef,
    flushProductCount: flush.products.length,
    ensureFlushDraft,
  });

  const steps = useMemo(
    () => buildDailyLogWizardSteps(flushDecision === 'yes' && uterus.fluidPockets.length > 0),
    [flushDecision, uterus.fluidPockets.length],
  );
  const currentStep = steps[Math.min(currentStepIndex, steps.length - 1)] ?? steps[0];
  const currentStepId = currentStep.id;
  const getStepIndex = useCallback(
    (stepId: DailyLogWizardStepId): number =>
      Math.max(0, steps.findIndex((step) => step.id === stepId)),
    [steps],
  );

  const {
    isLoading,
    isSaving,
    isDeleting,
    setIsLoading,
    runLoad,
    runSave,
    runDelete,
  } = useRecordForm({ initialLoading: isEdit });

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Daily Log' : 'Add Daily Log');
  }, [isEdit]);

  useEffect(() => {
    setCurrentStepIndex((current) => Math.min(current, steps.length - 1));
  }, [steps.length]);

  const hydrateFromRecord = useCallback((record: DailyLogDetail): void => {
    const hydrated = hydrateDailyLogWizardRecord(record);
    hydrateBasics({
      date: hydrated.date,
      time: hydrated.time,
      teasingScore: hydrated.teasingScore,
      isTimeClearable: record.time == null,
    });
    hydrateOvaries(hydrated.rightOvary, hydrated.leftOvary);
    hydrateUterus(hydrated.uterus, hydrated.flushDecision);
    hydrateFlush(hydrated.flush);
    hadPersistedFlushRef.current = record.uterineFlush != null;
    hydrateReview({
      notes: hydrated.notes,
      legacyNotes: hydrated.legacyNotes,
      legacyOvulationDetected: hydrated.legacyOvulationDetected,
      ovulationSource: hydrated.ovulationSource,
    });
    setErrors(createEmptyErrors());
  }, [hydrateBasics, hydrateFlush, hydrateOvaries, hydrateReview, hydrateUterus]);

  useEffect(() => {
    if (!logId) {
      setIsLoading(false);
      setCurrentStepIndex(0);
      resetCreateTimeDefaults();
      resetCreateFlushDecision();
      resetFlushDraft();
      hadPersistedFlushRef.current = false;
      return;
    }

    void runLoad(
      async () => {
        const record = await getDailyLogById(logId);
        if (!record) {
          Alert.alert('Log not found', 'This daily log no longer exists.');
          onGoBackRef.current();
          return;
        }

        hydrateFromRecord(record);
        setCurrentStepIndex(
          buildDailyLogWizardSteps(record.uterineFlush != null && record.uterineFluidPockets.length > 0)
            .length - 1,
        );
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load daily log.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [
    hydrateFromRecord,
    logId,
    resetCreateFlushDecision,
    resetCreateTimeDefaults,
    resetFlushDraft,
    runLoad,
    setIsLoading,
  ]);

  const applyBasicsValidation = useCallback((): boolean => {
    const nextErrors = validateBasics(date, time, isTimeClearable);
    setErrors((current) => ({ ...current, basics: nextErrors }));
    return !nextErrors.date && !nextErrors.time;
  }, [date, isTimeClearable, time]);

  const applyOvaryValidation = useCallback(
    (side: 'right' | 'left'): boolean => {
      const nextErrors = validateOvary(side === 'right' ? rightOvary : leftOvary);
      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: nextErrors,
      }));
      return !nextErrors.measurements;
    },
    [leftOvary, rightOvary],
  );

  const applyUterusValidation = useCallback((): boolean => {
    const nextErrors = validateUterus(uterus, flushDecision);
    setErrors((current) => ({ ...current, uterus: nextErrors }));
    return !nextErrors.dischargeNotes && !nextErrors.fluidPockets && !nextErrors.flushDecision;
  }, [flushDecision, uterus]);

  const applyFlushValidation = useCallback((): boolean => {
    if (flushDecision !== 'yes' || uterus.fluidPockets.length === 0) {
      setErrors((current) => ({ ...current, flush: {} }));
      return true;
    }

    const nextErrors = validateFlush(flush);
    setErrors((current) => ({ ...current, flush: nextErrors }));
    return !nextErrors.baseSolution && !nextErrors.totalVolumeMl && !nextErrors.products;
  }, [flush, flushDecision, uterus.fluidPockets.length]);

  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      const stepId = steps[stepIndex]?.id;

      if (stepId === 'basics') {
        return applyBasicsValidation();
      }

      if (stepId === 'rightOvary') {
        return applyOvaryValidation('right');
      }

      if (stepId === 'leftOvary') {
        return applyOvaryValidation('left');
      }

      if (stepId === 'uterus') {
        return applyUterusValidation();
      }

      if (stepId === 'flush') {
        return applyFlushValidation();
      }

      return (
        applyBasicsValidation() &&
        applyOvaryValidation('right') &&
        applyOvaryValidation('left') &&
        applyUterusValidation() &&
        applyFlushValidation()
      );
    },
    [applyBasicsValidation, applyFlushValidation, applyOvaryValidation, applyUterusValidation, steps],
  );

  const goNext = useCallback((): void => {
    if (!validateStep(currentStepIndex)) {
      return;
    }

    setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [currentStepIndex, steps.length, validateStep]);

  const goBack = useCallback((): void => {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  const goToStep = useCallback((stepIndex: number): void => {
    setCurrentStepIndex(Math.max(0, Math.min(stepIndex, steps.length - 1)));
  }, [steps.length]);

  const save = useCallback(async (): Promise<void> => {
    const basicsValid = applyBasicsValidation();
    const rightOvaryValid = applyOvaryValidation('right');
    const leftOvaryValid = applyOvaryValidation('left');
    const uterusValid = applyUterusValidation();
    const flushValid = applyFlushValidation();

    if (!basicsValid) {
      setCurrentStepIndex(getStepIndex('basics'));
      return;
    }

    if (!rightOvaryValid) {
      setCurrentStepIndex(getStepIndex('rightOvary'));
      return;
    }

    if (!leftOvaryValid) {
      setCurrentStepIndex(getStepIndex('leftOvary'));
      return;
    }

    if (!uterusValid) {
      setCurrentStepIndex(getStepIndex('uterus'));
      return;
    }

    if (!flushValid) {
      setCurrentStepIndex(getStepIndex('flush'));
      return;
    }

    await runSave(
      async () => {
        const payload = buildDailyLogPayload({
          isEdit,
          date,
          time,
          teasingScore,
          rightOvary,
          leftOvary,
          uterus,
          flushDecision,
          flush,
          hadPersistedFlush: hadPersistedFlushRef.current,
          notes,
          legacyOvulationDetected,
          ovulationSource,
        });

        const savedLogId = logId ?? newId();

        if (logId) {
          await updateDailyLog(logId, payload);
        } else {
          if (payload.time == null) {
            throw new Error('Daily log time is required.');
          }

          await createDailyLog({
            id: savedLogId,
            mareId,
            ...payload,
            time: payload.time,
          });
        }

        await completeLinkedTaskAfterSave({
          taskId,
          completedRecordType: 'dailyLog',
          completedRecordId: savedLogId,
          onCompletedOrSkipped: onGoBackRef.current,
        });
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save daily log.';
          const timeError = getBasicsTimeErrorForSaveFailure(message);
          if (timeError) {
            setErrors((current) => ({
              ...current,
              basics: {
                ...current.basics,
                time: timeError,
              },
            }));
            setCurrentStepIndex(getStepIndex('basics'));
            return;
          }

          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    applyBasicsValidation,
    applyFlushValidation,
    applyOvaryValidation,
    applyUterusValidation,
    date,
    flush,
    flushDecision,
    getStepIndex,
    isEdit,
    time,
    leftOvary,
    legacyOvulationDetected,
    logId,
    mareId,
    notes,
    ovulationSource,
    rightOvary,
    runSave,
    taskId,
    teasingScore,
    uterus,
  ]);

  const requestDelete = useCallback((): void => {
    if (!logId) {
      return;
    }

    confirmDelete({
      title: 'Delete Daily Log',
      message: 'Delete this daily log entry?',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await deleteDailyLog(logId);
            onGoBack();
          },
          {
            onError: (error: unknown) => {
              const message = error instanceof Error ? error.message : 'Failed to delete daily log.';
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
  }, [logId, onGoBack, runDelete]);

  return {
    isEdit,
    currentStepIndex,
    currentStepTitle: currentStep.title,
    currentStepId,
    steps,
    date,
    time,
    teasingScore,
    rightOvary,
    leftOvary,
    uterus,
    flushDecision,
    flush,
    notes,
    legacyNotes,
    legacyOvulationDetected,
    ovulationSource,
    isTimeClearable,
    errors,
    today,
    isLoading,
    isSaving,
    isDeleting,
    setDate,
    setTime,
    setTeasingScore,
    setNotes,
    setOvaryOvulation,
    setOvaryFollicleState,
    setOvaryFollicleSize,
    setOvaryConsistency,
    toggleOvaryStructure,
    addOvaryMeasurement,
    updateOvaryMeasurement,
    removeOvaryMeasurement,
    setEdema,
    setUterineToneCategory,
    setCervicalFirmness,
    setDischargeObserved,
    setDischargeNotes,
    setUterineCysts,
    upsertFluidPocket,
    removeFluidPocket,
    setFlushDecision,
    setFlushBaseSolution,
    setFlushTotalVolumeMl,
    setFlushNotes,
    addFlushProduct,
    updateFlushProduct,
    removeFlushProduct,
    goNext,
    goBack,
    goToStep,
    save,
    requestDelete,
  };
}
