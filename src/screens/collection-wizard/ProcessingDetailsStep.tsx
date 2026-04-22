import { StyleSheet, Text, View } from 'react-native';

import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { FormAutocompleteInput, FormField, FormTextInput } from '@/components/FormControls';
import { colors, spacing, typography } from '@/theme';
import {
  convertMotileToTotalConcentrationMillionsPerMl,
  type CollectionMathDerived,
} from '@/utils/collectionCalculator';
import { EXTENDER_TYPES, getExtenderTypeSuggestions } from '@/utils/extenderTypes';
import { parseOptionalNumber } from '@/utils/validation';

type Props = {
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
  targetMotileSpermMillionsPerDose: string;
  setTargetMotileSpermMillionsPerDose: (value: string) => void;
  targetPostExtensionConcentrationMillionsPerMl: string;
  setTargetPostExtensionConcentrationMillionsPerMl: (value: string) => void;
  extenderType: string;
  setExtenderType: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  derivedMath: CollectionMathDerived;
  errors: {
    targetMotileSpermMillionsPerDose?: string;
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
  progressiveMotilityPercent,
  targetMotileSpermMillionsPerDose,
  setTargetMotileSpermMillionsPerDose,
  targetPostExtensionConcentrationMillionsPerMl,
  setTargetPostExtensionConcentrationMillionsPerMl,
  extenderType,
  setExtenderType,
  notes,
  setNotes,
  derivedMath,
  errors,
}: Props): JSX.Element {
  const externalTotalSpermEquivalent = convertMotileToTotalConcentrationMillionsPerMl(
    parseOptionalNumber(targetPostExtensionConcentrationMillionsPerMl),
    progressiveMotilityPercent,
  );
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
              {progressiveMotilityPercent == null ? '-' : `${progressiveMotilityPercent}%`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.fieldSection}>
        <FormField
          label="Target motile sperm / dose (M)"
          error={errors.targetMotileSpermMillionsPerDose}
        >
          <FormTextInput
            value={targetMotileSpermMillionsPerDose}
            onChangeText={setTargetMotileSpermMillionsPerDose}
            placeholder="Optional"
            keyboardType="numeric"
          />
        </FormField>
        <Text style={styles.helperText}>
          BreedWise stores this target in millions. Example: 1 billion sperm/dose = 1000 M.
        </Text>
      </View>

      <View style={styles.fieldSection}>
        <FormField
          label="Target post-extension concentration (M motile/mL)"
          error={errors.targetPostExtensionConcentrationMillionsPerMl}
        >
          <FormTextInput
            value={targetPostExtensionConcentrationMillionsPerMl}
            onChangeText={setTargetPostExtensionConcentrationMillionsPerMl}
            placeholder="Optional"
            keyboardType="numeric"
          />
        </FormField>
        <Text style={styles.helperText}>
          BreedWise uses motile sperm/mL here. If another calculator shows total sperm/mL, convert it before entering: motile = total x (motility / 100).
        </Text>
        {externalTotalSpermEquivalent != null && progressiveMotilityPercent != null ? (
          <Text style={styles.helperText}>
            {`At ${progressiveMotilityPercent}% motility, this target equals ${externalTotalSpermEquivalent.toFixed(2)} M total/mL in calculators that use total sperm/mL.`}
          </Text>
        ) : null}
      </View>

      <FormField label="Extender Type">
        <FormAutocompleteInput
          value={extenderType}
          onChangeText={setExtenderType}
          options={EXTENDER_TYPES}
          getSuggestions={getExtenderTypeSuggestions}
          placeholder="Type or select extender (optional)"
          autoCapitalize="words"
          autoCorrect={false}
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
            Extender amount is negative. Target concentration is at or above raw motile concentration.
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
