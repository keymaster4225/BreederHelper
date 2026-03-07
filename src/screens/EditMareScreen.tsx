import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormSelectInput, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createMare, getMareById, softDeleteMare, updateMare } from '@/storage/repositories';
import { colors } from '@/theme';
import { newId } from '@/utils/id';
import { normalizeLocalDate, validateLocalDate, validateRequired } from '@/utils/validation';

const HORSE_BREEDS = [
  'Hanoverian',
  'KWPN',
  'Oldenburg (GOV)',
  'Oldenburg (ISR/OLD)',
  'Westfalen',
  'Trakehner',
  'Holsteiner',
  'Thoroughbred',
  'Swedish Warmblood',
  'Belgian Warmblood',
  'Irish Sport Horse',
  'American Warmblood',
  'Quarter Horse',
  'Paint',
  'Morgan',
];

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
  const [isDeleting, setIsDeleting] = useState(false);
  const today = new Date();

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

  const onDelete = (): void => {
    if (!mareId) {
      return;
    }

    Alert.alert(
      'Delete Mare',
      'Are you sure you want to delete this mare? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await softDeleteMare(mareId);
              navigation.navigate('Home');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete mare.';
              Alert.alert('Delete failed', message);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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
          />
        )}
      </ScrollView>
    </Screen>
  );
}
