import type { OvaryStructure } from '@/models/types';

import type {
  DailyLogWizardFollicleFinding,
  ScoreOption,
  TriStateOption,
  DailyLogWizardMeasurementDraft,
  DailyLogWizardOvaryDraft,
} from './types';

export type ParsedMeasurements = {
  values: number[];
  hasInvalid: boolean;
};

const FOLLICLE_MEASUREMENT_INPUT_PATTERN = /^\d*\.?\d*$/;
const PRIMARY_FINDING_STRUCTURE_BY_FINDING: Readonly<
  Partial<Record<DailyLogWizardFollicleFinding, OvaryStructure>>
> = {
  msf: 'multipleSmallFollicles',
  ahf: 'hemorrhagicAnovulatoryFollicle',
  cl: 'corpusLuteum',
};

const FINDING_BY_PRIMARY_STRUCTURE: Readonly<
  Partial<Record<OvaryStructure, DailyLogWizardFollicleFinding>>
> = {
  multipleSmallFollicles: 'msf',
  hemorrhagicAnovulatoryFollicle: 'ahf',
  corpusLuteum: 'cl',
};

function hasAtMostOneDecimalPlace(value: number): boolean {
  const scaled = value * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
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

export function toScoreOption(value: number | null | undefined): ScoreOption {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 5) {
    return '';
  }

  return String(value) as ScoreOption;
}

export function fromScoreOption(value: ScoreOption): number | null {
  if (!value) {
    return null;
  }

  return Number(value);
}

export function isPrimaryFindingStructure(value: OvaryStructure): boolean {
  return FINDING_BY_PRIMARY_STRUCTURE[value] != null;
}

export function removePrimaryFindingStructures(
  values: readonly OvaryStructure[],
): OvaryStructure[] {
  return values.filter((value) => !isPrimaryFindingStructure(value));
}

export function getPrimaryFindingStructure(
  finding: DailyLogWizardFollicleFinding,
): OvaryStructure | null {
  return PRIMARY_FINDING_STRUCTURE_BY_FINDING[finding] ?? null;
}

export function getOvaryFollicleFinding(
  draft: DailyLogWizardOvaryDraft,
): DailyLogWizardFollicleFinding {
  if (draft.follicleState === 'measured') {
    return 'measured';
  }

  const primaryStructures = draft.structures.filter(isPrimaryFindingStructure);
  if (primaryStructures.length !== 1) {
    return '';
  }

  return FINDING_BY_PRIMARY_STRUCTURE[primaryStructures[0]] ?? '';
}

export function parseMeasurementTextValue(value: string): number | null {
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

export function collectValidMeasurements(
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
