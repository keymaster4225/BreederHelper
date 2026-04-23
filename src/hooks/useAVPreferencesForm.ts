import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { getStallionById, updateStallion } from '@/storage/repositories';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateNumberRange,
} from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

type FormErrors = {
  avTemperatureF?: string;
  avWaterVolumeMl?: string;
};

type UseAVPreferencesFormArgs = {
  readonly stallionId: string;
  readonly onGoBack: () => void;
};

export function useAVPreferencesForm({
  stallionId,
  onGoBack,
}: UseAVPreferencesFormArgs) {
  const onGoBackRef = useRef(onGoBack);
  const [avTemperatureF, setAvTemperatureF] = useState('');
  const [avType, setAvType] = useState('');
  const [avLinerType, setAvLinerType] = useState('');
  const [avWaterVolumeMl, setAvWaterVolumeMl] = useState('');
  const [avNotes, setAvNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, runLoad, runSave } = useRecordForm({ initialLoading: true });

  useEffect(() => {
    onGoBackRef.current = onGoBack;
  }, [onGoBack]);

  useEffect(() => {
    void runLoad(
      async () => {
        const record = await getStallionById(stallionId);
        if (!record) {
          Alert.alert('Error', 'Stallion not found.');
          onGoBackRef.current();
          return;
        }

        setAvTemperatureF(record.avTemperatureF != null ? String(record.avTemperatureF) : '');
        setAvType(record.avType ?? '');
        setAvLinerType(record.avLinerType ?? '');
        setAvWaterVolumeMl(record.avWaterVolumeMl != null ? String(record.avWaterVolumeMl) : '');
        setAvNotes(record.avNotes ?? '');
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load AV preferences.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [runLoad, stallionId]);

  const validate = useCallback((): FormErrors => {
    return {
      avTemperatureF:
        validateNumberRange(parseOptionalNumber(avTemperatureF), 'Temperature', 0, 250) ??
        undefined,
      avWaterVolumeMl:
        validateNumberRange(parseOptionalInteger(avWaterVolumeMl), 'Water Volume', 0, 9999) ??
        undefined,
    };
  }, [avTemperatureF, avWaterVolumeMl]);

  const onSave = useCallback(async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    await runSave(
      async () => {
        const record = await getStallionById(stallionId);
        if (!record) {
          Alert.alert('Error', 'Stallion not found.');
          return;
        }

        await updateStallion(stallionId, {
          name: record.name,
          breed: record.breed,
          registrationNumber: record.registrationNumber,
          sire: record.sire,
          dam: record.dam,
          notes: record.notes,
          dateOfBirth: record.dateOfBirth,
          avTemperatureF: parseOptionalNumber(avTemperatureF),
          avType: avType.trim() || null,
          avLinerType: avLinerType.trim() || null,
          avWaterVolumeMl: parseOptionalInteger(avWaterVolumeMl),
          avNotes: avNotes.trim() || null,
        });

        onGoBack();
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save AV preferences.';
          Alert.alert('Save error', message);
        },
      },
    );
  }, [
    avLinerType,
    avNotes,
    avTemperatureF,
    avType,
    avWaterVolumeMl,
    onGoBack,
    runSave,
    stallionId,
    validate,
  ]);

  return {
    avTemperatureF,
    avType,
    avLinerType,
    avWaterVolumeMl,
    avNotes,
    errors,
    isLoading,
    isSaving,
    setAvTemperatureF,
    setAvType,
    setAvLinerType,
    setAvWaterVolumeMl,
    setAvNotes,
    onSave,
  };
}
