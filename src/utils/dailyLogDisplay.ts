import type { DailyLog, OvaryStructure } from '@/models/types';
import {
  formatCervicalFirmness,
  formatFollicleState,
  formatOvaryConsistency,
  formatOvaryStructure,
  formatUterineToneCategory,
} from './outcomeDisplay';

type OvarySide = 'right' | 'left';

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
  const consistency =
    side === 'right' ? log.rightOvaryConsistency ?? null : log.leftOvaryConsistency ?? null;
  const structures =
    side === 'right' ? log.rightOvaryStructures ?? [] : log.leftOvaryStructures ?? [];

  const hasStructuredData =
    ovulation != null ||
    follicleState != null ||
    measurements.length > 0 ||
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
  if (measurements.length > 0) {
    parts.push(`Measurements ${measurements.join(', ')} mm`);
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
