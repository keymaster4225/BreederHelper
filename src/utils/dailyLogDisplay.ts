import type { DailyLog, OvaryStructure } from '@/models/types';
import {
  formatCervicalFirmness,
  formatFollicleState,
  formatOvaryConsistency,
  formatOvaryStructure,
  formatUterineToneCategory,
} from './outcomeDisplay';
import { sortMeasurementsDesc } from './follicleMeasurements';

type OvarySide = 'right' | 'left';

export type DailyLogDetailLine = {
  readonly label: string;
  readonly value: string;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function formatOvaryStructures(structures: readonly OvaryStructure[] | null | undefined): string {
  if (!structures || structures.length === 0) {
    return '';
  }

  return structures.map((value) => formatOvaryStructure(value)).join(', ');
}

function buildStructuredOvarySummary(log: DailyLog, side: OvarySide): string {
  const ovulation =
    side === 'right' ? log.rightOvaryOvulation ?? null : log.leftOvaryOvulation ?? null;
  const follicleState =
    side === 'right'
      ? log.rightOvaryFollicleState ?? null
      : log.leftOvaryFollicleState ?? null;
  const measurements =
    side === 'right'
      ? log.rightOvaryFollicleMeasurementsMm ?? []
      : log.leftOvaryFollicleMeasurementsMm ?? [];
  const sortedMeasurements = sortMeasurementsDesc(measurements);
  const consistency =
    side === 'right' ? log.rightOvaryConsistency ?? null : log.leftOvaryConsistency ?? null;
  const structures =
    side === 'right' ? log.rightOvaryStructures ?? [] : log.leftOvaryStructures ?? [];

  const hasStructuredData =
    ovulation != null ||
    follicleState != null ||
    sortedMeasurements.length > 0 ||
    consistency != null ||
    structures.length > 0;

  if (!hasStructuredData) {
    return '';
  }

  const parts: string[] = [];
  if (ovulation != null) {
    parts.push(`Ovulation ${ovulation ? 'Yes' : 'No'}`);
  }
  if (follicleState) {
    parts.push(`Follicle ${formatFollicleState(follicleState)}`);
  }
  if (sortedMeasurements.length > 0) {
    parts.push(`Follicles ${sortedMeasurements.join(', ')} mm`);
  }
  if (consistency) {
    parts.push(`Consistency ${formatOvaryConsistency(consistency)}`);
  }
  const structuresText = formatOvaryStructures(structures);
  if (structuresText) {
    parts.push(`Structures ${structuresText}`);
  }

  return parts.join(' • ');
}

function buildStructuredOvaryDetails(log: DailyLog, side: OvarySide): DailyLogDetailLine[] {
  const ovulation =
    side === 'right' ? log.rightOvaryOvulation ?? null : log.leftOvaryOvulation ?? null;
  const follicleState =
    side === 'right'
      ? log.rightOvaryFollicleState ?? null
      : log.leftOvaryFollicleState ?? null;
  const measurements =
    side === 'right'
      ? log.rightOvaryFollicleMeasurementsMm ?? []
      : log.leftOvaryFollicleMeasurementsMm ?? [];
  const sortedMeasurements = sortMeasurementsDesc(measurements);
  const consistency =
    side === 'right' ? log.rightOvaryConsistency ?? null : log.leftOvaryConsistency ?? null;
  const structures =
    side === 'right' ? log.rightOvaryStructures ?? [] : log.leftOvaryStructures ?? [];

  const rows: DailyLogDetailLine[] = [];
  if (ovulation != null) {
    rows.push({ label: 'Ovulation', value: ovulation ? 'Yes' : 'No' });
  }
  if (sortedMeasurements.length > 0) {
    rows.push({
      label: 'Follicles',
      value: sortedMeasurements.map((value) => `${value} mm`).join(', '),
    });
  } else if (follicleState) {
    rows.push({ label: 'Follicle', value: formatFollicleState(follicleState) });
  }
  if (consistency) {
    rows.push({ label: 'Consistency', value: formatOvaryConsistency(consistency) });
  }
  const structuresText = formatOvaryStructures(structures);
  if (structuresText) {
    rows.push({ label: 'Structures', value: structuresText });
  }

  return rows;
}

function appendCysts(baseSummary: string, uterineCysts: string | null | undefined): string {
  if (!hasText(uterineCysts)) {
    return baseSummary;
  }

  const cystText = `Cysts: ${uterineCysts?.trim()}`;
  if (!baseSummary) {
    return cystText;
  }

  return `${baseSummary} • ${cystText}`;
}

export function buildOvarySummary(log: DailyLog, side: OvarySide): string {
  const structuredSummary = buildStructuredOvarySummary(log, side);
  if (structuredSummary) {
    return structuredSummary;
  }

  const legacyValue = side === 'right' ? log.rightOvary : log.leftOvary;
  return legacyValue?.trim() ?? '';
}

export function buildOvaryDetailLines(log: DailyLog, side: OvarySide): DailyLogDetailLine[] {
  const structuredRows = buildStructuredOvaryDetails(log, side);
  if (structuredRows.length > 0) {
    return structuredRows;
  }

  const legacyValue = side === 'right' ? log.rightOvary : log.leftOvary;
  if (!hasText(legacyValue)) {
    return [];
  }

  return [{ label: 'Notes', value: legacyValue?.trim() ?? '' }];
}

export function buildUterusSummary(log: DailyLog): string {
  const hasStructuredUterusData =
    log.uterineToneCategory != null ||
    log.cervicalFirmness != null ||
    log.dischargeObserved != null ||
    hasText(log.dischargeNotes);

  if (!hasStructuredUterusData) {
    return appendCysts(log.uterineTone?.trim() ?? '', log.uterineCysts);
  }

  const parts: string[] = [];
  if (log.uterineToneCategory) {
    parts.push(`Tone ${formatUterineToneCategory(log.uterineToneCategory)}`);
  }
  if (log.cervicalFirmness) {
    parts.push(`Cervix ${formatCervicalFirmness(log.cervicalFirmness)}`);
  }
  if (log.dischargeObserved != null) {
    parts.push(`Discharge ${log.dischargeObserved ? 'Yes' : 'No'}`);
  }
  if (log.dischargeObserved === true && hasText(log.dischargeNotes)) {
    parts.push(`Discharge notes ${log.dischargeNotes?.trim()}`);
  }

  return appendCysts(parts.join(' • '), log.uterineCysts);
}
