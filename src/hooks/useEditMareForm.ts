import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  DEFAULT_GESTATION_LENGTH_DAYS,
  MAX_GESTATION_LENGTH_DAYS,
  MIN_GESTATION_LENGTH_DAYS,
} from '@/models/types';
import { createMare, getMareById, softDeleteMare, updateMare } from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import {
  normalizeLocalDate,
  parseOptionalInteger,
  validateIntegerRange,
  validateLocalDate,
  validateRequired,
} from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

type FormErrors = {
  name?: string;
  breed?: string;
  gestationLengthDays?: string;
  dateOfBirth?: string;
};

type UseEditMareFormArgs = {
  readonly mareId?: string;
  readonly onGoBack: () => void;
  readonly onDeleted: () => void;
  readonly setTitle: (title: string) => void;
};

export function useEditMareForm({
  mareId,
  onGoBack,
  onDeleted,
  setTitle,
}: UseEditMareFormArgs) {
  const isEdit = Boolean(mareId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [name, setName] = useState('');
  const [isRecipient, setIsRecipient] = useState(false);
  const [breed, setBreed] = useState('');
  const [gestationLengthDays, setGestationLengthDays] = useState(
    String(DEFAULT_GESTATION_LENGTH_DAYS),
  );
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, setIsLoading, runLoad, runSave, runDelete } =
    useRecordForm({ initialLoading: isEdit });

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Mare' : 'Add Mare');
  }, [isEdit]);

  useEffect(() => {
    if (!mareId) {
      setIsLoading(false);
      return;
    }

    void runLoad(
      async () => {
        const mare = await getMareById(mareId);
        if (!mare) {
          Alert.alert('Mare not found', 'This mare no longer exists.');
          onGoBackRef.current();
          return;
        }

        setName(mare.name);
        setIsRecipient(mare.isRecipient);
        setBreed(mare.breed);
        setGestationLengthDays(String(mare.gestationLengthDays));
        setDateOfBirth(mare.dateOfBirth ?? '');
        setRegistrationNumber(mare.registrationNumber ?? '');
        setNotes(mare.notes ?? '');
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load mare.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [mareId, runLoad, setIsLoading]);

  const validate = useCallback((): boolean => {
    const parsedGestationLengthDays = parseOptionalInteger(gestationLengthDays);
    const nextErrors: FormErrors = {
      name: validateRequired(name, 'Name') ?? undefined,
      breed: validateRequired(breed, 'Breed') ?? undefined,
      gestationLengthDays:
        (validateRequired(gestationLengthDays, 'Gestation length') ??
          validateIntegerRange(
            parsedGestationLengthDays,
            'Gestation length',
            MIN_GESTATION_LENGTH_DAYS,
            MAX_GESTATION_LENGTH_DAYS,
          )) ??
        undefined,
      dateOfBirth: validateLocalDate(dateOfBirth, 'Date of birth', false) ?? undefined,
    };

    setErrors(nextErrors);
    return (
      !nextErrors.name &&
      !nextErrors.breed &&
      !nextErrors.gestationLengthDays &&
      !nextErrors.dateOfBirth
    );
  }, [breed, dateOfBirth, gestationLengthDays, name]);

  const onSave = useCallback(async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    const parsedGestationLengthDays = parseOptionalInteger(gestationLengthDays);
    if (parsedGestationLengthDays === null || Number.isNaN(parsedGestationLengthDays)) {
      return;
    }

    await runSave(
      async () => {
        const payload = {
          name: name.trim(),
          breed: breed.trim(),
          gestationLengthDays: parsedGestationLengthDays,
          dateOfBirth: normalizeLocalDate(dateOfBirth),
          registrationNumber: registrationNumber.trim() || null,
          isRecipient,
          notes: notes.trim() || null,
        };

        if (mareId) {
          await updateMare(mareId, payload);
        } else {
          await createMare({
            id: newId(),
            ...payload,
          });
        }

        onGoBack();
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save mare.';
          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    breed,
    dateOfBirth,
    gestationLengthDays,
    isRecipient,
    mareId,
    name,
    notes,
    onGoBack,
    registrationNumber,
    runSave,
    validate,
  ]);

  const requestDelete = useCallback((): void => {
    if (!mareId) {
      return;
    }

    confirmDelete({
      title: 'Delete Mare',
      message: 'Are you sure you want to delete this mare? This cannot be undone.',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await softDeleteMare(mareId);
            onDeleted();
          },
          {
            onError: (error: unknown) => {
              const message = error instanceof Error ? error.message : 'Failed to delete mare.';
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
  }, [mareId, onDeleted, runDelete]);

  return {
    isEdit,
    today,
    name,
    isRecipient,
    breed,
    gestationLengthDays,
    dateOfBirth,
    registrationNumber,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    setName,
    setIsRecipient,
    setBreed,
    setGestationLengthDays,
    setDateOfBirth,
    setRegistrationNumber,
    setNotes,
    onSave,
    requestDelete,
  };
}
