import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  createStallion,
  getStallionById,
  softDeleteStallion,
  updateStallion,
} from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import {
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateRequired,
} from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

type FormErrors = {
  name?: string;
  dateOfBirth?: string;
};

type UseStallionFormArgs = {
  readonly stallionId?: string;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};

export function useStallionForm({
  stallionId,
  onGoBack,
  setTitle,
}: UseStallionFormArgs) {
  const isEdit = Boolean(stallionId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [breed, setBreed] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, setIsLoading, runLoad, runSave, runDelete } =
    useRecordForm({ initialLoading: isEdit });

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Stallion' : 'Add Stallion');
  }, [isEdit]);

  useEffect(() => {
    if (!stallionId) {
      setIsLoading(false);
      return;
    }

    void runLoad(
      async () => {
        const record = await getStallionById(stallionId);
        if (!record) {
          Alert.alert('Stallion not found', 'This stallion no longer exists.');
          onGoBackRef.current();
          return;
        }

        setName(record.name);
        setDateOfBirth(record.dateOfBirth ?? '');
        setBreed(record.breed ?? '');
        setRegistrationNumber(record.registrationNumber ?? '');
        setSire(record.sire ?? '');
        setDam(record.dam ?? '');
        setNotes(record.notes ?? '');
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load stallion.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [runLoad, setIsLoading, stallionId]);

  const validate = useCallback((): FormErrors => {
    return {
      name: validateRequired(name, 'Name') ?? undefined,
      dateOfBirth:
        validateLocalDate(dateOfBirth, 'Date of birth') ??
        validateLocalDateNotInFuture(dateOfBirth) ??
        undefined,
    };
  }, [dateOfBirth, name]);

  const onSave = useCallback(async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    await runSave(
      async () => {
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

        onGoBack();
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save stallion.';
          Alert.alert('Save error', message);
        },
      },
    );
  }, [
    breed,
    dam,
    dateOfBirth,
    isEdit,
    name,
    notes,
    onGoBack,
    registrationNumber,
    runSave,
    sire,
    stallionId,
    validate,
  ]);

  const requestDelete = useCallback((): void => {
    if (!stallionId) {
      return;
    }

    confirmDelete({
      title: 'Delete Stallion',
      message:
        'This stallion will be removed from the list. Existing breeding records will be preserved.',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await softDeleteStallion(stallionId);
            onGoBack();
          },
          {
            onError: (error: unknown) => {
              const message = error instanceof Error ? error.message : 'Unable to delete stallion.';
              Alert.alert('Delete error', message);
            },
          },
        );
      },
    });
  }, [onGoBack, runDelete, stallionId]);

  return {
    isEdit,
    today,
    name,
    dateOfBirth,
    breed,
    registrationNumber,
    sire,
    dam,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    setName,
    setDateOfBirth,
    setBreed,
    setRegistrationNumber,
    setSire,
    setDam,
    setNotes,
    onSave,
    requestDelete,
  };
}
