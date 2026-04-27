import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormPickerInput, FormTextInput, FormTimeInput, OptionSelector, formStyles } from '@/components/FormControls';
import {
  COVERAGE_OPTIONS,
  NO_COLLECTION,
  OTHER_STALLION,
  useBreedingRecordForm,
} from '@/hooks/useBreedingRecordForm';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';
import { formatBreedingMethod } from '@/utils/outcomeDisplay';

type Props = NativeStackScreenProps<RootStackParamList, 'BreedingRecordForm'>;

type AIMethod = 'freshAI' | 'shippedCooledAI' | 'frozenAI';

export function BreedingRecordFormScreen({ navigation, route }: Props): JSX.Element {
  const {
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
    canShowAllCollections,
    showAllCollectionsList,
    aiMethodOptions,
    isTimeRequired,
    setDate,
    setTime,
    setStallionName,
    setMethod,
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
    requestDelete,
  } = useBreedingRecordForm({
    mareId: route.params.mareId,
    breedingRecordId: route.params.breedingRecordId,
    taskId: route.params.taskId,
    defaultDate: route.params.defaultDate,
    defaultTime: route.params.defaultTime,
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
    <Screen style={{ paddingTop: 0 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          {lockMethodAndCollection ? (
            <Text style={{ color: colors.onSurfaceVariant }}>
              This record is linked to an on-farm allocation. Stallion, method, and collection are locked.
            </Text>
          ) : null}

          <FormField label="Date" required error={errors.date}>
            <FormDateInput value={date} onChange={setDate} placeholder="Select breeding date" maximumDate={today} />
          </FormField>

          <FormField label="Time" required={isTimeRequired} error={errors.time}>
            <FormTimeInput
              value={time}
              onChange={setTime}
              placeholder="Select breeding time"
              clearable={!isTimeRequired}
              accessibilityLabel="Select breeding time"
            />
          </FormField>

          <FormField label="Stallion" required error={errors.stallion}>
            {lockMethodAndCollection ? (
              <FormTextInput value={selectedStallionLabel || 'Unknown stallion'} editable={false} />
            ) : (
              <FormPickerInput
                value={selectedStallionId ?? (useCustomStallion ? OTHER_STALLION : '')}
                onChange={onStallionChange}
                options={stallionPickerOptions}
                placeholder="Select stallion"
              />
            )}
          </FormField>

          {useCustomStallion && !lockMethodAndCollection ? (
            <FormField label="Stallion Name" required>
              <FormTextInput
                value={stallionName}
                onChangeText={setStallionName}
                placeholder="Enter stallion name"
              />
            </FormField>
          ) : null}

          <FormField label="Breeding Method" required>
            {lockMethodAndCollection ? (
              <FormTextInput value={formatBreedingMethod(method)} editable={false} />
            ) : (
              <>
                <OptionSelector value={coverageType} onChange={onCoverageChange} options={COVERAGE_OPTIONS} />
                {method !== 'liveCover' ? (
                  <OptionSelector value={method as AIMethod} onChange={setMethod} options={aiMethodOptions} />
                ) : null}
              </>
            )}
          </FormField>

          {showCollectionPicker ? (
            <FormField label="Collection">
              {lockMethodAndCollection ? (
                <FormTextInput value={selectedCollectionLabel} editable={false} />
              ) : (
                <FormPickerInput
                  value={selectedCollectionId ?? NO_COLLECTION}
                  onChange={onCollectionChange}
                  options={collectionPickerOptions}
                  placeholder="Select collection"
                  onShowAll={canShowAllCollections ? showAllCollectionsList : undefined}
                />
              )}
            </FormField>
          ) : null}

          {(method === 'freshAI' || method === 'shippedCooledAI') && (
            <View style={formStyles.form}>
              <FormField label="Volume (mL)" error={errors.volumeMl}>
                <FormTextInput value={volumeMl} onChangeText={setVolumeMl} keyboardType="decimal-pad" />
              </FormField>

              <FormField label="Concentration (millions/mL)" error={errors.concentrationMPerMl}>
                <FormTextInput value={concentrationMPerMl} onChangeText={setConcentrationMPerMl} keyboardType="decimal-pad" />
              </FormField>

              <FormField label="Motility %" error={errors.motilityPercent}>
                <FormTextInput value={motilityPercent} onChangeText={setMotilityPercent} keyboardType="decimal-pad" />
              </FormField>
            </View>
          )}

          {method === 'frozenAI' && (
            <View style={formStyles.form}>
              <FormField label="Number of Straws" required error={errors.numberOfStraws}>
                <FormTextInput value={numberOfStraws} onChangeText={setNumberOfStraws} keyboardType="number-pad" />
              </FormField>

              <FormField label="Straw Volume (mL)" error={errors.strawVolumeMl}>
                <FormTextInput value={strawVolumeMl} onChangeText={setStrawVolumeMl} keyboardType="decimal-pad" />
              </FormField>

              <FormField label="Straw Details">
                <FormTextInput value={strawDetails} onChangeText={setStrawDetails} placeholder="Batch / ID" />
              </FormField>
            </View>
          )}

          {(method === 'shippedCooledAI' || method === 'frozenAI') && (
            <FormField label="Collection Date" error={errors.collectionDate}>
              <FormDateInput
                value={collectionDate}
                onChange={setCollectionDate}
                placeholder="Select collection date"
                clearable
                maximumDate={today}
              />
            </FormField>
          )}

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <PrimaryButton
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={onSave}
            disabled={isSaving || isDeleting}
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
