import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createPregnancyCheck: jest.fn(),
  deletePregnancyCheck: jest.fn(),
  getMareById: jest.fn(),
  getPregnancyCheckById: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  updatePregnancyCheck: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  getMareById: jest.Mock;
  getPregnancyCheckById: jest.Mock;
  listBreedingRecordsByMare: jest.Mock;
};

import { usePregnancyCheckForm } from './usePregnancyCheckForm';

type HookCallbacks = {
  mareId: string;
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

describe('usePregnancyCheckForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
