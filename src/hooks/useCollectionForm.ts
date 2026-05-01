import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { type CollectionTargetMode } from '@/models/types';
import {
  deleteSemenCollection,
  getSemenCollectionById,
  updateSemenCollection,
} from '@/storage/repositories';
import { deriveCollectionMath } from '@/utils/collectionCalculator';
import {
  TARGET_SPERM_HELPER_TEXT,
  TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT,
  formatCollectionEquivalentHelperText,
  formatCollectionEquivalentValue,
  getCollectionEquivalentLabel,
  getCollectionRawConcentrationLabel,
  getCollectionTargetPostExtensionLabel,
  getCollectionTargetSpermLabel,
  getTargetPostExtensionModeHelperText,
  getTargetPostExtensionRangeHelperText,
} from '@/utils/collectionCalculatorCopy';
import {
  getEffectiveCollectionTargetMode,
  getPersistedCollectionTargetMode,
} from '@/utils/collectionTargetMode';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
} from '@/utils/validation';

type FormErrors = {
  collectionDate?: string;
  rawVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  motilityPercent?: string;
  progressiveMotilityPercent?: string;
  targetSpermMillionsPerDose?: string;
  targetPostExtensionConcentrationMillionsPerMl?: string;
};

type UseCollectionFormArgs = {
  readonly collectionId: string;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};

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

export function useCollectionForm({
  collectionId,
  onGoBack,
  setTitle,
}: UseCollectionFormArgs) {
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [collectionDate, setCollectionDate] = useState('');
  const [rawVolumeMl, setRawVolumeMl] = useState('');
  const [extenderType, setExtenderType] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [motilityPercent, setMotilityPercent] = useState('');
  const [progressiveMotilityPercent, setProgressiveMotilityPercent] = useState('');
  const [targetMode, setTargetMode] = useState<CollectionTargetMode>('progressive');
  const [targetSpermMillionsPerDose, setTargetSpermMillionsPerDose] = useState('');
  const [
    targetPostExtensionConcentrationMillionsPerMl,
    setTargetPostExtensionConcentrationMillionsPerMl,
  ] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current('Edit Collection');
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const record = await getSemenCollectionById(collectionId);
        if (!record) {
          Alert.alert('Collection not found', 'This collection no longer exists.');
          onGoBackRef.current();
          return;
        }

        setCollectionDate(record.collectionDate);
        setRawVolumeMl(record.rawVolumeMl != null ? String(record.rawVolumeMl) : '');
        setExtenderType(record.extenderType ?? '');
        setConcentrationMillionsPerMl(
          record.concentrationMillionsPerMl != null
            ? String(record.concentrationMillionsPerMl)
            : '',
        );
        setMotilityPercent(
          record.motilityPercent != null
            ? String(record.motilityPercent)
            : '',
        );
        setProgressiveMotilityPercent(
          record.progressiveMotilityPercent != null
            ? String(record.progressiveMotilityPercent)
            : '',
        );
        setTargetMode(getEffectiveCollectionTargetMode(record.targetMode));
        setTargetSpermMillionsPerDose(
          record.targetSpermMillionsPerDose != null
            ? String(record.targetSpermMillionsPerDose)
            : '',
        );
        setTargetPostExtensionConcentrationMillionsPerMl(
          record.targetPostExtensionConcentrationMillionsPerMl != null
            ? String(record.targetPostExtensionConcentrationMillionsPerMl)
            : '',
        );
        setNotes(record.notes ?? '');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [collectionId]);

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
      parsedTargetPostExtensionConcentrationMillionsPerMl,
      parsedTargetSpermMillionsPerDose,
      targetMode,
    ],
  );

  const equivalentHelperText = useMemo(
    () =>
      formatCollectionEquivalentHelperText({
        targetMode,
        equivalentConcentrationMillionsPerMl:
          targetMode === 'total'
            ? derivedMath.targetPostExtensionProgressiveEquivalentMillionsPerMl
            : derivedMath.targetPostExtensionTotalEquivalentMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
      }),
    [derivedMath, parsedProgressiveMotilityPercent, targetMode],
  );

  const equivalentValue = useMemo(
    () =>
      formatCollectionEquivalentValue({
        equivalentConcentrationMillionsPerMl:
          targetMode === 'total'
            ? derivedMath.targetPostExtensionProgressiveEquivalentMillionsPerMl
            : derivedMath.targetPostExtensionTotalEquivalentMillionsPerMl,
        progressiveMotilityPercent: parsedProgressiveMotilityPercent,
      }),
    [derivedMath, parsedProgressiveMotilityPercent, targetMode],
  );

  const rangeHelperText = getTargetPostExtensionRangeHelperText(targetMode);

  const onTargetModeChange = useCallback((nextTargetMode: CollectionTargetMode): void => {
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
  }, [targetMode]);

  const validate = useCallback((): FormErrors => {
    return {
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
  }, [
    collectionDate,
    concentrationMillionsPerMl,
    parsedMotilityPercent,
    parsedProgressiveMotilityPercent,
    rawVolumeMl,
    targetPostExtensionConcentrationMillionsPerMl,
    targetSpermMillionsPerDose,
  ]);

  const onSave = useCallback(async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsSaving(true);
    try {
      await updateSemenCollection(collectionId, {
        collectionDate,
        rawVolumeMl: parsedRawVolumeMl,
        extenderType: extenderType.trim() || null,
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
      });

      onGoBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save collection.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  }, [
    collectionDate,
    collectionId,
    extenderType,
    notes,
    onGoBack,
    parsedConcentrationMillionsPerMl,
    parsedMotilityPercent,
    parsedProgressiveMotilityPercent,
    parsedRawVolumeMl,
    parsedTargetPostExtensionConcentrationMillionsPerMl,
    parsedTargetSpermMillionsPerDose,
    targetMode,
    validate,
  ]);

  const requestDelete = useCallback((): void => {
    Alert.alert('Delete Collection', 'Are you sure you want to delete this collection record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteSemenCollection(collectionId);
              onGoBack();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to delete collection.';
              Alert.alert('Delete blocked', message);
            }
          })();
        },
      },
    ]);
  }, [collectionId, onGoBack]);

  return {
    today,
    collectionDate,
    rawVolumeMl,
    extenderType,
    concentrationMillionsPerMl,
    progressiveMotilityPercent,
    motilityPercent,
    targetMode,
    targetSpermMillionsPerDose,
    targetPostExtensionConcentrationMillionsPerMl,
    notes,
    errors,
    isLoading,
    isSaving,
    derivedMath,
    equivalentHelperText,
    equivalentValue,
    rangeHelperText,
    targetSpermHelperText: TARGET_SPERM_HELPER_TEXT,
    totalModeMissingMotilityWarningText: TOTAL_MODE_MISSING_MOTILITY_WARNING_TEXT,
    getCollectionEquivalentLabel,
    getCollectionRawConcentrationLabel,
    getCollectionTargetPostExtensionLabel,
    getCollectionTargetSpermLabel,
    getTargetPostExtensionModeHelperText,
    setCollectionDate,
    setRawVolumeMl,
    setExtenderType,
    setConcentrationMillionsPerMl,
    setMotilityPercent,
    setProgressiveMotilityPercent,
    setTargetSpermMillionsPerDose,
    setTargetPostExtensionConcentrationMillionsPerMl,
    setNotes,
    onTargetModeChange,
    onSave,
    requestDelete,
  };
}
