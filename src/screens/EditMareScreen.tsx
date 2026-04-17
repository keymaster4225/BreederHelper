import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormSelectInput, FormTextInput, formStyles } from '@/components/FormControls';
import { useRecordForm } from '@/hooks/useRecordForm';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createMare, getMareById, softDeleteMare, updateMare } from '@/storage/repositories';
import { colors } from '@/theme';
import { confirmDelete } from '@/utils/confirmDelete';
import { HORSE_BREEDS } from '@/utils/horseBreeds';
import { newId } from '@/utils/id';
import { normalizeLocalDate, validateLocalDate, validateRequired } from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMare'>;

type FormErrors = {
  name?: string;
  breed?: string;
  dateOfBirth?: string;
};

export function EditMareScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params?.mareId;
  const isEdit = Boolean(mareId);

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, setIsLoading, runLoad, runSave, runDelete } =
    useRecordForm({ initialLoading: isEdit });
  const today = new Date();

  const screenTitle = useMemo(() => (isEdit ? 'Edit Mare' : 'Add Mare'), [isEdit]);

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  useEffect(() => {
    if (!mareId) {
      setIsLoading(false);
      return;
    }

    void runLoad(
      async () => {
        const mare = await getMareById(mareId);
        if (!mare) {
          Alert.alert('Mare not found', 'This mare no longer exists.');
          navigation.goBack();
          return;
        }

        setName(mare.name);
        setBreed(mare.breed);
        setDateOfBirth(mare.dateOfBirth ?? '');
        setRegistrationNumber(mare.registrationNumber ?? '');
        setNotes(mare.notes ?? '');
      },
      {
        onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load mare.';
        Alert.alert('Load error', message);
        navigation.goBack();
        },
      },
    );
  }, [mareId, navigation, runLoad, setIsLoading]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      name: validateRequired(name, 'Name') ?? undefined,
      breed: validateRequired(breed, 'Breed') ?? undefined,
      dateOfBirth: validateLocalDate(dateOfBirth, 'Date of birth', false) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.name && !nextErrors.breed && !nextErrors.dateOfBirth;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    await runSave(
      async () => {
        if (mareId) {
          await updateMare(mareId, {
            name: name.trim(),
            breed: breed.trim(),
            dateOfBirth: normalizeLocalDate(dateOfBirth),
            registrationNumber: registrationNumber.trim() || null,
            notes: notes.trim() || null,
          });
        } else {
          await createMare({
            id: newId(),
            name: name.trim(),
            breed: breed.trim(),
            dateOfBirth: normalizeLocalDate(dateOfBirth),
            registrationNumber: registrationNumber.trim() || null,
            notes: notes.trim() || null,
          });
        }

        navigation.goBack();
      },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to save mare.';
          Alert.alert('Save failed', message);
        },
      },
    );
  };

  const onDelete = (): void => {
    if (!mareId) {
      return;
    }

    confirmDelete({
      title: 'Delete Mare',
      message: 'Are you sure you want to delete this mare? This cannot be undone.',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await softDeleteMare(mareId);
            navigation.navigate('MainTabs');
          },
          {
            onError: (err: unknown) => {
              const message = err instanceof Error ? err.message : 'Failed to delete mare.';
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
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
        <FormField label="Name" required error={errors.name}>
          <FormTextInput value={name} onChangeText={setName} placeholder="Mare name" />
        </FormField>

        <FormField label="Breed" required error={errors.breed}>
          <FormSelectInput value={breed} onChange={setBreed} options={HORSE_BREEDS} placeholder="Select breed" />
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
          <FormTextInput value={registrationNumber} onChangeText={setRegistrationNumber} placeholder="Optional" />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
        </FormField>

        <PrimaryButton
          label={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={isSaving || isDeleting}
        />

        {isEdit && (
          <DeleteButton
            label={isDeleting ? 'Deleting...' : 'Delete Mare'}
            onPress={onDelete}
            disabled={isSaving || isDeleting}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
