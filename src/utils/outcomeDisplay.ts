import { colors } from '@/theme';

export function getOutcomeColor(outcome: string): string {
  if (outcome === 'liveFoal') return colors.pregnant;
  if (outcome === 'stillbirth' || outcome === 'aborted') return colors.loss;
  return colors.onSurface;
}

export function formatBreedingMethod(method: string): string {
  if (method === 'liveCover') return 'Live Cover';
  if (method === 'freshAI') return 'Fresh AI';
  if (method === 'shippedCooledAI') return 'Shipped/Cooled AI';
  if (method === 'frozenAI') return 'Frozen AI';
  return method;
}

export function formatOutcome(outcome: string): string {
  if (outcome === 'liveFoal') return 'Live Foal';
  if (outcome === 'stillbirth') return 'Stillbirth';
  if (outcome === 'aborted') return 'Aborted';
  return 'Unknown';
}
