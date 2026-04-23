import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createFoalingRecord: jest.fn(),
  deleteFoalingRecord: jest.fn(),
  getFoalByFoalingRecordId: jest.fn(),
  getFoalingRecordById: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  updateFoalingRecord: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  getFoalByFoalingRecordId: jest.Mock;
  getFoalingRecordById: jest.Mock;
  listBreedingRecordsByMare: jest.Mock;
};

import { useFoalingRecordForm } from './useFoalingRecordForm';

type HookCallbacks = {
  mareId: string;
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

describe('useFoalingRecordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.getFoalByFoalingRecordId.mockResolvedValue(null);
    repositories.getFoalingRecordById.mockResolvedValue(null);
    repositories.listBreedingRecordsByMare.mockResolvedValue([]);
  });

  it('does not reload the foaling record when callback props change identity', async () => {
    repositories.listBreedingRecordsByMare.mockResolvedValue([
      {
        id: 'breeding-1',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Atlas',
        date: '2025-05-01',
        method: 'liveCover',
        notes: null,
        createdAt: '2025-05-01T00:00:00.000Z',
        updatedAt: '2025-05-01T00:00:00.000Z',
      },
    ]);
    repositories.getFoalingRecordById.mockResolvedValue({
      id: 'foaling-1',
      mareId: 'mare-1',
      breedingRecordId: 'breeding-1',
      date: '2026-04-15',
      outcome: 'liveFoal',
      foalSex: 'filly',
      complications: null,
      notes: 'Original note',
      createdAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useFoalingRecordForm>,
      HookCallbacks
    >(
      ({ mareId, onGoBack, setTitle }) =>
        useFoalingRecordForm({
          mareId,
          foalingRecordId: 'foaling-1',
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
    expect(repositories.getFoalingRecordById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited note');
    });

    rerender({
      mareId: 'mare-1',
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited note'));
    expect(repositories.getFoalingRecordById).toHaveBeenCalledTimes(1);
  });
});
