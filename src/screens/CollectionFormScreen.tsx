import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { COLLECTION_TARGET_MODE_OPTIONS } from '@/models/enums';
import type { CollectionTargetMode } from '@/models/types';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  deleteSemenCollection,
  getSemenCollectionById,
  updateSemenCollection,
} from '@/storage/repositories';
import { colors } from '@/theme';
import { deriveCollectionMath } from '@/utils/collectionCalculator';
import {
  TARGET_SPERM_HELPER_TEXT,
  TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT,
  formatCollectionEquivalentHelperText,
  formatCollectionEquivalentValue,
  getCollectionEquivalentLabel,
  getCollectionRawConcentrationLabel,
  getCollectionTargetPostExtensionLabel,
  getCollectionTargetSpermLabel,
  getTargetPostExtensionModeHelperText,
  getTargetPostExtensionRangeHelperText,
} from '@/utils/collectionCalculatorCopy';
import {
  getEffectiveCollectionTargetMode,
  getPersistedCollectionTargetMode,
} from '@/utils/collectionTargetMode';
import { EXTENDER_TYPES, getExtenderTypeSuggestions } from '@/utils/extenderTypes';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
} from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionForm'>;

type FormErrors = {
  collectionDate?: string;
  rawVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  progressiveMotilityPercent?: string;
  targetSpermMillionsPerDose?: string;
  targetPostExtensionConcentrationMillionsPerMl?: string;
};

function validatePositiveOptionalNumber(
  value: string,
  label: string,
  max: number,
): string | undefined {
  const parsed = parseOptionalNumber(value);
  const rangeError = validateNumberRange(parsed, label, 0, max);
  if (rangeError) {
    return rangeError;
  }

  if (parsed === 0) {
    return `${label} must be greater than 0.`;
  }

  return undefined;
}

