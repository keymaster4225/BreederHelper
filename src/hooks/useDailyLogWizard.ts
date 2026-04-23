import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { DailyLogDetail, DailyLogOvulationSource, FluidLocation, FollicleState, OvaryConsistency, OvaryStructure, UterineToneCategory, CervicalFirmness } from '@/models/types';
import { createDailyLog, deleteDailyLog, getDailyLogById, updateDailyLog } from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { getCurrentTimeHHMM } from '@/utils/dailyLogTime';
import { toLocalDate } from '@/utils/dates';
import { newId } from '@/utils/id';

import {
  DAILY_LOG_WIZARD_STEPS,
  SCORE_OPTIONS,
  TRI_STATE_OPTIONS,
} from './dailyLogWizard/constants';
import {
  buildDailyLogPayload,
  createEmptyErrors,
  createEmptyOvaryDraft,
  createEmptyUterusDraft,
  hydrateDailyLogWizardRecord,
} from './dailyLogWizard/mappers';
import {
  fromTriStateOption,
  toTriStateOption,
} from './dailyLogWizard/measurementUtils';
import {
  validateBasics,
  validateOvary,
  validateUterus,
} from './dailyLogWizard/validation';
import { useRecordForm } from './useRecordForm';

import type {
  DailyLogWizardErrors,
  DailyLogWizardFluidPocketDraft,
  DailyLogWizardLegacyNotes,
  DailyLogWizardMeasurementDraft,
  DailyLogWizardOvaryDraft,
  DailyLogWizardUterusDraft,
  ScoreOption,
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
  DailyLogWizardFluidPocketDraft,
  DailyLogWizardLegacyNotes,
  DailyLogWizardMeasurementDraft,
  DailyLogWizardOvaryDraft,
  DailyLogWizardUterusDraft,
  ScoreOption,
  TriStateOption,
};

type OvarySide = 'right' | 'left';

