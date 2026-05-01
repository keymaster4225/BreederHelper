import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { Mare, type CollectionTargetMode } from '@/models/types';
import {
  createCollectionWithAllocations,
  CreateCollectionWizardOnFarmRowInput,
  CreateCollectionWizardShippedRowInput,
  listMares,
} from '@/storage/repositories';
import { deriveCollectionMath } from '@/utils/collectionCalculator';
import { getPersistedCollectionTargetMode } from '@/utils/collectionTargetMode';
import { computeAllocationSummary } from '@/utils/collectionAllocation';
import { normalizeBreedingRecordTime } from '@/utils/breedingRecordTime';
import { newId } from '@/utils/id';
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

export type CollectionWizardShippedRow = CreateCollectionWizardShippedRowInput & {
  clientId: string;
  kind: 'shipped';
};

export type CollectionWizardOnFarmRow = {
  clientId: string;
  kind: 'usedOnSite';
  mareId: string;
  eventDate: string;
  eventTime: string;
  doseSemenVolumeMl: number | null;
  doseCount: 1;
  notes: string | null;
};

export type CollectionWizardAllocationRow =
  | CollectionWizardShippedRow
  | CollectionWizardOnFarmRow;

export type CollectionWizardShippedRowInput = Omit<
  CollectionWizardShippedRow,
  'clientId' | 'kind'
>;

export type CollectionWizardOnFarmRowInput = Omit<
  CollectionWizardOnFarmRow,
  'clientId' | 'kind'
>;

