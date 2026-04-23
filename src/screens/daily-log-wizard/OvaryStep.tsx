import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FOLLICLE_STATE_LABELS,
  FOLLICLE_STATE_OPTIONS,
  OVARY_CONSISTENCY_LABELS,
  OVARY_CONSISTENCY_OPTIONS,
  OVARY_STRUCTURE_LABELS,
  OVARY_STRUCTURE_OPTIONS,
} from '@/models/enums';
import type { FollicleState, OvaryConsistency, OvaryStructure } from '@/models/types';
import {
  fromTriStateOption,
  toTriStateOption,
  TRI_STATE_OPTIONS,
  type DailyLogWizardOvaryDraft,
  type TriStateOption,
} from '@/hooks/useDailyLogWizard';
import { FormField, FormTextInput, OptionSelector } from '@/components/FormControls';
import { borderRadius, colors, spacing, typography } from '@/theme';

type Props = {
  side: 'right' | 'left';
  ovary: DailyLogWizardOvaryDraft;
  errors: {
    measurements?: string;
  };
  onOvulationChange: (value: boolean | null) => void;
  onFollicleStateChange: (value: FollicleState | null) => void;
  onConsistencyChange: (value: OvaryConsistency | null) => void;
  onToggleStructure: (value: OvaryStructure) => void;
  onAddMeasurement: () => void;
  onMeasurementChange: (clientId: string, value: string) => void;
  onRemoveMeasurement: (clientId: string) => void;
};

function getSideLabel(side: 'right' | 'left'): string {
  return side === 'right' ? 'Right' : 'Left';
}

function renderMeasurementPlaceholder(index: number): string {
  return `Measurement ${index + 1} (mm)`;
}

export function OvaryStep({
  side,
  ovary,
  errors,
  onOvulationChange,
  onFollicleStateChange,
  onConsistencyChange,
  onToggleStructure,
  onAddMeasurement,
  onMeasurementChange,
  onRemoveMeasurement,
}: Props): JSX.Element {
  const sideLabel = getSideLabel(side);

  return (
    <>
      <FormField label={`${sideLabel} Ovary Ovulated`}>
        <OptionSelector<TriStateOption>
          value={toTriStateOption(ovary.ovulation)}
          onChange={(value) => onOvulationChange(fromTriStateOption(value))}
          options={[...TRI_STATE_OPTIONS]}
        />
      </FormField>

      <FormField label={`${sideLabel} Follicle State`}>
        <OptionSelector<FollicleState>
          value={ovary.follicleState}
          onChange={onFollicleStateChange}
          options={[...FOLLICLE_STATE_OPTIONS]}
          allowDeselect
        />
        {ovary.follicleState ? (
          <Text style={styles.helperText}>{`Selected: ${FOLLICLE_STATE_LABELS[ovary.follicleState]}`}</Text>
        ) : null}
      </FormField>

      {ovary.follicleState === 'measured' ? (
        <FormField label={`${sideLabel} Follicle Measurements (mm)`} error={errors.measurements}>
          <View style={styles.measurementsWrap}>
            {ovary.follicleMeasurements.length === 0 ? (
              <Text style={styles.emptyText}>No measurements added yet.</Text>
            ) : (
              ovary.follicleMeasurements.map((measurement, index) => (
                <View key={measurement.clientId} style={styles.measurementRow}>
                  <View style={styles.measurementInput}>
                    <FormTextInput
                      value={measurement.value}
                      onChangeText={(value) => onMeasurementChange(measurement.clientId, value)}
                      keyboardType="numeric"
                      placeholder={renderMeasurementPlaceholder(index)}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.measurementDelete, pressed && styles.pressed]}
                    onPress={() => onRemoveMeasurement(measurement.clientId)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove measurement"
                  >
                    <Text style={styles.measurementDeleteText}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
            <Pressable
              style={({ pressed }) => [styles.addRowButton, pressed && styles.pressed]}
              onPress={onAddMeasurement}
              accessibilityRole="button"
            >
              <Text style={styles.addRowButtonText}>Add Measurement</Text>
            </Pressable>
          </View>
        </FormField>
      ) : null}

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

      <FormField label={`${sideLabel} Ovary Structures`}>
        <View style={styles.structureWrap}>
          {OVARY_STRUCTURE_OPTIONS.map((option) => {
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
  measurementsWrap: {
    gap: spacing.sm,
  },
  measurementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  measurementInput: {
    flex: 1,
  },
  measurementDelete: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  measurementDeleteText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  addRowButton: {
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  addRowButtonText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
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
