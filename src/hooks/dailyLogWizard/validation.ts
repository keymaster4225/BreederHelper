import { FLUID_LOCATION_VALUES } from '@/models/enums';
import { normalizeDailyLogTime } from '@/utils/dailyLogTime';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';

import { collectValidMeasurements } from './measurementUtils';
import type {
  BasicsErrors,
  DailyLogWizardFlushDraft,
  DailyLogWizardOvaryDraft,
  DailyLogWizardUterusDraft,
  FlushDecision,
  FlushStepErrors,
  OvaryStepErrors,
  UterusStepErrors,
} from './types';

const FLUID_LOCATION_SET = new Set<string>(FLUID_LOCATION_VALUES);
const FLUSH_VOLUME_PATTERN = /^\d+(\.\d)?$/;

export function validateBasics(
  date: string,
  time: string,
  allowUntimedTime = false,
): BasicsErrors {
  const trimmedTime = time.trim();
  let timeError: string | undefined;

  if (!trimmedTime) {
    if (!allowUntimedTime) {
      timeError = 'Time is required.';
    }
  } else if (normalizeDailyLogTime(trimmedTime) === null) {
    timeError = 'Time must be a valid HH:MM value.';
  }

  return {
    date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    time: timeError,
  };
}

export function validateOvary(draft: DailyLogWizardOvaryDraft): OvaryStepErrors {
  let measurementsError: string | undefined;

  if (draft.follicleState === 'measured') {
    const measurements = collectValidMeasurements(draft.follicleMeasurements);
    if (measurements.values.length === 0) {
      measurementsError = 'Enter a valid follicle size (0-100 mm, up to 1 decimal place).';
    } else if (measurements.hasInvalid) {
      measurementsError = 'Follicle size must be between 0 and 100 mm with at most 1 decimal place.';
    }
  }

  return {
    measurements: measurementsError,
  };
}

function hasAtMostOneDecimalPlace(value: number): boolean {
  const scaled = value * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

export function validateUterus(
  uterus: DailyLogWizardUterusDraft,
  flushDecision: FlushDecision = null,
): UterusStepErrors {
  let dischargeNotesError: string | undefined;
  let fluidPocketsError: string | undefined;
  let flushDecisionError: string | undefined;

  if (uterus.dischargeObserved === true && !uterus.dischargeNotes.trim()) {
    dischargeNotesError = 'Discharge notes are required when discharge is observed.';
  }

  for (const row of uterus.fluidPockets) {
    if (!Number.isInteger(row.depthMm) || row.depthMm <= 0 || !FLUID_LOCATION_SET.has(row.location)) {
      fluidPocketsError = 'Each fluid pocket needs a valid depth and location.';
      break;
    }
  }

  if (uterus.fluidPockets.length > 0 && flushDecision == null) {
    flushDecisionError = 'Choose Yes or No for same-visit flush.';
  }

  return {
    dischargeNotes: dischargeNotesError,
    fluidPockets: fluidPocketsError,
    flushDecision: flushDecisionError,
  };
}

export function validateFlush(flush: DailyLogWizardFlushDraft): FlushStepErrors {
  const errors: FlushStepErrors = {};
  const volumeText = flush.totalVolumeMl.trim();
  const volume = Number(volumeText);

  if (!flush.baseSolution.trim()) {
    errors.baseSolution = 'Base solution is required.';
  }

  if (
    !volumeText ||
    !FLUSH_VOLUME_PATTERN.test(volumeText) ||
    !Number.isFinite(volume) ||
    volume <= 0 ||
    !hasAtMostOneDecimalPlace(volume)
  ) {
    errors.totalVolumeMl = 'Total volume must be greater than 0 with at most 1 decimal place.';
  }

  if (flush.products.length === 0) {
    errors.products = 'Add at least one flush product.';
  } else if (
    flush.products.some((product) => !product.productName.trim() || !product.dose.trim())
  ) {
    errors.products = 'Each flush product needs a name and dose.';
  }

  return errors;
}
