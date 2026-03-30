import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormCheckbox, FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
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
import { borderRadius, colors, spacing, typography } from '@/theme';
import { toLocalDate } from '@/utils/dates';
import { FOAL_MILESTONE_KEYS, FOAL_MILESTONE_LABELS } from '@/utils/foalMilestones';
import { interpretIgg, formatIggInterpretation, getIggColor } from '@/utils/igg';
import { newId } from '@/utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'FoalForm'>;

type FormErrors = {
  birthWeightLbs?: string;
};

const SEX_OPTIONS: { label: string; value: FoalSex }[] = [
  { label: 'Colt', value: 'colt' },
  { label: 'Filly', value: 'filly' },
];

const COLOR_OPTIONS: { label: string; value: FoalColor }[] = [
  { label: 'Bay', value: 'bay' },
  { label: 'Chestnut', value: 'chestnut' },
  { label: 'Black', value: 'black' },
  { label: 'Gray', value: 'gray' },
  { label: 'Palomino', value: 'palomino' },
  { label: 'Buckskin', value: 'buckskin' },
  { label: 'Roan', value: 'roan' },
  { label: 'Pinto/Paint', value: 'pintoPaint' },
  { label: 'Sorrel', value: 'sorrel' },
  { label: 'Dun', value: 'dun' },
  { label: 'Cremello', value: 'cremello' },
  { label: 'Other', value: 'other' },
];

