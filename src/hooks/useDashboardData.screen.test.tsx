import { act, renderHook, waitFor } from '@testing-library/react-native';

import { emitDataInvalidation } from '@/storage/dataInvalidation';

jest.mock('@/storage/repositories', () => ({
  listAllBreedingRecords: jest.fn(),
  listAllDailyLogs: jest.fn(),
  listAllFoalingRecords: jest.fn(),
  listAllPregnancyChecks: jest.fn(),
  listOpenDashboardTasks: jest.fn(),
  listMares: jest.fn(),
  listStallions: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  listAllBreedingRecords: jest.Mock;
  listAllDailyLogs: jest.Mock;
  listAllFoalingRecords: jest.Mock;
  listAllPregnancyChecks: jest.Mock;
  listOpenDashboardTasks: jest.Mock;
  listMares: jest.Mock;
  listStallions: jest.Mock;
};

import { useDashboardData } from './useDashboardData';

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

const dashboardTask = {
  id: 'task-1',
  mareId: 'mare-1',
  taskType: 'pregnancyCheck',
  title: 'Pregnancy check',
  dueDate: '2026-04-27',
  dueTime: null,
  notes: null,
  status: 'open',
  completedAt: null,
  completedRecordType: null,
  completedRecordId: null,
  sourceType: 'breedingRecord',
  sourceRecordId: 'breed-1',
  sourceReason: 'breedingPregnancyCheck',
  createdAt: '2026-04-13T00:00:00.000Z',
  updatedAt: '2026-04-13T00:00:00.000Z',
  mareName: 'Nova',
};

function mockBaseDashboardRecords() {
  repositories.listMares.mockResolvedValue([mare]);
  repositories.listStallions.mockResolvedValue([]);
  repositories.listAllDailyLogs.mockResolvedValue([]);
  repositories.listAllBreedingRecords.mockResolvedValue([
    {
      id: 'breed-1',
      mareId: 'mare-1',
      stallionId: null,
      stallionName: null,
      collectionId: null,
      date: '2026-04-13',
      time: null,
      method: 'freshAI',
      notes: null,
      volumeMl: null,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z',
    },
  ]);
  repositories.listAllPregnancyChecks.mockResolvedValue([]);
  repositories.listAllFoalingRecords.mockResolvedValue([]);
}

describe('useDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBaseDashboardRecords();
  });

  it('returns persisted dashboard tasks instead of inferred alert titles', async () => {
    repositories.listOpenDashboardTasks.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardData());

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toEqual([]);
    expect(repositories.listOpenDashboardTasks).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 14);
  });

  it('reloads dashboard data when tasks are invalidated', async () => {
    repositories.listOpenDashboardTasks
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dashboardTask]);

    const { result } = renderHook(() => useDashboardData());

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.tasks).toEqual([]));

    act(() => {
      emitDataInvalidation('tasks');
    });

    await waitFor(() => expect(result.current.tasks).toEqual([dashboardTask]));
    expect(repositories.listOpenDashboardTasks).toHaveBeenCalledTimes(2);
  });
});
