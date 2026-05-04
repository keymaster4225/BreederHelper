import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  DEFAULT_GESTATION_LENGTH_DAYS,
  type BreedingRecord,
  type LocalDate,
  type PhotoAsset,
  type PregnancyResult,
} from '@/models/types';
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
import { deletePhotoAssetDirectoryByRelativePath } from '@/storage/photoFiles/assets';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import {
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateRequired,
} from '@/utils/validation';

import {
  completeLinkedTaskAfterSave,
  type FollowUpTaskParams,
} from './completeLinkedTaskAfterSave';
import { useRecordForm } from './useRecordForm';

async function deletePhotoAssetFilesBestEffort(assets: readonly PhotoAsset[]): Promise<void> {
  for (const asset of assets) {
    try {
      await deletePhotoAssetDirectoryByRelativePath(asset.masterRelativePath);
    } catch {
      // Metadata has committed; the boot consistency sweep can remove leftovers.
    }
  }
}

type ResultOption = PregnancyResult;
type YesNo = 'yes' | 'no';

type FormErrors = {
  breedingRecordId?: string;
  date?: string;
};

type UsePregnancyCheckFormArgs = {
  readonly mareId: string;
  readonly pregnancyCheckId?: string;
  readonly initialBreedingRecordId?: string;
  readonly taskId?: string;
  readonly defaultDate?: LocalDate;
  readonly onGoBack: () => void;
  readonly onAddFollowUpTask?: (params: FollowUpTaskParams) => void;
  readonly setTitle: (title: string) => void;
};

export function usePregnancyCheckForm({
  mareId,
  pregnancyCheckId,
  initialBreedingRecordId,
  taskId,
  defaultDate,
  onGoBack,
  onAddFollowUpTask,
  setTitle,
}: UsePregnancyCheckFormArgs) {
  const isEdit = Boolean(pregnancyCheckId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const onAddFollowUpTaskRef = useRef(onAddFollowUpTask);
  const setTitleRef = useRef(setTitle);

  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [gestationLengthDays, setGestationLengthDays] = useState(DEFAULT_GESTATION_LENGTH_DAYS);
  const [breedingRecordId, setBreedingRecordId] = useState('');
  const [date, setDate] = useState(defaultDate ?? '');
  const [result, setResult] = useState<ResultOption>('positive');
  const [heartbeat, setHeartbeat] = useState<YesNo>('no');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, runLoad, runSave, runDelete } = useRecordForm({
    initialLoading: true,
  });

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    onAddFollowUpTaskRef.current = onAddFollowUpTask;
    setTitleRef.current = setTitle;
  }, [onAddFollowUpTask, onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Pregnancy Check' : 'Add Pregnancy Check');
  }, [isEdit]);

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
          onGoBackRef.current();
          return;
        }

        if (pregnancyCheckId && !existing) {
          Alert.alert('Record not found', 'This pregnancy check no longer exists.');
          onGoBackRef.current();
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
          const initialRecord = initialBreedingRecordId
            ? records.find((record) => record.id === initialBreedingRecordId)
            : undefined;
          setBreedingRecordId(initialRecord?.id ?? records[0].id);
        }
      },
      {
        onError: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unable to load pregnancy-check form data.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [initialBreedingRecordId, mareId, pregnancyCheckId, runLoad]);

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

  const saveWithCompletion = useCallback(async (
    onCompletedOrSkipped: (savedPregnancyCheckId: string) => void,
  ): Promise<void> => {
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

        const savedPregnancyCheckId = pregnancyCheckId ?? newId();

        if (pregnancyCheckId) {
          await updatePregnancyCheck(pregnancyCheckId, payload);
        } else {
          await createPregnancyCheck({ id: savedPregnancyCheckId, mareId, ...payload });
        }

        await completeLinkedTaskAfterSave({
          taskId,
          completedRecordType: 'pregnancyCheck',
          completedRecordId: savedPregnancyCheckId,
          onCompletedOrSkipped: () => onCompletedOrSkipped(savedPregnancyCheckId),
        });
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
    pregnancyCheckId,
    result,
    runSave,
    taskId,
    validate,
  ]);

  const onSave = useCallback(async (): Promise<void> => {
    await saveWithCompletion(() => onGoBackRef.current());
  }, [saveWithCompletion]);

  const onSaveAndAddFollowUp = useCallback(async (): Promise<void> => {
    await saveWithCompletion((savedPregnancyCheckId) => {
      const onAddFollowUpTask = onAddFollowUpTaskRef.current;
      if (!onAddFollowUpTask) {
        onGoBackRef.current();
        return;
      }

      onAddFollowUpTask({
        mareId,
        taskType: 'custom',
        sourceType: 'pregnancyCheck',
        sourceRecordId: savedPregnancyCheckId,
        sourceReason: 'manualFollowUp',
      });
    });
  }, [mareId, saveWithCompletion]);

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
            const deletedPhotoAssets = await deletePregnancyCheck(pregnancyCheckId);
            await deletePhotoAssetFilesBestEffort(deletedPhotoAssets);
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
    onSaveAndAddFollowUp,
    requestDelete,
  };
}
