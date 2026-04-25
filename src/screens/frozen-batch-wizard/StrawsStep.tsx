import { StyleSheet, Text, View } from 'react-native';

import {
  FREEZING_EXTENDER_VALUES,
  STRAW_COLOR_VALUES,
} from '@/models/enums';
import type { FreezingExtender, StrawColor } from '@/models/types';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { FormField, FormSelectInput, FormTextInput } from '@/components/FormControls';
import { colors, typography } from '@/theme';

type Props = {
  extender: FreezingExtender | null;
  setExtender: (value: FreezingExtender | null) => void;
  extenderOther: string;
  setExtenderOther: (value: string) => void;
  strawCount: string;
  setStrawCount: (value: string) => void;
  strawVolumeMl: string;
  setStrawVolumeMl: (value: string) => void;
  concentrationMillionsPerMl: string;
  setConcentrationMillionsPerMl: (value: string) => void;
  totalSpermPerStrawMillions: number | null;
  strawsPerDose: string;
  setStrawsPerDose: (value: string) => void;
  strawColor: StrawColor | null;
  setStrawColor: (value: StrawColor | null) => void;
  strawColorOther: string;
  setStrawColorOther: (value: string) => void;
  strawLabel: string;
  setStrawLabel: (value: string) => void;
  errors: {
    strawCount?: string;
    strawVolumeMl?: string;
    concentrationMillionsPerMl?: string;
    strawsPerDose?: string;
    extenderOther?: string;
    strawColorOther?: string;
  };
};

function formatSpermPerStraw(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} M`;
}

export function StrawsStep({
  extender,
  setExtender,
  extenderOther,
  setExtenderOther,
  strawCount,
  setStrawCount,
  strawVolumeMl,
  setStrawVolumeMl,
  concentrationMillionsPerMl,
  setConcentrationMillionsPerMl,
  totalSpermPerStrawMillions,
  strawsPerDose,
  setStrawsPerDose,
  strawColor,
  setStrawColor,
  strawColorOther,
  setStrawColorOther,
  strawLabel,
  setStrawLabel,
  errors,
}: Props): JSX.Element {
  return (
    <>
      <FormField label="Extender">
        <FormSelectInput
          value={extender ?? ''}
          onChange={(value) => setExtender(value ? (value as FreezingExtender) : null)}
          options={FREEZING_EXTENDER_VALUES as unknown as readonly string[]}
          clearable
          placeholder="Select extender"
        />
      </FormField>

      {extender === 'Other' ? (
        <FormField label="Extender Other" required error={errors.extenderOther}>
          <FormTextInput
            value={extenderOther}
            onChangeText={setExtenderOther}
            placeholder="Enter extender"
          />
        </FormField>
      ) : null}

      <FormField label="Straw Count" required error={errors.strawCount}>
        <FormTextInput
          value={strawCount}
          onChangeText={setStrawCount}
          placeholder="Required"
          keyboardType="number-pad"
        />
      </FormField>

      <FormField label="Straw Volume (mL)" required error={errors.strawVolumeMl}>
        <FormTextInput
          value={strawVolumeMl}
          onChangeText={setStrawVolumeMl}
          placeholder="Required"
          keyboardType="decimal-pad"
        />
      </FormField>

      <FormField
        label="Concentration (M/mL)"
        error={errors.concentrationMillionsPerMl}
      >
        <FormTextInput
          value={concentrationMillionsPerMl}
          onChangeText={setConcentrationMillionsPerMl}
          keyboardType="decimal-pad"
        />
      </FormField>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Derived</Text>
        <CardRow
          label="Sperm per Straw (M)"
          value={formatSpermPerStraw(totalSpermPerStrawMillions)}
        />
      </View>

      <FormField label="Straws per Dose" error={errors.strawsPerDose}>
        <FormTextInput
          value={strawsPerDose}
          onChangeText={setStrawsPerDose}
          keyboardType="number-pad"
        />
      </FormField>

      <FormField label="Straw Color">
        <FormSelectInput
          value={strawColor ?? ''}
          onChange={(value) => setStrawColor(value ? (value as StrawColor) : null)}
          options={STRAW_COLOR_VALUES as unknown as readonly string[]}
          clearable
          placeholder="Select color"
        />
      </FormField>

      {strawColor === 'Other' ? (
        <FormField label="Straw Color Other" required error={errors.strawColorOther}>
          <FormTextInput
            value={strawColorOther}
            onChangeText={setStrawColorOther}
            placeholder="Enter color"
          />
        </FormField>
      ) : null}

      <FormField label="Straw Label">
        <FormTextInput
          value={strawLabel}
          onChangeText={setStrawLabel}
        />
      </FormField>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
});
