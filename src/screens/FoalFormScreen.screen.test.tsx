import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  getFoalingRecordById: jest.fn(),
  getFoalById: jest.fn(),
  getFoalByFoalingRecordId: jest.fn(),
  createFoal: jest.fn(),
  updateFoal: jest.fn(),
  deleteFoal: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;
const { FoalFormScreen } = require('@/screens/FoalFormScreen') as typeof import('@/screens/FoalFormScreen');

beforeEach(() => {
  jest.clearAllMocks();
  repositories.getFoalingRecordById.mockResolvedValue({
    id: 'foaling-1',
    mareId: 'mare-1',
    breedingRecordId: null,
    date: '2026-03-30',
    outcome: 'liveFoal',
    foalSex: 'filly',
    complications: null,
    notes: null,
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  });
  repositories.getFoalByFoalingRecordId.mockResolvedValue(null);
});

function renderScreen(params?: Record<string, unknown>) {
  const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
  const route = {
    key: 'FoalForm',
    name: 'FoalForm',
    params: { mareId: 'mare-1', foalingRecordId: 'foaling-1', ...params },
  };

  return {
    navigation,
    ...render(<FoalFormScreen navigation={navigation as never} route={route as never} />),
  };
}

it('loads an existing foal record', async () => {
  repositories.getFoalById.mockResolvedValue({
    id: 'foal-1',
    foalingRecordId: 'foaling-1',
    name: 'Comet',
    sex: 'colt',
    color: 'bay',
    markings: 'Star',
    birthWeightLbs: 120,
    milestones: {},
    iggTests: [],
    notes: 'Healthy',
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  });

  const screen = renderScreen({ foalId: 'foal-1' });
  await waitFor(() => expect(screen.getByDisplayValue('Comet')).toBeTruthy());
  expect(screen.getByDisplayValue('120')).toBeTruthy();
  expect(screen.getByDisplayValue('Healthy')).toBeTruthy();
});

it('updates milestone state and supports IgG add/remove/save', async () => {
  repositories.createFoal.mockResolvedValue(undefined);
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Milestones')).toBeTruthy());
  fireEvent.press(screen.getByText('IgG Tested'));
  fireEvent.press(screen.getByText('+ Add Test'));
  fireEvent.changeText(screen.getByPlaceholderText('mg/dL'), '900');
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.createFoal).toHaveBeenCalled());
  const payload = repositories.createFoal.mock.calls[0][0];
  expect(payload.milestones.iggTested.done).toBe(true);
  expect(payload.iggTests).toHaveLength(1);

  fireEvent.press(screen.getByLabelText('Remove test'));
  expect(screen.queryByPlaceholderText('mg/dL')).toBeNull();
});

it('blocks save on invalid input', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Birth Weight (lbs)')).toBeTruthy());
  fireEvent.changeText(screen.getAllByPlaceholderText('Optional')[2], '-10');
  fireEvent.press(screen.getByText('Save'));

  expect(repositories.createFoal).not.toHaveBeenCalled();
  expect(screen.getByText('Must be a positive number.')).toBeTruthy();
});
