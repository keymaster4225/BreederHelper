import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { Mare } from '@/models/types';
import {
  createCollectionWithAllocations,
  CreateCollectionWizardOnFarmRowInput,
  CreateCollectionWizardShippedRowInput,
  listMares,
} from '@/storage/repositories';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
} from '@/utils/validation';

export const COLLECTION_WIZARD_STEPS = [
  'Collection basics',
  'Processing details',
  'Dose allocation',
  'Review',
] as const;

export type CollectionWizardShippedRow = CreateCollectionWizardShippedRowInput;
export type CollectionWizardOnFarmRow = CreateCollectionWizardOnFarmRowInput;

type StepFieldErrors = {
  collectionDate?: string;
  doseCount?: string;
  doseSizeMillions?: string;
  rawVolumeMl?: string;
  totalVolumeMl?: string;
  extenderVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  progressiveMotilityPercent?: string;
  allocation?: string;
};

type UseCollectionWizardArgs = {
  stallionId: string;
  onSaved: () => void;
};

function getDuplicateMareError(
  rows: readonly CollectionWizardOnFarmRow[],
): string | null {
  const seenMareIds = new Set<string>();

  for (const row of rows) {
    if (seenMareIds.has(row.mareId)) {
      return 'A mare can only be selected once in this collection.';
    }
    seenMareIds.add(row.mareId);
  }

  return null;
}

