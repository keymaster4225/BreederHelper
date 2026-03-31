import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useFoalForm } from '@/hooks/useFoalForm';
import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormCheckbox, FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { FoalColor, FoalSex } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { FOAL_MILESTONE_KEYS, FOAL_MILESTONE_LABELS } from '@/utils/foalMilestones';
import { interpretIgg, formatIggInterpretation, getIggColor } from '@/utils/igg';

type Props = NativeStackScreenProps<RootStackParamList, 'FoalForm'>;

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
  const {
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
  } = useFoalForm({
    foalingRecordId,
    foalId,
    defaultSex,
    onGoBack: () => navigation.goBack(),
    setTitle: (title) => navigation.setOptions({ title }),
  });

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
