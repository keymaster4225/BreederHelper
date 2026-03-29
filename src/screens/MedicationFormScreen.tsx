import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createMedicationLog, deleteMedicationLog, getMedicationLogById, updateMedicationLog } from '@/storage/repositories';
import { colors } from '@/theme';
import { newId } from '@/utils/id';
import { MEDICATION_ROUTE_OPTIONS, PREDEFINED_MEDICATIONS } from '@/utils/medications';
import { validateLocalDate, validateLocalDateNotInFuture, validateRequired } from '@/utils/validation';
import { toLocalDate } from '@/utils/dates';
import type { MedicationRoute } from '@/models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationForm'>;

type MedSelection = typeof PREDEFINED_MEDICATIONS[number] | 'custom';

type FormErrors = {
  medicationName?: string;
  date?: string;
};

const MED_OPTIONS: { label: string; value: MedSelection }[] = [
  ...PREDEFINED_MEDICATIONS.map((med) => ({ label: med, value: med as MedSelection })),
  { label: 'Custom', value: 'custom' as const },
];

export function MedicationFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const medicationLogId = route.params.medicationLogId;
  const isEdit = Boolean(medicationLogId);

  const [selectedMed, setSelectedMed] = useState<MedSelection | null>(null);
  const [customMedName, setCustomMedName] = useState('');
  const [date, setDate] = useState(toLocalDate(new Date()));
  const [dose, setDose] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<MedicationRoute | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Medication' : 'Add Medication' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (!medicationLogId) return;

    let mounted = true;
    getMedicationLogById(medicationLogId)
      .then((record) => {
        if (!mounted) return;

        if (!record) {
          Alert.alert('Not found', 'This medication log no longer exists.');
          navigation.goBack();
          return;
        }

        const predefined = PREDEFINED_MEDICATIONS.find((m) => m === record.medicationName);
        if (predefined) {
          setSelectedMed(predefined);
        } else {
          setSelectedMed('custom');
          setCustomMedName(record.medicationName);
        }

        setDate(record.date);
        setDose(record.dose ?? '');
        setSelectedRoute(record.route);
        setNotes(record.notes ?? '');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load medication log.';
        Alert.alert('Load error', message);
        navigation.goBack();
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [medicationLogId, navigation]);

  const getMedicationName = (): string => {
    if (selectedMed === 'custom') return customMedName.trim();
    return selectedMed ?? '';
  };

  const validate = (): boolean => {
    const medName = getMedicationName();
    const nextErrors: FormErrors = {
      medicationName: (validateRequired(medName, 'Medication')) ?? undefined,
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.medicationName && !nextErrors.date;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const payload = {
        date: date.trim(),
        medicationName: getMedicationName(),
        dose: dose.trim() || null,
        route: selectedRoute,
        notes: notes.trim() || null,
      };

      if (medicationLogId) {
        await updateMedicationLog(medicationLogId, payload);
      } else {
        await createMedicationLog({ id: newId(), mareId, ...payload });
      }

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save medication log.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!medicationLogId) return;

    Alert.alert('Delete Medication Log', 'Delete this medication log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteMedicationLog(medicationLogId);
              navigation.goBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete medication log.';
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
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <FormField label="Medication" required error={errors.medicationName}>
            <OptionSelector value={selectedMed} onChange={setSelectedMed} options={MED_OPTIONS} />
            {selectedMed === 'custom' ? (
              <FormTextInput
                value={customMedName}
                onChangeText={setCustomMedName}
                placeholder="Enter medication name"
              />
            ) : null}
          </FormField>

          <FormField label="Date" required error={errors.date}>
            <FormDateInput value={date} onChange={setDate} placeholder="Select date" displayFormat="MM-DD-YYYY" maximumDate={today} />
          </FormField>

          <FormField label="Dose">
            <FormTextInput value={dose} onChangeText={setDose} placeholder="e.g., 10 mL" />
          </FormField>

          <FormField label="Route">
            <OptionSelector
              value={selectedRoute}
              onChange={setSelectedRoute}
              options={MEDICATION_ROUTE_OPTIONS as { label: string; value: MedicationRoute }[]}
              allowDeselect
            />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <PrimaryButton
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={onSave}
            disabled={isSaving}
          />

          {isEdit ? (
            <DeleteButton label="Delete" onPress={onDelete} disabled={isSaving} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
