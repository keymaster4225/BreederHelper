import { useLayoutEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import {
  FROZEN_BATCH_WIZARD_STEPS,
  useFrozenBatchWizard,
} from '@/hooks/useFrozenBatchWizard';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { BasicsStep } from './frozen-batch-wizard/BasicsStep';
import { QualityStep } from './frozen-batch-wizard/QualityStep';
import { StorageStep } from './frozen-batch-wizard/StorageStep';
import { StrawsStep } from './frozen-batch-wizard/StrawsStep';

type Props = NativeStackScreenProps<RootStackParamList, 'FrozenBatchCreateWizard'>;

export function FrozenBatchWizardScreen({ navigation, route }: Props): JSX.Element {
  const wizard = useFrozenBatchWizard({
    stallionId: route.params.stallionId,
    collectionId: route.params.collectionId,
    onSaved: () => navigation.goBack(),
    onInvalidLinkedCollection: () => navigation.goBack(),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Add Frozen Batch',
      headerBackVisible: wizard.currentStepIndex === 0,
      headerLeft:
        wizard.currentStepIndex > 0
          ? () => (
              <Pressable
                accessibilityLabel="Go to previous wizard step"
                accessibilityRole="button"
                hitSlop={8}
                onPress={wizard.goBack}
                style={({ pressed }) => [styles.headerBackButton, pressed && styles.headerBackButtonPressed]}
                testID="frozen-batch-wizard-header-back"
              >
                <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
              </Pressable>
            )
          : undefined,
      headerRight: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel frozen batch wizard"
          style={({ pressed }) => [styles.cancelAction, pressed && styles.cancelActionPressed]}
        >
          <Text style={styles.cancelActionText}>Cancel</Text>
        </Pressable>
      ),
    });
  }, [navigation, wizard.currentStepIndex, wizard.goBack]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHeader}>
            <Text style={styles.stepCount}>{`Step ${wizard.currentStepIndex + 1} of ${FROZEN_BATCH_WIZARD_STEPS.length}`}</Text>
            <Text style={styles.stepTitle}>{wizard.currentStepTitle}</Text>
          </View>

          <View style={styles.stepPillRow}>
            {FROZEN_BATCH_WIZARD_STEPS.map((title, index) => {
              const active = wizard.currentStepIndex === index;
              return (
                <Pressable
                  key={title}
                  onPress={() => wizard.goToStep(index)}
                  disabled={wizard.isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to ${title} step`}
                  accessibilityState={{ selected: active, disabled: wizard.isSaving }}
                  style={({ pressed }) => [
                    styles.stepPill,
                    active && styles.stepPillActive,
                    pressed && !wizard.isSaving && styles.stepPillPressed,
                  ]}
                >
                  <Text style={[styles.stepPillNumber, active && styles.stepPillNumberActive]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles.stepPillText, active && styles.stepPillTextActive]}>
                    {title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {wizard.currentStepIndex === 0 ? (
            <BasicsStep
              freezeDate={wizard.freezeDate}
              setFreezeDate={wizard.setFreezeDate}
              rawSemenVolumeUsedMl={wizard.rawSemenVolumeUsedMl}
              setRawSemenVolumeUsedMl={wizard.setRawSemenVolumeUsedMl}
              isLinkedToCollection={wizard.isLinkedToCollection}
              wasCentrifuged={wizard.wasCentrifuged}
              setWasCentrifuged={wizard.setWasCentrifuged}
              centrifugeSpeedRpm={wizard.centrifugeSpeedRpm}
              setCentrifugeSpeedRpm={wizard.setCentrifugeSpeedRpm}
              centrifugeDurationMin={wizard.centrifugeDurationMin}
              setCentrifugeDurationMin={wizard.setCentrifugeDurationMin}
              centrifugeCushionUsed={wizard.centrifugeCushionUsed}
              setCentrifugeCushionUsed={wizard.setCentrifugeCushionUsed}
              centrifugeCushionType={wizard.centrifugeCushionType}
              setCentrifugeCushionType={wizard.setCentrifugeCushionType}
              centrifugeResuspensionVolumeMl={wizard.centrifugeResuspensionVolumeMl}
              setCentrifugeResuspensionVolumeMl={wizard.setCentrifugeResuspensionVolumeMl}
              centrifugeNotes={wizard.centrifugeNotes}
              setCentrifugeNotes={wizard.setCentrifugeNotes}
              errors={wizard.errors}
            />
          ) : null}

          {wizard.currentStepIndex === 1 ? (
            <StrawsStep
              extender={wizard.extender}
              setExtender={wizard.setExtender}
              extenderOther={wizard.extenderOther}
              setExtenderOther={wizard.setExtenderOther}
              strawCount={wizard.strawCount}
              setStrawCount={wizard.setStrawCount}
              strawVolumeMl={wizard.strawVolumeMl}
              setStrawVolumeMl={wizard.setStrawVolumeMl}
              concentrationMillionsPerMl={wizard.concentrationMillionsPerMl}
              setConcentrationMillionsPerMl={wizard.setConcentrationMillionsPerMl}
              totalSpermPerStrawMillions={wizard.totalSpermPerStrawMillions}
              strawsPerDose={wizard.strawsPerDose}
              setStrawsPerDose={wizard.setStrawsPerDose}
              strawColor={wizard.strawColor}
              setStrawColor={wizard.setStrawColor}
              strawColorOther={wizard.strawColorOther}
              setStrawColorOther={wizard.setStrawColorOther}
              strawLabel={wizard.strawLabel}
              setStrawLabel={wizard.setStrawLabel}
              errors={wizard.errors}
            />
          ) : null}

          {wizard.currentStepIndex === 2 ? (
            <QualityStep
              postThawMotilityPercent={wizard.postThawMotilityPercent}
              setPostThawMotilityPercent={wizard.setPostThawMotilityPercent}
              longevityHours={wizard.longevityHours}
              setLongevityHours={wizard.setLongevityHours}
              errors={wizard.errors}
            />
          ) : null}

          {wizard.currentStepIndex === 3 ? (
            <StorageStep
              storageDetails={wizard.storageDetails}
              setStorageDetails={wizard.setStorageDetails}
              notes={wizard.notes}
              setNotes={wizard.setNotes}
            />
          ) : null}

          <View style={styles.actions}>
            {wizard.currentStepIndex > 0 ? (
              <SecondaryButton
                label="Back"
                onPress={wizard.goBack}
                disabled={wizard.isSaving}
              />
            ) : null}

            {wizard.currentStepIndex < FROZEN_BATCH_WIZARD_STEPS.length - 1 ? (
              <PrimaryButton
                label="Next"
                onPress={wizard.goNext}
                disabled={wizard.isSaving}
              />
            ) : (
              <PrimaryButton
                label={wizard.isSaving ? 'Saving...' : 'Save'}
                onPress={() => {
                  void wizard.save();
                }}
                disabled={wizard.isSaveDisabled}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepHeader: {
    gap: spacing.xs,
  },
  stepCount: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  stepTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  stepPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepPill: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  stepPillPressed: {
    opacity: 0.8,
  },
  stepPillNumber: {
    ...typography.labelLarge,
    color: colors.onSurfaceVariant,
  },
  stepPillNumberActive: {
    color: colors.primary,
  },
  stepPillText: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  stepPillTextActive: {
    color: colors.primary,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerBackButton: {
    borderRadius: 999,
    padding: spacing.xs,
  },
  headerBackButtonPressed: {
    backgroundColor: colors.surfaceVariant,
  },
  cancelAction: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cancelActionPressed: {
    backgroundColor: colors.surfaceVariant,
  },
  cancelActionText: {
    ...typography.labelLarge,
    color: colors.primary,
  },
});
