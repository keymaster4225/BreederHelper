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
const idUtils = jest.requireMock('@/utils/id') as {
  newId: jest.Mock;
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
    idUtils.newId.mockImplementation(() => 'new-log-id');
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

  it('uses task-provided date and time defaults in create mode', () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '2026-05-01',
        defaultTime: '09:30',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    expect(result.current.date).toBe('2026-05-01');
    expect(result.current.time).toBe('09:30');
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

  it('seeds a follicle measurement row when follicle state is measured', () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setOvaryFollicleState('right', 'measured');
    });

    expect(result.current.rightOvary.follicleState).toBe('measured');
    expect(result.current.rightOvary.follicleMeasurements).toEqual([
      { clientId: 'new-log-id', value: '' },
    ]);
  });

  it('stores and clears a single follicle size through the public ovary setter', () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setOvaryFollicleSize('left', '34.5');
    });

    expect(result.current.leftOvary.follicleState).toBe('measured');
    expect(result.current.leftOvary.follicleMeasurements).toEqual([
      { clientId: 'new-log-id', value: '34.5' },
    ]);

    act(() => {
      result.current.setOvaryFollicleSize('left', '');
    });

    expect(result.current.leftOvary.follicleState).toBeNull();
    expect(result.current.leftOvary.follicleMeasurements).toEqual([]);
  });

  it('marks legacy ovulation as structured when an ovary ovulation value changes', async () => {
    repositories.getDailyLogById.mockResolvedValue(
      createDailyLogDetail({
        rightOvaryOvulation: null,
        leftOvaryOvulation: null,
        ovulationDetected: true,
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
    expect(result.current.ovulationSource).toBe('legacy');

    act(() => {
      result.current.setOvaryOvulation('right', true);
    });

    expect(result.current.ovulationSource).toBe('structured');
  });

  it('jumps to the invalid ovary step when a measured follicle has no valid size', async () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setOvaryFollicleState('right', 'measured');
    });

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.currentStepId).toBe('rightOvary');
    expect(result.current.errors.rightOvary.measurements).toBe(
      'Enter a valid follicle size (0-100 mm, up to 1 decimal place).',
    );
  });

  it('requires discharge notes and clears that error when notes are entered', () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.goToStep(3);
    });

    act(() => {
      result.current.setDischargeObserved(true);
    });

    act(() => {
      result.current.goNext();
    });

    expect(result.current.currentStepId).toBe('uterus');
    expect(result.current.errors.uterus.dischargeNotes).toBe(
      'Discharge notes are required when discharge is observed.',
    );

    act(() => {
      result.current.setDischargeNotes('Cloudy discharge');
    });

    expect(result.current.errors.uterus.dischargeNotes).toBeUndefined();
  });

  it('requires a flush decision when a fluid pocket exists before advancing', () => {
    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.goToStep(3);
    });

    act(() => {
      result.current.upsertFluidPocket({ depthMm: 6, location: 'uterineBody' });
    });

    act(() => {
      result.current.goNext();
    });

    expect(result.current.currentStepId).toBe('uterus');
    expect(result.current.errors.uterus.flushDecision).toBe(
      'Choose Yes or No for same-visit flush.',
    );
  });

  it('removing the last non-persisted fluid pocket clears the flush decision and removes the flush step', () => {
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

    const clientId = result.current.uterus.fluidPockets[0]?.clientId;
    expect(clientId).toBeTruthy();
    expect(result.current.currentStepId).toBe('basics');
    expect(result.current.steps.map((step) => step.id)).toContain('flush');

    act(() => {
      result.current.removeFluidPocket(clientId as string);
    });

    expect(result.current.flushDecision).toBeNull();
    expect(result.current.uterus.fluidPockets).toEqual([]);
    expect(result.current.steps.map((step) => step.id)).not.toContain('flush');
  });

  it('hydrates a persisted flush-backed record with the flush step and starts on review', async () => {
    repositories.getDailyLogById.mockResolvedValue(
      createDailyLogDetail({
        uterineFluidPockets: [
          {
            id: 'pocket-1',
            dailyLogId: 'log-1',
            depthMm: 7,
            location: 'uterineBody',
            createdAt: '2026-04-01T08:30:00.000Z',
            updatedAt: '2026-04-01T08:30:00.000Z',
          },
        ],
        uterineFlush: {
          id: 'flush-1',
          dailyLogId: 'log-1',
          baseSolution: 'Saline',
          totalVolumeMl: 500,
          notes: 'Recovered cloudy fluid',
          createdAt: '2026-04-01T08:30:00.000Z',
          updatedAt: '2026-04-01T08:30:00.000Z',
          products: [
            {
              id: 'product-1',
              uterineFlushId: 'flush-1',
              productName: 'Oxytocin',
              dose: '10 IU',
              notes: null,
              createdAt: '2026-04-01T08:30:00.000Z',
              updatedAt: '2026-04-01T08:30:00.000Z',
            },
          ],
        },
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

    expect(result.current.flushDecision).toBe('yes');
    expect(result.current.flush.baseSolution).toBe('Saline');
    expect(result.current.steps.map((step) => step.id)).toEqual([
      'basics',
      'rightOvary',
      'leftOvary',
      'uterus',
      'flush',
      'review',
    ]);
    expect(result.current.currentStepId).toBe('review');
  });

  it('prompts before removing the last persisted flush-backed fluid pocket', async () => {
    repositories.getDailyLogById.mockResolvedValue(
      createDailyLogDetail({
        uterineFluidPockets: [
          {
            id: 'pocket-1',
            dailyLogId: 'log-1',
            depthMm: 7,
            location: 'uterineBody',
            createdAt: '2026-04-01T08:30:00.000Z',
            updatedAt: '2026-04-01T08:30:00.000Z',
          },
        ],
        uterineFlush: {
          id: 'flush-1',
          dailyLogId: 'log-1',
          baseSolution: 'Saline',
          totalVolumeMl: 500,
          notes: null,
          products: [],
          createdAt: '2026-04-01T08:30:00.000Z',
          updatedAt: '2026-04-01T08:30:00.000Z',
        },
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

    act(() => {
      result.current.removeFluidPocket('pocket-1');
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Clear flush data?',
      'Removing the last fluid pocket will clear the saved flush details for this daily log.',
      expect.any(Array),
    );
    expect(result.current.uterus.fluidPockets).toHaveLength(1);
    expect(result.current.flushDecision).toBe('yes');

    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
    const clearButton = buttons.find((button) => button.text === 'Clear');
    expect(clearButton).toBeTruthy();

    act(() => {
      clearButton?.onPress?.();
    });

    expect(result.current.uterus.fluidPockets).toEqual([]);
    expect(result.current.flushDecision).toBeNull();
  });

  it('prompts before changing a persisted flush decision from yes to no', async () => {
    repositories.getDailyLogById.mockResolvedValue(
      createDailyLogDetail({
        uterineFluidPockets: [
          {
            id: 'pocket-1',
            dailyLogId: 'log-1',
            depthMm: 7,
            location: 'uterineBody',
            createdAt: '2026-04-01T08:30:00.000Z',
            updatedAt: '2026-04-01T08:30:00.000Z',
          },
        ],
        uterineFlush: {
          id: 'flush-1',
          dailyLogId: 'log-1',
          baseSolution: 'Saline',
          totalVolumeMl: 500,
          notes: null,
          products: [],
          createdAt: '2026-04-01T08:30:00.000Z',
          updatedAt: '2026-04-01T08:30:00.000Z',
        },
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

    act(() => {
      result.current.setFlushDecision('no');
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Clear flush data?',
      'Changing this answer to No will clear the saved flush details for this daily log.',
      expect.any(Array),
    );
    expect(result.current.flushDecision).toBe('yes');

    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
    const clearButton = buttons.find((button) => button.text === 'Clear');
    expect(clearButton).toBeTruthy();

    act(() => {
      clearButton?.onPress?.();
    });

    expect(result.current.flushDecision).toBe('no');
  });

  it('clears flush errors when a flush field changes', async () => {
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

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.errors.flush.baseSolution).toBe('Base solution is required.');

    act(() => {
      result.current.setFlushBaseSolution('Lactated Ringers');
    });

    expect(result.current.errors.flush).toEqual({});
  });

  it('adds, updates, and removes flush products through the public flush handlers', () => {
    let nextId = 0;
    idUtils.newId.mockImplementation(() => `id-${nextId++}`);

    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    expect(result.current.flush.products).toHaveLength(1);

    act(() => {
      result.current.addFlushProduct();
    });

    expect(result.current.flush.products).toHaveLength(2);
    const firstProductId = result.current.flush.products[0]?.clientId;
    const secondProductId = result.current.flush.products[1]?.clientId;
    expect(secondProductId).toBeTruthy();
    expect(secondProductId).not.toBe(firstProductId);

    act(() => {
      result.current.updateFlushProduct(secondProductId, {
        productName: 'Oxytocin',
        dose: '10 IU',
        notes: 'After flush',
      });
    });

    expect(result.current.flush.products[1]).toEqual({
      clientId: secondProductId,
      productName: 'Oxytocin',
      dose: '10 IU',
      notes: 'After flush',
    });

    act(() => {
      result.current.removeFlushProduct(secondProductId);
    });

    expect(result.current.flush.products.map((product) => product.clientId)).toEqual([firstProductId]);
  });

  it('reseeds the default flush draft when choosing yes after all product rows were removed', () => {
    let nextId = 0;
    idUtils.newId.mockImplementation(() => `id-${nextId++}`);

    const { result } = renderHook(() =>
      useDailyLogWizard({
        mareId: 'mare-1',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    const initialProductId = result.current.flush.products[0]?.clientId;

    act(() => {
      result.current.removeFlushProduct(initialProductId);
    });

    expect(result.current.flush.products).toEqual([]);

    act(() => {
      result.current.upsertFluidPocket({ depthMm: 6, location: 'uterineBody' });
      result.current.setFlushDecision('yes');
    });

    expect(result.current.flush.products).toEqual([
      expect.objectContaining({ productName: 'Saline', dose: '', notes: '' }),
    ]);
    expect(result.current.flush.products[0]?.clientId).toBeTruthy();
    expect(result.current.flush.products[0]?.clientId).not.toBe(initialProductId);
  });
});
