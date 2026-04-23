import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createDailyLog: jest.fn(),
  createFoal: jest.fn(),
  createMedicationLog: jest.fn(),
  createStallion: jest.fn(),
  deleteDailyLog: jest.fn(),
  deleteFoal: jest.fn(),
  deleteFrozenSemenBatch: jest.fn(),
  deleteMedicationLog: jest.fn(),
  getDailyLogById: jest.fn(),
  getFoalByFoalingRecordId: jest.fn(),
  getFoalById: jest.fn(),
  getFoalingRecordById: jest.fn(),
  getFrozenSemenBatch: jest.fn(),
  getMedicationLogById: jest.fn(),
  getSemenCollectionById: jest.fn(),
  getStallionById: jest.fn(),
  softDeleteStallion: jest.fn(),
  updateDailyLog: jest.fn(),
  updateFoal: jest.fn(),
  updateFrozenSemenBatch: jest.fn(),
  updateMedicationLog: jest.fn(),
  updateSemenCollection: jest.fn(),
  updateStallion: jest.fn(),
}));

jest.mock('./dailyLogWizard/mappers', () => ({
  buildDailyLogPayload: jest.fn(),
  createEmptyErrors: jest.fn(() => ({
    basics: {},
    rightOvary: {},
    leftOvary: {},
    uterus: {},
  })),
  createEmptyOvaryDraft: jest.fn(() => ({
    ovulation: null,
    follicleState: null,
    follicleMeasurements: [],
    consistency: null,
    structures: [],
  })),
  createEmptyUterusDraft: jest.fn(() => ({
    edema: '',
    uterineToneCategory: null,
    cervicalFirmness: null,
    dischargeObserved: null,
    dischargeNotes: '',
    uterineCysts: '',
    fluidPockets: [],
  })),
  hydrateDailyLogWizardRecord: jest.fn(() => ({
    date: '2026-04-01',
    teasingScore: '',
    rightOvary: {
      ovulation: null,
      follicleState: null,
      follicleMeasurements: [],
      consistency: null,
      structures: [],
    },
    leftOvary: {
      ovulation: null,
      follicleState: null,
      follicleMeasurements: [],
      consistency: null,
      structures: [],
    },
    uterus: {
      edema: '',
      uterineToneCategory: null,
      cervicalFirmness: null,
      dischargeObserved: null,
      dischargeNotes: '',
      uterineCysts: '',
      fluidPockets: [],
    },
    notes: 'Original note',
    legacyNotes: {
      rightOvary: null,
      leftOvary: null,
      uterineTone: null,
    },
    legacyOvulationDetected: null,
    ovulationSource: 'structured',
  })),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

import { useAVPreferencesForm } from './useAVPreferencesForm';
import { useCollectionForm } from './useCollectionForm';
import { useDailyLogWizard } from './useDailyLogWizard';
import { useFoalForm } from './useFoalForm';
import { useFrozenBatchForm } from './useFrozenBatchForm';
import { useMedicationForm } from './useMedicationForm';
import { useStallionForm } from './useStallionForm';

type NavigationCallbacks = {
  onGoBack: () => void;
  setTitle: (title: string) => void;
};

type GoBackOnly = {
  onGoBack: () => void;
};

describe('navigation callback reload guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not reload the stallion form when callback props change identity', async () => {
    repositories.getStallionById.mockResolvedValue({
      id: 'stallion-1',
      name: 'Atlas',
      dateOfBirth: '2014-03-10',
      breed: 'Warmblood',
      registrationNumber: 'ST-001',
      sire: null,
      dam: null,
      notes: 'Original note',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useStallionForm>,
      NavigationCallbacks
    >(
      ({ onGoBack, setTitle }) =>
        useStallionForm({
          stallionId: 'stallion-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original note');
    expect(repositories.getStallionById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited note');
    });

    rerender({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited note'));
    expect(repositories.getStallionById).toHaveBeenCalledTimes(1);
  });

  it('does not reload the daily log wizard when callback props change identity', async () => {
    repositories.getDailyLogById.mockResolvedValue({
      id: 'log-1',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useDailyLogWizard>,
      NavigationCallbacks
    >(
      ({ onGoBack, setTitle }) =>
        useDailyLogWizard({
          mareId: 'mare-1',
          logId: 'log-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original note');
    expect(repositories.getDailyLogById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited note');
    });

    rerender({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited note'));
    expect(repositories.getDailyLogById).toHaveBeenCalledTimes(1);
  });

  it('does not reload AV preferences when onGoBack changes identity', async () => {
    repositories.getStallionById.mockResolvedValue({
      id: 'stallion-1',
      avTemperatureF: 112,
      avType: 'Missouri',
      avLinerType: 'Standard',
      avWaterVolumeMl: 2500,
      avNotes: 'Original AV note',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useAVPreferencesForm>,
      GoBackOnly
    >(
      ({ onGoBack }) =>
        useAVPreferencesForm({
          stallionId: 'stallion-1',
          onGoBack,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avNotes).toBe('Original AV note');
    expect(repositories.getStallionById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setAvNotes('Edited AV note');
    });

    rerender({
      onGoBack: jest.fn(),
    });

    await waitFor(() => expect(result.current.avNotes).toBe('Edited AV note'));
    expect(repositories.getStallionById).toHaveBeenCalledTimes(1);
  });

  it('does not reload the frozen batch form when callback props change identity', async () => {
    repositories.getFrozenSemenBatch.mockResolvedValue({
      id: 'batch-1',
      stallionId: 'stallion-1',
      freezeDate: '2026-04-02',
      rawSemenVolumeUsedMl: 20,
      wasCentrifuged: false,
      centrifuge: {
        speedRpm: null,
        durationMin: null,
        cushionUsed: null,
        cushionType: null,
        resuspensionVolumeMl: null,
        notes: null,
      },
      extender: null,
      extenderOther: null,
      strawCount: 10,
      strawVolumeMl: 0.5,
      concentrationMillionsPerMl: 100,
      strawsPerDose: 2,
      strawColor: null,
      strawColorOther: null,
      strawLabel: null,
      postThawMotilityPercent: null,
      longevityHours: null,
      storageDetails: null,
      notes: 'Original batch note',
      collectionId: null,
      strawsRemaining: 8,
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useFrozenBatchForm>,
      NavigationCallbacks
    >(
      ({ onGoBack, setTitle }) =>
        useFrozenBatchForm({
          frozenBatchId: 'batch-1',
          expectedStallionId: 'stallion-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original batch note');
    expect(repositories.getFrozenSemenBatch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited batch note');
    });

    rerender({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited batch note'));
    expect(repositories.getFrozenSemenBatch).toHaveBeenCalledTimes(1);
  });

  it('does not reload the collection form when callback props change identity', async () => {
    repositories.getSemenCollectionById.mockResolvedValue({
      id: 'collection-1',
      collectionDate: '2026-04-02',
      rawVolumeMl: 30,
      extenderType: 'Kenney',
      concentrationMillionsPerMl: 120,
      progressiveMotilityPercent: 70,
      targetMode: 'progressive',
      targetSpermMillionsPerDose: 500,
      targetPostExtensionConcentrationMillionsPerMl: 25,
      notes: 'Original collection note',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useCollectionForm>,
      NavigationCallbacks
    >(
      ({ onGoBack, setTitle }) =>
        useCollectionForm({
          collectionId: 'collection-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original collection note');
    expect(repositories.getSemenCollectionById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited collection note');
    });

    rerender({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited collection note'));
    expect(repositories.getSemenCollectionById).toHaveBeenCalledTimes(1);
  });

  it('does not reload the foal form when callback props change identity', async () => {
    repositories.getFoalingRecordById.mockResolvedValue({
      id: 'foaling-1',
      outcome: 'liveFoal',
      foalSex: 'filly',
    });
    repositories.getFoalById.mockResolvedValue({
      id: 'foal-1',
      name: 'Comet',
      sex: 'colt',
      color: 'bay',
      markings: 'Star',
      birthWeightLbs: 120,
      milestones: {},
      iggTests: [],
      notes: 'Original foal note',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useFoalForm>,
      NavigationCallbacks
    >(
      ({ onGoBack, setTitle }) =>
        useFoalForm({
          foalingRecordId: 'foaling-1',
          foalId: 'foal-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original foal note');
    expect(repositories.getFoalingRecordById).toHaveBeenCalledTimes(1);
    expect(repositories.getFoalById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited foal note');
    });

    rerender({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited foal note'));
    expect(repositories.getFoalingRecordById).toHaveBeenCalledTimes(1);
    expect(repositories.getFoalById).toHaveBeenCalledTimes(1);
  });

  it('does not reload the medication form when callback props change identity', async () => {
    repositories.getMedicationLogById.mockResolvedValue({
      id: 'med-1',
      date: '2026-03-30',
      medicationName: 'Banamine',
      dose: '10 mL',
      route: 'oral',
      notes: 'Original med note',
    });

    const { result, rerender } = renderHook<
      ReturnType<typeof useMedicationForm>,
      NavigationCallbacks
    >(
      ({ onGoBack, setTitle }) =>
        useMedicationForm({
          mareId: 'mare-1',
          medicationLogId: 'med-1',
          onGoBack,
          setTitle,
        }),
      {
        initialProps: {
          onGoBack: jest.fn(),
          setTitle: jest.fn(),
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toBe('Original med note');
    expect(repositories.getMedicationLogById).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotes('Edited med note');
    });

    rerender({
      onGoBack: jest.fn(),
      setTitle: jest.fn(),
    });

    await waitFor(() => expect(result.current.notes).toBe('Edited med note'));
    expect(repositories.getMedicationLogById).toHaveBeenCalledTimes(1);
  });
});
