import { describe, expect, it } from 'vitest';

import { daysBetweenLocalDates, formatTaskDueLabel } from '@/utils/tasks';

describe('daysBetweenLocalDates', () => {
  it('returns positive, zero, and negative day differences', () => {
    expect(daysBetweenLocalDates('2026-04-28', '2026-04-27')).toBe(1);
    expect(daysBetweenLocalDates('2026-04-27', '2026-04-27')).toBe(0);
    expect(daysBetweenLocalDates('2026-04-25', '2026-04-27')).toBe(-2);
  });
});

describe('formatTaskDueLabel', () => {
  it('formats overdue, today, tomorrow, future, and timed tasks', () => {
    expect(formatTaskDueLabel({ dueDate: '2026-04-26', dueTime: null }, '2026-04-27')).toBe('Overdue by 1 day');
    expect(formatTaskDueLabel({ dueDate: '2026-04-25', dueTime: null }, '2026-04-27')).toBe('Overdue by 2 days');
    expect(formatTaskDueLabel({ dueDate: '2026-04-27', dueTime: null }, '2026-04-27')).toBe('Today');
    expect(formatTaskDueLabel({ dueDate: '2026-04-28', dueTime: '09:30' }, '2026-04-27')).toBe(
      'Tomorrow at 09:30',
    );
    expect(formatTaskDueLabel({ dueDate: '2026-05-04', dueTime: null }, '2026-04-27')).toBe('05-04-2026');
  });
});
