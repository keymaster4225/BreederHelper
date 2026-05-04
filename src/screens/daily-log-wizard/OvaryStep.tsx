import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  OVARY_CONSISTENCY_LABELS,
  OVARY_CONSISTENCY_OPTIONS,
  OVARY_STRUCTURE_LABELS,
  OVARY_STRUCTURE_OPTIONS,
} from '@/models/enums';
import type { OvaryConsistency, OvaryStructure } from '@/models/types';
import {
  fromTriStateOption,
  toTriStateOption,
  TRI_STATE_OPTIONS,
  type DailyLogWizardFollicleFinding,
  type DailyLogWizardOvaryDraft,
  type TriStateOption,
} from '@/hooks/useDailyLogWizard';
import {
  getOvaryFollicleFinding,
  isPrimaryFindingStructure,
} from '@/hooks/dailyLogWizard/measurementUtils';
import { FormField, FormTextInput, OptionSelector } from '@/components/FormControls';
import { borderRadius, colors, spacing, typography } from '@/theme';

type SelectableFollicleFinding = Exclude<DailyLogWizardFollicleFinding, ''>;

type Props = {
  side: 'right' | 'left';
  ovary: DailyLogWizardOvaryDraft;
  errors: {
    measurements?: string;
  };
  onOvulationChange: (value: boolean | null) => void;
  onFollicleFindingChange: (value: DailyLogWizardFollicleFinding) => void;
  onAddMeasurement: () => void;
  onUpdateMeasurement: (clientId: string, value: string) => void;
  onRemoveMeasurement: (clientId: string) => void;
  onConsistencyChange: (value: OvaryConsistency | null) => void;
  onToggleStructure: (value: OvaryStructure) => void;
};

const FOLLICLE_FINDING_OPTIONS: Array<{
  label: string;
  value: SelectableFollicleFinding;
}> = [
  { label: 'Measured', value: 'measured' },
  { label: 'MSF', value: 'msf' },
  { label: 'AHF', value: 'ahf' },
  { label: 'CL', value: 'cl' },
];

function getSideLabel(side: 'right' | 'left'): string {
  return side === 'right' ? 'Right' : 'Left';
}

function getFollicleRowLabel(index: number): string {
  const charCode = 'A'.charCodeAt(0) + index;
  return charCode <= 'Z'.charCodeAt(0) ? `Follicle ${String.fromCharCode(charCode)}` : `Follicle ${index + 1}`;
}

export function OvaryStep({
  side,
  ovary,
  errors,
  onOvulationChange,
  onFollicleFindingChange,
  onAddMeasurement,
  onUpdateMeasurement,
  onRemoveMeasurement,
  onConsistencyChange,
  onToggleStructure,
}: Props): JSX.Element {
  const sideLabel = getSideLabel(side);
  const follicleFinding = getOvaryFollicleFinding(ovary);
  const primaryStructures = ovary.structures.filter(isPrimaryFindingStructure);
  const showLegacyPrimarySummary = primaryStructures.length > 1;
  const additionalStructureOptions = OVARY_STRUCTURE_OPTIONS.filter(
    (option) => !isPrimaryFindingStructure(option.value),
  );

  return (
    <>
      <FormField label={`${sideLabel} Ovary Ovulated`}>
        <OptionSelector<TriStateOption>
          value={toTriStateOption(ovary.ovulation)}
          onChange={(value) => onOvulationChange(fromTriStateOption(value))}
          options={[...TRI_STATE_OPTIONS]}
        />
      </FormField>

      <FormField label="Follicle Finding" error={errors.measurements}>
        <OptionSelector<SelectableFollicleFinding>
          value={follicleFinding === '' ? null : follicleFinding}
          onChange={(value) => onFollicleFindingChange(value ?? '')}
          options={FOLLICLE_FINDING_OPTIONS}
          allowDeselect
        />
        {showLegacyPrimarySummary ? (
          <Text style={styles.helperText}>
            {`Existing findings: ${primaryStructures
              .map((value) => OVARY_STRUCTURE_LABELS[value])
              .join(', ')}`}
          </Text>
        ) : null}
        {follicleFinding === 'measured' ? (
          <View style={styles.measurementList}>
            {ovary.follicleMeasurements.map((measurement, index) => {
              const rowLabel = getFollicleRowLabel(index);
              return (
                <View key={measurement.clientId} style={styles.measurementRow}>
                  <View style={styles.measurementInputWrap}>
                    <Text style={styles.measurementLabel}>{rowLabel}</Text>
                    <FormTextInput
                      value={measurement.value}
                      onChangeText={(value) => onUpdateMeasurement(measurement.clientId, value)}
                      keyboardType="decimal-pad"
                      placeholder="mm"
                      accessibilityLabel={`${rowLabel} size`}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeMeasurementButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onRemoveMeasurement(measurement.clientId)}
                    accessibilityLabel={`Remove ${rowLabel}`}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons
                      name="close-circle-outline"
                      size={24}
                      color={colors.onSurfaceVariant}
                    />
                  </Pressable>
                </View>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.addMeasurementButton, pressed && styles.pressed]}
              onPress={onAddMeasurement}
              accessibilityLabel="Add Follicle"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
              <Text style={styles.addMeasurementButtonText}>Add Follicle</Text>
            </Pressable>
            <Text style={styles.helperText}>Enter values up to 100 mm.</Text>
          </View>
        ) : null}
      </FormField>

      <FormField label={`${sideLabel} Ovary Consistency`}>
        <OptionSelector<OvaryConsistency>
          value={ovary.consistency}
          onChange={onConsistencyChange}
          options={[...OVARY_CONSISTENCY_OPTIONS]}
          allowDeselect
        />
        {ovary.consistency ? (
          <Text style={styles.helperText}>{`Selected: ${OVARY_CONSISTENCY_LABELS[ovary.consistency]}`}</Text>
        ) : null}
      </FormField>

      <FormField label="Additional Structures">
        <View style={styles.structureWrap}>
          {additionalStructureOptions.map((option) => {
            const active = ovary.structures.includes(option.value);
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.structureChip,
                  active && styles.structureChipActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => onToggleStructure(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.structureChipText, active && styles.structureChipTextActive]}>
                  {OVARY_STRUCTURE_LABELS[option.value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormField>
    </>
  );
}

const styles = StyleSheet.create({
  helperText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  measurementList: {
    gap: spacing.sm,
  },
  measurementRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  measurementInputWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  measurementLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  removeMeasurementButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  addMeasurementButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  addMeasurementButtonText: {
    ...typography.labelSmall,
    color: colors.primary,
  },
  structureWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  structureChip: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  structureChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  structureChipText: {
    ...typography.labelSmall,
    color: colors.onSurface,
  },
  structureChipTextActive: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
});
