import { useCallback, useLayoutEffect } from 'react';
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
import { Screen } from '@/components/Screen';
import { formStyles } from '@/components/FormControls';
import { useDailyLogWizard } from '@/hooks/useDailyLogWizard';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { BasicsStep } from './daily-log-wizard/BasicsStep';
import { OvaryStep } from './daily-log-wizard/OvaryStep';
import { ReviewStep } from './daily-log-wizard/ReviewStep';
import { UterusStep } from './daily-log-wizard/UterusStep';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyLogForm'>;

export function DailyLogWizardScreen({ navigation, route }: Props): JSX.Element {
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const handleSetTitle = useCallback(
    (title: string) => {
      navigation.setOptions({ title });
    },
    [navigation],
  );

  const wizard = useDailyLogWizard({
    mareId: route.params.mareId,
    logId: route.params.logId,
    onGoBack: handleGoBack,
    setTitle: handleSetTitle,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
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
                testID="daily-log-wizard-header-back"
              >
                <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, wizard.currentStepIndex, wizard.goBack]);

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
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.stepHeader}>
            <Text style={styles.stepCount}>{`Step ${wizard.currentStepIndex + 1} of 5`}</Text>
            <Text style={styles.stepTitle}>{wizard.currentStepTitle}</Text>
          </View>

          {wizard.currentStepIndex === 0 ? (
            <BasicsStep
              date={wizard.date}
              teasingScore={wizard.teasingScore}
              errors={wizard.errors.basics}
              onDateChange={wizard.setDate}
              onTeasingScoreChange={wizard.setTeasingScore}
            />
          ) : null}

          {wizard.currentStepIndex === 1 ? (
            <OvaryStep
              side="right"
              ovary={wizard.rightOvary}
              errors={wizard.errors.rightOvary}
              onOvulationChange={(value) => wizard.setOvaryOvulation('right', value)}
              onFollicleSizeChange={(value) => wizard.setOvaryFollicleSize('right', value)}
              onConsistencyChange={(value) => wizard.setOvaryConsistency('right', value)}
              onToggleStructure={(value) => wizard.toggleOvaryStructure('right', value)}
            />
          ) : null}

          {wizard.currentStepIndex === 2 ? (
            <OvaryStep
              side="left"
              ovary={wizard.leftOvary}
              errors={wizard.errors.leftOvary}
              onOvulationChange={(value) => wizard.setOvaryOvulation('left', value)}
              onFollicleSizeChange={(value) => wizard.setOvaryFollicleSize('left', value)}
              onConsistencyChange={(value) => wizard.setOvaryConsistency('left', value)}
              onToggleStructure={(value) => wizard.toggleOvaryStructure('left', value)}
            />
          ) : null}

          {wizard.currentStepIndex === 3 ? (
            <UterusStep
              uterus={wizard.uterus}
              errors={wizard.errors.uterus}
              onEdemaChange={wizard.setEdema}
              onUterineToneCategoryChange={wizard.setUterineToneCategory}
              onCervicalFirmnessChange={wizard.setCervicalFirmness}
              onDischargeObservedChange={wizard.setDischargeObserved}
              onDischargeNotesChange={wizard.setDischargeNotes}
              onUterineCystsChange={wizard.setUterineCysts}
              onUpsertFluidPocket={wizard.upsertFluidPocket}
              onRemoveFluidPocket={wizard.removeFluidPocket}
            />
          ) : null}

          {wizard.currentStepIndex === 4 ? (
            <ReviewStep
              date={wizard.date}
              teasingScore={wizard.teasingScore}
              rightOvary={wizard.rightOvary}
              leftOvary={wizard.leftOvary}
              uterus={wizard.uterus}
              notes={wizard.notes}
              legacyNotes={wizard.legacyNotes}
              legacyOvulationDetected={wizard.legacyOvulationDetected}
              ovulationSource={wizard.ovulationSource}
              isEdit={wizard.isEdit}
              isSaving={wizard.isSaving}
              isDeleting={wizard.isDeleting}
              onNotesChange={wizard.setNotes}
              onJumpToStep={wizard.goToStep}
              onSave={() => {
                void wizard.save();
              }}
              onDelete={wizard.requestDelete}
            />
          ) : null}

          {wizard.currentStepIndex < 4 ? (
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
