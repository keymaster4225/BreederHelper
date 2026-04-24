import type { DailyLogDetail, DailyLogOvulationSource } from '@/models/types';
import { normalizeDailyLogTime } from '@/utils/dailyLogTime';
import { newId } from '@/utils/id';

import { collectValidMeasurements, fromScoreOption, toScoreOption } from './measurementUtils';
import type {
  DailyLogWizardErrors,
  DailyLogWizardFlushDraft,
  DailyLogWizardFluidPocketDraft,
  DailyLogWizardLegacyNotes,
  DailyLogWizardOvaryDraft,
  DailyLogWizardUterusDraft,
  FlushDecision,
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

export function createEmptyFlushDraft(): DailyLogWizardFlushDraft {
  return {
    baseSolution: '',
    totalVolumeMl: '',
    notes: '',
    products: [
      {
        clientId: newId(),
        productName: 'Saline',
        dose: '',
        notes: '',
      },
    ],
  };
}

export function createEmptyErrors(): DailyLogWizardErrors {
  return {
    basics: {},
    rightOvary: {},
    leftOvary: {},
    uterus: {},
    flush: {},
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

function mapFlushDraft(record: DailyLogDetail): DailyLogWizardFlushDraft {
  if (!record.uterineFlush) {
    return createEmptyFlushDraft();
  }

  return {
    id: record.uterineFlush.id,
    baseSolution: record.uterineFlush.baseSolution,
    totalVolumeMl: String(record.uterineFlush.totalVolumeMl),
    notes: record.uterineFlush.notes ?? '',
    createdAt: record.uterineFlush.createdAt,
    updatedAt: record.uterineFlush.updatedAt,
    products: record.uterineFlush.products.map((product) => ({
      clientId: product.id,
      id: product.id,
      productName: product.productName,
      dose: product.dose,
      notes: product.notes ?? '',
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    })),
  };
}

function inferFlushDecision(record: DailyLogDetail): FlushDecision {
  if (record.uterineFlush) {
    return 'yes';
  }

  if (record.uterineFluidPockets.length > 0) {
    return 'no';
  }

  return null;
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
    time: record.time ?? '',
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
    flushDecision: inferFlushDecision(record),
    flush: mapFlushDraft(record),
    notes: record.notes ?? '',
    legacyNotes,
    legacyOvulationDetected: record.ovulationDetected ?? null,
    ovulationSource: inferInitialOvulationSource(record),
  };
}

type BuildDailyLogPayloadArgs = {
  isEdit: boolean;
  date: string;
  time: string;
  teasingScore: ReturnType<typeof toScoreOption>;
  rightOvary: DailyLogWizardOvaryDraft;
  leftOvary: DailyLogWizardOvaryDraft;
  uterus: DailyLogWizardUterusDraft;
  flushDecision: FlushDecision;
  flush: DailyLogWizardFlushDraft;
  hadPersistedFlush: boolean;
  notes: string;
  legacyOvulationDetected: boolean | null;
  ovulationSource: DailyLogOvulationSource;
};

export function buildDailyLogPayload({
  isEdit,
  date,
  time,
  teasingScore,
  rightOvary,
  leftOvary,
  uterus,
  flushDecision,
  flush,
  hadPersistedFlush,
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

  const hasFluidPockets = uterus.fluidPockets.length > 0;
  const trimmedFlushProducts = flush.products
    .map((product) => ({
      id: product.id,
      productName: product.productName.trim(),
      dose: product.dose.trim(),
      notes: product.notes.trim() || null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }))
    .filter((product) => product.productName || product.dose || product.notes);
  const parsedFlushVolume = Number(flush.totalVolumeMl.trim());
  const uterineFlush =
    hasFluidPockets && flushDecision === 'yes'
      ? {
          id: flush.id,
          baseSolution: flush.baseSolution.trim(),
          totalVolumeMl: parsedFlushVolume,
          notes: flush.notes.trim() || null,
          products: trimmedFlushProducts,
          createdAt: flush.createdAt,
          updatedAt: flush.updatedAt,
        }
      : hadPersistedFlush
        ? null
        : undefined;

  return {
    date: date.trim(),
    time: normalizeDailyLogTime(time),
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
    uterineFlush,
  };
}