export function useCollectionWizard({
  stallionId,
  onSaved,
}: UseCollectionWizardArgs) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [collectionDate, setCollectionDate] = useState('');
  const [doseCount, setDoseCount] = useState('');
  const [doseSizeMillions, setDoseSizeMillions] = useState('');
  const [notes, setNotes] = useState('');
  const [rawVolumeMl, setRawVolumeMl] = useState('');
  const [totalVolumeMl, setTotalVolumeMl] = useState('');
  const [extenderVolumeMl, setExtenderVolumeMl] = useState('');
  const [extenderType, setExtenderType] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [progressiveMotilityPercent, setProgressiveMotilityPercent] = useState('');
  const [shippedRows, setShippedRows] = useState<CollectionWizardShippedRow[]>([]);
  const [onFarmRows, setOnFarmRows] = useState<CollectionWizardOnFarmRow[]>([]);
  const [mares, setMares] = useState<Mare[]>([]);
  const [mareLoadError, setMareLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<StepFieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const rows = await listMares();
        if (isMounted) {
          setMares(rows);
          setMareLoadError(null);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load mares.';
        setMareLoadError(message);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const parsedDoseCount = useMemo(() => parseOptionalInteger(doseCount), [doseCount]);
  const allocatedDoseCount = useMemo(
    () => shippedRows.reduce((total, row) => total + row.doseCount, 0) + onFarmRows.reduce((total, row) => total + row.doseCount, 0),
    [onFarmRows, shippedRows],
  );
  const remainingDoseCount = parsedDoseCount == null ? null : parsedDoseCount - allocatedDoseCount;
  const hasAllocations = shippedRows.length > 0 || onFarmRows.length > 0;
  const isOverAllocated = remainingDoseCount != null && remainingDoseCount < 0;
  const mareNameById = useMemo(() => {
    const lookup: Record<string, string> = {};
    for (const mare of mares) {
      lookup[mare.id] = mare.name;
    }
    return lookup;
  }, [mares]);

  const validateBasicsStep = (): boolean => {
    const nextErrors: StepFieldErrors = {
      collectionDate:
        validateLocalDate(collectionDate, 'Collection date', true) ??
        validateLocalDateNotInFuture(collectionDate) ??
        undefined,
      doseCount: hasAllocations
        ? validateNumberRange(parsedDoseCount, 'Dose Count', 1, 1000) ?? undefined
        : validateNumberRange(parsedDoseCount, 'Dose Count', 0, 1000) ?? undefined,
      doseSizeMillions:
        validateNumberRange(parseOptionalNumber(doseSizeMillions), 'Dose Size', 0, 100000) ?? undefined,
    };

    if (hasAllocations && parsedDoseCount == null) {
      nextErrors.doseCount = 'Dose Count is required once allocations have been added.';
    }

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((error) => !error);
  };

  const validateProcessingStep = (): boolean => {
    const nextErrors: StepFieldErrors = {
      rawVolumeMl:
        validateNumberRange(parseOptionalNumber(rawVolumeMl), 'Raw Volume', 0, 5000) ?? undefined,
      totalVolumeMl:
        validateNumberRange(parseOptionalNumber(totalVolumeMl), 'Total Volume', 0, 50000) ?? undefined,
      extenderVolumeMl:
        validateNumberRange(parseOptionalNumber(extenderVolumeMl), 'Extender Volume', 0, 50000) ?? undefined,
      concentrationMillionsPerMl:
        validateNumberRange(parseOptionalNumber(concentrationMillionsPerMl), 'Concentration', 0, 100000) ?? undefined,
      progressiveMotilityPercent:
        validateNumberRange(parseOptionalInteger(progressiveMotilityPercent), 'Motility', 0, 100) ?? undefined,
    };

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((error) => !error);
  };

  const validateAllocationStep = (): boolean => {
    const duplicateMareError = getDuplicateMareError(onFarmRows);
    let allocationError = duplicateMareError;

    if (!allocationError && hasAllocations && parsedDoseCount == null) {
      allocationError = 'Dose Count is required once allocations have been added.';
    }

    if (!allocationError && isOverAllocated) {
      allocationError = 'Allocated doses cannot exceed the collection dose count.';
    }

    setErrors((current) => ({ ...current, allocation: allocationError ?? undefined }));
    return !allocationError;
  };

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      return validateBasicsStep();
    }

    if (stepIndex === 1) {
      return validateProcessingStep();
    }

    if (stepIndex === 2) {
      return validateAllocationStep();
    }

    return validateBasicsStep() && validateProcessingStep() && validateAllocationStep();
  };

  const goNext = (): void => {
    if (!validateStep(currentStepIndex)) {
      return;
    }

    setCurrentStepIndex((current) => Math.min(current + 1, COLLECTION_WIZARD_STEPS.length - 1));
  };

  const goBack = (): void => {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
  };

  const goToStep = (stepIndex: number): void => {
    setCurrentStepIndex(stepIndex);
  };

  const upsertShippedRow = (row: CollectionWizardShippedRow, index?: number): void => {
    setShippedRows((current) => {
      if (index == null) {
        return [...current, row];
      }

      return current.map((existingRow, existingIndex) => (
        existingIndex === index ? row : existingRow
      ));
    });
    setErrors((current) => ({ ...current, allocation: undefined }));
  };

  const removeShippedRow = (index: number): void => {
    setShippedRows((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setErrors((current) => ({ ...current, allocation: undefined }));
  };

  const upsertOnFarmRow = (row: CollectionWizardOnFarmRow, index?: number): string | null => {
    const nextRows = index == null
      ? [...onFarmRows, row]
      : onFarmRows.map((existingRow, existingIndex) => (
        existingIndex === index ? row : existingRow
      ));

    const duplicateMareError = getDuplicateMareError(nextRows);
    if (duplicateMareError) {
      return duplicateMareError;
    }

    setOnFarmRows(nextRows);
    setErrors((current) => ({ ...current, allocation: undefined }));
    return null;
  };

  const removeOnFarmRow = (index: number): void => {
    setOnFarmRows((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setErrors((current) => ({ ...current, allocation: undefined }));
  };

  const save = async (): Promise<void> => {
    const basicsValid = validateBasicsStep();
    const processingValid = validateProcessingStep();
    const allocationValid = validateAllocationStep();

    if (!basicsValid) {
      setCurrentStepIndex(0);
      return;
    }

    if (!processingValid) {
      setCurrentStepIndex(1);
      return;
    }

    if (!allocationValid) {
      setCurrentStepIndex(2);
      return;
    }

    setIsSaving(true);
    try {
      await createCollectionWithAllocations({
        collection: {
          stallionId,
          collectionDate,
          rawVolumeMl: parseOptionalNumber(rawVolumeMl),
          totalVolumeMl: parseOptionalNumber(totalVolumeMl),
          extenderVolumeMl: parseOptionalNumber(extenderVolumeMl),
          extenderType: extenderType.trim() || null,
          concentrationMillionsPerMl: parseOptionalNumber(concentrationMillionsPerMl),
          progressiveMotilityPercent: parseOptionalInteger(progressiveMotilityPercent),
          doseCount: parsedDoseCount,
          doseSizeMillions: parseOptionalNumber(doseSizeMillions),
          notes: notes.trim() || null,
        },
        shippedRows,
        onFarmRows,
      });
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save collection.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    currentStepIndex,
    currentStepTitle: COLLECTION_WIZARD_STEPS[currentStepIndex],
    collectionDate,
    setCollectionDate,
    doseCount,
    setDoseCount,
    doseSizeMillions,
    setDoseSizeMillions,
    notes,
    setNotes,
    rawVolumeMl,
    setRawVolumeMl,
    totalVolumeMl,
    setTotalVolumeMl,
    extenderVolumeMl,
    setExtenderVolumeMl,
    extenderType,
    setExtenderType,
    concentrationMillionsPerMl,
    setConcentrationMillionsPerMl,
    progressiveMotilityPercent,
    setProgressiveMotilityPercent,
    shippedRows,
    onFarmRows,
    mares,
    mareNameById,
    mareLoadError,
    allocatedDoseCount,
    parsedDoseCount,
    remainingDoseCount,
    isOverAllocated,
    errors,
    isSaving,
    goNext,
    goBack,
    goToStep,
    upsertShippedRow,
    removeShippedRow,
    upsertOnFarmRow,
    removeOnFarmRow,
    save,
  };
}
