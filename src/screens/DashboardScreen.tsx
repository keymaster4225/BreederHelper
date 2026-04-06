import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardSection } from '@/components/DashboardSection';
import { Screen } from '@/components/Screen';
import { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { DashboardAlert } from '@/utils/dashboardAlerts';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface StatCardProps {
  readonly label: string;
  readonly count: number;
  readonly iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  readonly onPress: () => void;
}

function StatCard({ label, count, iconName, onPress }: StatCardProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCard, pressed && styles.statCardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}`}
    >
      <MaterialCommunityIcons name={iconName} size={24} color={colors.primary} />
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const FEATURES: readonly { icon: IconName; color: string; title: string; subtitle: string }[] = [
  { icon: 'clipboard-text-outline', color: colors.primary, title: 'Daily Observations', subtitle: 'Heat scores, teasing, edema, and ovulation' },
  { icon: 'needle', color: colors.secondary, title: 'Breeding & Pregnancy', subtitle: 'Breeding records, pregnancy checks, and due dates' },
  { icon: 'baby-carriage', color: colors.pregnant, title: 'Foaling & Foals', subtitle: 'Foaling outcomes, foal details, and milestones' },
  { icon: 'pill', color: '#009688', title: 'Medications', subtitle: 'Track medication schedules and catch gaps' },
  { icon: 'test-tube', color: colors.tertiary, title: 'Stallion Collections', subtitle: 'Semen collection records and AV preferences' },
];

export function DashboardScreen({ navigation }: Props): JSX.Element {
  const { totalMares, pregnantMares, totalStallions, alerts, isLoading, error, reload } =
    useDashboardData();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

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

  const hasAnimals = totalMares > 0 || totalStallions > 0;
  const isFirstTime = !isLoading && !hasAnimals;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isFirstTime ? (
          <View style={styles.emptyState}>
            <View style={styles.welcomeHeader}>
              <MaterialCommunityIcons name="horse" size={56} color={colors.primary} />
              <Text style={styles.emptyHeading}>Welcome to BreedWise</Text>
              <Text style={styles.emptySubtitle}>
                Your complete mare and stallion recordkeeping companion.
              </Text>
            </View>

            <View style={styles.getStartedRow}>
              <Pressable
                style={({ pressed }) => [styles.actionCard, pressed && styles.pressedOpacity]}
                onPress={() => navigation.navigate('EditMare')}
                accessibilityRole="button"
                accessibilityLabel="Add a Mare"
              >
                <MaterialCommunityIcons name="horse" size={32} color={colors.primary} />
                <Text style={styles.actionCardLabel}>Add a Mare</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionCard, pressed && styles.pressedOpacity]}
                onPress={() => navigation.navigate('StallionForm', {})}
                accessibilityRole="button"
                accessibilityLabel="Add a Stallion"
              >
                <MaterialCommunityIcons name="horse-variant" size={32} color={colors.primary} />
                <Text style={styles.actionCardLabel}>Add a Stallion</Text>
              </Pressable>
            </View>

            <View style={styles.featureSection}>
              <Text style={styles.featureSectionTitle}>What you can track</Text>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.featureRow}>
                  <View style={[styles.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                    <MaterialCommunityIcons name={f.icon} size={22} color={f.color} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!isLoading && hasAnimals ? (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="Mares"
                count={totalMares}
                iconName="horse"
                onPress={() => navigateToMares('all')}
              />
              <StatCard
                label="Pregnant"
                count={pregnantMares}
                iconName="stethoscope"
                onPress={() => navigateToMares('pregnant')}
              />
              <StatCard
                label="Stallions"
                count={totalStallions}
                iconName="horse-variant"
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
  loader: {
    marginTop: spacing.xxl,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    ...elevation.level1,
  },
  statCardPressed: {
    opacity: 0.85,
  },
  statCount: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  statLabel: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  emptyState: {
    gap: spacing.xxl,
    paddingTop: spacing.xl,
  },
  welcomeHeader: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyHeading: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  emptySubtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  getStartedRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    ...elevation.level1,
  },
  actionCardLabel: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  featureSection: {
    gap: spacing.md,
  },
  featureSectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  featureRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  featureIconWrap: {
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  featureTextWrap: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  featureSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  pressedOpacity: {
    opacity: 0.85,
  },
  caughtUp: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  caughtUpText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
  },
});
