import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ActivityIndicator,
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
import { FormActionBar, STICKY_ACTION_BAR_SCROLL_PADDING } from '@/components/FormActionBar';
import { Screen } from '@/components/Screen';
import { formStyles } from '@/components/FormControls';
import { useDailyLogWizard } from '@/hooks/useDailyLogWizard';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { BasicsStep } from './daily-log-wizard/BasicsStep';
import { FlushStep } from './daily-log-wizard/FlushStep';
import { OvaryStep } from './daily-log-wizard/OvaryStep';
import { ReviewStep } from './daily-log-wizard/ReviewStep';
import { UterusStep } from './daily-log-wizard/UterusStep';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyLogForm'>;

export function DailyLogWizardScreen({ navigation, route }: Props): JSX.Element {
  const allowScreenExitRef = useRef(false);
  const handleGoBack = useCallback(() => {
    allowScreenExitRef.current = true;
    navigation.goBack();
  }, [navigation]);
  const handleAddFollowUpTask = useCallback(
    (params: RootStackParamList['TaskForm']) => {
      allowScreenExitRef.current = true;
      navigation.replace('TaskForm', params);
    },
    [navigation],
  );
  const handleSetTitle = useCallback(
    (title: string) => {
      navigation.setOptions({ title });
    },
    [navigation],
  );

  const wizard = useDailyLogWizard({
    mareId: route.params.mareId,
    logId: route.params.logId,
    taskId: route.params.taskId,
    defaultDate: route.params.defaultDate,
    defaultTime: route.params.defaultTime,
    onGoBack: handleGoBack,
    onAddFollowUpTask: handleAddFollowUpTask,
    setTitle: handleSetTitle,
  });
  const currentStepIndex = wizard.currentStepIndex;
  const goBack = wizard.goBack;
  const isReviewStep = wizard.currentStepId === 'review';

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (allowScreenExitRef.current || currentStepIndex === 0) {
        return;
      }

      event.preventDefault();
      goBack();
    });
  }, [currentStepIndex, goBack, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: currentStepIndex === 0,
      headerLeft:
        currentStepIndex > 0
          ? () => (
              <Pressable
                accessibilityLabel="Go to previous wizard step"
                accessibilityRole="button"
                hitSlop={8}
                onPress={goBack}
                style={({ pressed }) => [styles.headerBackButton, pressed && styles.headerBackButtonPressed]}
                testID="daily-log-wizard-header-back"
              >
                <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
              </Pressable>
            )
          : undefined,
    });
  }, [currentStepIndex, goBack, navigation]);

  if (wizard.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            formStyles.form,
            isReviewStep ? styles.formWithActionBar : null,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepHeader}>
            <Text style={styles.stepCount}>{`Step ${wizard.currentStepIndex + 1} of ${wizard.steps.length}`}</Text>
            <Text style={styles.stepTitle}>{wizard.currentStepTitle}</Text>
          </View>

          {wizard.currentStepId === 'basics' ? (
            <BasicsStep
              date={wizard.date}
              time={wizard.time}
              teasingScore={wizard.teasingScore}
              errors={wizard.errors.basics}
              isTimeClearable={wizard.isTimeClearable}
              onDateChange={wizard.setDate}
              onTimeChange={wizard.setTime}
              onTeasingScoreChange={wizard.setTeasingScore}
            />
          ) : null}

          {wizard.currentStepId === 'rightOvary' ? (
            <OvaryStep
              side="right"
              ovary={wizard.rightOvary}
              errors={wizard.errors.rightOvary}
              onOvulationChange={(value) => wizard.setOvaryOvulation('right', value)}
              onFollicleFindingChange={(value) => wizard.setOvaryFollicleFinding('right', value)}
              onAddMeasurement={() => wizard.addOvaryMeasurement('right')}
              onUpdateMeasurement={(clientId, value) =>
                wizard.updateOvaryMeasurement('right', clientId, value)
              }
              onRemoveMeasurement={(clientId) => wizard.removeOvaryMeasurement('right', clientId)}
              onConsistencyChange={(value) => wizard.setOvaryConsistency('right', value)}
              onToggleStructure={(value) => wizard.toggleOvaryStructure('right', value)}
            />
          ) : null}

          {wizard.currentStepId === 'leftOvary' ? (
            <OvaryStep
              side="left"
              ovary={wizard.leftOvary}
              errors={wizard.errors.leftOvary}
              onOvulationChange={(value) => wizard.setOvaryOvulation('left', value)}
              onFollicleFindingChange={(value) => wizard.setOvaryFollicleFinding('left', value)}
              onAddMeasurement={() => wizard.addOvaryMeasurement('left')}
              onUpdateMeasurement={(clientId, value) =>
                wizard.updateOvaryMeasurement('left', clientId, value)
              }
              onRemoveMeasurement={(clientId) => wizard.removeOvaryMeasurement('left', clientId)}
              onConsistencyChange={(value) => wizard.setOvaryConsistency('left', value)}
              onToggleStructure={(value) => wizard.toggleOvaryStructure('left', value)}
            />
          ) : null}

          {wizard.currentStepId === 'uterus' ? (
            <UterusStep
              uterus={wizard.uterus}
              errors={wizard.errors.uterus}
              flushDecision={wizard.flushDecision}
              onEdemaChange={wizard.setEdema}
              onUterineToneCategoryChange={wizard.setUterineToneCategory}
              onCervicalFirmnessChange={wizard.setCervicalFirmness}
              onDischargeObservedChange={wizard.setDischargeObserved}
              onDischargeNotesChange={wizard.setDischargeNotes}
              onUterineCystsChange={wizard.setUterineCysts}
              onFlushDecisionChange={wizard.setFlushDecision}
              onUpsertFluidPocket={wizard.upsertFluidPocket}
              onRemoveFluidPocket={wizard.removeFluidPocket}
            />
          ) : null}

          {wizard.currentStepId === 'flush' ? (
            <FlushStep
              flush={wizard.flush}
              errors={wizard.errors.flush}
              onBaseSolutionChange={wizard.setFlushBaseSolution}
              onTotalVolumeMlChange={wizard.setFlushTotalVolumeMl}
              onNotesChange={wizard.setFlushNotes}
              onAddProduct={wizard.addFlushProduct}
              onUpdateProduct={wizard.updateFlushProduct}
              onRemoveProduct={wizard.removeFlushProduct}
            />
          ) : null}

          {wizard.currentStepId === 'review' ? (
            <ReviewStep
              date={wizard.date}
              time={wizard.time}
              teasingScore={wizard.teasingScore}
              rightOvary={wizard.rightOvary}
              leftOvary={wizard.leftOvary}
              uterus={wizard.uterus}
              flushDecision={wizard.flushDecision}
              flush={wizard.flush}
              notes={wizard.notes}
              legacyNotes={wizard.legacyNotes}
              legacyOvulationDetected={wizard.legacyOvulationDetected}
              ovulationSource={wizard.ovulationSource}
              onNotesChange={wizard.setNotes}
              onJumpToStep={wizard.goToStep}
            />
          ) : null}

          {wizard.currentStepId !== 'review' ? (
            <View style={styles.actions}>
              {wizard.currentStepIndex > 0 ? (
                <SecondaryButton
                  label="Back"
                  onPress={wizard.goBack}
                  disabled={wizard.isSaving || wizard.isDeleting}
                />
              ) : null}
              <PrimaryButton
                label="Next"
                onPress={wizard.goNext}
                disabled={wizard.isSaving || wizard.isDeleting}
              />
            </View>
          ) : null}
        </ScrollView>
        {isReviewStep ? (
          <FormActionBar
            primaryLabel={wizard.isSaving ? 'Saving...' : 'Save'}
            onPrimaryPress={() => {
              void wizard.save();
            }}
            primaryDisabled={wizard.isSaving || wizard.isDeleting}
            secondaryLabel="Save & Add Follow-up"
            onSecondaryPress={() => {
              void wizard.saveAndAddFollowUp();
            }}
            secondaryDisabled={wizard.isSaving || wizard.isDeleting}
            destructiveLabel={wizard.isEdit ? (wizard.isDeleting ? 'Deleting...' : 'Delete') : undefined}
            onDestructivePress={wizard.isEdit ? wizard.requestDelete : undefined}
            destructiveDisabled={wizard.isSaving || wizard.isDeleting}
          />
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  formWithActionBar: {
    paddingBottom: STICKY_ACTION_BAR_SCROLL_PADDING,
  },
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
  headerBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerBackButtonPressed: {
    opacity: 0.6,
  },
});
