import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getStallionById, updateStallion } from '@/storage/repositories';
import { colors } from '@/theme';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateNumberRange,
} from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'AVPreferencesForm'>;

type FormErrors = {
  avTemperatureF?: string;
  avWaterVolumeMl?: string;
};

export function AVPreferencesFormScreen({ navigation, route }: Props): JSX.Element {
  const { stallionId } = route.params;

  const [avTemperatureF, setAvTemperatureF] = useState('');
  const [avType, setAvType] = useState('');
  const [avLinerType, setAvLinerType] = useState('');
  const [avWaterVolumeMl, setAvWaterVolumeMl] = useState('');
  const [avNotes, setAvNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const record = await getStallionById(stallionId);
        if (record) {
          setAvTemperatureF(record.avTemperatureF != null ? String(record.avTemperatureF) : '');
          setAvType(record.avType ?? '');
          setAvLinerType(record.avLinerType ?? '');
          setAvWaterVolumeMl(record.avWaterVolumeMl != null ? String(record.avWaterVolumeMl) : '');
          setAvNotes(record.avNotes ?? '');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [stallionId]);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    errs.avTemperatureF =
      validateNumberRange(parseOptionalNumber(avTemperatureF), 'Temperature', 0, 250) ?? undefined;
    errs.avWaterVolumeMl =
      validateNumberRange(parseOptionalInteger(avWaterVolumeMl), 'Water Volume', 0, 9999) ?? undefined;
    return errs;
  };

  const onSave = async (): Promise<void> => {
    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setIsSaving(true);
    try {
      const record = await getStallionById(stallionId);
      if (!record) {
        Alert.alert('Error', 'Stallion not found.');
        return;
      }

      await updateStallion(stallionId, {
        name: record.name,
        breed: record.breed,
        registrationNumber: record.registrationNumber,
        sire: record.sire,
        dam: record.dam,
        notes: record.notes,
        dateOfBirth: record.dateOfBirth,
        avTemperatureF: parseOptionalNumber(avTemperatureF),
        avType: avType.trim() || null,
        avLinerType: avLinerType.trim() || null,
        avWaterVolumeMl: parseOptionalInteger(avWaterVolumeMl),
        avNotes: avNotes.trim() || null,
      });
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save AV preferences.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

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
          <FormField label="Temperature (°F)" error={errors.avTemperatureF}>
            <FormTextInput
              value={avTemperatureF}
              onChangeText={setAvTemperatureF}
              placeholder="Optional"
              keyboardType="numeric"
            />
          </FormField>

          <FormField label="AV Type">
            <FormTextInput value={avType} onChangeText={setAvType} placeholder="Optional" />
          </FormField>

          <FormField label="Liner Type">
            <FormTextInput value={avLinerType} onChangeText={setAvLinerType} placeholder="Optional" />
          </FormField>

          <FormField label="Water Volume (mL)" error={errors.avWaterVolumeMl}>
            <FormTextInput
              value={avWaterVolumeMl}
              onChangeText={setAvWaterVolumeMl}
              placeholder="Optional"
              keyboardType="numeric"
            />
          </FormField>

          <FormField label="AV Notes">
            <FormTextInput value={avNotes} onChangeText={setAvNotes} multiline placeholder="Optional" />
          </FormField>

          <View style={{ gap: 12 }}>
            <PrimaryButton
              label="Save AV Preferences"
              onPress={() => { void onSave(); }}
              disabled={isSaving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
