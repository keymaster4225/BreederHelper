import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { OnboardingCarousel } from '@/components/OnboardingCarousel';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { DashboardSection } from '@/components/DashboardSection';
import { Screen } from '@/components/Screen';
import { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { DashboardAlert } from '@/utils/dashboardAlerts';
import { canSeedPreviewData } from '@/utils/buildProfile';
import { seedPreviewData } from '@/utils/devSeed';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface StatCardProps {
  readonly label: string;
  readonly count: number;
  readonly iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  readonly accentColor: string;
  readonly caption: string;
  readonly onPress: () => void;
}

function StatCard({
  label,
  count,
  iconName,
  accentColor,
  caption,
  onPress,
}: StatCardProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCard, pressed && styles.pressedOpacity]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}`}
    >
      <View style={[styles.statIconWrap, { backgroundColor: `${accentColor}1A` }]}>
        <MaterialCommunityIcons name={iconName} size={20} color={accentColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </Pressable>
  );
}

export function DashboardScreen({ navigation }: Props): JSX.Element {
  const { totalMares, pregnantMares, totalStallions, alerts, isLoading, error, reload, reloadIfStale } =
    useDashboardData();
  const hasAnimals = totalMares > 0 || totalStallions > 0;
  const { onboardingComplete, isOnboardingLoading, completeOnboarding } =
    useOnboardingState(hasAnimals);
  const canShowSeedData = canSeedPreviewData();

  useFocusEffect(
    useCallback(() => {
      void reloadIfStale();
    }, [reloadIfStale]),
  );

  const handleSeedSampleData = useCallback(() => {
    void (async () => {
      try {
        const result = await seedPreviewData();
        await completeOnboarding();
        await reload();
        Alert.alert(
          'Sample Data',
          result === 'inserted'
            ? 'Sample mares, stallions, and records are ready.'
            : 'Sample data is already loaded.',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sample data failed to load.';
        Alert.alert('Seed Error', message);
      }
    })();
  }, [completeOnboarding, reload]);

  const onAlertPress = useCallback(
    (alert: DashboardAlert) => {
      switch (alert.kind) {
        case 'approachingDueDate':
          navigation.navigate('MareDetail', { mareId: alert.mareId });
          break;
        case 'pregnancyCheckNeeded':
          navigation.navigate('PregnancyCheckForm', { mareId: alert.mareId });
          break;
        case 'recentOvulation':
        case 'heatActivity':
        case 'noRecentLog':
          navigation.navigate('DailyLogForm', { mareId: alert.mareId });
          break;
        case 'medicationGap':
          navigation.navigate('MareDetail', { mareId: alert.mareId, initialTab: 'meds' });
          break;
        case 'foalNeedsIgg':
          if (alert.foalingRecordId) {
            navigation.navigate('FoalForm', {
              mareId: alert.mareId,
              foalingRecordId: alert.foalingRecordId,
              foalId: alert.foalId,
            });
          }
          break;
      }
    },
    [navigation],
  );

  const navigateToMares = useCallback(
    (filter: 'all' | 'pregnant') => {
      const requestKey = Date.now().toString();
      navigation.navigate('MainTabs', {
        screen: 'Mares',
        params: { initialFilter: filter, requestKey },
      });
    },
    [navigation],
  );

  const navigateToStallions = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Stallions' });
  }, [navigation]);

  if (isLoading || isOnboardingLoading) {
    return (
      <Screen>
        <View style={styles.loadingState}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
        </View>
      </Screen>
    );
  }

  if (!hasAnimals && !onboardingComplete) {
    return (
      <Screen>
        <View style={styles.carouselState}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <OnboardingCarousel
            onComplete={completeOnboarding}
            onSeedSampleData={handleSeedSampleData}
            showSeedSampleData={canShowSeedData}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!hasAnimals ? (
          <View style={styles.emptyState}>
            <View style={styles.setupCard}>
              <Text style={styles.setupTitle}>Get started</Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [styles.primaryActionCard, pressed && styles.pressedOpacity]}
                  onPress={() => navigation.navigate('EditMare')}
                  accessibilityRole="button"
                  accessibilityLabel="Add a Mare"
                >
                  <MaterialCommunityIcons name="horse" size={28} color={colors.primary} />
                  <Text style={styles.actionTitle}>Add a Mare</Text>
                  <Text style={styles.actionSubtitle}>Create your first mare profile and start tracking.</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.primaryActionCard, pressed && styles.pressedOpacity]}
                  onPress={() => navigation.navigate('StallionForm', {})}
                  accessibilityRole="button"
                  accessibilityLabel="Add a Stallion"
                >
                  <MaterialCommunityIcons name="horse-variant" size={28} color={colors.tertiary} />
                  <Text style={styles.actionTitle}>Add a Stallion</Text>
                  <Text style={styles.actionSubtitle}>Store collection history and breeding references.</Text>
                </Pressable>
              </View>

              {canShowSeedData ? (
                <Pressable
                  style={({ pressed }) => [styles.seedCard, pressed && styles.pressedOpacity]}
                  onPress={handleSeedSampleData}
                  accessibilityRole="button"
                  accessibilityLabel="Load sample data"
                >
                  <View style={styles.seedCardIcon}>
                    <MaterialCommunityIcons name="database-import-outline" size={22} color={colors.onPrimaryContainer} />
                  </View>
                  <View style={styles.seedCardText}>
                    <Text style={styles.seedCardTitle}>Load sample data</Text>
                    <Text style={styles.seedCardSubtitle}>
                      Import test mares, stallions, breeding records, and pregnancy checks.
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {hasAnimals ? (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="Mares"
                count={totalMares}
                iconName="horse"
                accentColor={colors.primary}
                caption="Active"
                onPress={() => navigateToMares('all')}
              />
              <StatCard
                label="Pregnant"
                count={pregnantMares}
                iconName="stethoscope"
                accentColor={colors.pregnant}
                caption="Expecting"
                onPress={() => navigateToMares('pregnant')}
              />
              <StatCard
                label="Stallions"
                count={totalStallions}
                iconName="horse-variant"
                accentColor={colors.tertiary}
                caption="Active"
                onPress={() => navigateToStallions()}
              />
            </View>

            {alerts.length > 0 ? (
              <DashboardSection alerts={alerts} onAlertPress={onAlertPress} collapsible={false} />
            ) : (
              <View style={styles.caughtUp}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.primary} />
                <Text style={styles.caughtUpText}>All caught up! No tasks today.</Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
  },
  carouselState: {
    flex: 1,
  },
  loader: {
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
  emptyState: {
    gap: spacing.lg,
  },
  setupCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    ...elevation.level2,
  },
  setupTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryActionCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    flex: 1,
    gap: spacing.sm,
    minHeight: 148,
    padding: spacing.lg,
  },
  actionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  actionSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  seedCard: {
    alignItems: 'center',
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  seedCardIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  seedCardText: {
    flex: 1,
    gap: 2,
  },
  seedCardTitle: {
    ...typography.titleSmall,
    color: colors.onPrimaryContainer,
  },
  seedCardSubtitle: {
    ...typography.bodySmall,
    color: colors.onSecondaryContainer,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    flexBasis: '30%',
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    ...elevation.level2,
  },
  statIconWrap: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 40,
  },
  statCount: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  statLabel: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  statCaption: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  caughtUp: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  caughtUpText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  pressedOpacity: {
    opacity: 0.85,
  },
});
