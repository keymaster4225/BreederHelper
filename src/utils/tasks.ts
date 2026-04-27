import { LocalDate, Task } from '@/models/types';
import { formatLocalDate } from '@/utils/dates';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetweenLocalDates(dateA: LocalDate, dateB: LocalDate): number {
  const first = new Date(`${dateA}T00:00:00Z`);
  const second = new Date(`${dateB}T00:00:00Z`);
  return Math.floor((first.getTime() - second.getTime()) / MS_PER_DAY);
}

export function formatTaskDueLabel(
  task: Pick<Task, 'dueDate' | 'dueTime'>,
  today: LocalDate,
): string {
  const daysUntilDue = daysBetweenLocalDates(task.dueDate, today);
  const overdueDays = Math.abs(daysUntilDue);
  const dateLabel =
    daysUntilDue < 0
      ? `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`
      : daysUntilDue === 0
        ? 'Today'
        : daysUntilDue === 1
          ? 'Tomorrow'
          : formatLocalDate(task.dueDate, 'MM-DD-YYYY');

  return task.dueTime ? `${dateLabel} at ${task.dueTime}` : dateLabel;
}
