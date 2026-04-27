import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { LocalDate, MedicationRoute } from '@/models/types';
import { createMedicationLog, deleteMedicationLog, getMedicationLogById, updateMedicationLog } from '@/storage/repositories';
import { toLocalDate } from '@/utils/dates';
import { newId } from '@/utils/id';
import { PREDEFINED_MEDICATIONS } from '@/utils/medications';
import { validateLocalDate, validateLocalDateNotInFuture, validateRequired } from '@/utils/validation';
import { completeLinkedTaskAfterSave } from './completeLinkedTaskAfterSave';

type MedSelection = typeof PREDEFINED_MEDICATIONS[number] | 'custom';

type FormErrors = {
  readonly medicationName?: string;
  readonly date?: string;
};

type UseMedicationFormArgs = {
  readonly mareId: string;
  readonly medicationLogId?: string;
  readonly taskId?: string;
  readonly defaultDate?: LocalDate;
  readonly onGoBack: () => void;
  readonly onOpenSourceDailyLog?: (sourceDailyLogId: string) => void;
  readonly setTitle: (title: string) => void;
};

type UseMedicationFormResult = {
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

export function useMedicationForm({
  mareId,
  medicationLogId,
  taskId,
  defaultDate,
  onGoBack,
  onOpenSourceDailyLog,
  setTitle,
}: UseMedicationFormArgs): UseMedicationFormResult {
  const isEdit = Boolean(medicationLogId);
  const onGoBackRef = useRef(onGoBack);
  const onOpenSourceDailyLogRef = useRef(onOpenSourceDailyLog);
  const setTitleRef = useRef(setTitle);

  const [selectedMed, setSelectedMed] = useState<MedSelection | null>(null);
  const [customMedName, setCustomMedName] = useState('');
  const [date, setDate] = useState(defaultDate ?? toLocalDate(new Date()));
  const [dose, setDose] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<MedicationRoute | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    onOpenSourceDailyLogRef.current = onOpenSourceDailyLog;
    setTitleRef.current = setTitle;
  }, [onGoBack, onOpenSourceDailyLog, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Medication' : 'Add Medication');
  }, [isEdit]);

  useEffect(() => {
    if (!medicationLogId) return;

    let mounted = true;
    void getMedicationLogById(medicationLogId)
      .then((record) => {
        if (!mounted) return;

        if (!record) {
          Alert.alert('Not found', 'This medication log no longer exists.');
          onGoBackRef.current();
          return;
        }

        if (record.sourceDailyLogId) {
          onOpenSourceDailyLogRef.current?.(record.sourceDailyLogId);
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
        const message = err instanceof Error ? err.message : 'Unable to load medication log.';
        Alert.alert('Load error', message);
        onGoBackRef.current();
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [medicationLogId]);

  const getMedicationName = useCallback((): string => {
    if (selectedMed === 'custom') return customMedName.trim();
    return selectedMed ?? '';
  }, [customMedName, selectedMed]);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {
      medicationName: validateRequired(getMedicationName(), 'Medication') ?? undefined,
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.medicationName && !nextErrors.date;
  }, [date, getMedicationName]);

  const onSave = useCallback(async () => {
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

      const savedMedicationLogId = medicationLogId ?? newId();

      if (medicationLogId) {
        await updateMedicationLog(medicationLogId, payload);
      } else {
        await createMedicationLog({ id: savedMedicationLogId, mareId, ...payload });
      }

      await completeLinkedTaskAfterSave({
        taskId,
        completedRecordType: 'medicationLog',
        completedRecordId: savedMedicationLogId,
        onCompletedOrSkipped: onGoBackRef.current,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save medication log.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }, [date, dose, getMedicationName, mareId, medicationLogId, notes, selectedRoute, taskId, validate]);

  const onDelete = useCallback(() => {
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
              onGoBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete medication log.';
              Alert.alert('Delete failed', message);
            }
          })();
        },
      },
    ]);
  }, [medicationLogId, onGoBack]);

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
