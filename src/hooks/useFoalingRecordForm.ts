import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { FoalSex, FoalingOutcome } from '@/models/types';
import {
  createFoalingRecord,
  deleteFoalingRecord,
  getFoalByFoalingRecordId,
  getFoalingRecordById,
  listBreedingRecordsByMare,
  updateFoalingRecord,
} from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

type FormErrors = {
  date?: string;
};

type UseFoalingRecordFormArgs = {
  readonly mareId: string;
  readonly foalingRecordId?: string;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};

export function useFoalingRecordForm({
  mareId,
  foalingRecordId,
  onGoBack,
  setTitle,
}: UseFoalingRecordFormArgs) {
  const isEdit = Boolean(foalingRecordId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [breedingOptions, setBreedingOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );
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

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Foaling Record' : 'Add Foaling Record');
  }, [isEdit]);

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
          onGoBackRef.current();
          return;
        }

        setBreedingOptions([
          { label: 'None', value: '' },
          ...records.map((record) => ({
            label: `${record.date} (${record.method})`,
            value: record.id,
          })),
        ]);
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
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load foaling form data.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [foalingRecordId, mareId, runLoad]);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.date;
  }, [date]);

  const onSave = useCallback(async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    if (hasFoal && originalOutcome === 'liveFoal' && outcome !== 'liveFoal') {
      Alert.alert(
        'Cannot change outcome',
        'This foaling record already has a foal record. Delete the foal record before changing the outcome.',
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

        onGoBack();
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save foaling record.';
          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    breedingRecordId,
    complications,
    date,
    foalSex,
    foalingRecordId,
    hasFoal,
    mareId,
    notes,
    onGoBack,
    originalOutcome,
    outcome,
    runSave,
    validate,
  ]);

  const requestDelete = useCallback((): void => {
    if (!foalingRecordId) {
      return;
    }

    if (hasFoal) {
      Alert.alert(
        'Cannot delete',
        'This foaling record has a foal record. Delete the foal record first.',
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
            onGoBack();
          },
          {
            onError: (error: unknown) => {
              const message =
                error instanceof Error ? error.message : 'Failed to delete foaling record.';
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
  }, [foalingRecordId, hasFoal, onGoBack, runDelete]);

  return {
    isEdit,
    today,
    breedingOptions,
    breedingRecordId,
    date,
    outcome,
    foalSex,
    complications,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    setBreedingRecordId,
    setDate,
    setOutcome,
    setFoalSex,
    setComplications,
    setNotes,
    onSave,
    requestDelete,
  };
}
