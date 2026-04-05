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
            <MaterialCommunityIcons name="horse" size={72} color={colors.primary} />
            <Text style={styles.emptyHeading}>Welcome to BreedWise</Text>
            <Text style={styles.emptySubtitle}>
              Track your mares, stallions, breeding records, and foaling results — all in one place!
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyButton, pressed && styles.pressedOpacity]}
              onPress={() => navigation.navigate('EditMare')}
            >
              <Text style={styles.emptyButtonText}>Add your first mare</Text>
            </Pressable>
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
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
  },
  emptyHeading: {
    ...typography.titleLarge,
    color: colors.onSurface,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emptyButtonText: {
    ...typography.labelLarge,
    color: colors.onPrimaryContainer,
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
