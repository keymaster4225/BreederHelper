import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
  listMares: jest.fn(),
  listAllDailyLogs: jest.fn(),
  listAllBreedingRecords: jest.fn(),
  listAllPregnancyChecks: jest.fn(),
  listAllFoalingRecords: jest.fn(),
  listAllMedicationLogs: jest.fn(),
  listAllFoals: jest.fn(),
  softDeleteMare: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;
const { HomeScreen } = require('@/screens/HomeScreen') as typeof import('@/screens/HomeScreen');

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

const pregnantMare = {
  id: 'mare-1',
  name: 'Nova',
  breed: 'Warmblood',
  dateOfBirth: '2015-01-01',
  registrationNumber: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const openMare = {
  id: 'mare-2',
  name: 'Maple',
  breed: 'Quarter Horse',
  dateOfBirth: '2016-02-02',
  registrationNumber: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  repositories.listAllDailyLogs.mockResolvedValue([
    {
      id: 'log-1',
      mareId: pregnantMare.id,
      date: '2026-03-15',
      teasingScore: 2,
      rightOvary: null,
      leftOvary: null,
      ovulationDetected: true,
      edema: 1,
      uterineTone: null,
      uterineCysts: null,
      notes: null,
      createdAt: '2026-03-15T00:00:00.000Z',
      updatedAt: '2026-03-15T00:00:00.000Z',
    },
  ]);
  repositories.listAllBreedingRecords.mockResolvedValue([
    {
      id: 'breed-1',
      mareId: pregnantMare.id,
      stallionId: null,
      stallionName: 'Atlas',
      date: '2025-04-15',
      method: 'freshAI',
      notes: null,
      volumeMl: null,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: '2025-04-15T00:00:00.000Z',
      updatedAt: '2025-04-15T00:00:00.000Z',
    },
    {
      id: 'breed-2',
      mareId: openMare.id,
      stallionId: null,
      stallionName: 'Orion',
      date: '2026-03-16',
      method: 'freshAI',
      notes: null,
      volumeMl: null,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
    },
  ]);
  repositories.listAllPregnancyChecks.mockResolvedValue([
    {
      id: 'check-1',
      mareId: pregnantMare.id,
      breedingRecordId: 'breed-1',
      date: '2025-05-01',
      result: 'positive',
      heartbeatDetected: true,
      notes: null,
      createdAt: '2025-05-01T00:00:00.000Z',
      updatedAt: '2025-05-01T00:00:00.000Z',
    },
  ]);
  repositories.listAllFoalingRecords.mockResolvedValue([]);
  repositories.listAllMedicationLogs.mockResolvedValue([]);
  repositories.listAllFoals.mockResolvedValue([]);
});

it('loads dashboard, search, and filter state correctly', async () => {
  repositories.listMares.mockResolvedValue([pregnantMare, openMare]);
  const navigation = createNavigation();
  const screen = render(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

  await waitFor(() => expect(screen.getByText('Nova')).toBeTruthy());
  expect(screen.getByText('Maple')).toBeTruthy();
  expect(screen.getAllByText('Pregnant').length).toBeGreaterThan(0);

  fireEvent.changeText(screen.getByPlaceholderText('Search mares...'), 'map');
  await waitFor(() => expect(screen.queryByText('Nova')).toBeNull());
  expect(screen.getByText('Maple')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Clear search'));
  fireEvent.press(screen.getByRole('button', { name: 'Open' }));
  await waitFor(() => expect(screen.queryByText('Nova')).toBeNull());
  expect(screen.getByText('Maple')).toBeTruthy();
});

it('refreshes the list after deleting a mare', async () => {
  repositories.listMares
    .mockResolvedValueOnce([pregnantMare, openMare])
    .mockResolvedValueOnce([pregnantMare]);
  repositories.softDeleteMare.mockResolvedValue(undefined);
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const navigation = createNavigation();
  const screen = render(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

  await waitFor(() => expect(screen.getByText('Maple')).toBeTruthy());
  fireEvent(screen.getByText('Maple'), 'longPress');
  fireEvent.press(screen.getByText('Delete'));

  const buttons = alertSpy.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
  buttons.find((button) => button.text === 'Delete')?.onPress?.();

  await waitFor(() => expect(repositories.softDeleteMare).toHaveBeenCalledWith(openMare.id));
  await waitFor(() => expect(screen.queryByText('Maple')).toBeNull());
});

it('routes alert taps to the expected destination', async () => {
  repositories.listMares.mockResolvedValue([openMare]);
  const navigation = createNavigation();
  const screen = render(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

  await waitFor(() => expect(screen.getByText("Today's Tasks")).toBeTruthy());
  fireEvent.press(screen.getByText("Today's Tasks"));
  fireEvent.press(screen.getByText('Day 15 post-breeding'));

  expect(navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', { mareId: openMare.id });
});
