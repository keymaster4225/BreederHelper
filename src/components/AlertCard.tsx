import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AlertKind, AlertPriority, DashboardAlert } from '@/utils/dashboardAlerts';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

interface AlertCardProps {
  readonly alert: DashboardAlert;
  readonly onPress: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ALERT_CONFIG: Record<
  AlertKind,
  { icon: IconName; accentColor: string }
> = {
  approachingDueDate: { icon: 'calendar-clock', accentColor: colors.pregnant },
  pregnancyCheckNeeded: { icon: 'stethoscope', accentColor: colors.secondary },
  recentOvulation: { icon: 'eye-check-outline', accentColor: colors.positive },
  heatActivity: { icon: 'thermometer-high', accentColor: colors.score5 },
  noRecentLog: { icon: 'alert-circle-outline', accentColor: colors.onSurfaceVariant },
};

const PRIORITY_BORDER: Record<AlertPriority, string> = {
  high: colors.secondary,
  medium: colors.primary,
  low: colors.outline,
};

export function AlertCard({ alert, onPress }: AlertCardProps): JSX.Element {
  const config = ALERT_CONFIG[alert.kind];
  const borderColor = PRIORITY_BORDER[alert.priority];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: borderColor },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${alert.mareName}: ${alert.title}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: config.accentColor + '18' }]}>
        <MaterialCommunityIcons
          name={config.icon}
          size={22}
          color={config.accentColor}
        />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.mareName} numberOfLines={1}>{alert.mareName}</Text>
        <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{alert.subtitle}</Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderLeftWidth: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...elevation.level1,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  mareName: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  title: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
});
