import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createFoalingRecord: jest.fn(),
  deleteFoalingRecord: jest.fn(),
  getFoalByFoalingRecordId: jest.fn(),
  getFoalingRecordById: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  updateFoalingRecord: jest.fn(),
}));

const { FoalingRecordFormScreen } = require('@/screens/FoalingRecordFormScreen') as typeof import('@/screens/FoalingRecordFormScreen');
const {
  getFoalByFoalingRecordId,
  getFoalingRecordById,
  listBreedingRecordsByMare,
  updateFoalingRecord,
} = jest.requireMock('@/storage/repositories') as {
  getFoalByFoalingRecordId: jest.Mock;
  getFoalingRecordById: jest.Mock;
  listBreedingRecordsByMare: jest.Mock;
  updateFoalingRecord: jest.Mock;
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

it('loads an existing foaling record and saves updates', async () => {
  const navigation = createNavigation();
  listBreedingRecordsByMare.mockResolvedValue([
    {
      id: 'br-1',
      mareId: 'mare-1',
      stallionId: 'stallion-1',
      stallionName: 'Atlas',
      date: '2025-05-10',
      method: 'liveCover',
      createdAt: '2025-05-10T00:00:00Z',
      updatedAt: '2025-05-10T00:00:00Z',
    },
  ]);
  getFoalingRecordById.mockResolvedValue({
    id: 'fr-1',
    mareId: 'mare-1',
    breedingRecordId: 'br-1',
    date: '2026-04-01',
    outcome: 'liveFoal',
    foalSex: 'filly',
    complications: null,
    notes: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  });
  getFoalByFoalingRecordId.mockResolvedValue(null);
  updateFoalingRecord.mockResolvedValue(undefined);

  const screen = render(
    <FoalingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'FoalingRecordForm',
        name: 'FoalingRecordForm',
        params: { mareId: 'mare-1', foalingRecordId: 'fr-1' },
      } as never}
    />,
  );

  await waitFor(() => {
    expect(listBreedingRecordsByMare).toHaveBeenCalledWith('mare-1');
    expect(getFoalingRecordById).toHaveBeenCalledWith('fr-1');
    expect(getFoalByFoalingRecordId).toHaveBeenCalledWith('fr-1');
  });

  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateFoalingRecord).toHaveBeenCalledWith(
      'fr-1',
      expect.objectContaining({
        date: '2026-04-01',
        outcome: 'liveFoal',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
