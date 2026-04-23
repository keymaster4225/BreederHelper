import {
  BREEDING_METHOD_LABELS,
  CERVICAL_FIRMNESS_LABELS,
  DOSE_EVENT_TYPE_LABELS,
  FLUID_LOCATION_LABELS,
  FOLLICLE_STATE_LABELS,
  FOAL_COLOR_LABELS,
  FOAL_SEX_LABELS,
  FOALING_OUTCOME_LABELS,
  OVARY_CONSISTENCY_LABELS,
  OVARY_STRUCTURE_LABELS,
  UTERINE_TONE_CATEGORY_LABELS,
} from '@/models/enums';
import type {
  CervicalFirmness,
  DoseEventType,
  FluidLocation,
  FollicleState,
  OvaryConsistency,
  OvaryStructure,
  UterineToneCategory,
} from '@/models/types';
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

export function formatFollicleState(value: FollicleState): string {
  return FOLLICLE_STATE_LABELS[value];
}

export function formatOvaryConsistency(value: OvaryConsistency): string {
  return OVARY_CONSISTENCY_LABELS[value];
}

export function formatOvaryStructure(value: OvaryStructure): string {
  return OVARY_STRUCTURE_LABELS[value];
}

export function formatUterineToneCategory(value: UterineToneCategory): string {
  return UTERINE_TONE_CATEGORY_LABELS[value];
}

export function formatCervicalFirmness(value: CervicalFirmness): string {
  return CERVICAL_FIRMNESS_LABELS[value];
}

export function formatFluidLocation(value: FluidLocation): string {
  return FLUID_LOCATION_LABELS[value];
}

export function getFoalSexColor(sex: string): string | null {
  if (sex === 'colt') return colors.colt;
  if (sex === 'filly') return colors.filly;
  return null;
}
