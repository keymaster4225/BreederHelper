import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormDateInput, FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createMare, getMareById, updateMare } from '@/storage/repositories';
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
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);

  const screenTitle = useMemo(() => (isEdit ? 'Edit Mare' : 'Add Mare'), [isEdit]);

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  useEffect(() => {
    if (!mareId) {
      return;
    }

    let mounted = true;
    setIsLoading(true);

    getMareById(mareId)
      .then((mare) => {
        if (!mounted) {
          return;
        }

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
      })
      .catch((err: unknown) => {
        if (!mounted) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Unable to load mare.';
        Alert.alert('Load error', message);
        navigation.goBack();
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [mareId, navigation]);

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

    setIsSaving(true);

    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save mare.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Text>Loading mare...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Name" required error={errors.name}>
          <FormTextInput value={name} onChangeText={setName} placeholder="Mare name" />
        </FormField>

        <FormField label="Breed" required error={errors.breed}>
          <FormTextInput value={breed} onChangeText={setBreed} placeholder="Breed" />
        </FormField>

        <FormField label="Date of Birth" error={errors.dateOfBirth}>
          <FormDateInput value={dateOfBirth} onChange={setDateOfBirth} placeholder="Select date of birth" clearable />
        </FormField>

        <FormField label="Registration #">
          <FormTextInput value={registrationNumber} onChangeText={setRegistrationNumber} placeholder="Optional" />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
        </FormField>

        <Pressable
          disabled={isSaving}
          style={[formStyles.saveButton, isSaving ? formStyles.saveButtonDisabled : null]}
          onPress={onSave}
        >
          <Text style={formStyles.saveButtonText}>
            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Mare'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
