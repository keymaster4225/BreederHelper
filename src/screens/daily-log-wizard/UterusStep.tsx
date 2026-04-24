import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CERVICAL_FIRMNESS_LABELS,
  CERVICAL_FIRMNESS_OPTIONS,
  FLUID_LOCATION_LABELS,
  UTERINE_TONE_CATEGORY_LABELS,
  UTERINE_TONE_CATEGORY_OPTIONS,
} from '@/models/enums';
import type {
  CervicalFirmness,
  FluidLocation,
  UterineToneCategory,
} from '@/models/types';
import {
  fromTriStateOption,
  SCORE_OPTIONS,
  toTriStateOption,
  TRI_STATE_OPTIONS,
  type DailyLogWizardFluidPocketDraft,
  type DailyLogWizardUterusDraft,
  type FlushDecision,
  type ScoreOption,
  type TriStateOption,
} from '@/hooks/useDailyLogWizard';
import { FormField, FormTextInput, OptionSelector } from '@/components/FormControls';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { FluidPocketEditor } from './FluidPocketEditor';

type FluidPocketInput = {
  depthMm: number;
  location: FluidLocation;
};

type Props = {
  uterus: DailyLogWizardUterusDraft;
  errors: {
    dischargeNotes?: string;
    fluidPockets?: string;
    flushDecision?: string;
  };
  flushDecision: FlushDecision;
  onEdemaChange: (value: ScoreOption) => void;
  onUterineToneCategoryChange: (value: UterineToneCategory | null) => void;
  onCervicalFirmnessChange: (value: CervicalFirmness | null) => void;
  onDischargeObservedChange: (value: boolean | null) => void;
  onDischargeNotesChange: (value: string) => void;
  onUterineCystsChange: (value: string) => void;
  onFlushDecisionChange: (value: FlushDecision) => void;
  onUpsertFluidPocket: (value: FluidPocketInput, clientId?: string) => void;
  onRemoveFluidPocket: (clientId: string) => void;
};

function formatFluidPocketRow(row: DailyLogWizardFluidPocketDraft): string {
  return `${row.depthMm} mm - ${FLUID_LOCATION_LABELS[row.location]}`;
}

