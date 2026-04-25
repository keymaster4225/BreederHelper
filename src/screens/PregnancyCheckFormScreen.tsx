import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { usePregnancyCheckForm } from '@/hooks/usePregnancyCheckForm';
import { PREGNANCY_RESULT_OPTIONS } from '@/models/enums';
import { Screen } from '@/components/Screen';
import { formatLocalDate } from '@/utils/dates';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { borderRadius, colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PregnancyCheckForm'>;

type YesNo = 'yes' | 'no';

const YES_NO_OPTIONS: { label: string; value: YesNo }[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

export function PregnancyCheckFormScreen({ navigation, route }: Props): JSX.Element {
  const {
    isEdit,
    today,
    breedingRecords,
    breedingRecordId,
    date,
    result,
    heartbeat,
    notes,
    errors,
    daysPostBreeding,
    approxDueDate,
    isLoading,
    isSaving,
    isDeleting,
    setBreedingRecordId,
    setDate,
    setResult,
    setHeartbeat,
    setNotes,
    onSave,
    requestDelete,
  } = usePregnancyCheckForm({
    mareId: route.params.mareId,
    pregnancyCheckId: route.params.pregnancyCheckId,
    initialBreedingRecordId: route.params.breedingRecordId,
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
        <FormField label="Breeding Record" required error={errors.breedingRecordId}>
          {breedingRecords.length === 0 ? (
            <View style={localStyles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={colors.onSurfaceVariant} />
              <Text style={localStyles.emptyHeading}>No breeding records</Text>
              <Text style={localStyles.emptySubtitle}>Add a breeding record for this mare first.</Text>
            </View>
          ) : (
            <OptionSelector
              value={breedingRecordId}
              onChange={setBreedingRecordId}
              options={breedingRecords.map((record) => ({ value: record.id, label: `${record.date} - ${record.stallionName ?? 'Unknown'} (${record.method})` }))}
            />
          )}
        </FormField>

        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select check date" maximumDate={today} />
        </FormField>

        <FormField label="Result" required>
          <OptionSelector value={result} onChange={setResult} options={PREGNANCY_RESULT_OPTIONS} />
        </FormField>

        <FormField label="Heartbeat Detected">
          <OptionSelector value={heartbeat} onChange={setHeartbeat} options={YES_NO_OPTIONS} />
          {result === 'negative' ? <Text style={localStyles.infoLabel}>Heartbeat is forced to No for negative checks.</Text> : null}
        </FormField>

        <View style={localStyles.infoRow}>
          <Text style={localStyles.infoLabel}>Days post-breeding: {daysPostBreeding === null ? '-' : `${daysPostBreeding}`}</Text>
          {result === 'positive' && approxDueDate ? (
            <Text style={localStyles.infoLabel}>Approx. due date: {formatLocalDate(approxDueDate, 'MM-DD-YYYY')}</Text>
          ) : null}
        </View>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <PrimaryButton
          label={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={isSaving || isDeleting || breedingRecords.length === 0}
        />

        {isEdit ? (
          <DeleteButton
            label={isDeleting ? 'Deleting...' : 'Delete'}
            onPress={requestDelete}
            disabled={isSaving || isDeleting}
          />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  infoRow: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoLabel: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyHeading: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
