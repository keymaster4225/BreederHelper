import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createBreedingRecord: jest.fn(),
  deleteBreedingRecord: jest.fn(),
  getBreedingRecordById: jest.fn(),
  getStallionById: jest.fn(),
  listSemenCollectionsByStallion: jest.fn(),
  listStallions: jest.fn(),
  updateBreedingRecord: jest.fn(),
}));

const { BreedingRecordFormScreen } = require('@/screens/BreedingRecordFormScreen') as typeof import('@/screens/BreedingRecordFormScreen');
const {
  getBreedingRecordById,
  listSemenCollectionsByStallion,
  listStallions,
  updateBreedingRecord,
} = jest.requireMock('@/storage/repositories') as {
  getBreedingRecordById: jest.Mock;
  listSemenCollectionsByStallion: jest.Mock;
  listStallions: jest.Mock;
  updateBreedingRecord: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('loads an existing breeding record and saves updates', async () => {
  const navigation = createNavigation();
  listStallions.mockResolvedValue([
    {
      id: 'stallion-1',
      name: 'Atlas',
      breed: 'Warmblood',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      deletedAt: null,
    },
  ]);
  listSemenCollectionsByStallion.mockResolvedValue([
    {
      id: 'col-1',
      stallionId: 'stallion-1',
      collectionDate: '2026-03-30',
      rawVolumeMl: 20,
      totalVolumeMl: null,
      extenderVolumeMl: null,
      extenderType: null,
      concentrationMillionsPerMl: 120,
      progressiveMotilityPercent: 70,
      doseCount: 8,
      doseSizeMillions: null,
      notes: null,
      createdAt: '2026-03-30T00:00:00Z',
      updatedAt: '2026-03-30T00:00:00Z',
    },
  ]);
  getBreedingRecordById.mockResolvedValue({
    id: 'br-1',
    mareId: 'mare-1',
    stallionId: 'stallion-1',
    stallionName: null,
    collectionId: 'col-1',
    date: '2026-04-01',
    method: 'freshAI',
    notes: null,
    volumeMl: 20,
    concentrationMPerMl: 120,
    motilityPercent: 70,
    numberOfStraws: null,
    strawVolumeMl: null,
    strawDetails: null,
    collectionDate: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  });
  updateBreedingRecord.mockResolvedValue(undefined);

  const screen = render(
    <BreedingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'BreedingRecordForm',
        name: 'BreedingRecordForm',
        params: { mareId: 'mare-1', breedingRecordId: 'br-1' },
      } as never}
    />,
  );

  await waitFor(() => {
    expect(getBreedingRecordById).toHaveBeenCalledWith('br-1');
  });

  const saveButton = await screen.findByText('Save');
  fireEvent.press(saveButton);

  await waitFor(() => {
    expect(updateBreedingRecord).toHaveBeenCalledWith(
      'br-1',
      expect.objectContaining({
        date: '2026-04-01',
        method: 'freshAI',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

it('preserves decimal straw volume values when editing a frozen AI record', async () => {
  const navigation = createNavigation();
  listStallions.mockResolvedValue([
    {
      id: 'stallion-2',
      name: 'Mercury',
      breed: 'Warmblood',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      deletedAt: null,
    },
  ]);
  listSemenCollectionsByStallion.mockResolvedValue([]);
  getBreedingRecordById.mockResolvedValue({
    id: 'br-frozen',
    mareId: 'mare-1',
    stallionId: 'stallion-2',
    stallionName: null,
    collectionId: null,
    date: '2026-04-01',
    method: 'frozenAI',
    notes: null,
    volumeMl: null,
    concentrationMPerMl: null,
    motilityPercent: null,
    numberOfStraws: 2,
    strawVolumeMl: 0.5,
    strawDetails: 'Batch A',
    collectionDate: '2026-03-28',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  });
  updateBreedingRecord.mockResolvedValue(undefined);

  const screen = render(
    <BreedingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'BreedingRecordForm',
        name: 'BreedingRecordForm',
        params: { mareId: 'mare-1', breedingRecordId: 'br-frozen' },
      } as never}
    />,
  );

  await waitFor(() => {
    expect(getBreedingRecordById).toHaveBeenCalledWith('br-frozen');
  });

  const strawVolumeInput = await screen.findByDisplayValue('0.5');
  fireEvent.changeText(strawVolumeInput, '0.75');
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateBreedingRecord).toHaveBeenCalledWith(
      'br-frozen',
      expect.objectContaining({
        method: 'frozenAI',
        numberOfStraws: 2,
        strawVolumeMl: 0.75,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
