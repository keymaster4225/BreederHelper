import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { DEFAULT_GESTATION_LENGTH_DAYS, type BreedingRecord, type PregnancyResult } from '@/models/types';
import {
  calculateDaysPostBreeding,
  estimateFoalingDate,
} from '@/models/types';
import {
  createPregnancyCheck,
  deletePregnancyCheck,
  getMareById,
  getPregnancyCheckById,
  listBreedingRecordsByMare,
  updatePregnancyCheck,
} from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import {
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateRequired,
} from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

type ResultOption = PregnancyResult;
type YesNo = 'yes' | 'no';

type FormErrors = {
  breedingRecordId?: string;
  date?: string;
};

type UsePregnancyCheckFormArgs = {
  readonly mareId: string;
  readonly pregnancyCheckId?: string;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};

export function usePregnancyCheckForm({
  mareId,
  pregnancyCheckId,
  onGoBack,
  setTitle,
}: UsePregnancyCheckFormArgs) {
  const isEdit = Boolean(pregnancyCheckId);
  const today = useMemo(() => new Date(), []);

  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [gestationLengthDays, setGestationLengthDays] = useState(DEFAULT_GESTATION_LENGTH_DAYS);
  const [breedingRecordId, setBreedingRecordId] = useState('');
  const [date, setDate] = useState('');
  const [result, setResult] = useState<ResultOption>('positive');
  const [heartbeat, setHeartbeat] = useState<YesNo>('no');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, runLoad, runSave, runDelete } = useRecordForm({
    initialLoading: true,
  });

  useEffect(() => {
    setTitle(isEdit ? 'Edit Pregnancy Check' : 'Add Pregnancy Check');
  }, [isEdit, setTitle]);

  useEffect(() => {
    void runLoad(
      async () => {
        const [mare, records, existing] = await Promise.all([
          getMareById(mareId),
          listBreedingRecordsByMare(mareId),
          pregnancyCheckId ? getPregnancyCheckById(pregnancyCheckId) : Promise.resolve(null),
        ]);

        if (!mare) {
          Alert.alert('Mare not found', 'This mare no longer exists.');
          onGoBack();
          return;
        }

        if (pregnancyCheckId && !existing) {
          Alert.alert('Record not found', 'This pregnancy check no longer exists.');
          onGoBack();
          return;
        }

        setGestationLengthDays(mare.gestationLengthDays);
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
      },
      {
        onError: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unable to load pregnancy-check form data.';
          Alert.alert('Load error', message);
          onGoBack();
        },
      },
    );
  }, [mareId, onGoBack, pregnancyCheckId, runLoad]);

  useEffect(() => {
    if (result === 'negative') {
      setHeartbeat('no');
    }
  }, [result]);

  const selectedBreedingRecord = useMemo(
    () => breedingRecords.find((record) => record.id === breedingRecordId) ?? null,
    [breedingRecordId, breedingRecords],
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

  const approxDueDate = useMemo(() => {
    if (!selectedBreedingRecord) {
      return null;
    }

    return estimateFoalingDate(selectedBreedingRecord.date, gestationLengthDays);
  }, [gestationLengthDays, selectedBreedingRecord]);

  const validate = useCallback((): boolean => {
    const dateError = validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date);

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
  }, [breedingRecordId, date, selectedBreedingRecord]);

  const onSave = useCallback(async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    await runSave(
      async () => {
        const payload = {
          breedingRecordId,
          date: date.trim(),
          result,
          heartbeatDetected: result === 'positive' ? heartbeat === 'yes' : null,
          notes: notes.trim() || null,
        };

        if (pregnancyCheckId) {
          await updatePregnancyCheck(pregnancyCheckId, payload);
        } else {
          await createPregnancyCheck({ id: newId(), mareId, ...payload });
        }

        onGoBack();
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save pregnancy check.';
          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    breedingRecordId,
    date,
    heartbeat,
    mareId,
    notes,
    onGoBack,
    pregnancyCheckId,
    result,
    runSave,
    validate,
  ]);

  const requestDelete = useCallback((): void => {
    if (!pregnancyCheckId) {
      return;
    }

    confirmDelete({
      title: 'Delete Pregnancy Check',
      message: 'Delete this pregnancy check?',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await deletePregnancyCheck(pregnancyCheckId);
            onGoBack();
          },
          {
            onError: (error: unknown) => {
              const message =
                error instanceof Error ? error.message : 'Failed to delete pregnancy check.';
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
  }, [onGoBack, pregnancyCheckId, runDelete]);

  return {
    isEdit,
    today,
    breedingRecords,
    breedingRecordId,
    date,
    result,
    heartbeat,
    notes,
    errors,
    selectedBreedingRecord,
    daysPostBreeding,
    approxDueDate,
    isLoading,
    isSaving,
    isDeleting,
    setBreedingRecordId,
    setDate,
    setResult,
    setHeartbeat,
    setNotes,
    onSave,
    requestDelete,
  };
}
