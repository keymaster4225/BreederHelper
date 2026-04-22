import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MedicationRoute } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createMedicationLog, deleteMedicationLog, getMedicationLogById, updateMedicationLog } from '@/storage/repositories';
import { toLocalDate } from '@/utils/dates';
import { newId } from '@/utils/id';
import { PREDEFINED_MEDICATIONS } from '@/utils/medications';
import { validateLocalDate, validateLocalDateNotInFuture, validateRequired } from '@/utils/validation';

type MedicationFormNavigation = NativeStackNavigationProp<RootStackParamList, 'MedicationForm'>;
type MedicationFormRoute = RouteProp<RootStackParamList, 'MedicationForm'>;
type MedSelection = typeof PREDEFINED_MEDICATIONS[number] | 'custom';

type FormErrors = {
  readonly medicationName?: string;
  readonly date?: string;
};

type UseMedicationFormState = {
  readonly isEdit: boolean;
  readonly selectedMed: MedSelection | null;
  readonly customMedName: string;
  readonly date: string;
  readonly dose: string;
  readonly selectedRoute: MedicationRoute | null;
  readonly notes: string;
  readonly errors: FormErrors;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly today: Date;
  readonly setSelectedMed: (value: MedSelection | null) => void;
  readonly setCustomMedName: (value: string) => void;
  readonly setDate: (value: string) => void;
  readonly setDose: (value: string) => void;
  readonly setSelectedRoute: (value: MedicationRoute | null) => void;
  readonly setNotes: (value: string) => void;
  readonly onSave: () => Promise<void>;
  readonly onDelete: () => void;
};

export function useMedicationForm(
  navigation: MedicationFormNavigation,
  route: MedicationFormRoute
): UseMedicationFormState {
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
    if (!medicationLogId) {
      return;
    }

    let mounted = true;

    getMedicationLogById(medicationLogId)
      .then((record) => {
        if (!mounted) {
          return;
        }

        if (!record) {
          Alert.alert('Not found', 'This medication log no longer exists.');
          navigation.goBack();
          return;
        }

        const predefined = PREDEFINED_MEDICATIONS.find((medication) => medication === record.medicationName);
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
        Alert.alert('Load error', err instanceof Error ? err.message : 'Unable to load medication log.');
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
  }, [medicationLogId, navigation]);

  const getMedicationName = (): string => {
    if (selectedMed === 'custom') {
      return customMedName.trim();
    }
    return selectedMed ?? '';
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      medicationName: validateRequired(getMedicationName(), 'Medication') ?? undefined,
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.medicationName && !nextErrors.date;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

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
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Failed to save medication log.');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!medicationLogId) {
      return;
    }

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
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete medication log.');
            }
          })();
        },
      },
    ]);
  };

  return {
    isEdit,
    selectedMed,
    customMedName,
    date,
    dose,
    selectedRoute,
    notes,
    errors,
    isLoading,
    isSaving,
    today,
    setSelectedMed,
    setCustomMedName,
    setDate,
    setDose,
    setSelectedRoute,
    setNotes,
    onSave,
    onDelete,
  };
}
