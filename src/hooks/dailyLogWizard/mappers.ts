import type { DailyLogDetail, DailyLogOvulationSource } from '@/models/types';
import { newId } from '@/utils/id';

import { collectValidMeasurements, fromScoreOption, toScoreOption } from './measurementUtils';
import type {
  DailyLogWizardErrors,
  DailyLogWizardFluidPocketDraft,
  DailyLogWizardLegacyNotes,
  DailyLogWizardOvaryDraft,
  DailyLogWizardUterusDraft,
} from './types';

export function createEmptyOvaryDraft(): DailyLogWizardOvaryDraft {
  return {
    ovulation: null,
    follicleState: null,
    follicleMeasurements: [],
    consistency: null,
    structures: [],
  };
}

export function createEmptyUterusDraft(): DailyLogWizardUterusDraft {
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

export function createEmptyErrors(): DailyLogWizardErrors {
  return {
    basics: {},
    rightOvary: {},
    leftOvary: {},
    uterus: {},
  };
}

function mapMeasurementsToDraftRows(values: readonly number[] | undefined) {
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

export function hydrateDailyLogWizardRecord(record: DailyLogDetail) {
  const legacyNotes: DailyLogWizardLegacyNotes = {
    rightOvary: record.rightOvary ?? null,
    leftOvary: record.leftOvary ?? null,
    uterineTone: record.uterineTone ?? null,
  };

  return {
    date: record.date,
    teasingScore: toScoreOption(record.teasingScore),
    rightOvary: {
      ovulation: record.rightOvaryOvulation ?? null,
      follicleState: record.rightOvaryFollicleState ?? null,
      follicleMeasurements: mapMeasurementsToDraftRows(record.rightOvaryFollicleMeasurementsMm),
      consistency: record.rightOvaryConsistency ?? null,
      structures: [...(record.rightOvaryStructures ?? [])],
    },
    leftOvary: {
      ovulation: record.leftOvaryOvulation ?? null,
      follicleState: record.leftOvaryFollicleState ?? null,
      follicleMeasurements: mapMeasurementsToDraftRows(record.leftOvaryFollicleMeasurementsMm),
      consistency: record.leftOvaryConsistency ?? null,
      structures: [...(record.leftOvaryStructures ?? [])],
    },
    uterus: {
      edema: toScoreOption(record.edema),
      uterineToneCategory: record.uterineToneCategory ?? null,
      cervicalFirmness: record.cervicalFirmness ?? null,
      dischargeObserved: record.dischargeObserved ?? null,
      dischargeNotes: record.dischargeNotes ?? '',
      uterineCysts: record.uterineCysts ?? '',
      fluidPockets: mapFluidPockets(record),
    },
    notes: record.notes ?? '',
    legacyNotes,
    legacyOvulationDetected: record.ovulationDetected ?? null,
    ovulationSource: inferInitialOvulationSource(record),
  };
}

type BuildDailyLogPayloadArgs = {
  isEdit: boolean;
  date: string;
  teasingScore: ReturnType<typeof toScoreOption>;
  rightOvary: DailyLogWizardOvaryDraft;
  leftOvary: DailyLogWizardOvaryDraft;
  uterus: DailyLogWizardUterusDraft;
  notes: string;
  legacyOvulationDetected: boolean | null;
  ovulationSource: DailyLogOvulationSource;
};

export function buildDailyLogPayload({
  isEdit,
  date,
  teasingScore,
  rightOvary,
  leftOvary,
  uterus,
  notes,
  legacyOvulationDetected,
  ovulationSource,
}: BuildDailyLogPayloadArgs) {
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

  return {
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
    ovulationDetected: resolvedOvulationSource === 'legacy' ? legacyOvulationDetected : undefined,
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
}
