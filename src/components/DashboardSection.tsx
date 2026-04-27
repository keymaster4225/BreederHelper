import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
              <Text style={styles.countText}>{tasks.length}</Text>
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
            <View key={task.id} style={styles.taskCard}>
              <Pressable
                style={({ pressed }) => [styles.taskBody, pressed && styles.pressedOpacity]}
                onPress={() => onTaskPress(task)}
                accessibilityRole="button"
                accessibilityLabel={`${task.title} for ${task.mareName}`}
              >
                <View style={styles.taskIcon}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.taskText}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskMeta}>
                    {task.mareName} - {formatTaskDueLabel(task, today)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.taskActions}>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressedOpacity]}
                  onPress={() => onTaskEdit(task)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${task.title}`}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressedOpacity]}
                  onPress={() => onTaskComplete(task)}
                  accessibilityRole="button"
                  accessibilityLabel={`Complete ${task.title}`}
                >
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
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

function formatTaskDueLabel(task: TaskWithMare, today: LocalDate): string {
  const dateLabel = task.dueDate === today ? 'Today' : task.dueDate;
  return task.dueTime ? `${dateLabel} ${task.dueTime}` : dateLabel;
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
  taskCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  taskBody: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  taskIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  taskText: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  taskMeta: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  taskActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pressedOpacity: {
    opacity: 0.7,
  },
  moreText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    paddingTop: spacing.xs,
    textAlign: 'center',
  },
});
