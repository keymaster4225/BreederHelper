import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  onFollicleSizeChange: (value: string) => void;
  onConsistencyChange: (value: OvaryConsistency | null) => void;
  onToggleStructure: (value: OvaryStructure) => void;
};

function getSideLabel(side: 'right' | 'left'): string {
  return side === 'right' ? 'Right' : 'Left';
}

export function OvaryStep({
  side,
  ovary,
  errors,
  onOvulationChange,
  onFollicleSizeChange,
  onConsistencyChange,
  onToggleStructure,
}: Props): JSX.Element {
  const sideLabel = getSideLabel(side);
  const follicleSizeValue = ovary.follicleMeasurements[0]?.value ?? '';

  return (
    <>
      <FormField label={`${sideLabel} Ovary Ovulated`}>
        <OptionSelector<TriStateOption>
          value={toTriStateOption(ovary.ovulation)}
          onChange={(value) => onOvulationChange(fromTriStateOption(value))}
          options={[...TRI_STATE_OPTIONS]}
        />
      </FormField>

      <FormField label="Follicle Size" error={errors.measurements}>
        <FormTextInput
          value={follicleSizeValue}
          onChangeText={onFollicleSizeChange}
          keyboardType="decimal-pad"
          placeholder="mm"
        />
        <Text style={styles.helperText}>Enter a value up to 100 mm.</Text>
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
