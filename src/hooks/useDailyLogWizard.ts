import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { FLUID_LOCATION_VALUES } from '@/models/enums';
import type {
  CervicalFirmness,
  DailyLogDetail,
  FluidLocation,
  FollicleState,
  OvaryConsistency,
  OvaryStructure,
  UterineToneCategory,
} from '@/models/types';
import {
  createDailyLog,
  deleteDailyLog,
  getDailyLogById,
  type DailyLogOvulationSource,
  updateDailyLog,
} from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { toLocalDate } from '@/utils/dates';
import { newId } from '@/utils/id';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

export const DAILY_LOG_WIZARD_STEPS = [
  'Basics',
  'Right Ovary',
  'Left Ovary',
  'Uterus',
  'Review',
] as const;

export type ScoreOption = '' | '0' | '1' | '2' | '3' | '4' | '5';

export type TriStateOption = 'unknown' | 'no' | 'yes';

export const SCORE_OPTIONS: readonly { label: string; value: ScoreOption }[] = [
  { label: 'N/A', value: '' },
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
] as const;

export const TRI_STATE_OPTIONS: readonly { label: string; value: TriStateOption }[] = [
  { label: 'Unknown', value: 'unknown' },
  { label: 'No', value: 'no' },
  { label: 'Yes', value: 'yes' },
] as const;

const FLUID_LOCATION_SET = new Set<string>(FLUID_LOCATION_VALUES);

type OvarySide = 'right' | 'left';

export type DailyLogWizardMeasurementDraft = {
  clientId: string;
  value: string;
};

export type DailyLogWizardOvaryDraft = {
  ovulation: boolean | null;
  follicleState: FollicleState | null;
  follicleMeasurements: DailyLogWizardMeasurementDraft[];
  consistency: OvaryConsistency | null;
  structures: OvaryStructure[];
};

export type DailyLogWizardFluidPocketDraft = {
  clientId: string;
  id?: string;
  depthMm: number;
  location: FluidLocation;
  createdAt?: string;
  updatedAt?: string;
};

export type DailyLogWizardUterusDraft = {
  edema: ScoreOption;
  uterineToneCategory: UterineToneCategory | null;
  cervicalFirmness: CervicalFirmness | null;
  dischargeObserved: boolean | null;
  dischargeNotes: string;
  uterineCysts: string;
  fluidPockets: DailyLogWizardFluidPocketDraft[];
};

export type DailyLogWizardLegacyNotes = {
  rightOvary: string | null;
  leftOvary: string | null;
  uterineTone: string | null;
};

type BasicsErrors = {
  date?: string;
};

type OvaryStepErrors = {
  measurements?: string;
};

type UterusStepErrors = {
  dischargeNotes?: string;
  fluidPockets?: string;
};

export type DailyLogWizardErrors = {
  basics: BasicsErrors;
  rightOvary: OvaryStepErrors;
  leftOvary: OvaryStepErrors;
  uterus: UterusStepErrors;
};

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

function createEmptyOvaryDraft(): DailyLogWizardOvaryDraft {
  return {
    ovulation: null,
    follicleState: null,
    follicleMeasurements: [],
    consistency: null,
    structures: [],
  };
}

function createEmptyUterusDraft(): DailyLogWizardUterusDraft {
  return {
    edema: '',
    uterineToneCategory: null,
    cervicalFirmness: null,
    dischargeObserved: null,
    dischargeNotes: '',
    uterineCysts: '',
    fluidPockets: [],
  };
}

function createEmptyErrors(): DailyLogWizardErrors {
  return {
    basics: {},
    rightOvary: {},
    leftOvary: {},
    uterus: {},
  };
}

export function toTriStateOption(value: boolean | null | undefined): TriStateOption {
  if (value === true) {
    return 'yes';
  }

  if (value === false) {
    return 'no';
  }

  return 'unknown';
}

export function fromTriStateOption(value: TriStateOption): boolean | null {
  if (value === 'yes') {
    return true;
  }

  if (value === 'no') {
    return false;
  }

  return null;
}

function toScoreOption(value: number | null | undefined): ScoreOption {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 5) {
    return '';
  }

  return String(value) as ScoreOption;
}

function fromScoreOption(value: ScoreOption): number | null {
  if (!value) {
    return null;
  }

  return Number(value);
}

