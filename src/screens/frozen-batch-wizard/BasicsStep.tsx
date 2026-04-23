import { FormCheckbox, FormDateInput, FormField, FormTextInput, OptionSelector } from '@/components/FormControls';

type YesNoValue = 'yes' | 'no';

const YES_NO_OPTIONS: { label: string; value: YesNoValue }[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

type Props = {
  freezeDate: string;
  setFreezeDate: (value: string) => void;
  rawSemenVolumeUsedMl: string;
  setRawSemenVolumeUsedMl: (value: string) => void;
  isLinkedToCollection: boolean;
  wasCentrifuged: boolean;
  setWasCentrifuged: (value: boolean) => void;
  centrifugeSpeedRpm: string;
  setCentrifugeSpeedRpm: (value: string) => void;
  centrifugeDurationMin: string;
  setCentrifugeDurationMin: (value: string) => void;
  centrifugeCushionUsed: boolean | null;
  setCentrifugeCushionUsed: (value: boolean | null) => void;
  centrifugeCushionType: string;
  setCentrifugeCushionType: (value: string) => void;
  centrifugeResuspensionVolumeMl: string;
  setCentrifugeResuspensionVolumeMl: (value: string) => void;
  centrifugeNotes: string;
  setCentrifugeNotes: (value: string) => void;
  errors: {
    freezeDate?: string;
    rawSemenVolumeUsedMl?: string;
    centrifugeSpeedRpm?: string;
    centrifugeDurationMin?: string;
    centrifugeCushionUsed?: string;
    centrifugeResuspensionVolumeMl?: string;
  };
};

export function BasicsStep({
  freezeDate,
  setFreezeDate,
  rawSemenVolumeUsedMl,
  setRawSemenVolumeUsedMl,
  isLinkedToCollection,
  wasCentrifuged,
  setWasCentrifuged,
  centrifugeSpeedRpm,
  setCentrifugeSpeedRpm,
  centrifugeDurationMin,
  setCentrifugeDurationMin,
  centrifugeCushionUsed,
  setCentrifugeCushionUsed,
  centrifugeCushionType,
  setCentrifugeCushionType,
  centrifugeResuspensionVolumeMl,
  setCentrifugeResuspensionVolumeMl,
  centrifugeNotes,
  setCentrifugeNotes,
  errors,
}: Props): JSX.Element {
  const cushionValue: YesNoValue | null =
    centrifugeCushionUsed == null ? null : centrifugeCushionUsed ? 'yes' : 'no';

  return (
    <>
      <FormField label="Freeze Date" required error={errors.freezeDate}>
        <FormDateInput
          value={freezeDate}
          onChange={setFreezeDate}
          maximumDate={new Date()}
          displayFormat="MM-DD-YYYY"
        />
      </FormField>

      <FormField
        label="Raw Semen Volume Used (mL)"
        required={isLinkedToCollection}
        error={errors.rawSemenVolumeUsedMl}
      >
        <FormTextInput
          value={rawSemenVolumeUsedMl}
          onChangeText={setRawSemenVolumeUsedMl}
          placeholder={isLinkedToCollection ? 'Required' : 'Optional'}
          keyboardType="decimal-pad"
        />
      </FormField>

      <FormField label="Was centrifuged?">
        <FormCheckbox
          label="Was centrifuged?"
          value={wasCentrifuged}
          onChange={setWasCentrifuged}
        />
      </FormField>

      {wasCentrifuged ? (
        <>
          <FormField
            label="Centrifuge Speed (RPM)"
            required
            error={errors.centrifugeSpeedRpm}
          >
            <FormTextInput
              value={centrifugeSpeedRpm}
              onChangeText={setCentrifugeSpeedRpm}
              placeholder="100-10000"
              keyboardType="number-pad"
            />
          </FormField>

          <FormField
            label="Centrifuge Duration (minutes)"
            required
            error={errors.centrifugeDurationMin}
          >
            <FormTextInput
              value={centrifugeDurationMin}
              onChangeText={setCentrifugeDurationMin}
              placeholder="Required"
              keyboardType="number-pad"
            />
          </FormField>

          <FormField label="Cushion Used?" required error={errors.centrifugeCushionUsed}>
            <OptionSelector
              value={cushionValue}
              onChange={(value) =>
                setCentrifugeCushionUsed(
                  value == null ? null : value === 'yes',
                )
              }
              options={YES_NO_OPTIONS}
              allowDeselect
            />
          </FormField>

          <FormField label="Cushion Type">
            <FormTextInput
              value={centrifugeCushionType}
              onChangeText={setCentrifugeCushionType}
              placeholder="Optional"
            />
          </FormField>

          <FormField
            label="Resuspension Volume (mL)"
            error={errors.centrifugeResuspensionVolumeMl}
          >
            <FormTextInput
              value={centrifugeResuspensionVolumeMl}
              onChangeText={setCentrifugeResuspensionVolumeMl}
              placeholder="Optional"
              keyboardType="decimal-pad"
            />
          </FormField>

          <FormField label="Centrifuge Notes">
            <FormTextInput
              value={centrifugeNotes}
              onChangeText={setCentrifugeNotes}
              placeholder="Optional"
              multiline
            />
          </FormField>
        </>
      ) : null}
    </>
  );
}
