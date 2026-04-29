import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { TaskCard } from '@/components/TaskCard';
import { LocalDate, TaskWithMare } from '@/models/types';
import { borderRadius, colors, spacing, typography } from '@/theme';

const MAX_VISIBLE_TASKS = 8;

interface DashboardSectionProps {
  readonly tasks: readonly TaskWithMare[];
  readonly today: LocalDate;
  readonly onTaskPress: (task: TaskWithMare) => void;
  readonly onTaskEdit: (task: TaskWithMare) => void;
  readonly onTaskComplete: (task: TaskWithMare) => void;
  readonly collapsible?: boolean;
}

export function DashboardSection({
  tasks,
  today,
  onTaskPress,
  onTaskEdit,
  onTaskComplete,
  collapsible = true,
}: DashboardSectionProps): JSX.Element | null {
  const [isCollapsed, setIsCollapsed] = useState(collapsible);

  if (tasks.length === 0) return null;

  const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenCount = tasks.length - visibleTasks.length;
  const openTaskCount = tasks.filter((task) => task.status === 'open').length;
  const openCountLabel = `${openTaskCount} open task${openTaskCount === 1 ? '' : 's'}`;

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
            <View style={styles.countBadge} accessibilityLabel={openCountLabel}>
              <Text style={styles.countText}>{openTaskCount}</Text>
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
        <View style={styles.taskList}>
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              today={today}
              onPress={onTaskPress}
              onEdit={onTaskEdit}
              onComplete={onTaskComplete}
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
  taskList: {
    gap: spacing.sm,
  },
  moreText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    paddingTop: spacing.xs,
    textAlign: 'center',
  },
});
