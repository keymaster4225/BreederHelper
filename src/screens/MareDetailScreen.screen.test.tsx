import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { MareDetailScreen } from '@/screens/MareDetailScreen';
import { useHorseExport } from '@/hooks/useHorseExport';

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
  getProfilePhoto: jest.fn(),
  listAttachmentPhotos: jest.fn(),
}));

jest.mock('@/hooks/useHorseExport', () => ({
  useHorseExport: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;
const mockUseHorseExport = useHorseExport as jest.MockedFunction<typeof useHorseExport>;
const mockExportMarePackage = jest.fn();
const mockExportStallionPackage = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  mockUseHorseExport.mockReturnValue({
    isExporting: false,
    errorMessage: null,
    exportMarePackage: mockExportMarePackage,
    exportStallionPackage: mockExportStallionPackage,
  });
  repositories.getMareById.mockResolvedValue({
    id: 'mare-1',
    name: 'Nova',
    breed: 'Warmblood',
    gestationLengthDays: 340,
    dateOfBirth: '2015-01-01',
    registrationNumber: null,
    isRecipient: false,
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
  repositories.getProfilePhoto.mockResolvedValue(null);
  repositories.listAttachmentPhotos.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
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

it('shows recipient and pregnant badges together in the header when both apply', async () => {
  repositories.getMareById.mockResolvedValueOnce({
    id: 'mare-1',
    name: 'Nova',
    breed: 'Warmblood',
    gestationLengthDays: 340,
    dateOfBirth: '2015-01-01',
    registrationNumber: null,
    isRecipient: true,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  repositories.listPregnancyChecksByMare.mockResolvedValueOnce([
    {
      id: 'check-1',
      mareId: 'mare-1',
      breedingRecordId: 'breed-1',
      date: '2026-03-01',
      result: 'positive',
      heartbeatDetected: true,
      notes: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ]);
  repositories.listFoalingRecordsByMare.mockResolvedValueOnce([]);

  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const screen = render(
    <MareDetailScreen
      navigation={navigation as never}
      route={{ key: 'MareDetail', name: 'MareDetail', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => expect(screen.getByText('Recipient')).toBeTruthy());
  expect(screen.getByText('Pregnant')).toBeTruthy();
});

it('does not show an extra success alert after sharing a mare package', async () => {
  mockExportMarePackage.mockResolvedValueOnce({
    ok: true,
    fileName: 'breedwise-mare-nova-v1-20260428-120000.json',
    fileUri: 'file:///breedwise-mare-nova-v1-20260428-120000.json',
    shared: true,
  });

  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const screen = render(
    <MareDetailScreen
      navigation={navigation as never}
      route={{ key: 'MareDetail', name: 'MareDetail', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => expect(screen.getByLabelText('Export mare package')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Export mare package'));

  await waitFor(() => expect(mockExportMarePackage).toHaveBeenCalledWith('mare-1'));
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('shows the local save alert when mare package sharing does not open', async () => {
  mockExportMarePackage.mockResolvedValueOnce({
    ok: true,
    fileName: 'breedwise-mare-nova-v1-20260428-120000.json',
    fileUri: 'file:///breedwise-mare-nova-v1-20260428-120000.json',
    shared: false,
  });

  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const screen = render(
    <MareDetailScreen
      navigation={navigation as never}
      route={{ key: 'MareDetail', name: 'MareDetail', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => expect(screen.getByLabelText('Export mare package')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Export mare package'));

  await waitFor(() => expect(mockExportMarePackage).toHaveBeenCalledWith('mare-1'));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Mare package ready',
      expect.stringContaining('The horse package was saved locally.'),
    ),
  );
});

it('shows mare export failures', async () => {
  mockExportMarePackage.mockResolvedValueOnce({
    ok: false,
    errorMessage: 'Mare mare-1 was not found.',
  });

  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const screen = render(
    <MareDetailScreen
      navigation={navigation as never}
      route={{ key: 'MareDetail', name: 'MareDetail', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => expect(screen.getByLabelText('Export mare package')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Export mare package'));

  await waitFor(() => expect(mockExportMarePackage).toHaveBeenCalledWith('mare-1'));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Export failed', 'Mare mare-1 was not found.'),
  );
});
