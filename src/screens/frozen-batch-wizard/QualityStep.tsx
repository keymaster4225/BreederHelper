import { FormField, FormTextInput } from '@/components/FormControls';

type Props = {
  postThawMotilityPercent: string;
  setPostThawMotilityPercent: (value: string) => void;
  longevityHours: string;
  setLongevityHours: (value: string) => void;
  errors: {
    postThawMotilityPercent?: string;
    longevityHours?: string;
  };
};

export function QualityStep({
  postThawMotilityPercent,
  setPostThawMotilityPercent,
  longevityHours,
  setLongevityHours,
  errors,
}: Props): JSX.Element {
  return (
    <>
      <FormField
        label="Post-thaw Motility (%)"
        error={errors.postThawMotilityPercent}
      >
        <FormTextInput
          value={postThawMotilityPercent}
          onChangeText={setPostThawMotilityPercent}
          placeholder="Optional (0-100)"
          keyboardType="decimal-pad"
        />
      </FormField>

      <FormField label="Longevity (hours)" error={errors.longevityHours}>
        <FormTextInput
          value={longevityHours}
          onChangeText={setLongevityHours}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />
      </FormField>
    </>
  );
}
