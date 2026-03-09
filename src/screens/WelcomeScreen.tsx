import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, spacing, typography } from '@/theme';
import { setOnboardingComplete } from '@/utils/onboarding';

type Props = {
  onComplete: () => void;
};

export function WelcomeScreen({ onComplete }: Props): JSX.Element {
  const handleGetStarted = async (): Promise<void> => {
    await setOnboardingComplete();
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="horse" size={80} color={colors.primary} />
        <Text style={styles.title}>BreedWise</Text>
        <Text style={styles.subtitle}>
          Track your mares, breeding records, and foaling results — all in one place!
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => {
          void handleGetStarted();
        }}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.labelLarge,
    color: colors.onPrimary,
  },
});
