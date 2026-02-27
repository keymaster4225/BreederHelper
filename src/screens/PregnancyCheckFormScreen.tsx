import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { BreedingRecord, calculateDaysPostBreeding } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createPregnancyCheck,
  deletePregnancyCheck,
  getPregnancyCheckById,
  listBreedingRecordsByMare,
  updatePregnancyCheck,
} from '@/storage/repositories';
import { newId } from '@/utils/id';
import { validateLocalDate, validateRequired } from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'PregnancyCheckForm'>;

type ResultOption = 'positive' | 'negative';
type YesNo = 'yes' | 'no';

type FormErrors = {
  breedingRecordId?: string;
  date?: string;
};

const RESULT_OPTIONS: { label: string; value: ResultOption }[] = [
  { label: 'Positive', value: 'positive' },
  { label: 'Negative', value: 'negative' },
];

const YES_NO_OPTIONS: { label: string; value: YesNo }[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

export function PregnancyCheckFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const pregnancyCheckId = route.params.pregnancyCheckId;
  const isEdit = Boolean(pregnancyCheckId);

  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [breedingRecordId, setBreedingRecordId] = useState('');
  const [date, setDate] = useState('');
  const [result, setResult] = useState<ResultOption>('positive');
  const [heartbeat, setHeartbeat] = useState<YesNo>('no');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Pregnancy Check' : 'Add Pregnancy Check' });
  }, [isEdit, navigation]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      listBreedingRecordsByMare(mareId),
      pregnancyCheckId ? getPregnancyCheckById(pregnancyCheckId) : Promise.resolve(null),
    ])
      .then(([records, existing]) => {
        if (!mounted) {
          return;
        }

        setBreedingRecords(records);

        if (existing) {
          setBreedingRecordId(existing.breedingRecordId);
          setDate(existing.date);
          setResult(existing.result);
          setHeartbeat(existing.heartbeatDetected ? 'yes' : 'no');
          setNotes(existing.notes ?? '');
        } else if (records.length > 0) {
          setBreedingRecordId(records[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Unable to load pregnancy-check form data.';
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
  }, [mareId, navigation, pregnancyCheckId]);

  useEffect(() => {
    if (result === 'negative') {
      setHeartbeat('no');
    }
  }, [result]);

  const selectedBreedingRecord = useMemo(
    () => breedingRecords.find((record) => record.id === breedingRecordId) ?? null,
    [breedingRecordId, breedingRecords]
  );

  const daysPostBreeding = useMemo(() => {
    if (!selectedBreedingRecord || !date.trim()) {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return null;
    }

    return calculateDaysPostBreeding(date.trim(), selectedBreedingRecord.date);
  }, [date, selectedBreedingRecord]);

  const validate = (): boolean => {
    const dateError = validateLocalDate(date, 'Date', true);

    let relativeDateError: string | null = null;
    if (!dateError && selectedBreedingRecord) {
      const delta = calculateDaysPostBreeding(date.trim(), selectedBreedingRecord.date);
      if (delta < 0) {
        relativeDateError = 'Check date cannot be before breeding date.';
      }
    }

    const nextErrors: FormErrors = {
      breedingRecordId: validateRequired(breedingRecordId, 'Breeding record') ?? undefined,
      date: (dateError ?? relativeDateError) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.breedingRecordId && !nextErrors.date;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        breedingRecordId,
        date: date.trim(),
        result,
        heartbeatDetected: result === 'positive' ? heartbeat === 'yes' : false,
        notes: notes.trim() || null,
      };

      if (pregnancyCheckId) {
        await updatePregnancyCheck(pregnancyCheckId, payload);
      } else {
        await createPregnancyCheck({ id: newId(), mareId, ...payload });
      }

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save pregnancy check.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!pregnancyCheckId) {
      return;
    }

    Alert.alert('Delete Pregnancy Check', 'Delete this pregnancy check?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deletePregnancyCheck(pregnancyCheckId);
              navigation.goBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete pregnancy check.';
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
        <Text>Loading pregnancy check...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Breeding Record" required error={errors.breedingRecordId}>
          {breedingRecords.length === 0 ? (
            <Text>No breeding records found for this mare.</Text>
          ) : (
            <OptionSelector
              value={breedingRecordId}
              onChange={setBreedingRecordId}
              options={breedingRecords.map((record) => ({ value: record.id, label: `${record.date} (${record.method})` }))}
            />
          )}
        </FormField>

        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select check date" />
        </FormField>

        <FormField label="Result" required>
          <OptionSelector value={result} onChange={setResult} options={RESULT_OPTIONS} />
        </FormField>

        <FormField label="Heartbeat Detected">
          <OptionSelector value={heartbeat} onChange={setHeartbeat} options={YES_NO_OPTIONS} />
          {result === 'negative' ? <Text>Heartbeat is forced to No for negative checks.</Text> : null}
        </FormField>

        <View>
          <Text>Days post-breeding: {daysPostBreeding === null ? '-' : `${daysPostBreeding}`}</Text>
        </View>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <Pressable
          disabled={isSaving || breedingRecords.length === 0}
          style={[formStyles.saveButton, isSaving || breedingRecords.length === 0 ? formStyles.saveButtonDisabled : null]}
          onPress={onSave}
        >
          <Text style={formStyles.saveButtonText}>{isSaving ? 'Saving...' : isEdit ? 'Save Pregnancy Check' : 'Create Pregnancy Check'}</Text>
        </Pressable>

        {isEdit ? (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete Pregnancy Check</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = {
  deleteButton: {
    alignItems: 'center' as const,
    backgroundColor: '#ffe3e0',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: '#b42318',
    fontSize: 15,
    fontWeight: '700' as const,
  },
};
