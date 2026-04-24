import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { DailyLogDetail, DailyLogOvulationSource, FluidLocation, FollicleState, OvaryConsistency, OvaryStructure, UterineToneCategory, CervicalFirmness } from '@/models/types';
import { createDailyLog, deleteDailyLog, getDailyLogById, updateDailyLog } from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { getCurrentTimeHHMM } from '@/utils/dailyLogTime';
import { toLocalDate } from '@/utils/dates';
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
  createEmptyFlushDraft,
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
  validateFlush,
  validateOvary,
  validateUterus,
} from './dailyLogWizard/validation';
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
  const hadPersistedFlushRef = useRef(false);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [date, setDate] = useState<string>(() => (isEdit ? '' : toLocalDate(today)));
  const [time, setTime] = useState<string>(() => (isEdit ? '' : getCurrentTimeHHMM(today)));
  const [teasingScore, setTeasingScore] = useState<ScoreOption>('');
  const [rightOvary, setRightOvary] = useState<DailyLogWizardOvaryDraft>(createEmptyOvaryDraft);
  const [leftOvary, setLeftOvary] = useState<DailyLogWizardOvaryDraft>(createEmptyOvaryDraft);
  const [uterus, setUterus] = useState<DailyLogWizardUterusDraft>(createEmptyUterusDraft);
  const [flushDecision, setFlushDecisionState] = useState<FlushDecision>(null);
  const [flush, setFlush] = useState<DailyLogWizardFlushDraft>(createEmptyFlushDraft);
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
    setDate(hydrated.date);
    setTime(hydrated.time);
    setTeasingScore(hydrated.teasingScore);
    setRightOvary(hydrated.rightOvary);
    setLeftOvary(hydrated.leftOvary);
    setUterus(hydrated.uterus);
    setFlushDecisionState(hydrated.flushDecision);
    setFlush(hydrated.flush);
    hadPersistedFlushRef.current = record.uterineFlush != null;
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
      setFlushDecisionState(null);
      setFlush(createEmptyFlushDraft());
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
  }, [flushDecision, updateUterus, uterus.fluidPockets]);

  const setFlushDecision = useCallback(
    (value: FlushDecision): void => {
      if (value === 'yes' && flush.products.length === 0) {
        setFlush(createEmptyFlushDraft());
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
    [flush.products.length, flushDecision],
  );

  const updateFlush = useCallback(
    (updater: (current: DailyLogWizardFlushDraft) => DailyLogWizardFlushDraft): void => {
      setFlush((current) => updater(current));
      setErrors((current) => ({ ...current, flush: {} }));
    },
    [],
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
