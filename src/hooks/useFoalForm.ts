import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { FoalColor, FoalMilestoneKey, FoalMilestones, FoalSex, IggTest } from '@/models/types';
import {
  createFoal,
  deleteFoal,
  getFoalByFoalingRecordId,
  getFoalById,
  getFoalingRecordById,
  updateFoal,
} from '@/storage/repositories';
import { toLocalDate } from '@/utils/dates';
import { newId } from '@/utils/id';

type UseFoalFormArgs = {
  readonly foalingRecordId: string;
  readonly foalId?: string;
  readonly defaultSex?: FoalSex | null;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};

type FormErrors = {
  birthWeightLbs?: string;
};

type UseFoalFormResult = {
  readonly existingFoalId: string | null;
  readonly isEdit: boolean;
  readonly name: string;
  readonly sex: FoalSex | null;
  readonly color: FoalColor | null;
  readonly markings: string;
  readonly birthWeightLbs: string;
  readonly milestones: FoalMilestones;
  readonly notes: string;
  readonly iggTests: IggTest[];
  readonly errors: FormErrors;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly setName: (value: string) => void;
  readonly setSex: (value: FoalSex | null) => void;
  readonly setColor: (value: FoalColor | null) => void;
  readonly setMarkings: (value: string) => void;
  readonly setBirthWeightLbs: (value: string) => void;
  readonly setNotes: (value: string) => void;
  readonly toggleMilestone: (key: FoalMilestoneKey) => void;
  readonly addIggTest: () => void;
  readonly updateIggTest: (index: number, updates: Partial<Pick<IggTest, 'date' | 'valueMgDl'>>) => void;
  readonly removeIggTest: (index: number) => void;
  readonly onSave: () => Promise<void>;
  readonly onDelete: () => void;
  readonly formatRecordedAt: (iso: string | null | undefined) => string;
};

export function useFoalForm({
  foalingRecordId,
  foalId,
  defaultSex,
  onGoBack,
  setTitle,
}: UseFoalFormArgs): UseFoalFormResult {
  const [existingFoalId, setExistingFoalId] = useState<string | null>(foalId ?? null);
  const isEdit = Boolean(existingFoalId);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<FoalSex | null>(defaultSex ?? null);
  const [color, setColor] = useState<FoalColor | null>(null);
  const [markings, setMarkings] = useState('');
  const [birthWeightLbs, setBirthWeightLbs] = useState('');
  const [milestones, setMilestones] = useState<FoalMilestones>({});
  const [notes, setNotes] = useState('');
  const [iggTests, setIggTests] = useState<IggTest[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Foal Record' : 'Add Foal Record');
  }, [isEdit]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const foalingRecord = await getFoalingRecordById(foalingRecordId);
        if (!mounted) return;

        if (!foalingRecord) {
          Alert.alert('Record not found', 'This foaling record no longer exists.');
          onGoBackRef.current();
          return;
        }

        if (foalingRecord.outcome !== 'liveFoal') {
          Alert.alert('Invalid record', 'Foal records can only be added to live foal outcomes.');
          onGoBackRef.current();
          return;
        }

        const existing = foalId
          ? await getFoalById(foalId)
          : await getFoalByFoalingRecordId(foalingRecordId);

        if (!mounted || !existing) return;

        setExistingFoalId(existing.id);
        setName(existing.name ?? '');
        setSex(existing.sex ?? null);
        setColor(existing.color ?? null);
        setMarkings(existing.markings ?? '');
        setBirthWeightLbs(existing.birthWeightLbs != null ? String(existing.birthWeightLbs) : '');
        setMilestones(existing.milestones);
        setIggTests([...existing.iggTests]);
        setNotes(existing.notes ?? '');
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Unable to load foal form data.';
        Alert.alert('Load error', message);
        onGoBackRef.current();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [foalId, foalingRecordId]);

  const toggleMilestone = useCallback((key: FoalMilestoneKey) => {
    setMilestones((prev) => {
      const current = prev[key];
      const wasDone = current?.done ?? false;
      return {
        ...prev,
        [key]: {
          done: !wasDone,
          recordedAt: !wasDone ? new Date().toISOString() : current?.recordedAt ?? null,
        },
      };
    });
  }, []);

  const addIggTest = useCallback(() => {
    setIggTests((prev) => [
      {
        date: toLocalDate(new Date()),
        valueMgDl: 0,
        recordedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const updateIggTest = useCallback((index: number, updates: Partial<Pick<IggTest, 'date' | 'valueMgDl'>>) => {
    setIggTests((prev) => prev.map((test, currentIndex) => (currentIndex === index ? { ...test, ...updates } : test)));
  }, []);

  const removeIggTest = useCallback((index: number) => {
    setIggTests((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const validate = useCallback((): boolean => {
    const trimmedWeight = birthWeightLbs.trim();
    const nextErrors: FormErrors = {};

    if (trimmedWeight) {
      const parsed = Number(trimmedWeight);
      if (Number.isNaN(parsed) || parsed <= 0) {
        nextErrors.birthWeightLbs = 'Must be a positive number.';
      }
    }

    setErrors(nextErrors);
    return !nextErrors.birthWeightLbs;
  }, [birthWeightLbs]);

  const onSave = useCallback(async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const trimmedWeight = birthWeightLbs.trim();
      const payload = {
        name: name.trim() || null,
        sex,
        color,
        markings: markings.trim() || null,
        birthWeightLbs: trimmedWeight ? Number(trimmedWeight) : null,
        milestones,
        iggTests: iggTests.filter((test) => test.valueMgDl > 0),
        notes: notes.trim() || null,
      };

      if (existingFoalId) {
        await updateFoal(existingFoalId, payload);
      } else {
        await createFoal({ id: newId(), foalingRecordId, ...payload });
      }

      onGoBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save foal record.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }, [birthWeightLbs, color, existingFoalId, foalingRecordId, iggTests, markings, milestones, name, notes, onGoBack, sex, validate]);

  const onDelete = useCallback(() => {
    if (!existingFoalId) return;

    Alert.alert('Delete Foal Record', 'Delete this foal record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteFoal(existingFoalId);
              onGoBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete foal record.';
              Alert.alert('Delete failed', message);
            }
          })();
        },
      },
    ]);
  }, [existingFoalId, onGoBack]);

  const formatRecordedAt = useCallback((iso: string | null | undefined): string => {
    if (!iso) return '';

    try {
      const value = new Date(iso);
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  }, []);

  return {
    existingFoalId,
    isEdit,
    name,
    sex,
    color,
    markings,
    birthWeightLbs,
    milestones,
    notes,
    iggTests,
    errors,
    isLoading,
    isSaving,
    setName,
    setSex,
    setColor,
    setMarkings,
    setBirthWeightLbs,
    setNotes,
    toggleMilestone,
    addIggTest,
    updateIggTest,
    removeIggTest,
    onSave,
    onDelete,
    formatRecordedAt,
  };
}
