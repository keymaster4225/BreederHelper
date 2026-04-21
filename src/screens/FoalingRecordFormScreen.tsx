import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { useRecordForm } from '@/hooks/useRecordForm';
import { FOAL_SEX_OPTIONS, FOALING_OUTCOME_OPTIONS } from '@/models/enums';
import { Screen } from '@/components/Screen';
import { FoalSex, FoalingOutcome } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createFoalingRecord,
  deleteFoalingRecord,
  getFoalByFoalingRecordId,
  getFoalingRecordById,
  listBreedingRecordsByMare,
  updateFoalingRecord,
} from '@/storage/repositories';
import { colors } from '@/theme';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'FoalingRecordForm'>;

type FormErrors = {
  date?: string;
};

export function FoalingRecordFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const foalingRecordId = route.params.foalingRecordId;
  const isEdit = Boolean(foalingRecordId);

  const [breedingOptions, setBreedingOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [breedingRecordId, setBreedingRecordId] = useState('');
  const [date, setDate] = useState('');
  const [outcome, setOutcome] = useState<FoalingOutcome>('liveFoal');
  const [foalSex, setFoalSex] = useState<FoalSex | null>(null);
  const [complications, setComplications] = useState('');
  const [notes, setNotes] = useState('');
  const [hasFoal, setHasFoal] = useState(false);
  const [originalOutcome, setOriginalOutcome] = useState<FoalingOutcome | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, runLoad, runSave, runDelete } = useRecordForm({
    initialLoading: true,
  });
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Foaling Record' : 'Add Foaling Record' });
  }, [isEdit, navigation]);

  useEffect(() => {
    void runLoad(
      async () => {
        const [records, existing, existingFoal] = await Promise.all([
          listBreedingRecordsByMare(mareId),
          foalingRecordId ? getFoalingRecordById(foalingRecordId) : Promise.resolve(null),
          foalingRecordId ? getFoalByFoalingRecordId(foalingRecordId) : Promise.resolve(null),
        ]);
        if (foalingRecordId && !existing) {
          Alert.alert('Record not found', 'This foaling record no longer exists.');
          navigation.goBack();
          return;
        }

        const options = [
          { label: 'None', value: '' },
          ...records.map((record) => ({ label: `${record.date} (${record.method})`, value: record.id })),
        ];
        setBreedingOptions(options);
        setHasFoal(Boolean(existingFoal));

        if (existing) {
          setBreedingRecordId(existing.breedingRecordId ?? '');
          setDate(existing.date);
          setOutcome(existing.outcome);
          setOriginalOutcome(existing.outcome);
          setFoalSex(existing.foalSex ?? null);
          setComplications(existing.complications ?? '');
          setNotes(existing.notes ?? '');
        }
      },
      {
        onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load foaling form data.';
        Alert.alert('Load error', message);
        navigation.goBack();
        },
      },
    );
  }, [foalingRecordId, mareId, navigation, runLoad]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.date;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    if (hasFoal && originalOutcome === 'liveFoal' && outcome !== 'liveFoal') {
      Alert.alert(
        'Cannot change outcome',
        'This foaling record already has a foal record. Delete the foal record before changing the outcome.'
      );
      return;
    }

    await runSave(
      async () => {
        const payload = {
          breedingRecordId: breedingRecordId || null,
          date: date.trim(),
          outcome,
          foalSex,
          complications: complications.trim() || null,
          notes: notes.trim() || null,
        };

        if (foalingRecordId) {
          await updateFoalingRecord(foalingRecordId, payload);
        } else {
          await createFoalingRecord({ id: newId(), mareId, ...payload });
        }

        navigation.goBack();
      },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to save foaling record.';
          Alert.alert('Save failed', message);
        },
      },
    );
  };

  const onDelete = (): void => {
    if (!foalingRecordId) {
      return;
    }

    if (hasFoal) {
      Alert.alert(
        'Cannot delete',
        'This foaling record has a foal record. Delete the foal record first.'
      );
      return;
    }

    confirmDelete({
      title: 'Delete Foaling Record',
      message: 'Delete this foaling record?',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await deleteFoalingRecord(foalingRecordId);
            navigation.goBack();
          },
          {
            onError: (err: unknown) => {
              const message = err instanceof Error ? err.message : 'Failed to delete foaling record.';
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
          <FormTextInput value={complications} onChangeText={setComplications} placeholder="Optional" />
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
            onPress={onDelete}
            disabled={isSaving || isDeleting}
          />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
