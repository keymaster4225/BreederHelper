import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MareDetailScreen } from '@/screens/MareDetailScreen';

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
  getMareById: jest.fn(),
  listDailyLogsByMare: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  listPregnancyChecksByMare: jest.fn(),
  listFoalingRecordsByMare: jest.fn(),
  listFoalsByMare: jest.fn(),
  listStallions: jest.fn(),
  listMedicationLogsByMare: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  repositories.getMareById.mockResolvedValue({
    id: 'mare-1',
    name: 'Nova',
    breed: 'Warmblood',
    dateOfBirth: '2015-01-01',
    registrationNumber: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  repositories.listDailyLogsByMare.mockResolvedValue([]);
  repositories.listBreedingRecordsByMare.mockResolvedValue([]);
  repositories.listPregnancyChecksByMare.mockResolvedValue([]);
  repositories.listFoalingRecordsByMare.mockResolvedValue([]);
  repositories.listFoalsByMare.mockResolvedValue([]);
  repositories.listStallions.mockResolvedValue([]);
  repositories.listMedicationLogsByMare.mockResolvedValue([]);
});

it('honors the initialTab route param', async () => {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const screen = render(
    <MareDetailScreen
      navigation={navigation as never}
      route={{ key: 'MareDetail', name: 'MareDetail', params: { mareId: 'mare-1', initialTab: 'foaling' } } as never}
    />,
  );

  await waitFor(() => expect(screen.getByRole('tab', { name: 'Foaling' })).toBeTruthy());
  expect(screen.getByRole('tab', { name: 'Foaling' }).props.accessibilityState.selected).toBe(true);
});

it('updates the active tab on tab press and page change', async () => {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const screen = render(
    <MareDetailScreen
      navigation={navigation as never}
      route={{ key: 'MareDetail', name: 'MareDetail', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => expect(screen.getByRole('tab', { name: 'Logs' })).toBeTruthy());
  fireEvent.press(screen.getByRole('tab', { name: 'Pregnancy' }));
  expect(screen.getByRole('tab', { name: 'Pregnancy' }).props.accessibilityState.selected).toBe(true);

  fireEvent(screen.getByTestId('mare-detail-pager'), 'onPageSelected', { nativeEvent: { position: 4 } });
  expect(screen.getByRole('tab', { name: 'Meds' }).props.accessibilityState.selected).toBe(true);
});
