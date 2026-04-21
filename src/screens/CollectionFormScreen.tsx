import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormAutocompleteInput, FormDateInput, FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  deleteSemenCollection,
  getSemenCollectionById,
  updateSemenCollection,
} from '@/storage/repositories';
import { colors } from '@/theme';
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
  totalVolumeMl?: string;
  extenderVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  progressiveMotilityPercent?: string;
  doseCount?: string;
  doseSizeMillions?: string;
};

export function CollectionFormScreen({ navigation, route }: Props): JSX.Element {
  const collectionId = route.params.collectionId;

  const [collectionDate, setCollectionDate] = useState('');
  const [rawVolumeMl, setRawVolumeMl] = useState('');
  const [totalVolumeMl, setTotalVolumeMl] = useState('');
  const [extenderVolumeMl, setExtenderVolumeMl] = useState('');
  const [extenderType, setExtenderType] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [progressiveMotilityPercent, setProgressiveMotilityPercent] = useState('');
  const [doseCount, setDoseCount] = useState('');
  const [doseSizeMillions, setDoseSizeMillions] = useState('');
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
          setTotalVolumeMl(record.totalVolumeMl != null ? String(record.totalVolumeMl) : '');
          setExtenderVolumeMl(record.extenderVolumeMl != null ? String(record.extenderVolumeMl) : '');
          setExtenderType(record.extenderType ?? '');
          setConcentrationMillionsPerMl(record.concentrationMillionsPerMl != null ? String(record.concentrationMillionsPerMl) : '');
          setProgressiveMotilityPercent(record.progressiveMotilityPercent != null ? String(record.progressiveMotilityPercent) : '');
          setDoseCount(record.doseCount != null ? String(record.doseCount) : '');
          setDoseSizeMillions(record.doseSizeMillions != null ? String(record.doseSizeMillions) : '');
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

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    errs.collectionDate =
      validateLocalDate(collectionDate, 'Collection date', true) ??
      validateLocalDateNotInFuture(collectionDate) ??
      undefined;
    errs.rawVolumeMl = validateNumberRange(parseOptionalNumber(rawVolumeMl), 'Raw Volume', 0, 5000) ?? undefined;
    errs.totalVolumeMl = validateNumberRange(parseOptionalNumber(totalVolumeMl), 'Total Volume', 0, 50000) ?? undefined;
    errs.extenderVolumeMl = validateNumberRange(parseOptionalNumber(extenderVolumeMl), 'Extender Volume', 0, 50000) ?? undefined;
    errs.concentrationMillionsPerMl = validateNumberRange(parseOptionalNumber(concentrationMillionsPerMl), 'Concentration', 0, 100000) ?? undefined;
    errs.progressiveMotilityPercent = validateNumberRange(parseOptionalInteger(progressiveMotilityPercent), 'Motility', 0, 100) ?? undefined;
    errs.doseCount = validateNumberRange(parseOptionalInteger(doseCount), 'Dose Count', 0, 1000) ?? undefined;
    errs.doseSizeMillions = validateNumberRange(parseOptionalNumber(doseSizeMillions), 'Dose Size', 0, 100000) ?? undefined;
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
        rawVolumeMl: parseOptionalNumber(rawVolumeMl),
        totalVolumeMl: parseOptionalNumber(totalVolumeMl),
        extenderVolumeMl: parseOptionalNumber(extenderVolumeMl),
        extenderType: extenderType.trim() || null,
        concentrationMillionsPerMl: parseOptionalNumber(concentrationMillionsPerMl),
        progressiveMotilityPercent: parseOptionalInteger(progressiveMotilityPercent),
        doseCount: parseOptionalInteger(doseCount),
        doseSizeMillions: parseOptionalNumber(doseSizeMillions),
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

          <FormField label="Raw Volume (mL)" error={errors.rawVolumeMl}>
            <FormTextInput value={rawVolumeMl} onChangeText={setRawVolumeMl} placeholder="Optional" keyboardType="numeric" />
          </FormField>

          <FormField label="Total Volume (mL)" error={errors.totalVolumeMl}>
            <FormTextInput value={totalVolumeMl} onChangeText={setTotalVolumeMl} placeholder="Optional" keyboardType="numeric" />
          </FormField>

          <FormField label="Extender Volume (mL)" error={errors.extenderVolumeMl}>
            <FormTextInput value={extenderVolumeMl} onChangeText={setExtenderVolumeMl} placeholder="Optional" keyboardType="numeric" />
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

          <FormField label="Concentration (M/mL)" error={errors.concentrationMillionsPerMl}>
            <FormTextInput value={concentrationMillionsPerMl} onChangeText={setConcentrationMillionsPerMl} placeholder="Optional" keyboardType="numeric" />
          </FormField>

          <FormField label="Progressive Motility (%)" error={errors.progressiveMotilityPercent}>
            <FormTextInput value={progressiveMotilityPercent} onChangeText={setProgressiveMotilityPercent} placeholder="0-100" keyboardType="numeric" />
          </FormField>

          <FormField label="Dose Count" error={errors.doseCount}>
            <FormTextInput value={doseCount} onChangeText={setDoseCount} placeholder="Optional" keyboardType="numeric" />
          </FormField>

          <FormField label="Dose Size (millions)" error={errors.doseSizeMillions}>
            <FormTextInput value={doseSizeMillions} onChangeText={setDoseSizeMillions} placeholder="Optional" keyboardType="numeric" />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
          </FormField>

          <View style={{ gap: 12 }}>
            <PrimaryButton
              label="Update Collection"
              onPress={() => { void onSave(); }}
              disabled={isSaving}
            />
            <DeleteButton label="Delete Collection" onPress={onDelete} disabled={isSaving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