export function UterusStep({
  uterus,
  errors,
  flushDecision,
  onEdemaChange,
  onUterineToneCategoryChange,
  onCervicalFirmnessChange,
  onDischargeObservedChange,
  onDischargeNotesChange,
  onUterineCystsChange,
  onFlushDecisionChange,
  onUpsertFluidPocket,
  onRemoveFluidPocket,
}: Props): JSX.Element {
  const [editingPocketClientId, setEditingPocketClientId] = useState<string | null>(null);
  const [isFluidEditorVisible, setIsFluidEditorVisible] = useState(false);

  const editingPocket = useMemo(
    () =>
      editingPocketClientId
        ? uterus.fluidPockets.find((row) => row.clientId === editingPocketClientId)
        : undefined,
    [editingPocketClientId, uterus.fluidPockets],
  );

  const openCreateFluidPocket = (): void => {
    setEditingPocketClientId(null);
    setIsFluidEditorVisible(true);
  };

  const openEditFluidPocket = (clientId: string): void => {
    setEditingPocketClientId(clientId);
    setIsFluidEditorVisible(true);
  };

  const closeFluidEditor = (): void => {
    setEditingPocketClientId(null);
    setIsFluidEditorVisible(false);
  };

  const handleSaveFluidPocket = (value: FluidPocketInput): void => {
    onUpsertFluidPocket(value, editingPocketClientId ?? undefined);
    closeFluidEditor();
  };

  return (
    <>
      <FormField label="Uterine Edema (0-5)">
        <OptionSelector<ScoreOption>
          value={uterus.edema}
          onChange={onEdemaChange}
          options={[...SCORE_OPTIONS]}
        />
      </FormField>

      <FormField label="Uterine Tone Category">
        <OptionSelector<UterineToneCategory>
          value={uterus.uterineToneCategory}
          onChange={onUterineToneCategoryChange}
          options={[...UTERINE_TONE_CATEGORY_OPTIONS]}
          allowDeselect
        />
        {uterus.uterineToneCategory ? (
          <Text style={styles.helperText}>
            {`Selected: ${UTERINE_TONE_CATEGORY_LABELS[uterus.uterineToneCategory]}`}
          </Text>
        ) : null}
      </FormField>

      <FormField label="Cervical Firmness">
        <OptionSelector<CervicalFirmness>
          value={uterus.cervicalFirmness}
          onChange={onCervicalFirmnessChange}
          options={[...CERVICAL_FIRMNESS_OPTIONS]}
          allowDeselect
        />
        {uterus.cervicalFirmness ? (
          <Text style={styles.helperText}>
            {`Selected: ${CERVICAL_FIRMNESS_LABELS[uterus.cervicalFirmness]}`}
          </Text>
        ) : null}
      </FormField>

      <FormField label="Discharge Observed">
        <OptionSelector<TriStateOption>
          value={toTriStateOption(uterus.dischargeObserved)}
          onChange={(value) => onDischargeObservedChange(fromTriStateOption(value))}
          options={[...TRI_STATE_OPTIONS]}
        />
      </FormField>

      {uterus.dischargeObserved === true ? (
        <FormField label="Discharge Notes" required error={errors.dischargeNotes}>
          <FormTextInput
            value={uterus.dischargeNotes}
            onChangeText={onDischargeNotesChange}
            placeholder="Describe discharge findings"
            multiline
          />
        </FormField>
      ) : null}

      <FormField label="Uterine Fluid Pockets" error={errors.fluidPockets}>
        <View style={styles.fluidWrap}>
          {uterus.fluidPockets.length === 0 ? (
            <Text style={styles.emptyText}>No fluid pockets recorded.</Text>
          ) : (
            uterus.fluidPockets.map((row) => (
              <View key={row.clientId} style={styles.fluidRow}>
                <Text style={styles.fluidRowText}>{formatFluidPocketRow(row)}</Text>
                <View style={styles.fluidActions}>
                  <Pressable
                    style={({ pressed }) => [styles.inlineActionButton, pressed && styles.pressed]}
                    onPress={() => openEditFluidPocket(row.clientId)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.inlineActionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.inlineActionButton,
                      styles.inlineActionDanger,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onRemoveFluidPocket(row.clientId)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.inlineActionDangerText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <Pressable
            style={({ pressed }) => [styles.addPocketButton, pressed && styles.pressed]}
            onPress={openCreateFluidPocket}
            accessibilityRole="button"
          >
            <Text style={styles.addPocketButtonText}>Add Fluid Pocket</Text>
          </Pressable>
        </View>
      </FormField>

      {uterus.fluidPockets.length > 0 ? (
        <FormField
          label="Was a uterine flush performed during this visit?"
          required
          error={errors.flushDecision}
        >
          <OptionSelector<Exclude<FlushDecision, null>>
            value={flushDecision}
            onChange={onFlushDecisionChange}
            options={[
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
            ]}
          />
        </FormField>
      ) : null}

      <FormField label="Uterine Cysts">
        <FormTextInput
          value={uterus.uterineCysts}
          onChangeText={onUterineCystsChange}
          placeholder="(ie: 2cm cyst at left horn base)"
        />
      </FormField>

      <FluidPocketEditor
        visible={isFluidEditorVisible}
        initialValue={editingPocket}
        onSave={handleSaveFluidPocket}
        onClose={closeFluidEditor}
      />
    </>
  );
}

const styles = StyleSheet.create({
  helperText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  fluidWrap: {
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  fluidRow: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    padding: spacing.md,
  },
  fluidRowText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  fluidActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineActionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  inlineActionText: {
    ...typography.labelSmall,
    color: colors.onSurface,
  },
  inlineActionDanger: {
    borderColor: colors.error,
  },
  inlineActionDangerText: {
    ...typography.labelSmall,
    color: colors.error,
  },
  addPocketButton: {
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  addPocketButtonText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  pressed: {
    opacity: 0.7,
  },
});
