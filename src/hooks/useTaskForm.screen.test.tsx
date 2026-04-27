import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  completeTask: jest.fn(),
  createTask: jest.fn(),
  deleteTask: jest.fn(),
  getTaskById: jest.fn(),
  listMares: jest.fn(),
  updateTask: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  completeTask: jest.Mock;
  createTask: jest.Mock;
  deleteTask: jest.Mock;
  getTaskById: jest.Mock;
  listMares: jest.Mock;
  updateTask: jest.Mock;
};

import { useTaskForm } from './useTaskForm';

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

const mare = {
  id: 'mare-1',
  name: 'Nova',
  breed: 'Warmblood',
  dateOfBirth: '2015-01-01',
  registrationNumber: null,
  isRecipient: false,
  gestationLengthDays: 340,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const existingTask = {
  id: 'task-1',
  mareId: 'mare-1',
  taskType: 'medication',
  title: 'Give Regu-Mate',
  dueDate: '2026-04-28',
  dueTime: '09:30',
  notes: 'AM dose',
  status: 'open',
  completedAt: null,
  completedRecordType: null,
  completedRecordId: null,
  sourceType: 'manual',
  sourceRecordId: null,
  sourceReason: null,
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
};

function renderTaskForm(overrides: Partial<Parameters<typeof useTaskForm>[0]> = {}) {
  return renderHook(() =>
    useTaskForm({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
      ...overrides,
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  repositories.listMares.mockResolvedValue([mare]);
  repositories.getTaskById.mockResolvedValue(null);
  repositories.createTask.mockResolvedValue(undefined);
  repositories.updateTask.mockResolvedValue(undefined);
  repositories.completeTask.mockResolvedValue(undefined);
  repositories.deleteTask.mockResolvedValue(undefined);
});

it('creates a dashboard task with the selected mare', async () => {
  const onGoBack = jest.fn();
  const { result } = renderTaskForm({
    initialMareId: mare.id,
    initialTaskType: 'custom',
    initialDueDate: '2026-04-30',
    onGoBack,
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  act(() => {
    result.current.setTitleValue('Schedule ultrasound');
  });

  await act(async () => {
    await result.current.onSave();
  });

  expect(repositories.createTask).toHaveBeenCalledWith(
    expect.objectContaining({
      mareId: mare.id,
      taskType: 'custom',
      title: 'Schedule ultrasound',
      dueDate: '2026-04-30',
      dueTime: null,
      notes: null,
      sourceType: undefined,
    }),
  );
  expect(onGoBack).toHaveBeenCalledTimes(1);
});

it('saves a workflow-prefilled task without changing the mare', async () => {
  const onGoBack = jest.fn();
  const { result } = renderTaskForm({
    initialMareId: mare.id,
    initialTaskType: 'pregnancyCheck',
    initialDueDate: '2026-05-11',
    sourceType: 'breedingRecord',
    sourceRecordId: 'breeding-1',
    sourceReason: 'manualFollowUp',
    onGoBack,
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  await act(async () => {
    await result.current.onSave();
  });

  expect(repositories.createTask).toHaveBeenCalledWith(
    expect.objectContaining({
      mareId: mare.id,
      taskType: 'pregnancyCheck',
      title: 'Pregnancy check',
      dueDate: '2026-05-11',
      sourceType: 'breedingRecord',
      sourceRecordId: 'breeding-1',
      sourceReason: 'manualFollowUp',
    }),
  );
  expect(onGoBack).toHaveBeenCalledTimes(1);
});

it('hydrates edit mode from an existing task', async () => {
  repositories.getTaskById.mockResolvedValue(existingTask);

  const { result } = renderTaskForm({ taskId: existingTask.id });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(result.current.mareId).toBe(mare.id);
  expect(result.current.taskType).toBe('medication');
  expect(result.current.title).toBe('Give Regu-Mate');
  expect(result.current.dueDate).toBe('2026-04-28');
  expect(result.current.dueTime).toBe('09:30');
  expect(result.current.notes).toBe('AM dose');
});

it('marks an existing task complete', async () => {
  repositories.getTaskById.mockResolvedValue(existingTask);
  const onGoBack = jest.fn();
  const { result } = renderTaskForm({ taskId: existingTask.id, onGoBack });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  await act(async () => {
    await result.current.onComplete();
  });

  expect(repositories.completeTask).toHaveBeenCalledWith(existingTask.id);
  expect(onGoBack).toHaveBeenCalledTimes(1);
});

it('deletes an existing task after confirmation', async () => {
  repositories.getTaskById.mockResolvedValue(existingTask);
  const onGoBack = jest.fn();
  const { result } = renderTaskForm({ taskId: existingTask.id, onGoBack });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  act(() => {
    result.current.requestDelete();
  });

  const buttons = alertSpy.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
  const deleteButton = buttons.find((button) => button.text === 'Delete');

  await act(async () => {
    await deleteButton?.onPress?.();
  });

  expect(repositories.deleteTask).toHaveBeenCalledWith(existingTask.id);
  expect(onGoBack).toHaveBeenCalledTimes(1);
});
