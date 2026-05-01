import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { FoalingEventDetailScreen } from '@/screens/FoalingEventDetailScreen';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const mockReact = require('react');
  return {
    ...actual,
    useFocusEffect: (effect: () => void) => {
      mockReact.useEffect(() => {
        effect();
      }, [effect]);
    },
  };
});

jest.mock('@/storage/repositories', () => ({
  getFoalByFoalingRecordId: jest.fn(),
  getFoalingRecordById: jest.fn(),
  getMareById: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

function renderScreen(navigation = createNavigation()) {
  return {
    navigation,
    ...render(
      <FoalingEventDetailScreen
        navigation={navigation as never}
        route={{
          key: 'FoalingEventDetail',
          name: 'FoalingEventDetail',
          params: { foalingRecordId: 'foaling-1' },
        } as never}
      />,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  repositories.getFoalingRecordById.mockResolvedValue({
    id: 'foaling-1',
    mareId: 'mare-1',
    breedingRecordId: 'breeding-1',
    date: '2027-03-07',
    outcome: 'liveFoal',
    foalSex: 'filly',
    complications: 'None',
    notes: 'Strong nursing response',
    createdAt: '2027-03-07T00:00:00.000Z',
    updatedAt: '2027-03-07T00:00:00.000Z',
  });
  repositories.getMareById.mockResolvedValue({
    id: 'mare-1',
    name: 'Nova',
    breed: 'Warmblood',
    gestationLengthDays: 340,
    dateOfBirth: null,
    registrationNumber: null,
    isRecipient: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  });
  repositories.getFoalByFoalingRecordId.mockResolvedValue({
    id: 'foal-1',
    foalingRecordId: 'foaling-1',
    name: 'Dawn',
    sex: 'filly',
    color: 'bay',
    markings: 'Star',
    birthWeightLbs: 110,
    milestones: {
      stood: { done: true, recordedAt: '2027-03-07T01:00:00.000Z' },
      nursed: { done: true, recordedAt: '2027-03-07T02:00:00.000Z' },
    },
    iggTests: [{ date: '2027-03-08', valueMgDl: 900, recordedAt: '2027-03-08T10:00:00.000Z' }],
    notes: 'Bright and active',
    createdAt: '2027-03-07T00:00:00.000Z',
    updatedAt: '2027-03-07T00:00:00.000Z',
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('renders a foaling summary and keeps edit actions explicit', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Foaling Summary')).toBeTruthy(), { timeout: 3000 });

  expect(screen.getByText('DOB')).toBeTruthy();
  expect(screen.getByText('03-07-2027')).toBeTruthy();
  expect(screen.getByText('Live Foal')).toBeTruthy();
  expect(screen.getByText('Dawn')).toBeTruthy();
  expect(screen.getByText('Bay')).toBeTruthy();
  expect(screen.getByText('Milestones')).toBeTruthy();
  expect(screen.getByText('Stood')).toBeTruthy();
  expect(screen.getByText('Nursed')).toBeTruthy();
  expect(screen.getAllByText(/^Done/).length).toBeGreaterThan(0);
  expect(screen.getByText('Passed Meconium')).toBeTruthy();
  expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  expect(screen.getByText('IgG')).toBeTruthy();
  expect(screen.getByText('900 Adequate')).toBeTruthy();
  expect(screen.getByText('Bright and active')).toBeTruthy();
  expect(screen.getByText('None')).toBeTruthy();
  expect(screen.getByText('Strong nursing response')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Open mare profile for Nova'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('MareDetail', {
    mareId: 'mare-1',
    initialTab: 'foaling',
  });

  expect(screen.queryByLabelText('Open breeding event from 04-01-2026')).toBeNull();

  fireEvent.press(screen.getByText('Open Foal Record'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('FoalForm', {
    mareId: 'mare-1',
    foalingRecordId: 'foaling-1',
    foalId: 'foal-1',
    defaultSex: 'filly',
  });
});

it('opens foal create flow from the summary when no foal is linked yet', async () => {
  repositories.getFoalByFoalingRecordId.mockResolvedValue(null);
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('No foal record has been added for this live foaling yet.')).toBeTruthy(), {
    timeout: 3000,
  });

  fireEvent.press(screen.getByText('Add Foal Record'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('FoalForm', {
    mareId: 'mare-1',
    foalingRecordId: 'foaling-1',
    foalId: undefined,
    defaultSex: 'filly',
  });
});

it('wires the header pencil to the foaling edit form', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.navigation.setOptions).toHaveBeenCalledWith(expect.objectContaining({
    headerRight: expect.any(Function),
  })));

  const setOptionsCall = screen.navigation.setOptions.mock.calls.find((call) => call[0].headerRight);
  const header = render(setOptionsCall![0].headerRight());
  fireEvent.press(header.getByLabelText('Edit foaling record'));

  expect(screen.navigation.navigate).toHaveBeenCalledWith('FoalingRecordForm', {
    mareId: 'mare-1',
    foalingRecordId: 'foaling-1',
  });
});
