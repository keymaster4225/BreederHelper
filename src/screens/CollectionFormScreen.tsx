import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import {
  FormAutocompleteInput,
  FormDateInput,
  FormField,
  FormTextInput,
  OptionSelector,
  formStyles,
} from '@/components/FormControls';
import { useCollectionForm } from '@/hooks/useCollectionForm';
import { COLLECTION_TARGET_MODE_OPTIONS } from '@/models/enums';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';
import {
  getCollectionEquivalentLabel,
  getCollectionRawConcentrationLabel,
} from '@/utils/collectionCalculatorCopy';
import { EXTENDER_TYPES, getExtenderTypeSuggestions } from '@/utils/extenderTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionForm'>;

function formatMl(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} mL`;
}

export function CollectionFormScreen({ navigation, route }: Props): JSX.Element {
  const {
    today,
    collectionDate,
    rawVolumeMl,
    extenderType,
    concentrationMillionsPerMl,
    motilityPercent,
    progressiveMotilityPercent,
    targetMode,
    targetSpermMillionsPerDose,
    targetPostExtensionConcentrationMillionsPerMl,
    notes,
    errors,
    isLoading,
    isSaving,
    derivedMath,
    equivalentHelperText,
    equivalentValue,
    rangeHelperText,
    targetSpermHelperText,
    totalModeMissingMotilityWarningText,
    getCollectionTargetPostExtensionLabel,
    getCollectionTargetSpermLabel,
    getTargetPostExtensionModeHelperText,
    setCollectionDate,
    setRawVolumeMl,
    setExtenderType,
    setConcentrationMillionsPerMl,
    setMotilityPercent,
    setProgressiveMotilityPercent,
    setTargetSpermMillionsPerDose,
    setTargetPostExtensionConcentrationMillionsPerMl,
    setNotes,
    onTargetModeChange,
    onSave,
    requestDelete,
  } = useCollectionForm({
    collectionId: route.params.collectionId,
    onGoBack: () => navigation.goBack(),
    setTitle: (title) => navigation.setOptions({ title }),
  });

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <FormField label="Collection Date" required error={errors.collectionDate}>
            <FormDateInput value={collectionDate} onChange={setCollectionDate} maximumDate={today} displayFormat="MM-DD-YYYY" />
          </FormField>

          <FormField label="Total Volume (mL)" error={errors.rawVolumeMl}>
            <FormTextInput value={rawVolumeMl} onChangeText={setRawVolumeMl} keyboardType="numeric" />
          </FormField>

          <FormField label="Concentration (M/mL, raw)" error={errors.concentrationMillionsPerMl}>
            <FormTextInput
              value={concentrationMillionsPerMl}
              onChangeText={setConcentrationMillionsPerMl}
              keyboardType="numeric"
            />
          </FormField>

          <FormField label="Motility (%)" error={errors.motilityPercent}>
            <FormTextInput
              value={motilityPercent}
              onChangeText={setMotilityPercent}
              placeholder="0-100"
              keyboardType="numeric"
            />
          </FormField>

          <FormField label="Progressive Motility (%)" error={errors.progressiveMotilityPercent}>
            <FormTextInput
              value={progressiveMotilityPercent}
              onChangeText={setProgressiveMotilityPercent}
              placeholder="0-100"
              keyboardType="numeric"
            />
          </FormField>

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
            <Text style={styles.helperText}>{targetSpermHelperText}</Text>
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
            <FormAutocompleteInput
              value={extenderType}
              onChangeText={setExtenderType}
              options={EXTENDER_TYPES}
              getSuggestions={getExtenderTypeSuggestions}
              placeholder="Type or select extender"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <View style={cardStyles.card}>
            <Text style={styles.sectionTitle}>Derived Plan</Text>
            <CardRow
              label={getCollectionRawConcentrationLabel(targetMode)}
              value={
                derivedMath.rawModeConcentrationMillionsPerMl == null
                  ? '-'
                  : `${derivedMath.rawModeConcentrationMillionsPerMl.toFixed(2)} M/mL`
              }
            />
            <CardRow label="Semen Per Dose" value={formatMl(derivedMath.semenPerDoseMl)} />
            <CardRow label="Extender Per Dose" value={formatMl(derivedMath.extenderPerDoseMl)} />
            <CardRow label="Dose Volume" value={formatMl(derivedMath.doseVolumeMl)} />
            {equivalentValue ? (
              <CardRow
                label={getCollectionEquivalentLabel(targetMode)}
                value={equivalentValue}
              />
            ) : null}
            <CardRow
              label="Max Doses"
              value={derivedMath.maxDoses == null ? '-' : `~${derivedMath.maxDoses.toFixed(1)}`}
            />
            {derivedMath.warnings.includes('negative-extender') ? (
              <Text style={styles.warningText}>
                {`Extender amount is negative. Target concentration is at or above the ${getCollectionRawConcentrationLabel(targetMode).toLowerCase()}.`}
              </Text>
            ) : null}
            {derivedMath.warnings.includes('total-mode-missing-motility') ? (
              <Text style={styles.warningText}>
                {totalModeMissingMotilityWarningText}
              </Text>
            ) : null}
            {derivedMath.warnings.includes('target-exceeds-capacity') ? (
              <Text style={styles.warningText}>
                Current targets appear to exceed collection capacity.
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 12 }}>
            <PrimaryButton
              label="Update Collection"
              onPress={() => {
                void onSave();
              }}
              disabled={isSaving}
            />
            <DeleteButton label="Delete Collection" onPress={requestDelete} disabled={isSaving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldSection: {
    gap: 4,
  },
  helperText: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    color: colors.error,
    fontSize: 12,
  },
});
