import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useMedicationForm } from '@/hooks/useMedicationForm';
import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';
import { MEDICATION_ROUTE_OPTIONS, PREDEFINED_MEDICATIONS } from '@/utils/medications';
import type { MedicationRoute } from '@/models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationForm'>;

type MedSelection = typeof PREDEFINED_MEDICATIONS[number] | 'custom';

const MED_OPTIONS: { label: string; value: MedSelection }[] = [
  ...PREDEFINED_MEDICATIONS.map((med) => ({ label: med, value: med as MedSelection })),
  { label: 'Custom', value: 'custom' as const },
];

export function MedicationFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const medicationLogId = route.params.medicationLogId;
  const {
    isEdit,
    selectedMed,
    customMedName,
    date,
    dose,
    selectedRoute,
    notes,
    errors,
    isLoading,
    isSaving,
    today,
    setSelectedMed,
    setCustomMedName,
    setDate,
    setDose,
    setSelectedRoute,
    setNotes,
    onSave,
    onDelete,
  } = useMedicationForm({
    mareId,
    medicationLogId,
    taskId: route.params.taskId,
    defaultDate: route.params.defaultDate,
    onGoBack: () => navigation.goBack(),
    onOpenSourceDailyLog: (sourceDailyLogId) =>
      navigation.replace('DailyLogForm', { mareId, logId: sourceDailyLogId }),
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
          <FormField label="Medication" required error={errors.medicationName}>
            <OptionSelector value={selectedMed} onChange={setSelectedMed} options={MED_OPTIONS} />
            {selectedMed === 'custom' ? (
              <FormTextInput
                value={customMedName}
                onChangeText={setCustomMedName}
                placeholder="Enter medication name"
              />
            ) : null}
          </FormField>

          <FormField label="Date" required error={errors.date}>
            <FormDateInput value={date} onChange={setDate} placeholder="Select date" displayFormat="MM-DD-YYYY" maximumDate={today} />
          </FormField>

          <FormField label="Dose">
            <FormTextInput value={dose} onChangeText={setDose} placeholder="e.g., 10 mL" />
          </FormField>

          <FormField label="Route">
            <OptionSelector
              value={selectedRoute}
              onChange={setSelectedRoute}
              options={MEDICATION_ROUTE_OPTIONS as { label: string; value: MedicationRoute }[]}
              allowDeselect
            />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <PrimaryButton
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={onSave}
            disabled={isSaving}
          />

          {isEdit ? (
            <DeleteButton label="Delete" onPress={onDelete} disabled={isSaving} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
