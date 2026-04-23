import { FLUID_LOCATION_VALUES } from '@/models/enums';
import { normalizeDailyLogTime } from '@/utils/dailyLogTime';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';

import { collectValidMeasurements } from './measurementUtils';
import type {
  BasicsErrors,
  DailyLogWizardOvaryDraft,
  DailyLogWizardUterusDraft,
  OvaryStepErrors,
  UterusStepErrors,
} from './types';

const FLUID_LOCATION_SET = new Set<string>(FLUID_LOCATION_VALUES);

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

export function validateUterus(uterus: DailyLogWizardUterusDraft): UterusStepErrors {
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

  return {
    dischargeNotes: dischargeNotesError,
    fluidPockets: fluidPocketsError,
  };
}
