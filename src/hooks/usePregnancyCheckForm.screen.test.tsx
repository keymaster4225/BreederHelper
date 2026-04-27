import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  completeTaskFromRecord: jest.fn(),
  createPregnancyCheck: jest.fn(),
  deletePregnancyCheck: jest.fn(),
  getMareById: jest.fn(),
  getPregnancyCheckById: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  updatePregnancyCheck: jest.fn(),
}));

jest.mock('@/utils/id', () => ({
  newId: jest.fn(() => 'new-preg-check-id'),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  completeTaskFromRecord: jest.Mock;
  createPregnancyCheck: jest.Mock;
  getMareById: jest.Mock;
  getPregnancyCheckById: jest.Mock;
  listBreedingRecordsByMare: jest.Mock;
};

import { usePregnancyCheckForm } from './usePregnancyCheckForm';

type HookCallbacks = {
  mareId: string;
  initialBreedingRecordId?: string;
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

describe('usePregnancyCheckForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.completeTaskFromRecord.mockResolvedValue(undefined);
    repositories.createPregnancyCheck.mockResolvedValue(undefined);
    repositories.getMareById.mockResolvedValue({
      id: 'mare-1',
      name: 'Maple',
      breed: 'Quarter Horse',
      gestationLengthDays: 345,
      dateOfBirth: null,
      registrationNumber: null,
      isRecipient: false,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    repositories.listBreedingRecordsByMare.mockResolvedValue([
      {
        id: 'breeding-1',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Atlas',
        date: '2026-03-20',
        method: 'liveCover',
        notes: null,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        id: 'breeding-2',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Beacon',
        date: '2026-03-25',
        method: 'freshAI',
        notes: null,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]);
    repositories.getPregnancyCheckById.mockResolvedValue(null);
  });

  it('does not reload the pregnancy check when callback props change identity', async () => {
    repositories.getPregnancyCheckById.mockResolvedValue({
      id: 'preg-check-1',
      breedingRecordId: 'breeding-1',
      date: '2026-04-10',
      result: 'positive',
      heartbeatDetected: true,
      notes: 'Original note',
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof usePregnancyCheckForm>,
      HookCallbacks
    >(
      ({ mareId, onGoBack, setTitle }) =>
        usePregnancyCheckForm({
          mareId,
          pregnancyCheckId: 'preg-check-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          mareId: 'mare-1',
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original note');
    expect(repositories.getPregnancyCheckById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited note');
    });

    rerender({
      mareId: 'mare-1',
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited note'));
    expect(repositories.getPregnancyCheckById).toHaveBeenCalledTimes(1);
  });

  it('preselects the route-provided breeding record in create mode', async () => {
    const { result } = renderHook<
      ReturnType<typeof usePregnancyCheckForm>,
      HookCallbacks
    >(
      ({ mareId, initialBreedingRecordId, onGoBack, setTitle }) =>
        usePregnancyCheckForm({
          mareId,
          initialBreedingRecordId,
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          mareId: 'mare-1',
          initialBreedingRecordId: 'breeding-2',
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.breedingRecordId).toBe('breeding-2');
  });

  it('uses a task-provided default date in create mode', async () => {
    const { result } = renderHook(() =>
      usePregnancyCheckForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '2026-04-03',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.date).toBe('2026-04-03');
  });

  it('completes a linked task after a successful create save', async () => {
    repositories.listBreedingRecordsByMare.mockResolvedValue([
      {
        id: 'breeding-1',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Atlas',
        date: '1969-03-20',
        method: 'liveCover',
        notes: null,
        createdAt: '1969-03-20T00:00:00.000Z',
        updatedAt: '1969-03-20T00:00:00.000Z',
      },
    ]);
    const onGoBack = jest.fn();
    const { result } = renderHook(() =>
      usePregnancyCheckForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '1970-01-01',
        onGoBack,
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onSave();
    });

    expect(repositories.createPregnancyCheck).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-preg-check-id', mareId: 'mare-1' }),
    );
    expect(repositories.completeTaskFromRecord).toHaveBeenCalledWith(
      'task-1',
      'pregnancyCheck',
      'new-preg-check-id',
    );
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens a custom follow-up task after a successful save-and-follow-up', async () => {
    repositories.listBreedingRecordsByMare.mockResolvedValue([
      {
        id: 'breeding-1',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Atlas',
        date: '1969-03-20',
        method: 'liveCover',
        notes: null,
        createdAt: '1969-03-20T00:00:00.000Z',
        updatedAt: '1969-03-20T00:00:00.000Z',
      },
    ]);
    const onGoBack = jest.fn();
    const onAddFollowUpTask = jest.fn();
    const { result } = renderHook(() =>
      usePregnancyCheckForm({
        mareId: 'mare-1',
        defaultDate: '1970-01-01',
        onGoBack,
        onAddFollowUpTask,
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.onSaveAndAddFollowUp();
    });

    expect(repositories.createPregnancyCheck).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-preg-check-id', mareId: 'mare-1' }),
    );
    expect(onAddFollowUpTask).toHaveBeenCalledWith({
      mareId: 'mare-1',
      taskType: 'custom',
      sourceType: 'pregnancyCheck',
      sourceRecordId: 'new-preg-check-id',
      sourceReason: 'manualFollowUp',
    });
    expect(onGoBack).not.toHaveBeenCalled();
  });

  it('falls back to the first breeding record when create-mode preselection is invalid', async () => {
    const { result } = renderHook<
      ReturnType<typeof usePregnancyCheckForm>,
      HookCallbacks
    >(
      ({ mareId, initialBreedingRecordId, onGoBack, setTitle }) =>
        usePregnancyCheckForm({
          mareId,
          initialBreedingRecordId,
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          mareId: 'mare-1',
          initialBreedingRecordId: 'missing-breeding',
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.breedingRecordId).toBe('breeding-1');
  });
});
