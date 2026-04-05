import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppNavigator } from '@/navigation/AppNavigator';

jest.mock('@/storage/repositories', () => ({
  listMares: jest.fn(),
  listStallions: jest.fn(),
  listAllDailyLogs: jest.fn(),
  listAllBreedingRecords: jest.fn(),
  listAllPregnancyChecks: jest.fn(),
  listAllFoalingRecords: jest.fn(),
  listAllMedicationLogs: jest.fn(),
  listAllFoals: jest.fn(),
}));

jest.mock('@/screens/EditMareScreen', () => ({
  EditMareScreen: () => null,
}));
jest.mock('@/screens/StallionManagementScreen', () => ({
  StallionManagementScreen: () => {
    const { Text } = require('react-native');
    return <Text>Stallion Management</Text>;
  },
}));
jest.mock('@/screens/BreedingRecordFormScreen', () => ({
  BreedingRecordFormScreen: () => null,
}));
jest.mock('@/screens/FoalingRecordFormScreen', () => ({
  FoalingRecordFormScreen: () => null,
}));
jest.mock('@/screens/FoalFormScreen', () => ({
  FoalFormScreen: () => null,
}));
jest.mock('@/screens/MareCalendarScreen', () => ({
  MareCalendarScreen: () => null,
}));
jest.mock('@/screens/MareDetailScreen', () => ({
  MareDetailScreen: () => null,
}));
jest.mock('@/screens/DailyLogFormScreen', () => ({
  DailyLogFormScreen: () => null,
}));
jest.mock('@/screens/PregnancyCheckFormScreen', () => ({
  PregnancyCheckFormScreen: ({ route }: { route: { params: { mareId: string } } }) => {
    const { Text } = require('react-native');
    return <Text>{`Pregnancy ${route.params.mareId}`}</Text>;
  },
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

function localDateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const BREEDING_DAYS_AGO = 15;

beforeEach(() => {
  jest.clearAllMocks();
  const breedingDate = localDateDaysAgo(BREEDING_DAYS_AGO);
  repositories.listMares.mockResolvedValue([
    {
      id: 'mare-1',
      name: 'Maple',
      breed: 'Quarter Horse',
      dateOfBirth: '2016-02-02',
      registrationNumber: null,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  repositories.listStallions.mockResolvedValue([
    {
      id: 'stallion-1',
      name: 'Atlas',
      breed: 'Warmblood',
      dateOfBirth: '2014-03-03',
      registrationNumber: null,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  repositories.listAllDailyLogs.mockResolvedValue([]);
  repositories.listAllBreedingRecords.mockResolvedValue([
    {
      id: 'breed-1',
      mareId: 'mare-1',
      stallionId: null,
      stallionName: null,
      date: breedingDate,
      method: 'freshAI',
      notes: null,
      volumeMl: null,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: `${breedingDate}T00:00:00.000Z`,
      updatedAt: `${breedingDate}T00:00:00.000Z`,
    },
  ]);
  repositories.listAllPregnancyChecks.mockResolvedValue([]);
  repositories.listAllFoalingRecords.mockResolvedValue([]);
  repositories.listAllMedicationLogs.mockResolvedValue([]);
  repositories.listAllFoals.mockResolvedValue([]);
});

it('defaults to the dashboard tab', async () => {
  const screen = render(<AppNavigator />);

  await waitFor(() => expect(screen.getByText("Today's Tasks")).toBeTruthy());
  expect(screen.getByText('BreedWise')).toBeTruthy();
  expect(screen.getByLabelText('1 Mares')).toBeTruthy();
});

it('switches tabs from dashboard to stallions and mares', async () => {
  const screen = render(<AppNavigator />);

  await waitFor(() => expect(screen.getByText("Today's Tasks")).toBeTruthy());

  fireEvent.press(screen.getAllByText('Stallions').at(-1)!);
  await waitFor(() => expect(screen.getByText('Stallion Management')).toBeTruthy());

  fireEvent.press(screen.getAllByText('Mares').at(-1)!);
  await waitFor(() => expect(screen.getByText('Maple')).toBeTruthy());
});

it('navigates from a dashboard alert to the intended screen params', async () => {
  const screen = render(<AppNavigator />);

  await waitFor(() => expect(screen.getByText("Today's Tasks")).toBeTruthy());
  fireEvent.press(screen.getByText(`Day ${BREEDING_DAYS_AGO} post-breeding`));

  await waitFor(() => expect(screen.getByText('Pregnancy mare-1', { includeHiddenElements: true })).toBeTruthy());
});
