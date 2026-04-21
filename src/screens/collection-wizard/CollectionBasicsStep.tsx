import { FormDateInput, FormField, FormTextInput } from '@/components/FormControls';

type Props = {
  collectionDate: string;
  setCollectionDate: (value: string) => void;
  doseCount: string;
  setDoseCount: (value: string) => void;
  doseSizeMillions: string;
  setDoseSizeMillions: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  errors: {
    collectionDate?: string;
    doseCount?: string;
    doseSizeMillions?: string;
  };
};

export function CollectionBasicsStep({
  collectionDate,
  setCollectionDate,
  doseCount,
  setDoseCount,
  doseSizeMillions,
  setDoseSizeMillions,
  notes,
  setNotes,
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

      <FormField label="Dose Count" error={errors.doseCount}>
        <FormTextInput
          value={doseCount}
          onChangeText={setDoseCount}
          placeholder="Optional until allocations are added"
          keyboardType="numeric"
        />
      </FormField>

      <FormField label="Dose Size (millions)" error={errors.doseSizeMillions}>
        <FormTextInput
          value={doseSizeMillions}
          onChangeText={setDoseSizeMillions}
          placeholder="Optional"
          keyboardType="numeric"
        />
      </FormField>

      <FormField label="Notes">
        <FormTextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Optional"
        />
      </FormField>
    </>
  );
}
