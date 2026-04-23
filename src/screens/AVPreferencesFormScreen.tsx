import { useEffect } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { useAVPreferencesForm } from '@/hooks/useAVPreferencesForm';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AVPreferencesForm'>;

export function AVPreferencesFormScreen({ navigation, route }: Props): JSX.Element {
  useEffect(() => {
    navigation.setOptions({ title: 'AV Preferences' });
  }, [navigation]);

  const {
    avTemperatureF,
    avType,
    avLinerType,
    avWaterVolumeMl,
    avNotes,
    errors,
    isLoading,
    isSaving,
    setAvTemperatureF,
    setAvType,
    setAvLinerType,
    setAvWaterVolumeMl,
    setAvNotes,
    onSave,
  } = useAVPreferencesForm({
    stallionId: route.params.stallionId,
    onGoBack: () => navigation.goBack(),
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
