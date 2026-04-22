import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { FoalColor, FoalMilestoneKey, FoalMilestones, FoalSex, IggTest } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
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

type FoalFormNavigation = NativeStackNavigationProp<RootStackParamList, 'FoalForm'>;
type FoalFormRoute = RouteProp<RootStackParamList, 'FoalForm'>;

type FormErrors = {
  birthWeightLbs?: string;
};

type UseFoalFormState = {
  readonly isEdit: boolean;
  readonly name: string;
  readonly sex: FoalSex | null;
  readonly color: FoalColor | null;
  readonly markings: string;
  readonly birthWeightLbs: string;
  readonly milestones: FoalMilestones;
  readonly notes: string;
  readonly iggTests: readonly IggTest[];
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
};

export function useFoalForm(
  navigation: FoalFormNavigation,
  route: FoalFormRoute
): UseFoalFormState {
  const { foalingRecordId, foalId, defaultSex } = route.params;

  const [existingFoalId, setExistingFoalId] = useState<string | null>(foalId ?? null);
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

  const isEdit = Boolean(existingFoalId);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Foal Record' : 'Add Foal Record' });
  }, [isEdit, navigation]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const foalingRecord = await getFoalingRecordById(foalingRecordId);
        if (!mounted) {
          return;
        }

        if (!foalingRecord) {
          Alert.alert('Record not found', 'This foaling record no longer exists.');
          navigation.goBack();
          return;
        }

        if (foalingRecord.outcome !== 'liveFoal') {
          Alert.alert('Invalid record', 'Foal records can only be added to live foal outcomes.');
          navigation.goBack();
          return;
        }

        const existing = foalId
          ? await getFoalById(foalId)
          : await getFoalByFoalingRecordId(foalingRecordId);

        if (!mounted || !existing) {
          return;
        }

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
        if (!mounted) {
          return;
        }
        Alert.alert('Load error', err instanceof Error ? err.message : 'Unable to load foal form data.');
        navigation.goBack();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [foalId, foalingRecordId, navigation]);

  const toggleMilestone = (key: FoalMilestoneKey): void => {
    setMilestones((prev) => {
      const current = prev[key];
      const nextDone = !(current?.done ?? false);
      return {
        ...prev,
        [key]: {
          done: nextDone,
          recordedAt: nextDone ? new Date().toISOString() : current?.recordedAt ?? null,
        },
      };
    });
  };

  const addIggTest = (): void => {
    setIggTests((prev) => [
      {
        date: toLocalDate(new Date()),
        valueMgDl: 0,
        recordedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const updateIggTest = (index: number, updates: Partial<Pick<IggTest, 'date' | 'valueMgDl'>>): void => {
    setIggTests((prev) => prev.map((test, currentIndex) => (currentIndex === index ? { ...test, ...updates } : test)));
  };

  const removeIggTest = (index: number): void => {
    setIggTests((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const validate = (): boolean => {
    const trimmedWeight = birthWeightLbs.trim();
    const nextErrors: FormErrors = {};

    if (trimmedWeight) {
      const parsedWeight = Number(trimmedWeight);
      if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
        nextErrors.birthWeightLbs = 'Must be a positive number.';
      }
    }

    setErrors(nextErrors);
    return !nextErrors.birthWeightLbs;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

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

      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Failed to save foal record.');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!existingFoalId) {
      return;
    }

    Alert.alert('Delete Foal Record', 'Delete this foal record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteFoal(existingFoalId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Failed to delete foal record.');
            }
          })();
        },
      },
    ]);
  };

  return {
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
  };
}

