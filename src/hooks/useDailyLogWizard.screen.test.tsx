import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { DailyLogDetail } from '@/models/types';

jest.mock('@/storage/repositories', () => ({
  createDailyLog: jest.fn(),
  deleteDailyLog: jest.fn(),
  getDailyLogById: jest.fn(),
  updateDailyLog: jest.fn(),
}));

jest.mock('@/utils/confirmDelete', () => ({
  confirmDelete: jest.fn(),
}));

jest.mock('@/utils/dailyLogTime', () => {
  const actual = jest.requireActual('@/utils/dailyLogTime');
  return {
    ...actual,
    getCurrentTimeHHMM: jest.fn(() => '14:05'),
  };
});

jest.mock('@/utils/id', () => ({
  newId: jest.fn(() => 'new-log-id'),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  createDailyLog: jest.Mock;
  deleteDailyLog: jest.Mock;
  getDailyLogById: jest.Mock;
  updateDailyLog: jest.Mock;
};

import { useDailyLogWizard } from './useDailyLogWizard';

function createDailyLogDetail(overrides: Partial<DailyLogDetail> = {}): DailyLogDetail {
  return {
    id: 'log-1',
    mareId: 'mare-1',
    date: '2026-04-01',
    time: '08:30',
    teasingScore: 3,
    rightOvary: null,
    leftOvary: null,
    rightOvaryOvulation: null,
    rightOvaryFollicleState: null,
    rightOvaryFollicleMeasurementsMm: [],
    rightOvaryConsistency: null,
    rightOvaryStructures: [],
    leftOvaryOvulation: null,
    leftOvaryFollicleState: null,
    leftOvaryFollicleMeasurementsMm: [],
    leftOvaryConsistency: null,
    leftOvaryStructures: [],
    ovulationDetected: null,
    edema: null,
    uterineTone: null,
    uterineToneCategory: null,
    cervicalFirmness: null,
    dischargeObserved: null,
    dischargeNotes: null,
    uterineCysts: null,
    notes: 'Original note',
    createdAt: '2026-04-01T08:30:00.000Z',
    updatedAt: '2026-04-01T08:30:00.000Z',
    uterineFluidPockets: [],
    uterineFlush: null,
    ...overrides,
  };
}

describe('useDailyLogWizard', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    repositories.createDailyLog.mockResolvedValue(undefined);
    repositories.deleteDailyLog.mockResolvedValue(undefined);
    repositories.getDailyLogById.mockResolvedValue(null);
    repositories.updateDailyLog.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('defaults new daily logs to the current local time', () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    expect(result.current.time).toBe('14:05');
    expect(result.current.isTimeClearable).toBe(false);
  });

  it('hydrates time for a timed edit', async () => {
    repositories.getDailyLogById.mockResolvedValue(
      createDailyLogDetail({
        time: '08:30',
      }),
    );

    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        logId: 'log-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.time).toBe('08:30');
    expect(result.current.isTimeClearable).toBe(false);
  });

  it('keeps time blank for an untimed legacy edit', async () => {
    repositories.getDailyLogById.mockResolvedValue(
      createDailyLogDetail({
        time: null,
      }),
    );

    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        logId: 'log-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.time).toBe('');
    expect(result.current.isTimeClearable).toBe(true);
  });

  it('maps duplicate timed save errors to the time field and returns to step 0', async () => {
    repositories.getDailyLogById.mockResolvedValue(createDailyLogDetail());
    repositories.updateDailyLog.mockRejectedValue(
      new Error('UNIQUE constraint failed: daily_logs.mare_id, daily_logs.date, daily_logs.time'),
    );

    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        logId: 'log-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentStepIndex).toBe(4);

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.errors.basics.time).toBe(
      'A daily log already exists for this mare at that date and time.',
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('blocks create save when time is missing before the repository is called', async () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setTime('');
    });

    await act(async () => {
      await result.current.save();
    });

    expect(repositories.createDailyLog).not.toHaveBeenCalled();
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.errors.basics.time).toBe('Time is required.');
  });

  it('adds a flush step when a fluid pocket is marked as flushed', async () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.upsertFluidPocket({ depthMm: 6, location: 'uterineBody' });
      result.current.setFlushDecision('yes');
    });

    expect(result.current.steps.map((step) => step.title)).toEqual([
      'Basics',
      'Right Ovary',
      'Left Ovary',
      'Uterus',
      'Flush',
      'Review',
    ]);

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.currentStepId).toBe('flush');
    expect(result.current.errors.flush.baseSolution).toBe('Base solution is required.');
  });
});
