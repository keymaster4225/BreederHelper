import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { LocalDate, TaskType, TaskWithMare } from '@/models/types';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';
import { formatTaskDueLabel } from '@/utils/tasks';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type TaskCardProps = {
  readonly task: TaskWithMare;
  readonly today: LocalDate;
  readonly onPress: (task: TaskWithMare) => void;
  readonly onEdit: (task: TaskWithMare) => void;
  readonly onComplete: (task: TaskWithMare) => void;
};

const TASK_CONFIG: Record<TaskType, { icon: IconName; accentColor: string }> = {
  dailyCheck: { icon: 'stethoscope', accentColor: colors.primary },
  medication: { icon: 'pill', accentColor: colors.tertiary },
  breeding: { icon: 'heart', accentColor: colors.heartbeat },
  pregnancyCheck: { icon: 'calendar-check', accentColor: colors.pregnant },
  custom: { icon: 'checkbox-marked-circle-outline', accentColor: colors.onSurfaceVariant },
};

export function TaskCard({
  task,
  today,
  onPress,
  onEdit,
  onComplete,
}: TaskCardProps): JSX.Element {
  const config = TASK_CONFIG[task.taskType];
  const isCompleted = task.status === 'completed';
  const checkboxIcon: IconName = isCompleted ? 'checkbox-marked-circle-outline' : 'checkbox-blank-outline';
  const completeLabel = isCompleted ? `Completed ${task.title}` : `Complete ${task.title}`;

  return (
    <View style={[styles.card, { borderLeftColor: config.accentColor }, isCompleted ? styles.completedCard : null]}>
      <Pressable
        style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}
        onPress={isCompleted ? undefined : () => onComplete(task)}
        disabled={isCompleted}
        accessibilityRole="button"
        accessibilityLabel={completeLabel}
      >
        <MaterialCommunityIcons name={checkboxIcon} size={22} color={config.accentColor} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.contentButton, pressed && styles.pressed]}
        onPress={isCompleted ? undefined : () => onPress(task)}
        disabled={isCompleted}
        accessibilityRole="button"
        accessibilityLabel={`${task.mareName}: ${task.title}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${config.accentColor}18` }]}>
          <MaterialCommunityIcons name={config.icon} size={20} color={config.accentColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.mareName, isCompleted ? styles.completedText : null]} numberOfLines={1}>{task.mareName}</Text>
          <Text style={[styles.title, isCompleted ? styles.completedText : null]} numberOfLines={1}>{task.title}</Text>
          <Text style={styles.dueLabel} numberOfLines={1}>{formatTaskDueLabel(task, today)}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
      </Pressable>

      {isCompleted ? null : (
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={() => onEdit(task)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${task.title}`}
        >
          <MaterialCommunityIcons name="pencil-outline" size={19} color={colors.onSurfaceVariant} />
        </Pressable>
      )}
    </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    ...elevation.level1,
  },
  completeButton: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  contentButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
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
  dueLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressed: {
    opacity: 0.85,
  },
  completedCard: {
    opacity: 0.72,
  },
  completedText: {
    color: colors.onSurfaceVariant,
  },
});
