import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import {
  FormAutocompleteInput,
  FormCheckbox,
  FormDateInput,
  FormField,
  FormTextInput,
  formStyles,
} from '@/components/FormControls';
import { ProfilePhotoPicker } from '@/components/ProfilePhoto';
import { useEditMareForm } from '@/hooks/useEditMareForm';
import {
  DEFAULT_GESTATION_LENGTH_DAYS,
} from '@/models/types';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';
import { getBreedSuggestions, HORSE_BREEDS } from '@/utils/horseBreeds';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMare'>;

export function EditMareScreen({ navigation, route }: Props): JSX.Element {
  const {
    isEdit,
    today,
    name,
    isRecipient,
    breed,
    gestationLengthDays,
    dateOfBirth,
    registrationNumber,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    setName,
    setIsRecipient,
    setBreed,
    setGestationLengthDays,
    setDateOfBirth,
    setRegistrationNumber,
    setNotes,
    onSave,
    requestDelete,
    profilePhoto,
  } = useEditMareForm({
    mareId: route.params?.mareId,
    onGoBack: () => navigation.goBack(),
    onDeleted: () => navigation.navigate('MainTabs'),
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
        {profilePhoto.enabled ? (
          <FormField label="Profile Photo">
            <ProfilePhotoPicker
              name={name || 'Mare'}
              uri={profilePhoto.photoUri}
              isProcessing={profilePhoto.isProcessing}
              error={profilePhoto.error}
              onTakePhoto={() => { void profilePhoto.takePhoto(); }}
              onChoosePhoto={() => { void profilePhoto.choosePhoto(); }}
              onRemovePhoto={profilePhoto.removePhoto}
            />
          </FormField>
        ) : null}

        <FormField label="Name" required error={errors.name}>
          <FormTextInput value={name} onChangeText={setName} placeholder="Mare name" />
        </FormField>

        <FormField label="Recipient">
          <FormCheckbox
            label="Recipient mare"
            value={isRecipient}
            onChange={setIsRecipient}
          />
        </FormField>

        <FormField label="Breed" required error={errors.breed}>
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

        <FormField label="Gestation Length (days)" required error={errors.gestationLengthDays}>
          <FormTextInput
            value={gestationLengthDays}
            onChangeText={setGestationLengthDays}
            placeholder={String(DEFAULT_GESTATION_LENGTH_DAYS)}
            keyboardType="number-pad"
          />
        </FormField>

        <FormField label="Date of Birth" error={errors.dateOfBirth}>
          <FormDateInput
            value={dateOfBirth}
            onChange={setDateOfBirth}
            placeholder="Select date of birth"
            clearable
            displayFormat="MM-DD-YYYY"
            maximumDate={today}
          />
        </FormField>

        <FormField label="Registration #">
          <FormTextInput value={registrationNumber} onChangeText={setRegistrationNumber} />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <PrimaryButton
          label={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={isSaving || isDeleting}
        />

        {isEdit && (
          <DeleteButton
            label={isDeleting ? 'Deleting...' : 'Delete Mare'}
            onPress={requestDelete}
            disabled={isSaving || isDeleting}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
