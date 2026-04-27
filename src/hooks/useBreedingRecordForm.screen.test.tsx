import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  completeTaskFromRecord: jest.fn(),
  createBreedingRecord: jest.fn(),
  deleteBreedingRecord: jest.fn(),
  getBreedingRecordById: jest.fn(),
  getStallionById: jest.fn(),
  hasLinkedOnFarmDoseEvent: jest.fn(),
  listSemenCollectionsByStallion: jest.fn(),
  listStallions: jest.fn(),
  updateBreedingRecord: jest.fn(),
}));

jest.mock('@/utils/id', () => ({
  newId: jest.fn(() => 'new-breeding-id'),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  completeTaskFromRecord: jest.Mock;
  createBreedingRecord: jest.Mock;
  getBreedingRecordById: jest.Mock;
  hasLinkedOnFarmDoseEvent: jest.Mock;
  listSemenCollectionsByStallion: jest.Mock;
  listStallions: jest.Mock;
};

import { OTHER_STALLION, useBreedingRecordForm } from './useBreedingRecordForm';

type HookCallbacks = {
  mareId: string;
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

describe('useBreedingRecordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.completeTaskFromRecord.mockResolvedValue(undefined);
    repositories.createBreedingRecord.mockResolvedValue(undefined);
    repositories.getBreedingRecordById.mockResolvedValue(null);
    repositories.hasLinkedOnFarmDoseEvent.mockResolvedValue(false);
    repositories.listSemenCollectionsByStallion.mockResolvedValue([]);
    repositories.listStallions.mockResolvedValue([]);
  });

  it('uses task-provided date and time defaults in create mode', async () => {
    const { result } = renderHook(() =>
      useBreedingRecordForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '1970-01-01',
        defaultTime: '10:15',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(repositories.listStallions).toHaveBeenCalledTimes(1));
    expect(result.current.date).toBe('1970-01-01');
    expect(result.current.time).toBe('10:15');
  });

  it('completes a linked task after a successful create save', async () => {
    const onGoBack = jest.fn();
    const { result } = renderHook(() =>
      useBreedingRecordForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '1970-01-01',
        defaultTime: '10:15',
        onGoBack,
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(repositories.listStallions).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.onStallionChange(OTHER_STALLION);
      result.current.setStallionName('Outside Stallion');
    });

    await waitFor(() => {
      expect(result.current.useCustomStallion).toBe(true);
      expect(result.current.stallionName).toBe('Outside Stallion');
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(repositories.createBreedingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-breeding-id', mareId: 'mare-1' }),
    );
    expect(repositories.completeTaskFromRecord).toHaveBeenCalledWith(
      'task-1',
      'breedingRecord',
      'new-breeding-id',
    );
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not reload the breeding record when callback props change identity', async () => {
    repositories.getBreedingRecordById.mockResolvedValue({
      id: 'breeding-1',
      mareId: 'mare-1',
      stallionId: null,
      stallionName: 'Outside Stallion',
      collectionId: null,
      date: '2026-04-01',
      method: 'freshAI',
      volumeMl: 20,
      concentrationMPerMl: 120,
      motilityPercent: 70,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      notes: 'Original note',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useBreedingRecordForm>,
      HookCallbacks
    >(
      ({ mareId, onGoBack, setTitle }) =>
        useBreedingRecordForm({
          mareId,
          breedingRecordId: 'breeding-1',
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
    expect(repositories.getBreedingRecordById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited note');
    });

    rerender({
      mareId: 'mare-1',
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited note'));
    expect(repositories.getBreedingRecordById).toHaveBeenCalledTimes(1);
  });
});
