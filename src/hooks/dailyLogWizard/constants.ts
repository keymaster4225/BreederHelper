import type { ScoreOption, TriStateOption } from './types';

export const DAILY_LOG_WIZARD_STEPS = [
  'Basics',
  'Right Ovary',
  'Left Ovary',
  'Uterus',
  'Review',
] as const;

export const SCORE_OPTIONS: readonly { label: string; value: ScoreOption }[] = [
  { label: 'N/A', value: '' },
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
] as const;

export const TRI_STATE_OPTIONS: readonly { label: string; value: TriStateOption }[] = [
  { label: 'Unknown', value: 'unknown' },
  { label: 'No', value: 'no' },
  { label: 'Yes', value: 'yes' },
] as const;
