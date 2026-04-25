import { FormField, FormTextInput } from '@/components/FormControls';

type Props = {
  storageDetails: string;
  setStorageDetails: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
};

export function StorageStep({
  storageDetails,
  setStorageDetails,
  notes,
  setNotes,
}: Props): JSX.Element {
  return (
    <>
      <FormField label="Storage Details">
        <FormTextInput
          value={storageDetails}
          onChangeText={setStorageDetails}
          multiline
        />
      </FormField>

      <FormField label="Notes">
        <FormTextInput
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </FormField>
    </>
  );
}
