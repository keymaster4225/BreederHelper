import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createPregnancyCheck: jest.fn(),
  deletePregnancyCheck: jest.fn(),
  getMareById: jest.fn(),
  getPregnancyCheckById: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  updatePregnancyCheck: jest.fn(),
}));

const { PregnancyCheckFormScreen } = require('@/screens/PregnancyCheckFormScreen') as typeof import('@/screens/PregnancyCheckFormScreen');
const {
  getMareById,
  getPregnancyCheckById,
  listBreedingRecordsByMare,
  updatePregnancyCheck,
} = jest.requireMock('@/storage/repositories') as {
  getMareById: jest.Mock;
  getPregnancyCheckById: jest.Mock;
  listBreedingRecordsByMare: jest.Mock;
  updatePregnancyCheck: jest.Mock;
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

it('loads an existing pregnancy check and saves updates', async () => {
  const navigation = createNavigation();
  getMareById.mockResolvedValue({
    id: 'mare-1',
    name: 'Nova',
    breed: 'Warmblood',
    gestationLengthDays: 320,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
  listBreedingRecordsByMare.mockResolvedValue([
    {
      id: 'br-1',
      mareId: 'mare-1',
      stallionId: 'stallion-1',
      stallionName: 'Atlas',
      date: '2026-03-20',
      method: 'liveCover',
      createdAt: '2026-03-20T00:00:00Z',
      updatedAt: '2026-03-20T00:00:00Z',
    },
  ]);
  getPregnancyCheckById.mockResolvedValue({
    id: 'pc-1',
    mareId: 'mare-1',
    breedingRecordId: 'br-1',
    date: '2026-04-04',
    result: 'positive',
    heartbeatDetected: true,
    notes: null,
    createdAt: '2026-04-04T00:00:00Z',
    updatedAt: '2026-04-04T00:00:00Z',
  });
  updatePregnancyCheck.mockResolvedValue(undefined);

  const screen = render(
    <PregnancyCheckFormScreen
      navigation={navigation as never}
      route={{
        key: 'PregnancyCheckForm',
        name: 'PregnancyCheckForm',
        params: { mareId: 'mare-1', pregnancyCheckId: 'pc-1' },
      } as never}
    />,
  );

  await waitFor(() => {
    expect(getMareById).toHaveBeenCalledWith('mare-1');
    expect(listBreedingRecordsByMare).toHaveBeenCalledWith('mare-1');
    expect(getPregnancyCheckById).toHaveBeenCalledWith('pc-1');
  });

  expect(screen.getByText('Approx. due date: 02-03-2027')).toBeTruthy();
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updatePregnancyCheck).toHaveBeenCalledWith(
      'pc-1',
      expect.objectContaining({
        breedingRecordId: 'br-1',
        date: '2026-04-04',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
