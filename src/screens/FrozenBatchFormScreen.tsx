import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { formStyles } from '@/components/FormControls';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { Screen } from '@/components/Screen';
import { useFrozenBatchForm } from '@/hooks/useFrozenBatchForm';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import { BasicsStep } from './frozen-batch-wizard/BasicsStep';
import { QualityStep } from './frozen-batch-wizard/QualityStep';
import { StorageStep } from './frozen-batch-wizard/StorageStep';
import { StrawsStep } from './frozen-batch-wizard/StrawsStep';

type Props = NativeStackScreenProps<RootStackParamList, 'FrozenBatchForm'>;

function formatSpermPerStraw(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} M`;
}

export function FrozenBatchFormScreen({ navigation, route }: Props): JSX.Element {
  const {
    freezeDate,
    rawSemenVolumeUsedMl,
    wasCentrifuged,
    centrifugeSpeedRpm,
    centrifugeDurationMin,
    centrifugeCushionUsed,
    centrifugeCushionType,
    centrifugeResuspensionVolumeMl,
    centrifugeNotes,
    extender,
    extenderOther,
    strawCount,
    strawVolumeMl,
    concentrationMillionsPerMl,
    strawsPerDose,
    strawColor,
    strawColorOther,
    strawLabel,
    postThawMotilityPercent,
    longevityHours,
    storageDetails,
    notes,
    linkedCollectionId,
    linkedCollectionDate,
    strawsRemaining,
    errors,
    isLoading,
    isSaving,
    totalSpermPerStrawMillions,
    setFreezeDate,
    setRawSemenVolumeUsedMl,
    setWasCentrifuged,
    setCentrifugeSpeedRpm,
    setCentrifugeDurationMin,
    setCentrifugeCushionUsed,
    setCentrifugeCushionType,
    setCentrifugeResuspensionVolumeMl,
    setCentrifugeNotes,
    setExtender,
    setExtenderOther,
    setStrawCount,
    setStrawVolumeMl,
    setConcentrationMillionsPerMl,
    setStrawsPerDose,
    setStrawColor,
    setStrawColorOther,
    setStrawLabel,
    setPostThawMotilityPercent,
    setLongevityHours,
    setStorageDetails,
    setNotes,
    onSave,
    requestDelete,
  } = useFrozenBatchForm({
    frozenBatchId: route.params.frozenBatchId,
    expectedStallionId: route.params.stallionId,
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
          <View style={cardStyles.card}>
            <Text style={styles.sectionTitle}>Source</Text>
            <CardRow
              label="Batch source"
              value={
                linkedCollectionDate
                  ? `From collection ${formatLocalDate(linkedCollectionDate, 'MM-DD-YYYY')}`
                  : 'Imported / standalone'
              }
            />
            <CardRow
              label="Straws remaining"
              value={strawsRemaining == null ? '-' : String(strawsRemaining)}
            />
            <CardRow
              label="Sperm per Straw (M)"
              value={formatSpermPerStraw(totalSpermPerStrawMillions)}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Basics</Text>
            <BasicsStep
              freezeDate={freezeDate}
              setFreezeDate={setFreezeDate}
              rawSemenVolumeUsedMl={rawSemenVolumeUsedMl}
              setRawSemenVolumeUsedMl={setRawSemenVolumeUsedMl}
              isLinkedToCollection={Boolean(linkedCollectionId)}
              wasCentrifuged={wasCentrifuged}
              setWasCentrifuged={setWasCentrifuged}
              centrifugeSpeedRpm={centrifugeSpeedRpm}
              setCentrifugeSpeedRpm={setCentrifugeSpeedRpm}
              centrifugeDurationMin={centrifugeDurationMin}
              setCentrifugeDurationMin={setCentrifugeDurationMin}
              centrifugeCushionUsed={centrifugeCushionUsed}
              setCentrifugeCushionUsed={setCentrifugeCushionUsed}
              centrifugeCushionType={centrifugeCushionType}
              setCentrifugeCushionType={setCentrifugeCushionType}
              centrifugeResuspensionVolumeMl={centrifugeResuspensionVolumeMl}
              setCentrifugeResuspensionVolumeMl={setCentrifugeResuspensionVolumeMl}
              centrifugeNotes={centrifugeNotes}
              setCentrifugeNotes={setCentrifugeNotes}
              errors={errors}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Straws & Extender</Text>
            <StrawsStep
              extender={extender}
              setExtender={setExtender}
              extenderOther={extenderOther}
              setExtenderOther={setExtenderOther}
              strawCount={strawCount}
              setStrawCount={setStrawCount}
              strawVolumeMl={strawVolumeMl}
              setStrawVolumeMl={setStrawVolumeMl}
              concentrationMillionsPerMl={concentrationMillionsPerMl}
              setConcentrationMillionsPerMl={setConcentrationMillionsPerMl}
              totalSpermPerStrawMillions={totalSpermPerStrawMillions}
              strawsPerDose={strawsPerDose}
              setStrawsPerDose={setStrawsPerDose}
              strawColor={strawColor}
              setStrawColor={setStrawColor}
              strawColorOther={strawColorOther}
              setStrawColorOther={setStrawColorOther}
              strawLabel={strawLabel}
              setStrawLabel={setStrawLabel}
              errors={errors}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Quality</Text>
            <QualityStep
              postThawMotilityPercent={postThawMotilityPercent}
              setPostThawMotilityPercent={setPostThawMotilityPercent}
              longevityHours={longevityHours}
              setLongevityHours={setLongevityHours}
              errors={errors}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Storage & Notes</Text>
            <StorageStep
              storageDetails={storageDetails}
              setStorageDetails={setStorageDetails}
              notes={notes}
              setNotes={setNotes}
            />
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={isSaving ? 'Saving...' : 'Save Frozen Batch'}
              onPress={() => {
                void onSave();
              }}
              disabled={isSaving}
            />
            <DeleteButton
              label="Delete Frozen Batch"
              onPress={requestDelete}
              disabled={isSaving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
