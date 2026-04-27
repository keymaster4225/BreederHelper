import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { LocalDate, Mare, TaskSourceReason, TaskSourceType, TaskType } from '@/models/types';
import {
  completeTask,
  createTask,
  deleteTask,
  getTaskById,
  listMares,
  updateTask,
} from '@/storage/repositories';
import { confirmDelete } from '@/utils/confirmDelete';
import { normalizeDailyLogTime } from '@/utils/dailyLogTime';
import { toLocalDate } from '@/utils/dates';
import { newId } from '@/utils/id';
import { validateLocalDate, validateRequired } from '@/utils/validation';

export const TASK_DEFAULT_TITLES: Record<TaskType, string> = {
  dailyCheck: 'Check mare',
  medication: 'Give medication',
  breeding: 'Breed mare',
  pregnancyCheck: 'Pregnancy check',
  custom: '',
};

export const TASK_TYPE_OPTIONS: { label: string; value: TaskType }[] = [
  { label: 'Daily check', value: 'dailyCheck' },
  { label: 'Medication', value: 'medication' },
  { label: 'Breeding', value: 'breeding' },
  { label: 'Pregnancy check', value: 'pregnancyCheck' },
  { label: 'Custom', value: 'custom' },
];

type FormErrors = {
  readonly mareId?: string;
  readonly taskType?: string;
  readonly title?: string;
  readonly dueDate?: string;
  readonly dueTime?: string;
};

type UseTaskFormArgs = {
  readonly taskId?: string;
  readonly initialMareId?: string;
  readonly initialTaskType?: TaskType;
  readonly initialDueDate?: LocalDate;
  readonly initialDueTime?: string | null;
  readonly initialTitle?: string;
  readonly sourceType?: TaskSourceType;
  readonly sourceRecordId?: string;
  readonly sourceReason?: TaskSourceReason;
  readonly onGoBack: () => void;
  readonly setTitle: (title: string) => void;
};

type UseTaskFormResult = {
  readonly isEdit: boolean;
  readonly mares: readonly Mare[];
  readonly mareId: string;
  readonly taskType: TaskType;
  readonly title: string;
  readonly dueDate: string;
  readonly dueTime: string;
  readonly notes: string;
  readonly errors: FormErrors;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isDeleting: boolean;
  readonly isCompleting: boolean;
  readonly setMareId: (value: string) => void;
  readonly setTaskType: (value: TaskType) => void;
  readonly setTitleValue: (value: string) => void;
  readonly setDueDate: (value: string) => void;
  readonly setDueTime: (value: string) => void;
  readonly setNotes: (value: string) => void;
  readonly onSave: () => Promise<void>;
  readonly onComplete: () => Promise<void>;
  readonly requestDelete: () => void;
};

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateDueTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return normalizeDailyLogTime(trimmed) ? undefined : 'Due time must be HH:MM.';
}

export function useTaskForm({
  taskId,
  initialMareId,
  initialTaskType = 'custom',
  initialDueDate,
  initialDueTime,
  initialTitle,
  sourceType,
  sourceRecordId,
  sourceReason,
  onGoBack,
  setTitle,
}: UseTaskFormArgs): UseTaskFormResult {
  const isEdit = Boolean(taskId);
  const onGoBackRef = useRef(onGoBack);
  const setTitleRef = useRef(setTitle);

  const [mares, setMares] = useState<readonly Mare[]>([]);
  const [mareId, setMareId] = useState(initialMareId ?? '');
  const [taskType, setTaskTypeState] = useState<TaskType>(initialTaskType);
  const [title, setTitleValue] = useState(initialTitle ?? TASK_DEFAULT_TITLES[initialTaskType]);
  const [dueDate, setDueDate] = useState(initialDueDate ?? toLocalDate(new Date()));
  const [dueTime, setDueTime] = useState(initialDueTime ?? '');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    onGoBackRef.current = onGoBack;
    setTitleRef.current = setTitle;
  }, [onGoBack, setTitle]);

  useEffect(() => {
    setTitleRef.current(isEdit ? 'Edit Task' : 'Add Task');
  }, [isEdit]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const [loadedMares, existingTask] = await Promise.all([
          listMares(),
          taskId ? getTaskById(taskId) : Promise.resolve(null),
        ]);

        if (!mounted) {
          return;
        }

        setMares(loadedMares);

        if (taskId && !existingTask) {
          Alert.alert('Task not found', 'This task no longer exists.');
          onGoBackRef.current();
          return;
        }

        if (existingTask) {
          setMareId(existingTask.mareId);
          setTaskTypeState(existingTask.taskType);
          setTitleValue(existingTask.title);
          setDueDate(existingTask.dueDate);
          setDueTime(existingTask.dueTime ?? '');
          setNotes(existingTask.notes ?? '');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load task form data.';
        Alert.alert('Load error', message);
        onGoBackRef.current();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [taskId]);

  const setTaskType = useCallback((nextTaskType: TaskType) => {
    setTitleValue((currentTitle) => {
      const currentDefault = TASK_DEFAULT_TITLES[taskType];
      if (currentTitle.trim().length === 0 || currentTitle === currentDefault) {
        return TASK_DEFAULT_TITLES[nextTaskType];
      }
      return currentTitle;
    });
    setTaskTypeState(nextTaskType);
  }, [taskType]);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {
      mareId: validateRequired(mareId, 'Mare') ?? undefined,
      taskType: validateRequired(taskType, 'Task type') ?? undefined,
      title: validateRequired(title, 'Title') ?? undefined,
      dueDate: validateLocalDate(dueDate, 'Due date', true) ?? undefined,
      dueTime: validateDueTime(dueTime),
    };

    setErrors(nextErrors);
    return !nextErrors.mareId && !nextErrors.taskType && !nextErrors.title && !nextErrors.dueDate && !nextErrors.dueTime;
  }, [dueDate, dueTime, mareId, taskType, title]);

  const onSave = useCallback(async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      const normalizedDueTime = dueTime.trim() ? normalizeDailyLogTime(dueTime) : null;
      const payload = {
        mareId,
        taskType,
        title: title.trim(),
        dueDate: dueDate.trim() as LocalDate,
        dueTime: normalizedDueTime,
        notes: normalizeOptionalText(notes),
      };

      if (taskId) {
        await updateTask(taskId, payload);
      } else {
        await createTask({
          id: newId(),
          ...payload,
          sourceType,
          sourceRecordId,
          sourceReason,
        });
      }

      onGoBackRef.current();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save task.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }, [dueDate, dueTime, mareId, notes, sourceReason, sourceRecordId, sourceType, taskId, taskType, title, validate]);

  const onComplete = useCallback(async (): Promise<void> => {
    if (!taskId) {
      return;
    }

    setIsCompleting(true);
    try {
      await completeTask(taskId);
      onGoBackRef.current();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete task.';
      Alert.alert('Task update failed', message);
    } finally {
      setIsCompleting(false);
    }
  }, [taskId]);

  const requestDelete = useCallback((): void => {
    if (!taskId) {
      return;
    }

    confirmDelete({
      title: 'Delete Task',
      message: 'Delete this task?',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteTask(taskId);
          onGoBackRef.current();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete task.';
          Alert.alert('Delete failed', message);
        } finally {
          setIsDeleting(false);
        }
      },
    });
  }, [taskId]);

  return {
    isEdit,
    mares,
    mareId,
    taskType,
    title,
    dueDate,
    dueTime,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    isCompleting,
    setMareId,
    setTaskType,
    setTitleValue,
    setDueDate,
    setDueTime,
    setNotes,
    onSave,
    onComplete,
    requestDelete,
  };
}
