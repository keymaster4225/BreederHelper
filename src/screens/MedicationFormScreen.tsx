import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useMedicationForm } from '@/hooks/useMedicationForm';
import { FormActionBar, STICKY_ACTION_BAR_SCROLL_PADDING } from '@/components/FormActionBar';
import { FormDateInput, FormField, FormTextInput, FormTimeInput, OptionSelector, formStyles } from '@/components/FormControls';
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
    time,
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
    setTime,
    setDose,
    setSelectedRoute,
    setNotes,
    onSave,
    onSaveAndAddFollowUp,
    onDelete,
  } = useMedicationForm({
    mareId,
    medicationLogId,
    taskId: route.params.taskId,
    defaultDate: route.params.defaultDate,
    onGoBack: () => navigation.goBack(),
    onAddFollowUpTask: (params) => navigation.replace('TaskForm', params),
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[formStyles.form, styles.formWithActionBar]}
          keyboardShouldPersistTaps="handled"
        >
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

          <FormField label="Time" required error={errors.time}>
            <FormTimeInput
              value={time}
              onChange={setTime}
              placeholder="Select administration time"
              accessibilityLabel="Medication administration time"
            />
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
        </ScrollView>
        <FormActionBar
          primaryLabel={isSaving ? 'Saving...' : 'Save'}
          onPrimaryPress={onSave}
          primaryDisabled={isSaving}
          secondaryLabel="Save & Add Follow-up"
          onSecondaryPress={onSaveAndAddFollowUp}
          secondaryDisabled={isSaving}
          destructiveLabel={isEdit ? 'Delete' : undefined}
          onDestructivePress={isEdit ? onDelete : undefined}
          destructiveDisabled={isSaving}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  formWithActionBar: {
    paddingBottom: STICKY_ACTION_BAR_SCROLL_PADDING,
  },
});
