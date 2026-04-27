import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AI_BREEDING_METHOD_OPTIONS } from '@/models/enums';
import type { BreedingMethod, LocalDate, SemenCollection, Stallion } from '@/models/types';
import {
  createBreedingRecord,
  deleteBreedingRecord,
  getBreedingRecordById,
  getStallionById,
  hasLinkedOnFarmDoseEvent,
  listSemenCollectionsByStallion,
  listStallions,
  updateBreedingRecord,
} from '@/storage/repositories';
import { normalizeBreedingRecordTime } from '@/utils/breedingRecordTime';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatLocalDate } from '@/utils/dates';
import { getCurrentTimeHHMM } from '@/utils/dailyLogTime';
import { newId } from '@/utils/id';
import {
  normalizeLocalDate,
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

import {
  completeLinkedTaskAfterSave,
  type FollowUpTaskParams,
} from './completeLinkedTaskAfterSave';
import { useRecordForm } from './useRecordForm';

type FormErrors = {
  date?: string;
  time?: string;
  stallion?: string;
  collectionDate?: string;
  volumeMl?: string;
  concentrationMPerMl?: string;
  motilityPercent?: string;
  numberOfStraws?: string;
  strawVolumeMl?: string;
};

export type CoverageType = 'liveCover' | 'ai';

export const OTHER_STALLION = '__other__';
export const NO_COLLECTION = '__none__';

export const COVERAGE_OPTIONS: { label: string; value: CoverageType }[] = [
  { label: 'Live Cover', value: 'liveCover' },
  { label: 'AI', value: 'ai' },
];

type AIMethod = Exclude<BreedingMethod, 'liveCover'>;

function formatCollectionLabel(collection: SemenCollection): string {
  const date = formatLocalDate(collection.collectionDate, 'MM-DD-YYYY');
  const volume = collection.rawVolumeMl != null ? `${collection.rawVolumeMl} mL` : '-';
  const motility =
    collection.progressiveMotilityPercent != null
      ? `${collection.progressiveMotilityPercent}%`
      : '-';
  return `${date} - ${volume} - ${motility} motility`;
}

type UseBreedingRecordFormArgs = {
  readonly mareId: string;
  readonly breedingRecordId?: string;
  readonly taskId?: string;
  readonly defaultDate?: LocalDate;
  readonly defaultTime?: string | null;
  readonly onGoBack: () => void;
  readonly onAddFollowUpTask?: (params: FollowUpTaskParams) => void;
  readonly setTitle: (title: string) => void;
};

export function useBreedingRecordForm({
  mareId,
  breedingRecordId,
  taskId,
  defaultDate,
  defaultTime,
  onGoBack,
  onAddFollowUpTask,
  setTitle,
}: UseBreedingRecordFormArgs) {
  const isEdit = Boolean(breedingRecordId);
  const today = useMemo(() => new Date(), []);
  const onGoBackRef = useRef(onGoBack);
  const onAddFollowUpTaskRef = useRef(onAddFollowUpTask);
  const setTitleRef = useRef(setTitle);

  const [date, setDate] = useState(defaultDate ?? '');
  const [time, setTime] = useState(() => defaultTime ?? getCurrentTimeHHMM());
  const [stallionName, setStallionName] = useState('');
  const [method, setMethod] = useState<BreedingMethod>('liveCover');
  const [volumeMl, setVolumeMl] = useState('');
  const [concentrationMPerMl, setConcentrationMPerMl] = useState('');
  const [motilityPercent, setMotilityPercent] = useState('');
  const [numberOfStraws, setNumberOfStraws] = useState('');
  const [strawVolumeMl, setStrawVolumeMl] = useState('');
  const [strawDetails, setStrawDetails] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, runLoad, runSave, runDelete } = useRecordForm({
    initialLoading: isEdit,
  });

  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [selectedStallionId, setSelectedStallionId] = useState<string | null>(null);
  const [useCustomStallion, setUseCustomStallion] = useState(false);

  const [collections, setCollections] = useState<SemenCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showAllCollections, setShowAllCollections] = useState(false);
  const [isLinkedOnFarmRecord, setIsLinkedOnFarmRecord] = useState(false);
  const [loadedRecordHadTime, setLoadedRecordHadTime] = useState(false);

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    onAddFollowUpTaskRef.current = onAddFollowUpTask;
    setTitleRef.current = setTitle;
  }, [onAddFollowUpTask, onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Breeding Record' : 'Add Breeding Record');
  }, [isEdit]);

  useEffect(() => {
    void (async () => {
      const rows = await listStallions();
      setStallions(rows);
    })();
  }, []);

  useEffect(() => {
    if (!breedingRecordId) {
      setIsLinkedOnFarmRecord(false);
      setLoadedRecordHadTime(false);
      return;
    }

    void runLoad(
      async () => {
        const record = await getBreedingRecordById(breedingRecordId);
        if (!record) {
          Alert.alert('Record not found', 'This breeding record no longer exists.');
          onGoBackRef.current();
          return;
        }

        setDate(record.date);
        setTime(record.time ?? '');
        setLoadedRecordHadTime(record.time != null);
        setMethod(record.method);
        setVolumeMl(record.volumeMl == null ? '' : String(record.volumeMl));
        setConcentrationMPerMl(
          record.concentrationMPerMl == null ? '' : String(record.concentrationMPerMl),
        );
        setMotilityPercent(record.motilityPercent == null ? '' : String(record.motilityPercent));
        setNumberOfStraws(record.numberOfStraws == null ? '' : String(record.numberOfStraws));
        setStrawVolumeMl(record.strawVolumeMl == null ? '' : String(record.strawVolumeMl));
        setStrawDetails(record.strawDetails ?? '');
        setCollectionDate(record.collectionDate ?? '');
        setNotes(record.notes ?? '');
        setIsLinkedOnFarmRecord(await hasLinkedOnFarmDoseEvent(record.id));

        if (record.stallionId != null) {
          setSelectedStallionId(record.stallionId);
          setUseCustomStallion(false);
          const nextCollections = await listSemenCollectionsByStallion(record.stallionId);
          setCollections(nextCollections);
          const currentList = await listStallions();
          const found = currentList.some((stallion) => stallion.id === record.stallionId);
          if (!found) {
            const deleted = await getStallionById(record.stallionId);
            if (deleted) {
              setStallions([deleted, ...currentList]);
            }
          } else {
            setStallions(currentList);
          }
        } else {
          setUseCustomStallion(true);
          setStallionName(record.stallionName ?? '');
        }

        if (record.collectionId != null) {
          setSelectedCollectionId(record.collectionId);
        }
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unable to load breeding record.';
          Alert.alert('Load error', message);
          onGoBackRef.current();
        },
      },
    );
  }, [breedingRecordId, runLoad]);

  const coverageType: CoverageType = method === 'liveCover' ? 'liveCover' : 'ai';
  const lockMethodAndCollection = isEdit && isLinkedOnFarmRecord;

  const selectedStallionLabel = useCustomStallion
    ? stallionName.trim()
    : stallions.find((stallion) => stallion.id === selectedStallionId)?.name ?? '';

  const selectedCollection = selectedCollectionId
    ? collections.find((collection) => collection.id === selectedCollectionId) ?? null
    : null;
  const selectedCollectionLabel = selectedCollection
    ? formatCollectionLabel(selectedCollection)
    : selectedCollectionId ?? 'None';

  const onCoverageChange = useCallback(
    (coverage: CoverageType): void => {
      if (lockMethodAndCollection) {
        return;
      }

      if (coverage === 'liveCover') {
        setMethod('liveCover');
        setSelectedCollectionId(null);
      } else if (method === 'liveCover') {
        setMethod('freshAI');
      }
    },
    [lockMethodAndCollection, method],
  );

  const onStallionChange = useCallback(
    (value: string): void => {
      if (lockMethodAndCollection) {
        return;
      }

      if (value === OTHER_STALLION) {
        setUseCustomStallion(true);
        setSelectedStallionId(null);
        setSelectedCollectionId(null);
        setCollections([]);
        return;
      }

      setUseCustomStallion(false);
      setSelectedStallionId(value);
      setSelectedCollectionId(null);
      setShowAllCollections(false);

      void (async () => {
        const rows = await listSemenCollectionsByStallion(value);
        setCollections(rows);
      })();
    },
    [lockMethodAndCollection],
  );

  const onCollectionChange = useCallback(
    (value: string): void => {
      if (lockMethodAndCollection) {
        return;
      }

      if (value === NO_COLLECTION) {
        setSelectedCollectionId(null);
        return;
      }

      const collection = collections.find((candidate) => candidate.id === value);
      if (!collection) {
        return;
      }

      setSelectedCollectionId(collection.id);
      if (collection.rawVolumeMl != null) {
        setVolumeMl(String(collection.rawVolumeMl));
      }
      if (collection.concentrationMillionsPerMl != null) {
        setConcentrationMPerMl(String(collection.concentrationMillionsPerMl));
      }
      if (collection.progressiveMotilityPercent != null) {
        setMotilityPercent(String(collection.progressiveMotilityPercent));
      }
      if (collection.collectionDate) {
        setCollectionDate(collection.collectionDate);
      }
    },
    [collections, lockMethodAndCollection],
  );

  const stallionPickerOptions = useMemo(
    () => [
      ...stallions.map((stallion) => ({ label: stallion.name, value: stallion.id })),
      { label: 'Other / Not in list', value: OTHER_STALLION },
    ],
    [stallions],
  );

  const showCollectionPicker = selectedStallionId != null && method !== 'liveCover';
  const recentCollections = showAllCollections ? collections : collections.slice(0, 10);
  const collectionPickerOptions = useMemo(
    () => [
      { label: 'None', value: NO_COLLECTION },
      ...recentCollections.map((collection) => ({
        label: formatCollectionLabel(collection),
        value: collection.id,
      })),
    ],
    [recentCollections],
  );

  const validate = useCallback(() => {
    const parsedVolume = parseOptionalNumber(volumeMl);
    const parsedConcentration = parseOptionalNumber(concentrationMPerMl);
    const parsedMotility = parseOptionalNumber(motilityPercent);
    const parsedStraws = parseOptionalInteger(numberOfStraws);
    const parsedStrawVolume = parseOptionalNumber(strawVolumeMl);
    const parsedTime = time === '' ? null : normalizeBreedingRecordTime(time);
    const timeError =
      parsedTime != null
        ? undefined
        : !isEdit && time === ''
          ? 'Breeding time is required.'
          : time === ''
            ? undefined
            : 'Breeding time must be a valid HH:MM time.';

    const nextErrors: FormErrors = {
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
      time: timeError,
      stallion: useCustomStallion
        ? validateRequired(stallionName.trim(), 'Stallion name') ?? undefined
        : selectedStallionId == null
          ? 'Please select a stallion.'
          : undefined,
      collectionDate:
        method === 'shippedCooledAI' || method === 'frozenAI'
          ? (validateLocalDate(collectionDate, 'Collection date', false) ??
              validateLocalDateNotInFuture(collectionDate) ??
              (method === 'shippedCooledAI' &&
              collectionDate.trim() &&
              date.trim() &&
              collectionDate.trim() > date.trim()
                ? 'Collection date cannot be after breeding date.'
                : null)) ??
            undefined
          : undefined,
      volumeMl:
        method === 'freshAI' || method === 'shippedCooledAI'
          ? validateNumberRange(parsedVolume, 'Volume (mL)', 0, 1000) ?? undefined
          : undefined,
      concentrationMPerMl:
        method === 'freshAI' || method === 'shippedCooledAI'
          ? validateNumberRange(parsedConcentration, 'Concentration (millions/mL)', 0, 100000) ??
            undefined
          : undefined,
      motilityPercent:
        method === 'freshAI' || method === 'shippedCooledAI'
          ? validateNumberRange(parsedMotility, 'Motility %', 0, 100) ?? undefined
          : undefined,
      numberOfStraws:
        method === 'frozenAI'
          ? parsedStraws === null
            ? 'Number of straws is required for Frozen AI.'
            : validateNumberRange(parsedStraws, 'Number of straws', 1, 1000) ?? undefined
          : undefined,
      strawVolumeMl:
        method === 'frozenAI'
          ? validateNumberRange(parsedStrawVolume, 'Straw volume (mL)', 0, 99) ?? undefined
          : undefined,
    };

    setErrors(nextErrors);
    return {
      valid: Object.values(nextErrors).every((error) => !error),
      parsedVolume,
      parsedConcentration,
      parsedMotility,
      parsedStraws,
      parsedStrawVolume,
      parsedTime,
    };
  }, [
    collectionDate,
    concentrationMPerMl,
    date,
    isEdit,
    method,
    motilityPercent,
    numberOfStraws,
    selectedStallionId,
    stallionName,
    strawVolumeMl,
    time,
    useCustomStallion,
    volumeMl,
  ]);

  const saveWithCompletion = useCallback(async (
    onCompletedOrSkipped: (savedBreedingRecordId: string) => void,
  ): Promise<void> => {
    const {
      valid,
      parsedVolume,
      parsedConcentration,
      parsedMotility,
      parsedStraws,
      parsedStrawVolume,
      parsedTime,
    } = validate();
    if (!valid) {
      return;
    }
    if (!isEdit && parsedTime == null) {
      return;
    }
    const createTime = parsedTime;

    if (isEdit && loadedRecordHadTime && parsedTime == null) {
      const confirmed = await confirmClearBreedingTime();
      if (!confirmed) {
        return;
      }
    }

    await runSave(
      async () => {
        const payload = {
          stallionId: selectedStallionId,
          stallionName: useCustomStallion ? stallionName.trim() || null : null,
          collectionId: selectedCollectionId,
          date: date.trim(),
          time: parsedTime,
          method,
          notes: notes.trim() || null,
          volumeMl: method === 'freshAI' || method === 'shippedCooledAI' ? parsedVolume : null,
          concentrationMPerMl:
            method === 'freshAI' || method === 'shippedCooledAI' ? parsedConcentration : null,
          motilityPercent:
            method === 'freshAI' || method === 'shippedCooledAI' ? parsedMotility : null,
          numberOfStraws: method === 'frozenAI' ? parsedStraws : null,
          strawVolumeMl: method === 'frozenAI' ? parsedStrawVolume : null,
          strawDetails: method === 'frozenAI' ? strawDetails.trim() || null : null,
          collectionDate:
            selectedCollectionId != null ||
            method === 'shippedCooledAI' ||
            method === 'frozenAI'
              ? normalizeLocalDate(collectionDate)
              : null,
        };

        const savedBreedingRecordId = breedingRecordId ?? newId();

        if (breedingRecordId) {
          await updateBreedingRecord(breedingRecordId, payload);
        } else {
          if (createTime == null) {
            throw new Error('Breeding time is required.');
          }
          await createBreedingRecord({ id: savedBreedingRecordId, mareId, ...payload, time: createTime });
        }

        await completeLinkedTaskAfterSave({
          taskId,
          completedRecordType: 'breedingRecord',
          completedRecordId: savedBreedingRecordId,
          onCompletedOrSkipped: () => onCompletedOrSkipped(savedBreedingRecordId),
        });
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save breeding record.';
          Alert.alert('Save failed', message);
        },
      },
    );
  }, [
    breedingRecordId,
    collectionDate,
    date,
    isEdit,
    loadedRecordHadTime,
    mareId,
    method,
    notes,
    runSave,
    selectedCollectionId,
    selectedStallionId,
    stallionName,
    strawDetails,
    taskId,
    useCustomStallion,
    validate,
  ]);

  const onSave = useCallback(async (): Promise<void> => {
    await saveWithCompletion(() => onGoBackRef.current());
  }, [saveWithCompletion]);

  const onSaveAndAddFollowUp = useCallback(async (): Promise<void> => {
    await saveWithCompletion((savedBreedingRecordId) => {
      const onAddFollowUpTask = onAddFollowUpTaskRef.current;
      if (!onAddFollowUpTask) {
        onGoBackRef.current();
        return;
      }

      onAddFollowUpTask({
        mareId,
        taskType: 'pregnancyCheck',
        sourceType: 'breedingRecord',
        sourceRecordId: savedBreedingRecordId,
        sourceReason: 'manualFollowUp',
      });
    });
  }, [mareId, saveWithCompletion]);

  const requestDelete = useCallback((): void => {
    if (!breedingRecordId) {
      return;
    }

    confirmDelete({
      title: 'Delete Breeding Record',
      message: 'Delete this breeding record?',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await deleteBreedingRecord(breedingRecordId);
            onGoBack();
          },
          {
            onError: (error: unknown) => {
              const message = error instanceof Error ? error.message : 'Failed to delete breeding record.';
              if (message.toLowerCase().includes('foreign key')) {
                Alert.alert(
                  'Delete blocked',
                  'Cannot delete this breeding record because linked records exist.',
                );
                return;
              }
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
  }, [breedingRecordId, onGoBack, runDelete]);

  return {
    today,
    isEdit,
    date,
    time,
    stallionName,
    method,
    volumeMl,
    concentrationMPerMl,
    motilityPercent,
    numberOfStraws,
    strawVolumeMl,
    strawDetails,
    collectionDate,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    coverageType,
    lockMethodAndCollection,
    selectedStallionId,
    selectedCollectionId,
    useCustomStallion,
    selectedStallionLabel,
    selectedCollectionLabel,
    stallionPickerOptions,
    collectionPickerOptions,
    showCollectionPicker,
    canShowAllCollections: collections.length > 10 && !showAllCollections,
    showAllCollectionsList: () => setShowAllCollections(true),
    aiMethodOptions: AI_BREEDING_METHOD_OPTIONS,
    isTimeRequired: !isEdit,
    setDate,
    setTime,
    setStallionName,
    setMethod: (value: AIMethod) => setMethod(value),
    setVolumeMl,
    setConcentrationMPerMl,
    setMotilityPercent,
    setNumberOfStraws,
    setStrawVolumeMl,
    setStrawDetails,
    setCollectionDate,
    setNotes,
    onCoverageChange,
    onStallionChange,
    onCollectionChange,
    onSave,
    onSaveAndAddFollowUp,
    requestDelete,
  };
}

function confirmClearBreedingTime(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Clear Breeding Time',
      'Remove the saved time from this breeding record?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Clear', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
