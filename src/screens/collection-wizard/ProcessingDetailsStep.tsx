import { StyleSheet, Text, View } from 'react-native';

import { CardRow, cardStyles } from '@/components/RecordCardParts';
import {
  FormField,
  FormSelectInput,
  FormTextInput,
  OptionSelector,
} from '@/components/FormControls';
import { COLLECTION_TARGET_MODE_OPTIONS } from '@/models/enums';
import type { CollectionTargetMode } from '@/models/types';
import { colors, spacing, typography } from '@/theme';
import { type CollectionMathDerived } from '@/utils/collectionCalculator';
import {
  TARGET_SPERM_HELPER_TEXT,
  TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT,
  formatCollectionEquivalentHelperText,
  getCollectionRawConcentrationLabel,
  getCollectionTargetPostExtensionLabel,
  getCollectionTargetSpermLabel,
  getTargetPostExtensionModeHelperText,
  getTargetPostExtensionRangeHelperText,
} from '@/utils/collectionCalculatorCopy';
import { EXTENDER_TYPES } from '@/utils/extenderTypes';

type Props = {
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  motilityPercent: number | null;
  progressiveMotilityPercent: number | null;
  targetMode: CollectionTargetMode;
  onTargetModeChange: (value: CollectionTargetMode) => void;
  targetSpermMillionsPerDose: string;
  setTargetSpermMillionsPerDose: (value: string) => void;
  targetPostExtensionConcentrationMillionsPerMl: string;
  setTargetPostExtensionConcentrationMillionsPerMl: (value: string) => void;
  extenderOption: string;
  setExtenderOption: (value: string) => void;
  extenderCustom: string;
  setExtenderCustom: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  derivedMath: CollectionMathDerived;
  errors: {
    targetSpermMillionsPerDose?: string;
    targetPostExtensionConcentrationMillionsPerMl?: string;
  };
};

function formatMl(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} mL`;
}

function formatApprox(value: number | null): string {
  return value == null ? '-' : `~${value.toFixed(1)}`;
}

export function ProcessingDetailsStep({
  rawVolumeMl,
  concentrationMillionsPerMl,
  motilityPercent,
  progressiveMotilityPercent,
  targetMode,
  onTargetModeChange,
  targetSpermMillionsPerDose,
  setTargetSpermMillionsPerDose,
  targetPostExtensionConcentrationMillionsPerMl,
  setTargetPostExtensionConcentrationMillionsPerMl,
  extenderOption,
  setExtenderOption,
  extenderCustom,
  setExtenderCustom,
  notes,
  setNotes,
  derivedMath,
  errors,
}: Props): JSX.Element {
  const equivalentHelperText = formatCollectionEquivalentHelperText({
    targetMode,
    equivalentConcentrationMillionsPerMl:
      targetMode === 'total'
        ? derivedMath.targetPostExtensionProgressiveEquivalentMillionsPerMl
        : derivedMath.targetPostExtensionTotalEquivalentMillionsPerMl,
    progressiveMotilityPercent,
  });
  const rangeHelperText = getTargetPostExtensionRangeHelperText(targetMode);
  const hasDerivedValues =
    derivedMath.semenPerDoseMl != null ||
    derivedMath.extenderPerDoseMl != null ||
    derivedMath.doseVolumeMl != null ||
    derivedMath.maxDoses != null;

  return (
    <>
      <View style={styles.chipSection}>
        <Text style={styles.sectionTitle}>Pinned Inputs</Text>
        <View style={styles.chipWrap}>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Total Volume</Text>
            <Text style={styles.chipValue}>
              {rawVolumeMl == null ? '-' : `${rawVolumeMl.toFixed(2)} mL`}
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Concentration</Text>
            <Text style={styles.chipValue}>
              {concentrationMillionsPerMl == null
                ? '-'
                : `${concentrationMillionsPerMl.toFixed(2)} M/mL`}
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Motility</Text>
            <Text style={styles.chipValue}>
              {motilityPercent == null ? '-' : `${motilityPercent}%`}
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Progressive</Text>
            <Text style={styles.chipValue}>
              {progressiveMotilityPercent == null ? '-' : `${progressiveMotilityPercent}%`}
            </Text>
          </View>
        </View>
      </View>

      <FormField label="Target Mode">
        <OptionSelector
          value={targetMode}
          onChange={onTargetModeChange}
          options={COLLECTION_TARGET_MODE_OPTIONS}
        />
      </FormField>

      <View style={styles.fieldSection}>
        <FormField
          label={getCollectionTargetSpermLabel(targetMode)}
          error={errors.targetSpermMillionsPerDose}
        >
          <FormTextInput
            value={targetSpermMillionsPerDose}
            onChangeText={setTargetSpermMillionsPerDose}
            keyboardType="numeric"
          />
        </FormField>
        <Text style={styles.helperText}>{TARGET_SPERM_HELPER_TEXT}</Text>
      </View>

      <View style={styles.fieldSection}>
        <FormField
          label={getCollectionTargetPostExtensionLabel(targetMode)}
          error={errors.targetPostExtensionConcentrationMillionsPerMl}
        >
          <FormTextInput
            value={targetPostExtensionConcentrationMillionsPerMl}
            onChangeText={setTargetPostExtensionConcentrationMillionsPerMl}
            keyboardType="numeric"
          />
        </FormField>
        {rangeHelperText ? <Text style={styles.helperText}>{rangeHelperText}</Text> : null}
        <Text style={styles.helperText}>
          {getTargetPostExtensionModeHelperText(targetMode)}
        </Text>
        {equivalentHelperText ? (
          <Text style={styles.helperText}>{equivalentHelperText}</Text>
        ) : null}
      </View>

      <FormField label="Extender Type">
        <FormSelectInput
          value={extenderOption}
          onChange={setExtenderOption}
          options={EXTENDER_TYPES}
          placeholder="Select extender"
          clearable
        />
      </FormField>

      {extenderOption === 'Other' ? (
        <FormField label="Custom Extender">
          <FormTextInput
            value={extenderCustom}
            onChangeText={setExtenderCustom}
            placeholder="Enter extender name"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </FormField>
      ) : null}

      <FormField label="Notes">
        <FormTextInput
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </FormField>

      <View style={cardStyles.card}>
        <Text style={styles.sectionTitle}>Derived Math</Text>
        {hasDerivedValues ? (
          <>
            <CardRow label="Max Doses Possible" value={formatApprox(derivedMath.maxDoses)} />
            <CardRow label="Semen Per Dose" value={formatMl(derivedMath.semenPerDoseMl)} />
            <CardRow label="Extender Per Dose" value={formatMl(derivedMath.extenderPerDoseMl)} />
            <CardRow label="Dose Volume" value={formatMl(derivedMath.doseVolumeMl)} />
          </>
        ) : (
          <Text style={styles.infoText}>Enter targets to see per-dose math.</Text>
        )}

        {derivedMath.warnings.includes('negative-extender') ? (
          <Text style={styles.warningText}>
            {`Extender amount is negative. Target concentration is at or above the ${getCollectionRawConcentrationLabel(targetMode).toLowerCase()}.`}
          </Text>
        ) : null}
        {derivedMath.warnings.includes('total-mode-missing-motility') ? (
          <Text style={styles.warningText}>
            {TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT}
          </Text>
        ) : null}
        {derivedMath.warnings.includes('target-exceeds-capacity') ? (
          <Text style={styles.warningText}>
            This target appears to exceed what the current collection can produce.
          </Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chipSection: {
    gap: spacing.sm,
  },
  fieldSection: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 999,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  chipValue: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.error,
  },
});