type ParsedMeasurements = {
  values: number[];
  hasInvalid: boolean;
};

const FOLLICLE_MEASUREMENT_INPUT_PATTERN = /^\d*\.?\d*$/;

function hasAtMostOneDecimalPlace(value: number): boolean {
  const scaled = value * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function parseMeasurementTextValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.') {
    return null;
  }

  if (!FOLLICLE_MEASUREMENT_INPUT_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100 || !hasAtMostOneDecimalPlace(parsed)) {
    return null;
  }

  return parsed;
}

function collectValidMeasurements(
  rows: readonly DailyLogWizardMeasurementDraft[],
): ParsedMeasurements {
  const values: number[] = [];
  let hasInvalid = false;

  for (const row of rows) {
    const trimmed = row.value.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = parseMeasurementTextValue(trimmed);
    if (parsed == null) {
      hasInvalid = true;
      continue;
    }

    values.push(parsed);
  }

  return { values, hasInvalid };
}

function mapMeasurementsToDraftRows(values: readonly number[] | undefined): DailyLogWizardMeasurementDraft[] {
  if (!values || values.length === 0) {
    return [];
  }

  return values.map((value) => ({
    clientId: newId(),
    value: String(value),
  }));
}

function mapFluidPockets(record: DailyLogDetail): DailyLogWizardFluidPocketDraft[] {
  return record.uterineFluidPockets.map((pocket) => ({
    clientId: pocket.id,
    id: pocket.id,
    depthMm: pocket.depthMm,
    location: pocket.location,
    createdAt: pocket.createdAt,
    updatedAt: pocket.updatedAt,
  }));
}

function inferInitialOvulationSource(record: DailyLogDetail): DailyLogOvulationSource {
  if (record.rightOvaryOvulation == null && record.leftOvaryOvulation == null) {
    return 'legacy';
  }

  return 'structured';
}

