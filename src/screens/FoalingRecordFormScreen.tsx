import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { useFoalingRecordForm } from '@/hooks/useFoalingRecordForm';
import { FOAL_SEX_OPTIONS, FOALING_OUTCOME_OPTIONS } from '@/models/enums';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FoalingRecordForm'>;

export function FoalingRecordFormScreen({ navigation, route }: Props): JSX.Element {
  const {
    isEdit,
    today,
    breedingOptions,
    breedingRecordId,
    date,
    outcome,
    foalSex,
    complications,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    setBreedingRecordId,
    setDate,
    setOutcome,
    setFoalSex,
    setComplications,
    setNotes,
    onSave,
    requestDelete,
  } = useFoalingRecordForm({
    mareId: route.params.mareId,
    foalingRecordId: route.params.foalingRecordId,
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
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select foaling date" maximumDate={today} />
        </FormField>

        <FormField label="Breeding Record">
          <OptionSelector value={breedingRecordId} onChange={setBreedingRecordId} options={breedingOptions} />
        </FormField>

        <FormField label="Outcome" required>
          <OptionSelector value={outcome} onChange={setOutcome} options={FOALING_OUTCOME_OPTIONS} />
        </FormField>

        <FormField label="Foal Sex">
          <OptionSelector value={foalSex} onChange={(v) => setFoalSex(v)} options={FOAL_SEX_OPTIONS} />
        </FormField>

        <FormField label="Complications">
          <FormTextInput value={complications} onChangeText={setComplications} />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <PrimaryButton
          label={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={isSaving || isDeleting}
        />

        {isEdit ? (
          <DeleteButton
            label={isDeleting ? 'Deleting...' : 'Delete'}
            onPress={requestDelete}
            disabled={isSaving || isDeleting}
          />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
