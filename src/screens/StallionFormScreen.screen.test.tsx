import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createStallion: jest.fn(),
  getStallionById: jest.fn(),
  softDeleteStallion: jest.fn(),
  updateStallion: jest.fn(),
}));

const { StallionFormScreen } = require('@/screens/StallionFormScreen') as typeof import('@/screens/StallionFormScreen');
const { getStallionById, updateStallion } = jest.requireMock('@/storage/repositories') as {
  getStallionById: jest.Mock;
  updateStallion: jest.Mock;
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

it('loads an existing stallion and saves updates', async () => {
  const navigation = createNavigation();
  getStallionById.mockResolvedValue({
    id: 'stallion-1',
    name: 'Atlas',
    breed: 'Warmblood',
    registrationNumber: 'ST-001',
    sire: null,
    dam: null,
    notes: null,
    dateOfBirth: '2014-03-10',
    avTemperatureF: null,
    avType: null,
    avLinerType: null,
    avWaterVolumeMl: null,
    avNotes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  });
  updateStallion.mockResolvedValue(undefined);

  const screen = render(
    <StallionFormScreen
      navigation={navigation as never}
      route={{ key: 'StallionForm', name: 'StallionForm', params: { stallionId: 'stallion-1' } } as never}
    />,
  );

  await waitFor(() => {
    expect(getStallionById).toHaveBeenCalledWith('stallion-1');
  });

  fireEvent.press(screen.getByText('Update Stallion'));

  await waitFor(() => {
    expect(updateStallion).toHaveBeenCalledWith(
      'stallion-1',
      expect.objectContaining({
        name: 'Atlas',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
