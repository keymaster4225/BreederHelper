import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormCheckbox, FormDateInput, FormField, FormTextInput, OptionSelector } from '@/components/FormControls';
import { borderRadius, colors, spacing, typography } from '@/theme';

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
  const [isCentrifugeExpanded, setIsCentrifugeExpanded] = useState(wasCentrifuged);

  useEffect(() => {
    if (wasCentrifuged) {
      setIsCentrifugeExpanded(true);
    }
  }, [wasCentrifuged]);

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
          placeholder={isLinkedToCollection ? 'Required' : undefined}
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
        <View style={styles.card} testID="centrifuge-settings-card">
          <Pressable
            style={({ pressed }) => [styles.cardHeader, pressed && styles.cardHeaderPressed]}
            onPress={() => setIsCentrifugeExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Toggle centrifuge settings"
          >
            <Text style={styles.cardTitle}>Centrifuge Settings</Text>
            <Text style={styles.cardToggleText}>{isCentrifugeExpanded ? 'Collapse' : 'Expand'}</Text>
          </Pressable>

          {isCentrifugeExpanded ? (
            <View style={styles.cardContent}>
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

              <View style={styles.nestedBlock}>
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

                {cushionValue === 'yes' ? (
                  <FormField label="Cushion Type">
                    <FormTextInput
                      value={centrifugeCushionType}
                      onChangeText={setCentrifugeCushionType}
                    />
                  </FormField>
                ) : null}
              </View>

              <FormField
                label="Resuspension Volume (mL)"
                error={errors.centrifugeResuspensionVolumeMl}
              >
                <FormTextInput
                  value={centrifugeResuspensionVolumeMl}
                  onChangeText={setCentrifugeResuspensionVolumeMl}
                  keyboardType="decimal-pad"
                />
              </FormField>

              <FormField label="Centrifuge Notes">
                <FormTextInput
                  value={centrifugeNotes}
                  onChangeText={setCentrifugeNotes}
                  multiline
                />
              </FormField>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardHeaderPressed: {
    opacity: 0.8,
  },
  cardTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  cardToggleText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  cardContent: {
    gap: spacing.md,
    padding: spacing.md,
  },
  nestedBlock: {
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
});