export function FoalFormScreen({ navigation, route }: Props): JSX.Element {
  const { foalingRecordId, foalId, defaultSex } = route.params;

  const [existingFoalId, setExistingFoalId] = useState<string | null>(foalId ?? null);
  const isEdit = Boolean(existingFoalId);

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
    navigation.setOptions({ title: isEdit ? 'Edit Foal Record' : 'Add Foal Record' });
  }, [isEdit, navigation]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const foalingRecord = await getFoalingRecordById(foalingRecordId);
        if (!mounted) return;

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

        if (!mounted) return;

        if (existing) {
          setExistingFoalId(existing.id);
          setName(existing.name ?? '');
          setSex(existing.sex ?? null);
          setColor(existing.color ?? null);
          setMarkings(existing.markings ?? '');
          setBirthWeightLbs(existing.birthWeightLbs != null ? String(existing.birthWeightLbs) : '');
          setMilestones(existing.milestones);
          setIggTests([...existing.iggTests]);
          setNotes(existing.notes ?? '');
        }
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Unable to load foal form data.';
        Alert.alert('Load error', message);
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
      const wasDone = current?.done ?? false;
      return {
        ...prev,
        [key]: {
          done: !wasDone,
          recordedAt: !wasDone ? new Date().toISOString() : current?.recordedAt ?? null,
        },
      };
    });
  };

  const addIggTest = (): void => {
    const newTest: IggTest = {
      date: toLocalDate(new Date()),
      valueMgDl: 0,
      recordedAt: new Date().toISOString(),
    };
    setIggTests((prev) => [newTest, ...prev]);
  };

  const updateIggTest = (index: number, updates: Partial<Pick<IggTest, 'date' | 'valueMgDl'>>): void => {
    setIggTests((prev) =>
      prev.map((test, i) =>
        i === index ? { ...test, ...updates } : test
      )
    );
  };

  const removeIggTest = (index: number): void => {
    setIggTests((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    const trimmedWeight = birthWeightLbs.trim();
    if (trimmedWeight) {
      const parsed = Number(trimmedWeight);
      if (isNaN(parsed) || parsed <= 0) {
        nextErrors.birthWeightLbs = 'Must be a positive number.';
      }
    }
    setErrors(nextErrors);
    return !nextErrors.birthWeightLbs;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const trimmedWeight = birthWeightLbs.trim();
      const validIggTests = iggTests.filter((t) => t.valueMgDl > 0);
      const payload = {
        name: name.trim() || null,
        sex,
        color,
        markings: markings.trim() || null,
        birthWeightLbs: trimmedWeight ? Number(trimmedWeight) : null,
        milestones,
        iggTests: validIggTests,
        notes: notes.trim() || null,
      };

      if (existingFoalId) {
        await updateFoal(existingFoalId, payload);
      } else {
        await createFoal({ id: newId(), foalingRecordId, ...payload });
      }

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save foal record.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
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
              navigation.goBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete foal record.';
              Alert.alert('Delete failed', message);
            }
          })();
        },
      },
    ]);
  };

  const formatRecordedAt = (iso: string | null | undefined): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${month}/${day} ${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <FormField label="Name">
            <FormTextInput value={name} onChangeText={setName} placeholder="Optional" />
          </FormField>

          <FormField label="Sex">
            <OptionSelector value={sex} onChange={setSex} options={SEX_OPTIONS} />
          </FormField>

          <FormField label="Color">
            <OptionSelector value={color} onChange={setColor} options={COLOR_OPTIONS} />
          </FormField>

          <FormField label="Markings">
            <FormTextInput value={markings} onChangeText={setMarkings} placeholder="Optional" />
          </FormField>

          <FormField label="Birth Weight (lbs)" error={errors.birthWeightLbs}>
            <FormTextInput
              value={birthWeightLbs}
              onChangeText={setBirthWeightLbs}
              placeholder="Optional"
              keyboardType="numeric"
            />
          </FormField>

          <View style={milestoneStyles.section}>
            <Text style={milestoneStyles.sectionTitle}>Milestones</Text>
            {FOAL_MILESTONE_KEYS.map((key) => {
              const entry = milestones[key];
              const isDone = entry?.done ?? false;
              const timeLabel = isDone ? formatRecordedAt(entry?.recordedAt) : '';
              return (
                <View key={key}>
                  <View style={milestoneStyles.row}>
                    <FormCheckbox
                      label={FOAL_MILESTONE_LABELS[key]}
                      value={isDone}
                      onChange={() => toggleMilestone(key)}
                    />
                    {timeLabel ? <Text style={milestoneStyles.time}>{timeLabel}</Text> : null}
                  </View>
                  {key === 'iggTested' && isDone ? (
                    <View style={iggStyles.section}>
                      {iggTests.map((test, index) => {
                        const hasValue = test.valueMgDl > 0;
                        const interpretation = hasValue ? interpretIgg(test.valueMgDl) : null;
                        return (
                          <View key={index} style={iggStyles.testRow}>
                            <View style={iggStyles.testFields}>
                              <View style={iggStyles.dateField}>
                                <FormDateInput
                                  value={test.date}
                                  onChange={(date) => updateIggTest(index, { date })}
                                  displayFormat="MM-DD-YYYY"
                                />
                              </View>
                              <View style={iggStyles.valueField}>
                                <FormTextInput
                                  value={hasValue ? String(test.valueMgDl) : ''}
                                  onChangeText={(text) => {
                                    const parsed = parseInt(text, 10);
                                    updateIggTest(index, { valueMgDl: isNaN(parsed) ? 0 : parsed });
                                  }}
                                  placeholder="mg/dL"
                                  keyboardType="numeric"
                                />
                              </View>
                              {interpretation ? (
                                <StatusBadge
                                  label={formatIggInterpretation(interpretation)}
                                  backgroundColor={getIggColor(interpretation)}
                                  textColor="#FFFFFF"
                                />
                              ) : null}
                            </View>
                            <Pressable
                              onPress={() => removeIggTest(index)}
                              hitSlop={8}
                              accessibilityLabel="Remove test"
                            >
                              <Text style={iggStyles.deleteIcon}>✕</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                      <Pressable onPress={addIggTest} style={iggStyles.addButton}>
                        <Text style={iggStyles.addButtonText}>+ Add Test</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <PrimaryButton
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={onSave}
            disabled={isSaving}
          />

          {isEdit ? (
            <DeleteButton label="Delete" onPress={onDelete} disabled={isSaving} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const milestoneStyles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.onSurface,
    ...typography.labelLarge,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  time: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
});

const iggStyles = StyleSheet.create({
  section: {
    marginLeft: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.outline,
    paddingLeft: spacing.md,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  testFields: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  dateField: {
    minWidth: 120,
  },
  valueField: {
    width: 80,
  },
  deleteIcon: {
    color: colors.error,
    fontSize: 18,
    padding: spacing.xs,
  },
  addButton: {
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: colors.primary,
    ...typography.labelMedium,
  },
});
