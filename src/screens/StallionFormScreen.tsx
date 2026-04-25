import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormAutocompleteInput, FormDateInput, FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { useStallionForm } from '@/hooks/useStallionForm';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';
import { getBreedSuggestions, HORSE_BREEDS } from '@/utils/horseBreeds';

type Props = NativeStackScreenProps<RootStackParamList, 'StallionForm'>;

export function StallionFormScreen({ navigation, route }: Props): JSX.Element {
  const {
    isEdit,
    today,
    name,
    dateOfBirth,
    breed,
    registrationNumber,
    sire,
    dam,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    setName,
    setDateOfBirth,
    setBreed,
    setRegistrationNumber,
    setSire,
    setDam,
    setNotes,
    onSave,
    requestDelete,
  } = useStallionForm({
    stallionId: route.params?.stallionId,
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
          <FormField label="Name" required error={errors.name}>
            <FormTextInput value={name} onChangeText={setName} placeholder="Stallion name" />
          </FormField>

          <FormField label="Date of Birth" error={errors.dateOfBirth}>
            <FormDateInput
              value={dateOfBirth}
              onChange={setDateOfBirth}
              clearable
              displayFormat="MM-DD-YYYY"
              maximumDate={today}
            />
          </FormField>

          <FormField label="Breed">
            <FormAutocompleteInput
              value={breed}
              onChangeText={setBreed}
              options={HORSE_BREEDS}
              getSuggestions={getBreedSuggestions}
              placeholder="Type or select breed"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </FormField>

          <FormField label="Registration Number">
            <FormTextInput value={registrationNumber} onChangeText={setRegistrationNumber} />
          </FormField>

          <FormField label="Sire">
            <FormTextInput value={sire} onChangeText={setSire} />
          </FormField>

          <FormField label="Dam">
            <FormTextInput value={dam} onChangeText={setDam} />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <View style={{ gap: 12 }}>
            <PrimaryButton
              label={isEdit ? 'Update Stallion' : 'Add Stallion'}
              onPress={() => { void onSave(); }}
              disabled={isSaving || isDeleting}
            />
            {isEdit ? (
              <DeleteButton
                label={isDeleting ? 'Deleting...' : 'Delete Stallion'}
                onPress={requestDelete}
                disabled={isSaving || isDeleting}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
