import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createStallion,
  getStallionById,
  softDeleteStallion,
  updateStallion,
} from '@/storage/repositories';
import { colors } from '@/theme';
import { newId } from '@/utils/id';
import {
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateRequired,
} from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'StallionForm'>;

type FormErrors = {
  name?: string;
  dateOfBirth?: string;
};

export function StallionFormScreen({ navigation, route }: Props): JSX.Element {
  const stallionId = route.params?.stallionId;
  const isEdit = Boolean(stallionId);

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [breed, setBreed] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Stallion' : 'Add Stallion' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (!stallionId) return;
    void (async () => {
      try {
        const record = await getStallionById(stallionId);
        if (record) {
          setName(record.name);
          setDateOfBirth(record.dateOfBirth ?? '');
          setBreed(record.breed ?? '');
          setRegistrationNumber(record.registrationNumber ?? '');
          setSire(record.sire ?? '');
          setDam(record.dam ?? '');
          setNotes(record.notes ?? '');
        }
      } finally {
        setIsLoadingRecord(false);
      }
    })();
  }, [stallionId]);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    errs.name = validateRequired(name, 'Name') ?? undefined;
    errs.dateOfBirth =
      validateLocalDate(dateOfBirth, 'Date of birth') ??
      validateLocalDateNotInFuture(dateOfBirth) ??
      undefined;
    return errs;
  };

  const onSave = async (): Promise<void> => {
    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        breed: breed.trim() || null,
        registrationNumber: registrationNumber.trim() || null,
        sire: sire.trim() || null,
        dam: dam.trim() || null,
        notes: notes.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
      };

      if (isEdit && stallionId) {
        await updateStallion(stallionId, payload);
      } else {
        await createStallion({ id: newId(), ...payload });
      }
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save stallion.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!stallionId) return;
    Alert.alert(
      'Delete Stallion',
      'This stallion will be removed from the list. Existing breeding records will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteStallion(stallionId);
                navigation.goBack();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unable to delete stallion.';
                Alert.alert('Delete error', message);
              }
            })();
          },
        },
      ],
    );
  };

  if (isLoadingRecord) {
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
            <FormTextInput value={breed} onChangeText={setBreed} placeholder="Optional" />
          </FormField>

          <FormField label="Registration Number">
            <FormTextInput value={registrationNumber} onChangeText={setRegistrationNumber} placeholder="Optional" />
          </FormField>

          <FormField label="Sire">
            <FormTextInput value={sire} onChangeText={setSire} placeholder="Optional" />
          </FormField>

          <FormField label="Dam">
            <FormTextInput value={dam} onChangeText={setDam} placeholder="Optional" />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
          </FormField>

          <View style={{ gap: 12 }}>
            <PrimaryButton
              label={isEdit ? 'Update Stallion' : 'Add Stallion'}
              onPress={() => { void onSave(); }}
              disabled={isSaving}
            />
            {isEdit ? <DeleteButton label="Delete Stallion" onPress={onDelete} disabled={isSaving} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
