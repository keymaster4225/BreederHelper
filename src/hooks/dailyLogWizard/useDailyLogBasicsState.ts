import { useCallback, useState } from 'react';

import { getCurrentTimeHHMM } from '@/utils/dailyLogTime';
import { toLocalDate } from '@/utils/dates';

import type { DailyLogWizardSetErrors, ScoreOption } from './types';

type UseDailyLogBasicsStateArgs = {
  isEdit: boolean;
  today: Date;
  setErrors: DailyLogWizardSetErrors;
};

type HydrateBasicsInput = {
  date: string;
  time: string;
  teasingScore: ScoreOption;
  isTimeClearable: boolean;
};

export function useDailyLogBasicsState({
  isEdit,
  today,
  setErrors,
}: UseDailyLogBasicsStateArgs) {
  const [date, setDateState] = useState<string>(() => (isEdit ? '' : toLocalDate(today)));
  const [time, setTimeState] = useState<string>(() => (isEdit ? '' : getCurrentTimeHHMM(today)));
  const [teasingScore, setTeasingScore] = useState<ScoreOption>('');
  const [isTimeClearable, setIsTimeClearable] = useState(false);

  const hydrateBasics = useCallback((value: HydrateBasicsInput): void => {
    setDateState(value.date);
    setTimeState(value.time);
    setTeasingScore(value.teasingScore);
    setIsTimeClearable(value.isTimeClearable);
  }, []);

  const resetCreateTimeDefaults = useCallback((): void => {
    setTimeState(getCurrentTimeHHMM(today));
    setIsTimeClearable(false);
  }, [today]);

  const setDate = useCallback(
    (value: string): void => {
      setDateState(value);
      setErrors((current) => ({
        ...current,
        basics: {
          ...current.basics,
          date: undefined,
        },
      }));
    },
    [setErrors],
  );

  const setTime = useCallback(
    (value: string): void => {
      setTimeState(value);
      setErrors((current) => ({
        ...current,
        basics: {
          ...current.basics,
          time: undefined,
        },
      }));
    },
    [setErrors],
  );

  return {
    date,
    time,
    teasingScore,
    isTimeClearable,
    hydrateBasics,
    resetCreateTimeDefaults,
    setDate,
    setTime,
    setTeasingScore,
  };
}
