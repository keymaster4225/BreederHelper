import { FormDateInput, FormField, FormTextInput } from '@/components/FormControls';

type Props = {
  collectionDate: string;
  setCollectionDate: (value: string) => void;
  rawVolumeMl: string;
  setRawVolumeMl: (value: string) => void;
  concentrationMillionsPerMl: string;
  setConcentrationMillionsPerMl: (value: string) => void;
  progressiveMotilityPercent: string;
  setProgressiveMotilityPercent: (value: string) => void;
  errors: {
    collectionDate?: string;
    rawVolumeMl?: string;
    concentrationMillionsPerMl?: string;
    progressiveMotilityPercent?: string;
  };
};

export function CollectionBasicsStep({
  collectionDate,
  setCollectionDate,
  rawVolumeMl,
  setRawVolumeMl,
  concentrationMillionsPerMl,
  setConcentrationMillionsPerMl,
  progressiveMotilityPercent,
  setProgressiveMotilityPercent,
  errors,
}: Props): JSX.Element {
  return (
    <>
      <FormField label="Collection Date" required error={errors.collectionDate}>
        <FormDateInput
          value={collectionDate}
          onChange={setCollectionDate}
          maximumDate={new Date()}
          displayFormat="MM-DD-YYYY"
        />
      </FormField>

      <FormField label="Total Volume (mL)" error={errors.rawVolumeMl}>
        <FormTextInput
          value={rawVolumeMl}
          onChangeText={setRawVolumeMl}
          keyboardType="numeric"
        />
      </FormField>

      <FormField
        label="Concentration (M/mL, raw)"
        error={errors.concentrationMillionsPerMl}
      >
        <FormTextInput
          value={concentrationMillionsPerMl}
          onChangeText={setConcentrationMillionsPerMl}
          keyboardType="numeric"
        />
      </FormField>

      <FormField
        label="Progressive Motility (%)"
        error={errors.progressiveMotilityPercent}
      >
        <FormTextInput
          value={progressiveMotilityPercent}
          onChangeText={setProgressiveMotilityPercent}
          placeholder="0-100"
          keyboardType="numeric"
        />
      </FormField>
    </>
  );
}