export function useDailyLogWizard({
  mareId,
  logId,
  onGoBack,
  setTitle,
}: UseDailyLogWizardArgs) {
  const isEdit = Boolean(logId);
  const today = useMemo(() => new Date(), []);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [date, setDate] = useState<string>(() => (isEdit ? '' : toLocalDate(today)));
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
    setTitle(isEdit ? 'Edit Daily Log' : 'Add Daily Log');
  }, [isEdit, setTitle]);

  const hydrateFromRecord = useCallback((record: DailyLogDetail): void => {
    setDate(record.date);
    setTeasingScore(toScoreOption(record.teasingScore));

    setRightOvary({
      ovulation: record.rightOvaryOvulation ?? null,
      follicleState: record.rightOvaryFollicleState ?? null,
      follicleMeasurements: mapMeasurementsToDraftRows(record.rightOvaryFollicleMeasurementsMm),
      consistency: record.rightOvaryConsistency ?? null,
      structures: [...(record.rightOvaryStructures ?? [])],
    });
    setLeftOvary({
      ovulation: record.leftOvaryOvulation ?? null,
      follicleState: record.leftOvaryFollicleState ?? null,
      follicleMeasurements: mapMeasurementsToDraftRows(record.leftOvaryFollicleMeasurementsMm),
      consistency: record.leftOvaryConsistency ?? null,
      structures: [...(record.leftOvaryStructures ?? [])],
    });
    setUterus({
      edema: toScoreOption(record.edema),
      uterineToneCategory: record.uterineToneCategory ?? null,
      cervicalFirmness: record.cervicalFirmness ?? null,
      dischargeObserved: record.dischargeObserved ?? null,
      dischargeNotes: record.dischargeNotes ?? '',
      uterineCysts: record.uterineCysts ?? '',
      fluidPockets: mapFluidPockets(record),
    });
    setNotes(record.notes ?? '');

    setLegacyNotes({
      rightOvary: record.rightOvary ?? null,
      leftOvary: record.leftOvary ?? null,
      uterineTone: record.uterineTone ?? null,
    });
    setLegacyOvulationDetected(record.ovulationDetected ?? null);
    setOvulationSource(inferInitialOvulationSource(record));
    setErrors(createEmptyErrors());
  }, []);

  useEffect(() => {
    if (!logId) {
      setIsLoading(false);
      setCurrentStepIndex(0);
      return;
    }

    void runLoad(
      async () => {
        const record = await getDailyLogById(logId);
        if (!record) {
          Alert.alert('Log not found', 'This daily log no longer exists.');
          onGoBack();
          return;
        }

        hydrateFromRecord(record);
        setCurrentStepIndex(DAILY_LOG_WIZARD_STEPS.length - 1);
      },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unable to load daily log.';
          Alert.alert('Load error', message);
          onGoBack();
        },
      },
    );
  }, [hydrateFromRecord, logId, onGoBack, runLoad, setIsLoading]);

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

  const setEdema = useCallback(
    (value: ScoreOption): void => {
      updateUterus((current) => ({ ...current, edema: value }));
    },
    [updateUterus],
  );

  const setUterineToneCategory = useCallback(
    (value: UterineToneCategory | null): void => {
      updateUterus((current) => ({ ...current, uterineToneCategory: value }));
    },
    [updateUterus],
  );

  const setCervicalFirmness = useCallback(
    (value: CervicalFirmness | null): void => {
      updateUterus((current) => ({ ...current, cervicalFirmness: value }));
    },
    [updateUterus],
  );

  const setDischargeObserved = useCallback(
    (value: boolean | null): void => {
      updateUterus((current) => ({ ...current, dischargeObserved: value }));
      setErrors((current) => ({ ...current, uterus: { ...current.uterus, dischargeNotes: undefined } }));
    },
    [updateUterus],
  );

  const setDischargeNotes = useCallback(
    (value: string): void => {
      updateUterus((current) => ({ ...current, dischargeNotes: value }));
      setErrors((current) => ({ ...current, uterus: { ...current.uterus, dischargeNotes: undefined } }));
    },
    [updateUterus],
  );

  const setUterineCysts = useCallback(
    (value: string): void => {
      updateUterus((current) => ({ ...current, uterineCysts: value }));
    },
    [updateUterus],
  );

  const upsertFluidPocket = useCallback(
    (value: UpsertFluidPocketInput, clientId?: string): void => {
      const nextDepth = value.depthMm;
      const nextLocation = value.location;

      updateUterus((current) => {
        if (!clientId) {
          return {
            ...current,
            fluidPockets: [
              ...current.fluidPockets,
              {
                clientId: newId(),
                depthMm: nextDepth,
                location: nextLocation,
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
            depthMm: nextDepth,
            location: nextLocation,
          };
        });

        return updated ? { ...current, fluidPockets: nextRows } : current;
      });

      setErrors((current) => ({ ...current, uterus: { ...current.uterus, fluidPockets: undefined } }));
    },
    [updateUterus],
  );

  const removeFluidPocket = useCallback(
    (clientId: string): void => {
      updateUterus((current) => ({
        ...current,
        fluidPockets: current.fluidPockets.filter((row) => row.clientId !== clientId),
      }));
    },
    [updateUterus],
  );

  const validateBasicsStep = useCallback((): boolean => {
    const nextErrors: BasicsErrors = {
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };
    setErrors((current) => ({ ...current, basics: nextErrors }));
    return !nextErrors.date;
  }, [date]);

  const validateOvaryStep = useCallback(
    (side: OvarySide): boolean => {
      const draft = side === 'right' ? rightOvary : leftOvary;
      let measurementsError: string | undefined;

      if (draft.follicleState === 'measured') {
        const measurements = collectValidMeasurements(draft.follicleMeasurements);
        if (measurements.values.length === 0) {
          measurementsError = 'Enter a valid follicle size (0-100 mm, up to 1 decimal place).';
        } else if (measurements.hasInvalid) {
          measurementsError = 'Follicle size must be between 0 and 100 mm with at most 1 decimal place.';
        }
      }

      const stepErrors: OvaryStepErrors = {
        measurements: measurementsError,
      };
      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: stepErrors,
      }));

      return !measurementsError;
    },
    [leftOvary, rightOvary],
  );

  const validateUterusStep = useCallback((): boolean => {
    let dischargeNotesError: string | undefined;
    let fluidPocketsError: string | undefined;

    if (uterus.dischargeObserved === true && !uterus.dischargeNotes.trim()) {
      dischargeNotesError = 'Discharge notes are required when discharge is observed.';
    }

    for (const row of uterus.fluidPockets) {
      if (!Number.isInteger(row.depthMm) || row.depthMm <= 0 || !FLUID_LOCATION_SET.has(row.location)) {
        fluidPocketsError = 'Each fluid pocket needs a valid depth and location.';
        break;
      }
    }

    const nextErrors: UterusStepErrors = {
      dischargeNotes: dischargeNotesError,
      fluidPockets: fluidPocketsError,
    };
    setErrors((current) => ({ ...current, uterus: nextErrors }));
    return !dischargeNotesError && !fluidPocketsError;
  }, [uterus]);

  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      if (stepIndex === 0) {
        return validateBasicsStep();
      }

      if (stepIndex === 1) {
        return validateOvaryStep('right');
      }

      if (stepIndex === 2) {
        return validateOvaryStep('left');
      }

      if (stepIndex === 3) {
        return validateUterusStep();
      }

      return validateBasicsStep() && validateOvaryStep('right') && validateOvaryStep('left') && validateUterusStep();
    },
    [validateBasicsStep, validateOvaryStep, validateUterusStep],
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

  const save = useCallback(async (): Promise<void> => {
    const basicsValid = validateBasicsStep();
    const rightOvaryValid = validateOvaryStep('right');
    const leftOvaryValid = validateOvaryStep('left');
    const uterusValid = validateUterusStep();

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
        const rightMeasurements = collectValidMeasurements(rightOvary.follicleMeasurements).values;
        const leftMeasurements = collectValidMeasurements(leftOvary.follicleMeasurements).values;

        const shouldPreserveLegacyOvulation =
          isEdit &&
          ovulationSource === 'legacy' &&
          rightOvary.ovulation == null &&
          leftOvary.ovulation == null;
        const resolvedOvulationSource: DailyLogOvulationSource = shouldPreserveLegacyOvulation
          ? 'legacy'
          : 'structured';

        const payload = {
          date: date.trim(),
          teasingScore: fromScoreOption(teasingScore),
          rightOvaryOvulation: rightOvary.ovulation,
          rightOvaryFollicleState: rightOvary.follicleState,
          rightOvaryFollicleMeasurementsMm:
            rightOvary.follicleState === 'measured' ? rightMeasurements : [],
          rightOvaryConsistency: rightOvary.consistency,
          rightOvaryStructures: rightOvary.structures,
          leftOvaryOvulation: leftOvary.ovulation,
          leftOvaryFollicleState: leftOvary.follicleState,
          leftOvaryFollicleMeasurementsMm:
            leftOvary.follicleState === 'measured' ? leftMeasurements : [],
          leftOvaryConsistency: leftOvary.consistency,
          leftOvaryStructures: leftOvary.structures,
          ovulationSource: resolvedOvulationSource,
          ovulationDetected:
            resolvedOvulationSource === 'legacy' ? legacyOvulationDetected : undefined,
          edema: fromScoreOption(uterus.edema),
          uterineToneCategory: uterus.uterineToneCategory,
          cervicalFirmness: uterus.cervicalFirmness,
          dischargeObserved: uterus.dischargeObserved,
          dischargeNotes: uterus.dischargeNotes.trim() || null,
          uterineCysts: uterus.uterineCysts.trim() || null,
          notes: notes.trim() || null,
          uterineFluidPockets: uterus.fluidPockets.map((row) => ({
            id: row.id,
            depthMm: row.depthMm,
            location: row.location,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        };

        if (logId) {
          await updateDailyLog(logId, payload);
        } else {
          await createDailyLog({
            id: newId(),
            mareId,
            ...payload,
          });
        }

        onGoBack();
      },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to save daily log.';
          if (message.toLowerCase().includes('unique')) {
            Alert.alert('Duplicate date', 'A daily log already exists for this mare on that date.');
            return;
          }

          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    date,
    isEdit,
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
    validateBasicsStep,
    validateOvaryStep,
    validateUterusStep,
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
            onError: (err: unknown) => {
              const message = err instanceof Error ? err.message : 'Failed to delete daily log.';
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
    teasingScore,
    rightOvary,
    leftOvary,
    uterus,
    notes,
    legacyNotes,
    legacyOvulationDetected,
    ovulationSource,
    errors,
    today,
    isLoading,
    isSaving,
    isDeleting,
    setDate: setDateValue,
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
