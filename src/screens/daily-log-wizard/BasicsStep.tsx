import { FormDateInput, FormField, OptionSelector } from '@/components/FormControls';
import {
  SCORE_OPTIONS,
  type ScoreOption,
} from '@/hooks/useDailyLogWizard';

type Props = {
  date: string;
  teasingScore: ScoreOption;
  errors: {
    date?: string;
  };
  onDateChange: (value: string) => void;
  onTeasingScoreChange: (value: ScoreOption) => void;
};

export function BasicsStep({
  date,
  teasingScore,
  errors,
  onDateChange,
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
