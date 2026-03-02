import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { FoalSex, FoalingOutcome } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createFoalingRecord,
  deleteFoalingRecord,
  getFoalingRecordById,
  listBreedingRecordsByMare,
  updateFoalingRecord,
} from '@/storage/repositories';
import { newId } from '@/utils/id';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';
import { borderRadius, colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FoalingRecordForm'>;

type FormErrors = {
  date?: string;
};

const OUTCOME_OPTIONS: { label: string; value: FoalingOutcome }[] = [
  { label: 'Live Foal', value: 'liveFoal' },
  { label: 'Stillbirth', value: 'stillbirth' },
  { label: 'Aborted', value: 'aborted' },
  { label: 'Unknown', value: 'unknown' },
];

const SEX_OPTIONS: { label: string; value: FoalSex }[] = [
  { label: 'Colt', value: 'colt' },
  { label: 'Filly', value: 'filly' },
  { label: 'Unknown', value: 'unknown' },
];

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
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Foaling Record' : 'Add Foaling Record' });
  }, [isEdit, navigation]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      listBreedingRecordsByMare(mareId),
      foalingRecordId ? getFoalingRecordById(foalingRecordId) : Promise.resolve(null),
    ])
      .then(([records, existing]) => {
        if (!mounted) {
          return;
        }

        const options = [
          { label: 'None', value: '' },
          ...records.map((record) => ({ label: `${record.date} (${record.method})`, value: record.id })),
        ];
        setBreedingOptions(options);

        if (existing) {
          setBreedingRecordId(existing.breedingRecordId ?? '');
          setDate(existing.date);
          setOutcome(existing.outcome);
          setFoalSex(existing.foalSex ?? null);
          setComplications(existing.complications ?? '');
          setNotes(existing.notes ?? '');
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load foaling form data.';
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
  }, [foalingRecordId, mareId, navigation]);

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

    setIsSaving(true);
    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save foaling record.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!foalingRecordId) {
      return;
    }

    Alert.alert('Delete Foaling Record', 'Delete this foaling record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteFoalingRecord(foalingRecordId);
              navigation.goBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete foaling record.';
              Alert.alert('Delete failed', message);
            }
          })();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <Screen>
        <Text>Loading foaling record...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select foaling date" maximumDate={today} />
        </FormField>

        <FormField label="Breeding Record">
          <OptionSelector value={breedingRecordId} onChange={setBreedingRecordId} options={breedingOptions} />
        </FormField>

        <FormField label="Outcome" required>
          <OptionSelector value={outcome} onChange={setOutcome} options={OUTCOME_OPTIONS} />
        </FormField>

        <FormField label="Foal Sex">
          <OptionSelector value={foalSex} onChange={(v) => setFoalSex(v)} options={SEX_OPTIONS} />
        </FormField>

        <FormField label="Complications">
          <FormTextInput value={complications} onChangeText={setComplications} placeholder="Optional" />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <Pressable
          disabled={isSaving}
          style={[formStyles.saveButton, isSaving ? formStyles.saveButtonDisabled : null]}
          onPress={onSave}
        >
          <Text style={formStyles.saveButtonText}>{isSaving ? 'Saving...' : isEdit ? 'Save Foaling Record' : 'Create Foaling Record'}</Text>
        </Pressable>

        {isEdit ? (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete Foaling Record</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = {
  deleteButton: {
    alignItems: 'center' as const,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  deleteButtonText: {
    color: colors.error,
    ...typography.labelLarge,
  },
};
