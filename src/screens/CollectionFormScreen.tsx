import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { FormAutocompleteInput, FormDateInput, FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  deleteSemenCollection,
  getSemenCollectionById,
  updateSemenCollection,
} from '@/storage/repositories';
import { colors } from '@/theme';
import { deriveCollectionMath } from '@/utils/collectionCalculator';
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
  targetMotileSpermMillionsPerDose?: string;
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
  const [targetMotileSpermMillionsPerDose, setTargetMotileSpermMillionsPerDose] = useState('');
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
          setTargetMotileSpermMillionsPerDose(
            record.targetMotileSpermMillionsPerDose != null
              ? String(record.targetMotileSpermMillionsPerDose)
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
  const parsedTargetMotileSpermMillionsPerDose = parseOptionalNumber(
    targetMotileSpermMillionsPerDose,
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
        targetMotileSpermMillionsPerDose: parsedTargetMotileSpermMillionsPerDose,
        targetPostExtensionConcentrationMillionsPerMl:
          parsedTargetPostExtensionConcentrationMillionsPerMl,
      }),
    [
      parsedConcentrationMillionsPerMl,
      parsedProgressiveMotilityPercent,
      parsedRawVolumeMl,
      parsedTargetMotileSpermMillionsPerDose,
      parsedTargetPostExtensionConcentrationMillionsPerMl,
    ],
  );

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
    errs.targetMotileSpermMillionsPerDose = validatePositiveOptionalNumber(
      targetMotileSpermMillionsPerDose,
      'Target motile sperm per dose',
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
        targetMotileSpermMillionsPerDose: parsedTargetMotileSpermMillionsPerDose,
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
              label="Raw Motile Concentration"
              value={
                derivedMath.rawMotileConcentrationMillionsPerMl == null
                  ? '-'
                  : `${derivedMath.rawMotileConcentrationMillionsPerMl.toFixed(2)} M/mL`
              }
            />
            <CardRow label="Semen Per Dose" value={formatMl(derivedMath.semenPerDoseMl)} />
            <CardRow label="Extender Per Dose" value={formatMl(derivedMath.extenderPerDoseMl)} />
            <CardRow label="Dose Volume" value={formatMl(derivedMath.doseVolumeMl)} />
            <CardRow
              label="Max Doses"
              value={derivedMath.maxDoses == null ? '-' : `~${derivedMath.maxDoses.toFixed(1)}`}
            />
            {derivedMath.warnings.includes('negative-extender') ? (
              <Text style={styles.warningText}>
                Extender amount is negative. Target concentration is at or above raw motile concentration.
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
