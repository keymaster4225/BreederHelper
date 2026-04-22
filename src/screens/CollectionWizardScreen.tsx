import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { formStyles } from '@/components/FormControls';
import { useCollectionWizard } from '@/hooks/useCollectionWizard';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { CollectionBasicsStep } from './collection-wizard/CollectionBasicsStep';
import { ProcessingDetailsStep } from './collection-wizard/ProcessingDetailsStep';
import { DoseAllocationStep } from './collection-wizard/DoseAllocationStep';
import { ReviewStep } from './collection-wizard/ReviewStep';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionCreateWizard'>;

export function CollectionWizardScreen({ navigation, route }: Props): JSX.Element {
  const wizard = useCollectionWizard({
    stallionId: route.params.stallionId,
    onSaved: () => navigation.goBack(),
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHeader}>
            <Text style={styles.stepCount}>{`Step ${wizard.currentStepIndex + 1} of 4`}</Text>
            <Text style={styles.stepTitle}>{wizard.currentStepTitle}</Text>
          </View>

          {wizard.currentStepIndex === 0 ? (
            <CollectionBasicsStep
              collectionDate={wizard.collectionDate}
              setCollectionDate={wizard.setCollectionDate}
              rawVolumeMl={wizard.rawVolumeMl}
              setRawVolumeMl={wizard.setRawVolumeMl}
              concentrationMillionsPerMl={wizard.concentrationMillionsPerMl}
              setConcentrationMillionsPerMl={wizard.setConcentrationMillionsPerMl}
              progressiveMotilityPercent={wizard.progressiveMotilityPercent}
              setProgressiveMotilityPercent={wizard.setProgressiveMotilityPercent}
              errors={wizard.errors}
            />
          ) : null}

          {wizard.currentStepIndex === 1 ? (
            <ProcessingDetailsStep
              rawVolumeMl={wizard.parsedRawVolumeMl}
              concentrationMillionsPerMl={wizard.parsedConcentrationMillionsPerMl}
              progressiveMotilityPercent={wizard.parsedProgressiveMotilityPercent}
              targetMotileSpermMillionsPerDose={wizard.targetMotileSpermMillionsPerDose}
              setTargetMotileSpermMillionsPerDose={wizard.setTargetMotileSpermMillionsPerDose}
              targetPostExtensionConcentrationMillionsPerMl={wizard.targetPostExtensionConcentrationMillionsPerMl}
              setTargetPostExtensionConcentrationMillionsPerMl={wizard.setTargetPostExtensionConcentrationMillionsPerMl}
              extenderType={wizard.extenderType}
              setExtenderType={wizard.setExtenderType}
              notes={wizard.notes}
              setNotes={wizard.setNotes}
              derivedMath={wizard.derivedMath}
              errors={wizard.errors}
            />
          ) : null}

          {wizard.currentStepIndex === 2 ? (
            <DoseAllocationStep
              collectionDate={wizard.collectionDate}
              rawVolumeMl={wizard.parsedRawVolumeMl}
              remainingApproxDoses={wizard.remainingApproxDoses}
              allocationRows={wizard.allocationRows}
              allocationSummary={wizard.allocationSummary}
              mares={wizard.mares}
              mareNameById={wizard.mareNameById}
              mareLoadError={wizard.mareLoadError}
              allocationError={wizard.errors.allocation}
              shippedPrefillDoseSemenVolumeMl={wizard.shippedPrefillDoseSemenVolumeMl}
              shippedPrefillDoseExtenderVolumeMl={wizard.shippedPrefillDoseExtenderVolumeMl}
              onFarmPrefillDoseSemenVolumeMl={wizard.onFarmPrefillDoseSemenVolumeMl}
              onSaveShippedRow={wizard.upsertShippedRow}
              onSaveOnFarmRow={wizard.upsertOnFarmRow}
              onRemoveAllocationRow={wizard.removeAllocationRow}
            />
          ) : null}

          {wizard.currentStepIndex === 3 ? (
            <ReviewStep
              collectionDate={wizard.collectionDate}
              rawVolumeMl={wizard.parsedRawVolumeMl}
              concentrationMillionsPerMl={wizard.parsedConcentrationMillionsPerMl}
              progressiveMotilityPercent={wizard.parsedProgressiveMotilityPercent}
              targetMotileSpermMillionsPerDose={wizard.parsedTargetMotileSpermMillionsPerDose}
              targetPostExtensionConcentrationMillionsPerMl={wizard.parsedTargetPostExtensionConcentrationMillionsPerMl}
              extenderType={wizard.extenderType}
              notes={wizard.notes}
              derivedMath={wizard.derivedMath}
              allocationRows={wizard.allocationRows}
              mareNameById={wizard.mareNameById}
              allocationSummary={wizard.allocationSummary}
              remainingApproxDoses={wizard.remainingApproxDoses}
              onJumpToStep={wizard.goToStep}
            />
          ) : null}

          <View style={styles.actions}>
            {wizard.currentStepIndex > 0 ? (
              <SecondaryButton label="Back" onPress={wizard.goBack} disabled={wizard.isSaving} />
            ) : null}
            {wizard.currentStepIndex < 3 ? (
              <PrimaryButton label="Next" onPress={wizard.goNext} disabled={wizard.isSaving} />
            ) : (
              <PrimaryButton
                label="Save"
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
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
