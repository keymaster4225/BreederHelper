import { colors } from '@/theme';

export function getOutcomeColor(outcome: string): string {
  if (outcome === 'liveFoal') return colors.pregnant;
  if (outcome === 'stillbirth' || outcome === 'aborted') return colors.loss;
  return colors.onSurface;
}

export function formatOutcome(outcome: string): string {
  if (outcome === 'liveFoal') return 'Live Foal';
  if (outcome === 'stillbirth') return 'Stillbirth';
  if (outcome === 'aborted') return 'Aborted';
  return 'Unknown';
}
