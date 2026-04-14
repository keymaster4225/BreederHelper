import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { borderRadius, colors, spacing, typography } from '@/theme';

type OnboardingCarouselProps = {
  readonly onComplete: () => void | Promise<void>;
  readonly onSeedSampleData?: () => void | Promise<void>;
  readonly showSeedSampleData?: boolean;
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const CAROUSEL_PAGES: readonly {
  heading: string;
  icon: IconName;
  accentColor: string;
  kicker: string;
  lines: readonly string[];
}[] = [
  {
    heading: 'Daily Observations',
    icon: 'clipboard-text-outline',
    accentColor: colors.primary,
    kicker: 'Daily Observations',
    lines: [
      'See which mares need attention first',
      'Track ovulation for precise timing',
      'Record teasing scores, ultrasound results, and more',
      
    ],
  },
  {
    heading: 'Breeding Through Foaling',
    icon: 'calendar-heart',
    accentColor: colors.secondary,
    kicker: 'Breeding Workflow',
    lines: [
      'Quickly log breeding events and outcomes',
      'Track pregnancy checks and due dates',
      'Record foaling details and early foal milestones',
    ],
  },
  {
    heading: 'Stallions & Medications',
    icon: 'test-tube',
    accentColor: colors.tertiary,
    kicker: 'Stallions & Medications',
    lines: [
      'Manage stallion profiles and collections',
      'Track collection history and AV preferences',
      'Log medications for any animal',
    ],
  },
] as const;

export function OnboardingCarousel({
  onComplete,
  onSeedSampleData,
  showSeedSampleData = false,
}: OnboardingCarouselProps): JSX.Element {
  const [pageIndex, setPageIndex] = useState(0);

  return (
    <View style={styles.container}>
      <PagerView
        style={styles.pager}
        initialPage={0}
        orientation="horizontal"
        onPageSelected={(event) => setPageIndex(event.nativeEvent.position)}
        testID="onboarding-pager"
      >
        <View key="welcome" style={styles.page}>
          <View style={styles.pageContent}>
            <Text style={styles.heading}>Welcome to BreedWise</Text>
            <Text style={styles.subtitle}>
              All your mares, stallions, and breeding records — organized and paperwork-free.
            </Text>

            <View style={styles.hintRow}>
              <Text style={styles.hintText}>Swipe to learn more</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={colors.onSurfaceVariant}
              />
            </View>

            {showSeedSampleData && onSeedSampleData ? (
              <Pressable
                style={({ pressed }) => [styles.sampleDataButton, pressed && styles.pressedOpacity]}
                onPress={() => void onSeedSampleData()}
                accessibilityRole="button"
                accessibilityLabel="Load sample data"
              >
                <MaterialCommunityIcons name="database-import-outline" size={18} color={colors.onPrimaryContainer} />
                <Text style={styles.sampleDataButtonText}>Load sample data</Text>
              </Pressable>
            ) : null}

            <View style={styles.secondaryButtonWrap}>
              <SecondaryButton label="Skip" onPress={() => void onComplete()} />
            </View>
          </View>
        </View>

        {CAROUSEL_PAGES.map((page, index) => {
          const isFinalPage = index === CAROUSEL_PAGES.length - 1;

          return (
            <View key={page.heading} style={styles.page}>
              <View style={styles.pageContent}>
                <View style={styles.featurePanel}>
                  <View
                    style={[
                      styles.featureIllustration,
                      { backgroundColor: `${page.accentColor}18` },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconWrap,
                        { backgroundColor: `${page.accentColor}24` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={page.icon}
                        size={36}
                        color={page.accentColor}
                      />
                    </View>
                    <View style={styles.featureKicker}>
                      <Text style={styles.featureKickerText}>{page.kicker}</Text>
                    </View>
                  </View>

                  <View style={styles.lineGroup}>
                    {page.lines.map((line) => (
                      <View key={line} style={styles.lineCard}>
                        <View style={[styles.lineDot, { backgroundColor: page.accentColor }]} />
                        <Text style={styles.line}>{line}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {isFinalPage ? (
                  <View style={styles.primaryButtonWrap}>
                    <PrimaryButton label="Get Started" onPress={() => void onComplete()} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </PagerView>

      <View style={styles.dotRow}>
        {Array.from({ length: 4 }, (_, index) => (
          <View
            key={`dot-${index}`}
            testID={`onboarding-dot-${index}`}
            style={[styles.dot, index === pageIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.lg,
  },
  pager: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  pageContent: {
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 360,
    width: '100%',
  },
  heading: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  hintText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  sampleDataButton: {
    alignItems: 'center',
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sampleDataButtonText: {
    ...typography.labelMedium,
    color: colors.onPrimaryContainer,
  },
  secondaryButtonWrap: {
    width: 160,
  },
  featurePanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    width: '100%',
  },
  featureIllustration: {
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    width: '100%',
  },
  featureIconWrap: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  featureKicker: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureKickerText: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  lineGroup: {
    gap: spacing.sm,
    width: '100%',
  },
  lineCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lineDot: {
    borderRadius: borderRadius.full,
    height: 10,
    width: 10,
  },
  line: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  primaryButtonWrap: {
    marginTop: spacing.sm,
    width: '100%',
  },
  dotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  dot: {
    borderRadius: borderRadius.full,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: colors.outlineVariant,
  },
  pressedOpacity: {
    opacity: 0.8,
  },
});
