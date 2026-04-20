import {
  BREEDING_METHOD_LABELS,
  DOSE_EVENT_TYPE_LABELS,
  FOAL_COLOR_LABELS,
  FOAL_SEX_LABELS,
  FOALING_OUTCOME_LABELS,
} from '@/models/enums';
import { DoseEventType } from '@/models/types';
import { colors } from '@/theme';

export { DOSE_EVENT_TYPE_LABELS };

export function formatDoseEventType(type: DoseEventType): string {
  return DOSE_EVENT_TYPE_LABELS[type];
}

export function getOutcomeColor(outcome: string): string {
  if (outcome === 'liveFoal') return colors.pregnant;
  if (outcome === 'stillbirth' || outcome === 'aborted') return colors.loss;
  return colors.onSurface;
}

export function formatBreedingMethod(method: string): string {
  return BREEDING_METHOD_LABELS[method as keyof typeof BREEDING_METHOD_LABELS] ?? method;
}

export function formatOutcome(outcome: string): string {
  return FOALING_OUTCOME_LABELS[outcome as keyof typeof FOALING_OUTCOME_LABELS] ?? 'Unknown';
}

export function formatFoalColor(color: string): string {
  return FOAL_COLOR_LABELS[color as keyof typeof FOAL_COLOR_LABELS] ?? color;
}

export function formatFoalSex(sex: string): string {
  return FOAL_SEX_LABELS[sex as keyof typeof FOAL_SEX_LABELS] ?? sex;
}

export function getFoalSexColor(sex: string): string | null {
  if (sex === 'colt') return colors.colt;
  if (sex === 'filly') return colors.filly;
  return null;
}
