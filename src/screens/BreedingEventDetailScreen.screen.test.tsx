import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { BreedingEventDetailScreen } from '@/screens/BreedingEventDetailScreen';

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
  getBreedingRecordById: jest.fn(),
  getMareById: jest.fn(),
  getSemenCollectionById: jest.fn(),
  getStallionById: jest.fn(),
  listFoalingRecordsByMare: jest.fn(),
  listFoalsByMare: jest.fn(),
  listPregnancyChecksByMare: jest.fn(),
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
      <BreedingEventDetailScreen
        navigation={navigation as never}
        route={{
          key: 'BreedingEventDetail',
          name: 'BreedingEventDetail',
          params: { breedingRecordId: 'breeding-1' },
        } as never}
      />,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  repositories.getBreedingRecordById.mockResolvedValue({
    id: 'breeding-1',
    mareId: 'mare-1',
    stallionId: 'stallion-1',
    stallionName: null,
    collectionId: 'collection-1',
    date: '2026-04-01',
    method: 'freshAI',
    notes: 'Good service',
    volumeMl: 20,
    concentrationMPerMl: 120,
    motilityPercent: 70,
    numberOfStraws: null,
    strawVolumeMl: null,
    strawDetails: null,
    collectionDate: '2026-03-31',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
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
  repositories.getStallionById.mockResolvedValue({
    id: 'stallion-1',
    name: 'Atlas',
    breed: null,
    registrationNumber: null,
    sire: null,
    dam: null,
    notes: null,
    dateOfBirth: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  });
  repositories.getSemenCollectionById.mockResolvedValue({
    id: 'collection-1',
    stallionId: 'stallion-1',
    collectionDate: '2026-03-31',
    rawVolumeMl: 55,
    extenderType: null,
    concentrationMillionsPerMl: 150,
    progressiveMotilityPercent: 75,
    targetMode: null,
    targetSpermMillionsPerDose: null,
    targetPostExtensionConcentrationMillionsPerMl: null,
    notes: null,
    createdAt: '2026-03-31T00:00:00.000Z',
    updatedAt: '2026-03-31T00:00:00.000Z',
  });
  repositories.listPregnancyChecksByMare.mockResolvedValue([
    {
      id: 'check-1',
      mareId: 'mare-1',
      breedingRecordId: 'breeding-1',
      date: '2026-04-15',
      result: 'positive',
      heartbeatDetected: true,
      notes: null,
      createdAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z',
    },
  ]);
  repositories.listFoalingRecordsByMare.mockResolvedValue([
    {
      id: 'foaling-1',
      mareId: 'mare-1',
      breedingRecordId: 'breeding-1',
      date: '2027-03-07',
      outcome: 'liveFoal',
      foalSex: 'filly',
      complications: null,
      notes: null,
      createdAt: '2027-03-07T00:00:00.000Z',
      updatedAt: '2027-03-07T00:00:00.000Z',
    },
  ]);
  repositories.listFoalsByMare.mockResolvedValue([
    {
      id: 'foal-1',
      mareId: 'mare-1',
      foalingRecordId: 'foaling-1',
      name: 'Dawn',
      sex: 'filly',
      color: null,
      markings: null,
      notes: null,
      createdAt: '2027-03-07T00:00:00.000Z',
      updatedAt: '2027-03-07T00:00:00.000Z',
    },
  ]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('renders breeding details and navigates to related records and cross-links', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Summary')).toBeTruthy(), { timeout: 3000 });
  expect(screen.getByText('04-01-2026')).toBeTruthy();
  expect(screen.getByText('Fresh AI')).toBeTruthy();
  expect(screen.getByText('20 mL')).toBeTruthy();
  expect(screen.getByText('120 M/mL')).toBeTruthy();
  expect(screen.getByText('Good service')).toBeTruthy();
  expect(screen.getByText('Dawn')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Open mare profile for Nova'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('MareDetail', {
    mareId: 'mare-1',
    initialTab: 'breeding',
  });

  fireEvent.press(screen.getByLabelText('Open stallion profile for Atlas'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('StallionDetail', {
    stallionId: 'stallion-1',
    initialTab: 'breeding',
  });

  fireEvent.press(screen.getByLabelText('Open linked collection'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('CollectionForm', {
    stallionId: 'stallion-1',
    collectionId: 'collection-1',
  });

  fireEvent.press(screen.getByText('Add Pregnancy Check'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', {
    mareId: 'mare-1',
    breedingRecordId: 'breeding-1',
  });

  fireEvent.press(screen.getByLabelText('Open pregnancy check from 04-15-2026'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', {
    mareId: 'mare-1',
    pregnancyCheckId: 'check-1',
  });

  fireEvent.press(screen.getByLabelText('Open foal record from 03-07-2027'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('FoalForm', {
    mareId: 'mare-1',
    foalingRecordId: 'foaling-1',
    foalId: 'foal-1',
    defaultSex: 'filly',
  });
});

it('opens foal create flow from live-foal records when no foal is linked yet', async () => {
  repositories.listFoalsByMare.mockResolvedValue([]);
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Foaling Records')).toBeTruthy(), { timeout: 3000 });

  fireEvent.press(screen.getByLabelText('Add foal record from 03-07-2027'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('FoalForm', {
    mareId: 'mare-1',
    foalingRecordId: 'foaling-1',
    foalId: undefined,
    defaultSex: 'filly',
  });
});

it('keeps foaling pencil mapped to foaling edit form', async () => {
  repositories.listPregnancyChecksByMare.mockResolvedValue([]);
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Foaling Records')).toBeTruthy(), { timeout: 3000 });

  screen.navigation.navigate.mockClear();
  fireEvent.press(screen.getByLabelText('Edit'));
  expect(screen.navigation.navigate).toHaveBeenCalledTimes(1);
  expect(screen.navigation.navigate).toHaveBeenLastCalledWith('FoalingRecordForm', {
    mareId: 'mare-1',
    foalingRecordId: 'foaling-1',
  });
});

it('wires the header pencil to the existing breeding edit form', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.navigation.setOptions).toHaveBeenCalledWith(expect.objectContaining({
    headerRight: expect.any(Function),
  })));

  const setOptionsCall = screen.navigation.setOptions.mock.calls.find((call) => call[0].headerRight);
  const header = render(setOptionsCall![0].headerRight());
  fireEvent.press(header.getByLabelText('Edit breeding event'));

  expect(screen.navigation.navigate).toHaveBeenCalledWith('BreedingRecordForm', {
    mareId: 'mare-1',
    breedingRecordId: 'breeding-1',
  });
});

it('does not render an empty service-details card for live cover with no extra fields', async () => {
  repositories.getBreedingRecordById.mockResolvedValue({
    id: 'breeding-1',
    mareId: 'mare-1',
    stallionId: null,
    stallionName: 'Outside Stallion',
    collectionId: null,
    date: '2026-04-01',
    method: 'liveCover',
    notes: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
  repositories.getStallionById.mockResolvedValue(null);
  repositories.getSemenCollectionById.mockResolvedValue(null);
  repositories.listPregnancyChecksByMare.mockResolvedValue([]);
  repositories.listFoalingRecordsByMare.mockResolvedValue([]);
  repositories.listFoalsByMare.mockResolvedValue([]);

  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Live Cover')).toBeTruthy());
  expect(screen.queryByText('Service Details')).toBeNull();
});

it('renders soft-deleted stallion as plain text instead of a cross-link', async () => {
  repositories.getStallionById.mockResolvedValue({
    id: 'stallion-1',
    name: 'Atlas',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: '2026-04-01T00:00:00.000Z',
  });

  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Atlas (Deleted)')).toBeTruthy());
  expect(screen.queryByLabelText('Open stallion profile for Atlas')).toBeNull();
});

it('alerts and goes back for an invalid first-load breeding record', async () => {
  repositories.getBreedingRecordById.mockResolvedValue(null);
  const screen = renderScreen();

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
    'Unable to open breeding event',
    'This breeding record no longer exists.',
  ));
  expect(screen.navigation.goBack).toHaveBeenCalled();
});