type UseDailyLogWizardArgs = {
  mareId: string;
  logId?: string;
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

type UpsertFluidPocketInput = {
  depthMm: number;
  location: FluidLocation;
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
  onGoBack,
  setTitle,
}: UseDailyLogWizardArgs) {
  const isEdit = Boolean(logId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [date, setDate] = useState<string>(() => (isEdit ? '' : toLocalDate(today)));
  const [time, setTime] = useState<string>(() => (isEdit ? '' : getCurrentTimeHHMM(today)));
  const [teasingScore, setTeasingScore] = useState<ScoreOption>('');
  const [rightOvary, setRightOvary] = useState<DailyLogWizardOvaryDraft>(createEmptyOvaryDraft);
  const [leftOvary, setLeftOvary] = useState<DailyLogWizardOvaryDraft>(createEmptyOvaryDraft);
  const [uterus, setUterus] = useState<DailyLogWizardUterusDraft>(createEmptyUterusDraft);
  const [notes, setNotes] = useState('');
  const [legacyNotes, setLegacyNotes] = useState<DailyLogWizardLegacyNotes>({
    rightOvary: null,
    leftOvary: null,
    uterineTone: null,
  });
  const [isTimeClearable, setIsTimeClearable] = useState(false);
  const [legacyOvulationDetected, setLegacyOvulationDetected] = useState<boolean | null>(null);
  const [ovulationSource, setOvulationSource] = useState<DailyLogOvulationSource>('structured');
  const [errors, setErrors] = useState<DailyLogWizardErrors>(createEmptyErrors);

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

  const hydrateFromRecord = useCallback((record: DailyLogDetail): void => {
    const hydrated = hydrateDailyLogWizardRecord(record);
    setDate(hydrated.date);
    setTime(hydrated.time);
    setTeasingScore(hydrated.teasingScore);
    setRightOvary(hydrated.rightOvary);
    setLeftOvary(hydrated.leftOvary);
    setUterus(hydrated.uterus);
    setNotes(hydrated.notes);
    setLegacyNotes(hydrated.legacyNotes);
    setIsTimeClearable(record.time == null);
    setLegacyOvulationDetected(hydrated.legacyOvulationDetected);
    setOvulationSource(hydrated.ovulationSource);
    setErrors(createEmptyErrors());
  }, []);

  useEffect(() => {
    if (!logId) {
      setIsLoading(false);
      setCurrentStepIndex(0);
      setTime(getCurrentTimeHHMM(today));
      setIsTimeClearable(false);
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
        setCurrentStepIndex(DAILY_LOG_WIZARD_STEPS.length - 1);
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load daily log.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [hydrateFromRecord, logId, runLoad, setIsLoading, today]);

  const setOvaryForSide = useCallback(
    (side: OvarySide, updater: (current: DailyLogWizardOvaryDraft) => DailyLogWizardOvaryDraft): void => {
      if (side === 'right') {
        setRightOvary((current) => updater(current));
        return;
      }

      setLeftOvary((current) => updater(current));
    },
    [],
  );

  const setOvaryOvulation = useCallback(
    (side: OvarySide, value: boolean | null): void => {
      const currentValue = side === 'right' ? rightOvary.ovulation : leftOvary.ovulation;
      if (currentValue !== value) {
        setOvulationSource('structured');
      }

      setOvaryForSide(side, (current) => ({
        ...current,
        ovulation: value,
      }));
    },
    [leftOvary.ovulation, rightOvary.ovulation, setOvaryForSide],
  );

  const setOvaryFollicleState = useCallback(
    (side: OvarySide, value: FollicleState | null): void => {
      setOvaryForSide(side, (current) => {
        const needsSeedRow = value === 'measured' && current.follicleMeasurements.length === 0;
        return {
          ...current,
          follicleState: value,
          follicleMeasurements: needsSeedRow
            ? [{ clientId: newId(), value: '' }]
            : current.follicleMeasurements,
        };
      });

      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: {},
      }));
    },
    [setOvaryForSide],
  );

  const setOvaryFollicleSize = useCallback(
    (side: OvarySide, value: string): void => {
      setOvaryForSide(side, (current) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return {
            ...current,
            follicleState: null,
            follicleMeasurements: [],
          };
        }

        const existingClientId = current.follicleMeasurements[0]?.clientId ?? newId();
        return {
          ...current,
          follicleState: 'measured',
          follicleMeasurements: [{ clientId: existingClientId, value }],
        };
      });

      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: {
          ...current[side === 'right' ? 'rightOvary' : 'leftOvary'],
          measurements: undefined,
        },
      }));
    },
    [setOvaryForSide],
  );

  const setOvaryConsistency = useCallback(
    (side: OvarySide, value: OvaryConsistency | null): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        consistency: value,
      }));
    },
    [setOvaryForSide],
  );

  const toggleOvaryStructure = useCallback(
    (side: OvarySide, structure: OvaryStructure): void => {
      setOvaryForSide(side, (current) => {
        const hasStructure = current.structures.includes(structure);
        return {
          ...current,
          structures: hasStructure
            ? current.structures.filter((value) => value !== structure)
            : [...current.structures, structure],
        };
      });
    },
    [setOvaryForSide],
  );

  const addOvaryMeasurement = useCallback(
    (side: OvarySide): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: [...current.follicleMeasurements, { clientId: newId(), value: '' }],
      }));
    },
    [setOvaryForSide],
  );

  const updateOvaryMeasurement = useCallback(
    (side: OvarySide, clientId: string, value: string): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: current.follicleMeasurements.map((measurement) =>
          measurement.clientId === clientId ? { ...measurement, value } : measurement,
        ),
      }));
    },
    [setOvaryForSide],
  );

  const removeOvaryMeasurement = useCallback(
    (side: OvarySide, clientId: string): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: current.follicleMeasurements.filter(
          (measurement) => measurement.clientId !== clientId,
        ),
      }));
    },
    [setOvaryForSide],
  );

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
  }, [updateUterus]);

  const setDischargeNotes = useCallback((value: string): void => {
    updateUterus((current) => ({ ...current, dischargeNotes: value }));
    setErrors((current) => ({ ...current, uterus: { ...current.uterus, dischargeNotes: undefined } }));
  }, [updateUterus]);

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
    [updateUterus],
  );

  const removeFluidPocket = useCallback((clientId: string): void => {
    updateUterus((current) => ({
      ...current,
      fluidPockets: current.fluidPockets.filter((row) => row.clientId !== clientId),
    }));
  }, [updateUterus]);

  const applyBasicsValidation = useCallback((): boolean => {
    const nextErrors = validateBasics(date, time, isTimeClearable);
    setErrors((current) => ({ ...current, basics: nextErrors }));
    return !nextErrors.date && !nextErrors.time;
  }, [date, isTimeClearable, time]);

  const applyOvaryValidation = useCallback(
    (side: OvarySide): boolean => {
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
    const nextErrors = validateUterus(uterus);
    setErrors((current) => ({ ...current, uterus: nextErrors }));
    return !nextErrors.dischargeNotes && !nextErrors.fluidPockets;
  }, [uterus]);

  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      if (stepIndex === 0) {
        return applyBasicsValidation();
      }

      if (stepIndex === 1) {
        return applyOvaryValidation('right');
      }

      if (stepIndex === 2) {
        return applyOvaryValidation('left');
      }

      if (stepIndex === 3) {
        return applyUterusValidation();
      }

      return (
        applyBasicsValidation() &&
        applyOvaryValidation('right') &&
        applyOvaryValidation('left') &&
        applyUterusValidation()
      );
    },
    [applyBasicsValidation, applyOvaryValidation, applyUterusValidation],
  );

  const goNext = useCallback((): void => {
    if (!validateStep(currentStepIndex)) {
      return;
    }

    setCurrentStepIndex((current) => Math.min(current + 1, DAILY_LOG_WIZARD_STEPS.length - 1));
  }, [currentStepIndex, validateStep]);

  const goBack = useCallback((): void => {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  const goToStep = useCallback((stepIndex: number): void => {
    setCurrentStepIndex(Math.max(0, Math.min(stepIndex, DAILY_LOG_WIZARD_STEPS.length - 1)));
  }, []);

  const setDateValue = useCallback((value: string): void => {
    setDate(value);
    setErrors((current) => ({
      ...current,
      basics: {
        ...current.basics,
        date: undefined,
      },
    }));
  }, []);

  const setTimeValue = useCallback((value: string): void => {
    setTime(value);
    setErrors((current) => ({
      ...current,
      basics: {
        ...current.basics,
        time: undefined,
      },
    }));
  }, []);

  const save = useCallback(async (): Promise<void> => {
    const basicsValid = applyBasicsValidation();
    const rightOvaryValid = applyOvaryValidation('right');
    const leftOvaryValid = applyOvaryValidation('left');
    const uterusValid = applyUterusValidation();

    if (!basicsValid) {
      setCurrentStepIndex(0);
      return;
    }

    if (!rightOvaryValid) {
      setCurrentStepIndex(1);
      return;
    }

    if (!leftOvaryValid) {
      setCurrentStepIndex(2);
      return;
    }

    if (!uterusValid) {
      setCurrentStepIndex(3);
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
          notes,
          legacyOvulationDetected,
          ovulationSource,
        });

        if (logId) {
          await updateDailyLog(logId, payload);
        } else {
          if (payload.time == null) {
            throw new Error('Daily log time is required.');
          }

          await createDailyLog({
            id: newId(),
            mareId,
            ...payload,
            time: payload.time,
          });
        }

        onGoBack();
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
            setCurrentStepIndex(0);
            return;
          }

          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    applyBasicsValidation,
    applyOvaryValidation,
    applyUterusValidation,
    date,
    isEdit,
    time,
    leftOvary,
    legacyOvulationDetected,
    logId,
    mareId,
    notes,
    onGoBack,
    ovulationSource,
    rightOvary,
    runSave,
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
    currentStepTitle: DAILY_LOG_WIZARD_STEPS[currentStepIndex],
    date,
    time,
    teasingScore,
    rightOvary,
    leftOvary,
    uterus,
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
    setDate: setDateValue,
    setTime: setTimeValue,
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
    goNext,
    goBack,
    goToStep,
    save,
    requestDelete,
  };
}
