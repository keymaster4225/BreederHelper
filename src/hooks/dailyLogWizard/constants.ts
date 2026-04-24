import type { DailyLogWizardStepDescriptor, ScoreOption, TriStateOption } from './types';

export const BASE_DAILY_LOG_WIZARD_STEPS: readonly DailyLogWizardStepDescriptor[] = [
  { id: 'basics', title: 'Basics' },
  { id: 'rightOvary', title: 'Right Ovary' },
  { id: 'leftOvary', title: 'Left Ovary' },
  { id: 'uterus', title: 'Uterus' },
  { id: 'review', title: 'Review' },
] as const;

export function buildDailyLogWizardSteps(
  includeFlushStep: boolean,
): readonly DailyLogWizardStepDescriptor[] {
  if (!includeFlushStep) {
    return BASE_DAILY_LOG_WIZARD_STEPS;
  }

  return [
    ...BASE_DAILY_LOG_WIZARD_STEPS.slice(0, 4),
    { id: 'flush', title: 'Flush' },
    BASE_DAILY_LOG_WIZARD_STEPS[4],
  ];
}

export const DAILY_LOG_WIZARD_STEPS = BASE_DAILY_LOG_WIZARD_STEPS.map((step) => step.title);

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
