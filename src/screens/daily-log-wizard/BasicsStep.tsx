import { FormDateInput, FormField, FormTimeInput, OptionSelector } from '@/components/FormControls';
import {
  SCORE_OPTIONS,
  type ScoreOption,
} from '@/hooks/useDailyLogWizard';

type Props = {
  date: string;
  time: string;
  teasingScore: ScoreOption;
  errors: {
    date?: string;
    time?: string;
  };
  isTimeClearable: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onTeasingScoreChange: (value: ScoreOption) => void;
};

export function BasicsStep({
  date,
  time,
  teasingScore,
  errors,
  isTimeClearable,
  onDateChange,
  onTimeChange,
  onTeasingScoreChange,
}: Props): JSX.Element {
  return (
    <>
      <FormField label="Date" required error={errors.date}>
        <FormDateInput
          value={date}
          onChange={onDateChange}
          placeholder="Select date"
          maximumDate={new Date()}
        />
      </FormField>

      <FormField label="Time" required={!isTimeClearable} error={errors.time}>
        <FormTimeInput
          value={time}
          onChange={onTimeChange}
          placeholder="Select time"
          clearable={isTimeClearable}
          accessibilityLabel="Daily log time"
        />
      </FormField>

      <FormField label="Teasing Score (0-5)">
        <OptionSelector
          value={teasingScore}
          onChange={onTeasingScoreChange}
          options={[...SCORE_OPTIONS]}
        />
      </FormField>
    </>
  );
}