function formatMl(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} mL`;
}

export function CollectionFormScreen({ navigation, route }: Props): JSX.Element {
  const collectionId = route.params.collectionId;

  const [collectionDate, setCollectionDate] = useState('');
  const [rawVolumeMl, setRawVolumeMl] = useState('');
  const [extenderType, setExtenderType] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [progressiveMotilityPercent, setProgressiveMotilityPercent] = useState('');
  const [targetMode, setTargetMode] = useState<CollectionTargetMode>('progressive');
  const [targetSpermMillionsPerDose, setTargetSpermMillionsPerDose] = useState('');
  const [
    targetPostExtensionConcentrationMillionsPerMl,
    setTargetPostExtensionConcentrationMillionsPerMl,
  ] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: 'Edit Collection' });
  }, [navigation]);

  useEffect(() => {
    void (async () => {
      try {
        const record = await getSemenCollectionById(collectionId);
        if (record) {
          setCollectionDate(record.collectionDate);
          setRawVolumeMl(record.rawVolumeMl != null ? String(record.rawVolumeMl) : '');
          setExtenderType(record.extenderType ?? '');
          setConcentrationMillionsPerMl(
            record.concentrationMillionsPerMl != null
              ? String(record.concentrationMillionsPerMl)
              : '',
          );
          setProgressiveMotilityPercent(
            record.progressiveMotilityPercent != null
              ? String(record.progressiveMotilityPercent)
              : '',
          );
          setTargetMode(getEffectiveCollectionTargetMode(record.targetMode));
          setTargetSpermMillionsPerDose(
            record.targetSpermMillionsPerDose != null
              ? String(record.targetSpermMillionsPerDose)
              : '',
          );
          setTargetPostExtensionConcentrationMillionsPerMl(
            record.targetPostExtensionConcentrationMillionsPerMl != null
              ? String(record.targetPostExtensionConcentrationMillionsPerMl)
              : '',
          );
          setNotes(record.notes ?? '');
        } else {
          Alert.alert('Collection not found', 'This collection no longer exists.');
          navigation.goBack();
        }
      } finally {
        setIsLoadingRecord(false);
      }
    })();
  }, [collectionId, navigation]);

  const parsedRawVolumeMl = parseOptionalNumber(rawVolumeMl);
  const parsedConcentrationMillionsPerMl = parseOptionalNumber(concentrationMillionsPerMl);
  const parsedProgressiveMotilityPercent = parseOptionalInteger(progressiveMotilityPercent);
  const parsedTargetSpermMillionsPerDose = parseOptionalNumber(
    targetSpermMillionsPerDose,
  );
  const parsedTargetPostExtensionConcentrationMillionsPerMl = parseOptionalNumber(
    targetPostExtensionConcentrationMillionsPerMl,
  );

  const derivedMath = useMemo(
    () =>
      deriveCollectionMath({
        rawVolumeMl: parsedRawVolumeMl,
        concentrationMillionsPerMl: parsedConcentrationMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
        targetMode,
        targetSpermMillionsPerDose: parsedTargetSpermMillionsPerDose,
        targetPostExtensionConcentrationMillionsPerMl:
          parsedTargetPostExtensionConcentrationMillionsPerMl,
      }),
    [
      parsedConcentrationMillionsPerMl,
      parsedProgressiveMotilityPercent,
      parsedRawVolumeMl,
      parsedTargetSpermMillionsPerDose,
      parsedTargetPostExtensionConcentrationMillionsPerMl,
      targetMode,
    ],
  );
  const equivalentHelperText = useMemo(
    () =>
      formatCollectionEquivalentHelperText({
        targetMode,
        equivalentConcentrationMillionsPerMl:
          targetMode === 'total'
            ? derivedMath.targetPostExtensionProgressiveEquivalentMillionsPerMl
            : derivedMath.targetPostExtensionTotalEquivalentMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
      }),
    [derivedMath, parsedProgressiveMotilityPercent, targetMode],
  );
  const equivalentValue = useMemo(
    () =>
      formatCollectionEquivalentValue({
        equivalentConcentrationMillionsPerMl:
          targetMode === 'total'
            ? derivedMath.targetPostExtensionProgressiveEquivalentMillionsPerMl
            : derivedMath.targetPostExtensionTotalEquivalentMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
      }),
    [derivedMath, parsedProgressiveMotilityPercent, targetMode],
  );
  const rangeHelperText = getTargetPostExtensionRangeHelperText(targetMode);

  const onTargetModeChange = (nextTargetMode: CollectionTargetMode): void => {
    if (nextTargetMode === targetMode) {
      return;
    }

    setTargetMode(nextTargetMode);
    setTargetSpermMillionsPerDose('');
    setTargetPostExtensionConcentrationMillionsPerMl('');
    setErrors((current) => ({
      ...current,
      targetSpermMillionsPerDose: undefined,
      targetPostExtensionConcentrationMillionsPerMl: undefined,
    }));
  };

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    errs.collectionDate =
      validateLocalDate(collectionDate, 'Collection date', true) ??
      validateLocalDateNotInFuture(collectionDate) ??
      undefined;
    errs.rawVolumeMl = validatePositiveOptionalNumber(rawVolumeMl, 'Total Volume', 5000);
    errs.concentrationMillionsPerMl = validatePositiveOptionalNumber(
      concentrationMillionsPerMl,
      'Concentration',
      100000,
    );
    errs.progressiveMotilityPercent =
      validateNumberRange(
        parsedProgressiveMotilityPercent,
        'Progressive Motility',
        0,
        100,
      ) ?? undefined;
    errs.targetSpermMillionsPerDose = validatePositiveOptionalNumber(
      targetSpermMillionsPerDose,
      'Target sperm per dose',
      100000,
    );
    errs.targetPostExtensionConcentrationMillionsPerMl = validatePositiveOptionalNumber(
      targetPostExtensionConcentrationMillionsPerMl,
      'Target post-extension concentration',
      100000,
    );
    return errs;
  };

  const onSave = async (): Promise<void> => {
    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setIsSaving(true);
    try {
      const payload = {
        collectionDate,
        rawVolumeMl: parsedRawVolumeMl,
        extenderType: extenderType.trim() || null,
        concentrationMillionsPerMl: parsedConcentrationMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
        targetMode: getPersistedCollectionTargetMode({
          targetMode,
          targetSpermMillionsPerDose: parsedTargetSpermMillionsPerDose,
          targetPostExtensionConcentrationMillionsPerMl:
            parsedTargetPostExtensionConcentrationMillionsPerMl,
        }),
        targetSpermMillionsPerDose: parsedTargetSpermMillionsPerDose,
        targetPostExtensionConcentrationMillionsPerMl:
          parsedTargetPostExtensionConcentrationMillionsPerMl,
        notes: notes.trim() || null,
      };

      await updateSemenCollection(collectionId, payload);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save collection.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    Alert.alert(
      'Delete Collection',
      'Are you sure you want to delete this collection record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteSemenCollection(collectionId);
                navigation.goBack();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unable to delete collection.';
                Alert.alert('Delete blocked', message);
              }
            })();
          },
        },
      ],
    );
  };

  if (isLoadingRecord) {
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
            <FormTextInput value={rawVolumeMl} onChangeText={setRawVolumeMl} placeholder="Optional" keyboardType="numeric" />
          </FormField>

          <FormField label="Concentration (M/mL, raw)" error={errors.concentrationMillionsPerMl}>
            <FormTextInput
              value={concentrationMillionsPerMl}
              onChangeText={setConcentrationMillionsPerMl}
              placeholder="Optional"
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
                placeholder="Optional"
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
                placeholder="Optional"
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
              placeholder="Type or select extender (optional)"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
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
                {TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT}
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
            <DeleteButton label="Delete Collection" onPress={onDelete} disabled={isSaving} />
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
