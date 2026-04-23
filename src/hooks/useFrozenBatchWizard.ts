import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type { CreateFrozenSemenBatchInput, FreezingExtender, StrawColor } from '@/models/types';
import { createFrozenSemenBatch, getSemenCollectionById } from '@/storage/repositories';
import { computeTotalSpermPerStrawMillions } from '@/utils/frozenSemen';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateIntegerRange,
  validateLinkedFrozenRawVolume,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateOptionalDecimalRange,
  validateOtherSelection,
  validateTriStateSelection,
} from '@/utils/validation';

export const FROZEN_BATCH_WIZARD_STEPS = [
  'Basics',
  'Straws & Extender',
  'Quality',
  'Storage & Notes',
] as const;

type FrozenBatchWizardErrors = {
  freezeDate?: string;
  rawSemenVolumeUsedMl?: string;
  centrifugeSpeedRpm?: string;
  centrifugeDurationMin?: string;
  centrifugeCushionUsed?: string;
  centrifugeResuspensionVolumeMl?: string;
  strawCount?: string;
  strawVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  strawsPerDose?: string;
  extenderOther?: string;
  strawColorOther?: string;
  postThawMotilityPercent?: string;
  longevityHours?: string;
};

type UseFrozenBatchWizardArgs = {
  stallionId: string;
  collectionId?: string;
  onSaved: () => void;
  onInvalidLinkedCollection?: () => void;
};

function toOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function toOptionalInteger(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function validateOptionalPositiveNumber(
  value: number | null,
  label: string,
): string | null {
  if (value == null) {
    return null;
  }

  const rangeError = validateNumberRange(value, label, 0, 100000);
  if (rangeError) {
    return rangeError;
  }

  if (value <= 0) {
    return `${label} must be greater than zero.`;
  }

  return null;
}

export function useFrozenBatchWizard({
  stallionId,
  collectionId,
  onSaved,
  onInvalidLinkedCollection,
}: UseFrozenBatchWizardArgs) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [freezeDate, setFreezeDate] = useState('');
  const [rawSemenVolumeUsedMl, setRawSemenVolumeUsedMl] = useState('');
  const [wasCentrifuged, setWasCentrifuged] = useState(false);
  const [centrifugeSpeedRpm, setCentrifugeSpeedRpm] = useState('');
  const [centrifugeDurationMin, setCentrifugeDurationMin] = useState('');
  const [centrifugeCushionUsed, setCentrifugeCushionUsed] = useState<boolean | null>(null);
  const [centrifugeCushionType, setCentrifugeCushionType] = useState('');
  const [centrifugeResuspensionVolumeMl, setCentrifugeResuspensionVolumeMl] = useState('');
  const [centrifugeNotes, setCentrifugeNotes] = useState('');

  const [extender, setExtender] = useState<FreezingExtender | null>(null);
  const [extenderOther, setExtenderOther] = useState('');
  const [strawCount, setStrawCount] = useState('');
  const [strawVolumeMl, setStrawVolumeMl] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [strawsPerDose, setStrawsPerDose] = useState('');
  const [strawColor, setStrawColor] = useState<StrawColor | null>(null);
  const [strawColorOther, setStrawColorOther] = useState('');
  const [strawLabel, setStrawLabel] = useState('');

  const [postThawMotilityPercent, setPostThawMotilityPercent] = useState('');
  const [longevityHours, setLongevityHours] = useState('');

  const [storageDetails, setStorageDetails] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FrozenBatchWizardErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!collectionId) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const collection = await getSemenCollectionById(collectionId);
        if (!mounted) {
          return;
        }

        if (!collection) {
          Alert.alert('Collection not found', 'This collection no longer exists.');
          onInvalidLinkedCollection?.();
          return;
        }

        if (collection.stallionId !== stallionId) {
          Alert.alert(
            'Collection mismatch',
            'This collection belongs to a different stallion.',
          );
          onInvalidLinkedCollection?.();
          return;
        }

        setFreezeDate((current) =>
          current.trim().length > 0 ? current : collection.collectionDate,
        );
      } catch (error) {
        if (!mounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Unable to load collection details.';
        Alert.alert('Load error', message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [collectionId, onInvalidLinkedCollection, stallionId]);

  const parsedRawSemenVolumeUsedMl = useMemo(
    () => parseOptionalNumber(rawSemenVolumeUsedMl),
    [rawSemenVolumeUsedMl],
  );
  const parsedCentrifugeSpeedRpm = useMemo(
    () => parseOptionalInteger(centrifugeSpeedRpm),
    [centrifugeSpeedRpm],
  );
  const parsedCentrifugeDurationMin = useMemo(
    () => parseOptionalInteger(centrifugeDurationMin),
    [centrifugeDurationMin],
  );
  const parsedCentrifugeResuspensionVolumeMl = useMemo(
    () => parseOptionalNumber(centrifugeResuspensionVolumeMl),
    [centrifugeResuspensionVolumeMl],
  );
  const parsedStrawCount = useMemo(() => parseOptionalInteger(strawCount), [strawCount]);
  const parsedStrawVolumeMl = useMemo(() => parseOptionalNumber(strawVolumeMl), [strawVolumeMl]);
  const parsedConcentrationMillionsPerMl = useMemo(
    () => parseOptionalNumber(concentrationMillionsPerMl),
    [concentrationMillionsPerMl],
  );
  const parsedStrawsPerDose = useMemo(
    () => parseOptionalInteger(strawsPerDose),
    [strawsPerDose],
  );
  const parsedPostThawMotilityPercent = useMemo(
    () => parseOptionalNumber(postThawMotilityPercent),
    [postThawMotilityPercent],
  );
  const parsedLongevityHours = useMemo(
    () => parseOptionalNumber(longevityHours),
    [longevityHours],
  );

  const totalSpermPerStrawMillions = useMemo(
    () =>
      computeTotalSpermPerStrawMillions(
        parsedConcentrationMillionsPerMl,
        parsedStrawVolumeMl,
      ),
    [parsedConcentrationMillionsPerMl, parsedStrawVolumeMl],
  );

  const validateBasicsStep = (): boolean => {
    const nextErrors: FrozenBatchWizardErrors = {
      freezeDate:
        validateLocalDate(freezeDate, 'Freeze date', true) ??
        validateLocalDateNotInFuture(freezeDate) ??
        undefined,
      rawSemenVolumeUsedMl:
        validateLinkedFrozenRawVolume(
          parsedRawSemenVolumeUsedMl,
          collectionId ?? null,
        ) ?? undefined,
    };

    if (!collectionId && !nextErrors.rawSemenVolumeUsedMl) {
      nextErrors.rawSemenVolumeUsedMl =
        validateOptionalPositiveNumber(
          parsedRawSemenVolumeUsedMl,
          'Raw semen volume used',
        ) ?? undefined;
    }

    if (wasCentrifuged) {
      nextErrors.centrifugeSpeedRpm =
        (parsedCentrifugeSpeedRpm == null
          ? 'Centrifuge speed is required.'
          : validateIntegerRange(
              parsedCentrifugeSpeedRpm,
              'Centrifuge speed',
              100,
              10000,
            )) ?? undefined;
      nextErrors.centrifugeDurationMin =
        (parsedCentrifugeDurationMin == null
          ? 'Centrifuge duration is required.'
          : validateIntegerRange(
              parsedCentrifugeDurationMin,
              'Centrifuge duration',
              1,
              600,
            )) ?? undefined;
      nextErrors.centrifugeCushionUsed =
        validateTriStateSelection(centrifugeCushionUsed, 'Cushion used', true) ??
        undefined;
      nextErrors.centrifugeResuspensionVolumeMl =
        validateOptionalPositiveNumber(
          parsedCentrifugeResuspensionVolumeMl,
          'Resuspension volume',
        ) ?? undefined;
    } else {
      nextErrors.centrifugeSpeedRpm = undefined;
      nextErrors.centrifugeDurationMin = undefined;
      nextErrors.centrifugeCushionUsed = undefined;
      nextErrors.centrifugeResuspensionVolumeMl = undefined;
    }

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((value) => !value);
  };

  const validateStrawsStep = (): boolean => {
    const nextErrors: FrozenBatchWizardErrors = {
      extenderOther:
        validateOtherSelection(extender, extenderOther, 'Extender') ?? undefined,
      strawColorOther:
        validateOtherSelection(strawColor, strawColorOther, 'Straw color') ??
        undefined,
    };

    if (parsedStrawCount == null) {
      nextErrors.strawCount = 'Straw count is required.';
    } else {
      nextErrors.strawCount =
        validateIntegerRange(parsedStrawCount, 'Straw count', 1, 100000) ??
        undefined;
    }

    if (parsedStrawVolumeMl == null) {
      nextErrors.strawVolumeMl = 'Straw volume is required.';
    } else {
      const rangeError = validateNumberRange(
        parsedStrawVolumeMl,
        'Straw volume',
        0,
        100000,
      );
      if (rangeError) {
        nextErrors.strawVolumeMl = rangeError;
      } else if (parsedStrawVolumeMl <= 0) {
        nextErrors.strawVolumeMl = 'Straw volume must be greater than zero.';
      }
    }

    nextErrors.concentrationMillionsPerMl =
      validateOptionalPositiveNumber(
        parsedConcentrationMillionsPerMl,
        'Concentration',
      ) ?? undefined;

    if (parsedStrawsPerDose != null) {
      const rangeError = validateIntegerRange(
        parsedStrawsPerDose,
        'Straws per dose',
        1,
        100000,
      );
      if (rangeError) {
        nextErrors.strawsPerDose = rangeError;
      } else if (
        parsedStrawCount != null &&
        !Number.isNaN(parsedStrawCount) &&
        parsedStrawsPerDose > parsedStrawCount
      ) {
        nextErrors.strawsPerDose = 'Straws per dose cannot exceed straw count.';
      } else {
        nextErrors.strawsPerDose = undefined;
      }
    } else {
      nextErrors.strawsPerDose = undefined;
    }

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((value) => !value);
  };

  const validateQualityStep = (): boolean => {
    const nextErrors: FrozenBatchWizardErrors = {
      postThawMotilityPercent:
        validateOptionalDecimalRange(
          parsedPostThawMotilityPercent,
          'Post-thaw motility',
          0,
          100,
        ) ?? undefined,
      longevityHours:
        validateOptionalPositiveNumber(parsedLongevityHours, 'Longevity') ?? undefined,
    };

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.values(nextErrors).every((value) => !value);
  };

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      return validateBasicsStep();
    }
    if (stepIndex === 1) {
      return validateStrawsStep();
    }
    if (stepIndex === 2) {
      return validateQualityStep();
    }

    return validateBasicsStep() && validateStrawsStep() && validateQualityStep();
  };

  const goNext = (): void => {
    if (!validateStep(currentStepIndex)) {
      return;
    }
    setCurrentStepIndex((current) =>
      Math.min(current + 1, FROZEN_BATCH_WIZARD_STEPS.length - 1),
    );
  };

  const goBack = (): void => {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
  };

  const goToStep = (targetStepIndex: number): void => {
    const maxIndex = FROZEN_BATCH_WIZARD_STEPS.length - 1;
    const nextStepIndex = Math.max(0, Math.min(targetStepIndex, maxIndex));

    if (nextStepIndex === currentStepIndex) {
      return;
    }

    if (nextStepIndex < currentStepIndex) {
      setCurrentStepIndex(nextStepIndex);
      return;
    }

    for (let stepIndex = currentStepIndex; stepIndex < nextStepIndex; stepIndex += 1) {
      if (!validateStep(stepIndex)) {
        setCurrentStepIndex(stepIndex);
        return;
      }
    }

    setCurrentStepIndex(nextStepIndex);
  };

  const save = async (): Promise<void> => {
    const basicsValid = validateBasicsStep();
    const strawsValid = validateStrawsStep();
    const qualityValid = validateQualityStep();

    if (!basicsValid) {
      setCurrentStepIndex(0);
      return;
    }
    if (!strawsValid) {
      setCurrentStepIndex(1);
      return;
    }
    if (!qualityValid) {
      setCurrentStepIndex(2);
      return;
    }

    if (
      parsedStrawCount == null ||
      Number.isNaN(parsedStrawCount) ||
      parsedStrawCount < 1 ||
      parsedStrawVolumeMl == null ||
      Number.isNaN(parsedStrawVolumeMl) ||
      parsedStrawVolumeMl <= 0
    ) {
      setCurrentStepIndex(1);
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateFrozenSemenBatchInput = {
        stallionId,
        collectionId: collectionId ?? null,
        freezeDate: freezeDate.trim(),
        rawSemenVolumeUsedMl: toOptionalNumber(parsedRawSemenVolumeUsedMl),
        extender,
        extenderOther: toOptionalText(extenderOther),
        wasCentrifuged,
        centrifuge: {
          speedRpm: wasCentrifuged ? toOptionalInteger(parsedCentrifugeSpeedRpm) : null,
          durationMin: wasCentrifuged
            ? toOptionalInteger(parsedCentrifugeDurationMin)
            : null,
          cushionUsed: wasCentrifuged ? centrifugeCushionUsed : null,
          cushionType: wasCentrifuged ? toOptionalText(centrifugeCushionType) : null,
          resuspensionVolumeMl: wasCentrifuged
            ? toOptionalNumber(parsedCentrifugeResuspensionVolumeMl)
            : null,
          notes: wasCentrifuged ? toOptionalText(centrifugeNotes) : null,
        },
        strawCount: parsedStrawCount,
        strawVolumeMl: parsedStrawVolumeMl,
        concentrationMillionsPerMl: toOptionalNumber(parsedConcentrationMillionsPerMl),
        strawsPerDose: toOptionalInteger(parsedStrawsPerDose),
        strawColor,
        strawColorOther: toOptionalText(strawColorOther),
        strawLabel: toOptionalText(strawLabel),
        postThawMotilityPercent: toOptionalNumber(parsedPostThawMotilityPercent),
        longevityHours: toOptionalNumber(parsedLongevityHours),
        storageDetails: toOptionalText(storageDetails),
        notes: toOptionalText(notes),
      };

      await createFrozenSemenBatch(payload);
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save frozen batch.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    currentStepIndex,
    currentStepTitle: FROZEN_BATCH_WIZARD_STEPS[currentStepIndex],
    freezeDate,
    setFreezeDate,
    rawSemenVolumeUsedMl,
    setRawSemenVolumeUsedMl,
    wasCentrifuged,
    setWasCentrifuged,
    centrifugeSpeedRpm,
    setCentrifugeSpeedRpm,
    centrifugeDurationMin,
    setCentrifugeDurationMin,
    centrifugeCushionUsed,
    setCentrifugeCushionUsed,
    centrifugeCushionType,
    setCentrifugeCushionType,
    centrifugeResuspensionVolumeMl,
    setCentrifugeResuspensionVolumeMl,
    centrifugeNotes,
    setCentrifugeNotes,
    extender,
    setExtender,
    extenderOther,
    setExtenderOther,
    strawCount,
    setStrawCount,
    strawVolumeMl,
    setStrawVolumeMl,
    concentrationMillionsPerMl,
    setConcentrationMillionsPerMl,
    strawsPerDose,
    setStrawsPerDose,
    strawColor,
    setStrawColor,
    strawColorOther,
    setStrawColorOther,
    strawLabel,
    setStrawLabel,
    postThawMotilityPercent,
    setPostThawMotilityPercent,
    longevityHours,
    setLongevityHours,
    storageDetails,
    setStorageDetails,
    notes,
    setNotes,
    totalSpermPerStrawMillions,
    errors,
    isSaving,
    isSaveDisabled: isSaving,
    isLinkedToCollection: Boolean(collectionId),
    goNext,
    goBack,
    goToStep,
    save,
  };
}