type StepFieldErrors = {
  collectionDate?: string;
  rawVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  motilityPercent?: string;
  progressiveMotilityPercent?: string;
  targetSpermMillionsPerDose?: string;
  targetPostExtensionConcentrationMillionsPerMl?: string;
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

function getOnFarmTimeError(rows: readonly CollectionWizardOnFarmRow[]): string | null {
  for (const row of rows) {
    if (normalizeBreedingRecordTime(row.eventTime) == null) {
      return 'Each on-farm allocation needs a valid breeding time.';
    }
  }

  return null;
}

function validatePositiveOptionalNumber(
  value: string,
  label: string,
  max: number,
): string | undefined {
  const parsed = parseOptionalNumber(value);
  const rangeError = validateNumberRange(parsed, label, 0, max);
  if (rangeError) {
    return rangeError;
  }

  if (parsed === 0) {
    return `${label} must be greater than 0.`;
  }

  return undefined;
}

export function useCollectionWizard({
  stallionId,
  onSaved,
}: UseCollectionWizardArgs) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [collectionDate, setCollectionDate] = useState('');
  const [rawVolumeMl, setRawVolumeMl] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [motilityPercent, setMotilityPercent] = useState('');
  const [progressiveMotilityPercent, setProgressiveMotilityPercent] = useState('');
  const [targetMode, setTargetMode] = useState<CollectionTargetMode>('progressive');

  const [targetSpermMillionsPerDose, setTargetSpermMillionsPerDose] = useState('');
  const [
    targetPostExtensionConcentrationMillionsPerMl,
    setTargetPostExtensionConcentrationMillionsPerMl,
  ] = useState('');
  const [extenderOption, setExtenderOption] = useState('');
  const [extenderCustom, setExtenderCustom] = useState('');
  const [notes, setNotes] = useState('');

  const [allocationRows, setAllocationRows] = useState<CollectionWizardAllocationRow[]>([]);
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

  const parsedRawVolumeMl = useMemo(() => parseOptionalNumber(rawVolumeMl), [rawVolumeMl]);
  const parsedConcentrationMillionsPerMl = useMemo(
    () => parseOptionalNumber(concentrationMillionsPerMl),
    [concentrationMillionsPerMl],
  );
  const parsedMotilityPercent = useMemo(
    () => parseOptionalInteger(motilityPercent),
    [motilityPercent],
  );
  const parsedProgressiveMotilityPercent = useMemo(
    () => parseOptionalInteger(progressiveMotilityPercent),
    [progressiveMotilityPercent],
  );
  const parsedTargetSpermMillionsPerDose = useMemo(
    () => parseOptionalNumber(targetSpermMillionsPerDose),
    [targetSpermMillionsPerDose],
  );
  const parsedTargetPostExtensionConcentrationMillionsPerMl = useMemo(
    () => parseOptionalNumber(targetPostExtensionConcentrationMillionsPerMl),
    [targetPostExtensionConcentrationMillionsPerMl],
  );

  const extenderType = useMemo(
    () =>
      (extenderOption === 'Other' ? extenderCustom : extenderOption).trim(),
    [extenderOption, extenderCustom],
  );

  const shippedRows = useMemo(
    () =>
      allocationRows.filter(
        (row): row is CollectionWizardShippedRow => row.kind === 'shipped',
      ),
    [allocationRows],
  );
  const onFarmRows = useMemo(
    () =>
      allocationRows.filter(
        (row): row is CollectionWizardOnFarmRow => row.kind === 'usedOnSite',
      ),
    [allocationRows],
  );

  const derivedMath = useMemo(
    () =>
      deriveCollectionMath({
        rawVolumeMl: parsedRawVolumeMl,
        concentrationMillionsPerMl: parsedConcentrationMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
        targetMode,
        targetSpermMillionsPerDose: parsedTargetSpermMillionsPerDose,
        targetPostExtensionConcentrationMillionsPerMl:
          parsedTargetPostExtensionConcentrationMillionsPerMl,
      }),
    [
      parsedConcentrationMillionsPerMl,
      parsedProgressiveMotilityPercent,
      parsedRawVolumeMl,
      parsedTargetSpermMillionsPerDose,
      parsedTargetPostExtensionConcentrationMillionsPerMl,
      targetMode,
    ],
  );

  const allocationSummary = useMemo(
    () =>
      computeAllocationSummary(
        allocationRows.map((row) => ({
          doseSemenVolumeMl:
            row.kind === 'shipped' ? row.doseSemenVolumeMl : row.doseSemenVolumeMl ?? null,
          doseCount: row.doseCount,
        })),
        parsedRawVolumeMl,
      ),
    [allocationRows, parsedRawVolumeMl],
  );

  const remainingApproxDoses = useMemo(() => {
    if (
      allocationSummary.remainingMl == null ||
      derivedMath.semenPerDoseMl == null ||
      derivedMath.semenPerDoseMl <= 0
    ) {
      return null;
    }

    return allocationSummary.remainingMl / derivedMath.semenPerDoseMl;
  }, [allocationSummary.remainingMl, derivedMath.semenPerDoseMl]);

  const isShippedPrefillValid =
    derivedMath.semenPerDoseMl != null &&
    derivedMath.extenderPerDoseMl != null &&
    derivedMath.extenderPerDoseMl >= 0;
  const isOnFarmPrefillValid = derivedMath.semenPerDoseMl != null;

  const shippedPrefillDoseSemenVolumeMl = isShippedPrefillValid
    ? derivedMath.semenPerDoseMl
    : null;
  const shippedPrefillDoseExtenderVolumeMl = isShippedPrefillValid
    ? derivedMath.extenderPerDoseMl
    : null;
  const onFarmPrefillDoseSemenVolumeMl = isOnFarmPrefillValid
    ? derivedMath.semenPerDoseMl
    : null;

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
      rawVolumeMl: validatePositiveOptionalNumber(rawVolumeMl, 'Total Volume', 5000),
      concentrationMillionsPerMl: validatePositiveOptionalNumber(
        concentrationMillionsPerMl,
        'Concentration',
        100000,
      ),
      motilityPercent:
        validateNumberRange(
          parsedMotilityPercent,
          'Motility',
          0,
          100,
        ) ?? undefined,
      progressiveMotilityPercent:
        validateNumberRange(
          parsedProgressiveMotilityPercent,
          'Progressive Motility',
          0,
          100,
        ) ?? undefined,
    };

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((error) => !error);
  };

  const validateProcessingStep = (): boolean => {
    const nextErrors: StepFieldErrors = {
      targetSpermMillionsPerDose: validatePositiveOptionalNumber(
        targetSpermMillionsPerDose,
        'Target sperm per dose',
        100000,
      ),
      targetPostExtensionConcentrationMillionsPerMl: validatePositiveOptionalNumber(
        targetPostExtensionConcentrationMillionsPerMl,
        'Target post-extension concentration',
        100000,
      ),
    };

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((error) => !error);
  };

  const validateAllocationStep = (): boolean => {
    const duplicateMareError = getDuplicateMareError(onFarmRows);
    let allocationError = duplicateMareError ?? getOnFarmTimeError(onFarmRows);

    if (!allocationError && !allocationSummary.isWithinCap) {
      allocationError = `Allocated semen volume exceeds collected volume by ${allocationSummary.exceededByMl.toFixed(2)} mL.`;
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

    return (
      validateBasicsStep() && validateProcessingStep() && validateAllocationStep()
    );
  };

  const onTargetModeChange = (nextTargetMode: CollectionTargetMode): void => {
    if (nextTargetMode === targetMode) {
      return;
    }

    setTargetMode(nextTargetMode);
    setTargetSpermMillionsPerDose('');
    setTargetPostExtensionConcentrationMillionsPerMl('');
    setErrors((current) => ({
      ...current,
      targetSpermMillionsPerDose: undefined,
      targetPostExtensionConcentrationMillionsPerMl: undefined,
    }));
  };

  const goNext = (): void => {
    if (!validateStep(currentStepIndex)) {
      return;
    }

    setCurrentStepIndex((current) =>
      Math.min(current + 1, COLLECTION_WIZARD_STEPS.length - 1),
    );
  };

  const goBack = (): void => {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
  };

  const goToStep = (stepIndex: number): void => {
    setCurrentStepIndex(stepIndex);
  };

  const upsertShippedRow = (
    row: CollectionWizardShippedRowInput,
    clientId?: string,
  ): void => {
    setAllocationRows((current) => {
      const buildRow = (nextClientId: string): CollectionWizardShippedRow => ({
        ...row,
        clientId: nextClientId,
        kind: 'shipped',
      });

      if (clientId == null) {
        return [...current, buildRow(newId())];
      }

      let updated = false;
      const next = current.map((existingRow) => {
        if (existingRow.clientId !== clientId) {
          return existingRow;
        }
        updated = true;
        return buildRow(clientId);
      });

      return updated ? next : [...next, buildRow(clientId)];
    });
    setErrors((current) => ({ ...current, allocation: undefined }));
  };

  const upsertOnFarmRow = (
    row: CollectionWizardOnFarmRowInput,
    clientId?: string,
  ): string | null => {
    const nextRow: CollectionWizardOnFarmRow = {
      ...row,
      clientId: clientId ?? newId(),
      kind: 'usedOnSite',
      doseCount: 1,
    };

    let nextRows: CollectionWizardAllocationRow[];
    if (clientId == null) {
      nextRows = [...allocationRows, nextRow];
    } else {
      let updated = false;
      nextRows = allocationRows.map((existingRow) => {
        if (existingRow.clientId !== clientId) {
          return existingRow;
        }
        updated = true;
        return nextRow;
      });
      if (!updated) {
        nextRows = [...nextRows, nextRow];
      }
    }

    const duplicateMareError = getDuplicateMareError(
      nextRows.filter(
        (existingRow): existingRow is CollectionWizardOnFarmRow =>
          existingRow.kind === 'usedOnSite',
      ),
    );
    if (duplicateMareError) {
      return duplicateMareError;
    }

    setAllocationRows(nextRows);
    setErrors((current) => ({ ...current, allocation: undefined }));
    return null;
  };

  const removeAllocationRow = (clientId: string): void => {
    setAllocationRows((current) =>
      current.filter((row) => row.clientId !== clientId),
    );
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
      const shippedPayload: CreateCollectionWizardShippedRowInput[] = shippedRows.map(
        ({ clientId: _clientId, kind: _kind, ...row }) => row,
      );
      const onFarmPayload: CreateCollectionWizardOnFarmRowInput[] = onFarmRows.map(
        ({ clientId: _clientId, kind: _kind, ...row }) => ({
          mareId: row.mareId,
          eventDate: row.eventDate,
          eventTime: row.eventTime,
          doseSemenVolumeMl: row.doseSemenVolumeMl,
          notes: row.notes,
          doseCount: 1,
        }),
      );

      await createCollectionWithAllocations({
        collection: {
          stallionId,
          collectionDate,
          rawVolumeMl: parsedRawVolumeMl,
          extenderType: extenderType || null,
          concentrationMillionsPerMl: parsedConcentrationMillionsPerMl,
          motilityPercent: parsedMotilityPercent,
          progressiveMotilityPercent: parsedProgressiveMotilityPercent,
          targetMode: getPersistedCollectionTargetMode({
            targetMode,
            targetSpermMillionsPerDose: parsedTargetSpermMillionsPerDose,
            targetPostExtensionConcentrationMillionsPerMl:
              parsedTargetPostExtensionConcentrationMillionsPerMl,
          }),
          targetSpermMillionsPerDose: parsedTargetSpermMillionsPerDose,
          targetPostExtensionConcentrationMillionsPerMl:
            parsedTargetPostExtensionConcentrationMillionsPerMl,
          notes: notes.trim() || null,
        },
        shippedRows: shippedPayload,
        onFarmRows: onFarmPayload,
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
    rawVolumeMl,
    setRawVolumeMl,
    concentrationMillionsPerMl,
    setConcentrationMillionsPerMl,
    motilityPercent,
    setMotilityPercent,
    progressiveMotilityPercent,
    setProgressiveMotilityPercent,
    targetMode,
    onTargetModeChange,
    targetSpermMillionsPerDose,
    setTargetSpermMillionsPerDose,
    targetPostExtensionConcentrationMillionsPerMl,
    setTargetPostExtensionConcentrationMillionsPerMl,
    extenderType,
    extenderOption,
    setExtenderOption,
    extenderCustom,
    setExtenderCustom,
    notes,
    setNotes,
    parsedRawVolumeMl,
    parsedConcentrationMillionsPerMl,
    parsedMotilityPercent,
    parsedProgressiveMotilityPercent,
    parsedTargetSpermMillionsPerDose,
    parsedTargetPostExtensionConcentrationMillionsPerMl,
    derivedMath,
    allocationRows,
    shippedRows,
    onFarmRows,
    allocationSummary,
    remainingApproxDoses,
    shippedPrefillDoseSemenVolumeMl,
    shippedPrefillDoseExtenderVolumeMl,
    onFarmPrefillDoseSemenVolumeMl,
    mares,
    mareNameById,
    mareLoadError,
    errors,
    isSaving,
    isSaveDisabled: isSaving || !allocationSummary.isWithinCap,
    goNext,
    goBack,
    goToStep,
    upsertShippedRow,
    upsertOnFarmRow,
    removeAllocationRow,
    save,
  };
}
