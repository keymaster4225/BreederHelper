import { FormAutocompleteInput, FormField, FormTextInput } from '@/components/FormControls';
import { EXTENDER_TYPES, getExtenderTypeSuggestions } from '@/utils/extenderTypes';

type Props = {
  rawVolumeMl: string;
  setRawVolumeMl: (value: string) => void;
  totalVolumeMl: string;
  setTotalVolumeMl: (value: string) => void;
  extenderVolumeMl: string;
  setExtenderVolumeMl: (value: string) => void;
  extenderType: string;
  setExtenderType: (value: string) => void;
  concentrationMillionsPerMl: string;
  setConcentrationMillionsPerMl: (value: string) => void;
  progressiveMotilityPercent: string;
  setProgressiveMotilityPercent: (value: string) => void;
  errors: {
    rawVolumeMl?: string;
    totalVolumeMl?: string;
    extenderVolumeMl?: string;
    concentrationMillionsPerMl?: string;
    progressiveMotilityPercent?: string;
  };
};

export function ProcessingDetailsStep({
  rawVolumeMl,
  setRawVolumeMl,
  totalVolumeMl,
  setTotalVolumeMl,
  extenderVolumeMl,
  setExtenderVolumeMl,
  extenderType,
  setExtenderType,
  concentrationMillionsPerMl,
  setConcentrationMillionsPerMl,
  progressiveMotilityPercent,
  setProgressiveMotilityPercent,
  errors,
}: Props): JSX.Element {
  return (
    <>
      <FormField label="Raw Volume (mL)" error={errors.rawVolumeMl}>
        <FormTextInput
          value={rawVolumeMl}
          onChangeText={setRawVolumeMl}
          placeholder="Optional"
          keyboardType="numeric"
        />
      </FormField>

      <FormField label="Total Volume (mL)" error={errors.totalVolumeMl}>
        <FormTextInput
          value={totalVolumeMl}
          onChangeText={setTotalVolumeMl}
          placeholder="Optional"
          keyboardType="numeric"
        />
      </FormField>

      <FormField label="Extender Volume (mL)" error={errors.extenderVolumeMl}>
        <FormTextInput
          value={extenderVolumeMl}
          onChangeText={setExtenderVolumeMl}
          placeholder="Optional"
          keyboardType="numeric"
        />
      </FormField>

      <FormField label="Extender Type">
        <FormAutocompleteInput
          value={extenderType}
          onChangeText={setExtenderType}
          options={EXTENDER_TYPES}
          getSuggestions={getExtenderTypeSuggestions}
          placeholder="Type or select extender (optional)"
          autoCapitalize="words"
          autoCorrect={false}
        />
      </FormField>

      <FormField label="Concentration (M/mL)" error={errors.concentrationMillionsPerMl}>
        <FormTextInput
          value={concentrationMillionsPerMl}
          onChangeText={setConcentrationMillionsPerMl}
          placeholder="Optional"
          keyboardType="numeric"
        />
      </FormField>

      <FormField label="Progressive Motility (%)" error={errors.progressiveMotilityPercent}>
        <FormTextInput
          value={progressiveMotilityPercent}
          onChangeText={setProgressiveMotilityPercent}
          placeholder="Optional"
          keyboardType="numeric"
        />
      </FormField>
    </>
  );
}
