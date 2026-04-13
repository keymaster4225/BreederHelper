import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AlertCard } from '@/components/AlertCard';
import { DashboardAlert } from '@/utils/dashboardAlerts';
import { borderRadius, colors, spacing, typography } from '@/theme';

const MAX_VISIBLE_ALERTS = 8;

interface DashboardSectionProps {
  readonly alerts: readonly DashboardAlert[];
  readonly onAlertPress: (alert: DashboardAlert) => void;
  readonly collapsible?: boolean;
}

export function DashboardSection({
  alerts,
  onAlertPress,
  collapsible = true,
}: DashboardSectionProps): JSX.Element | null {
  const [isCollapsed, setIsCollapsed] = useState(collapsible);

  if (alerts.length === 0) return null;

  const visibleAlerts = alerts.slice(0, MAX_VISIBLE_ALERTS);
  const hiddenCount = alerts.length - visibleAlerts.length;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={collapsible ? () => setIsCollapsed((prev) => !prev) : undefined}
        accessibilityRole="button"
        accessibilityLabel={collapsible ? (isCollapsed ? 'Show tasks' : 'Hide tasks') : 'Tasks'}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Today's Tasks</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{alerts.length}</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            Prioritized checks and follow-ups for the mares that need attention first.
          </Text>
        </View>
        {collapsible ? (
          <MaterialCommunityIcons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={22}
            color={colors.onSurfaceVariant}
          />
        ) : null}
      </Pressable>

      {!collapsible || !isCollapsed ? (
        <View style={styles.alertList}>
          {visibleAlerts.map((alert) => (
            <AlertCard
              key={`${alert.kind}-${alert.mareId}`}
              alert={alert}
              onPress={() => onAlertPress(alert)}
            />
          ))}
          {hiddenCount > 0 ? (
            <Text style={styles.moreText}>
              and {hiddenCount} more...
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  headerContent: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.full,
    height: 24,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: spacing.sm,
  },
  countText: {
    ...typography.labelSmall,
    color: colors.onSecondaryContainer,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  alertList: {
    gap: spacing.sm,
  },
  moreText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    paddingTop: spacing.xs,
    textAlign: 'center',
  },
});
