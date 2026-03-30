import type { IggInterpretation } from '@/models/types';

export const IGG_THRESHOLDS = {
  ADEQUATE: 800,
  PARTIAL_FAILURE: 400,
} as const;

export function interpretIgg(valueMgDl: number): IggInterpretation {
  if (valueMgDl >= IGG_THRESHOLDS.ADEQUATE) return 'adequate';
  if (valueMgDl >= IGG_THRESHOLDS.PARTIAL_FAILURE) return 'partialFailure';
  return 'completeFailure';
}

const INTERPRETATION_LABELS: Record<IggInterpretation, string> = {
  adequate: 'Adequate',
  partialFailure: 'Partial Failure',
  completeFailure: 'Complete Failure',
};

export function formatIggInterpretation(interpretation: IggInterpretation): string {
  return INTERPRETATION_LABELS[interpretation];
}

const INTERPRETATION_COLORS: Record<IggInterpretation, string> = {
  adequate: '#4CAF50',
  partialFailure: '#FF9800',
  completeFailure: '#E53935',
};

export function getIggColor(interpretation: IggInterpretation): string {
  return INTERPRETATION_COLORS[interpretation];
}
