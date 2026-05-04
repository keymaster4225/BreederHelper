import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { StallionDetailScreen } from '@/screens/StallionDetailScreen';
import { useHorseExport } from '@/hooks/useHorseExport';

jest.mock('@/screens/stallion-detail/DoseEventModal', () => ({
  DoseEventModal: () => null,
}));

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
  getStallionById: jest.fn(),
  listDoseEventsByCollectionIds: jest.fn(),
  listFrozenSemenBatchesByCollectionIds: jest.fn(),
  listFrozenSemenBatchesByStallion: jest.fn(),
  listSemenCollectionsByStallion: jest.fn(),
  listBreedingRecordsForStallion: jest.fn(),
  listLegacyBreedingRecordsMatchingStallionName: jest.fn(),
  listMares: jest.fn(),
  getProfilePhoto: jest.fn(),
}));

jest.mock('@/hooks/useHorseExport', () => ({
  useHorseExport: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;
const mockUseHorseExport = useHorseExport as jest.MockedFunction<typeof useHorseExport>;
const mockExportMarePackage = jest.fn();
const mockExportStallionPackage = jest.fn();

const makeStallion = (overrides?: Record<string, unknown>) => ({
  id: 'st-1',
  name: 'Thunder',
  breed: 'Thoroughbred',
  registrationNumber: 'REG-123',
  sire: 'Storm',
  dam: 'Rain',
  notes: null,
  dateOfBirth: '2018-01-01',
  avTemperatureF: 120,
  avType: 'Colorado',
  avLinerType: 'Disposable',
  avWaterVolumeMl: 500,
  avNotes: 'Use warm water',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

const makeCollection = (id: string, date: string, overrides?: Record<string, unknown>) => ({
  id,
  stallionId: 'st-1',
  collectionDate: date,
  rawVolumeMl: 50,
  extenderType: 'INRA 96',
  concentrationMillionsPerMl: 200,
  progressiveMotilityPercent: 75,
  targetMode: 'progressive',
  targetSpermMillionsPerDose: 500,
  targetPostExtensionConcentrationMillionsPerMl: 100,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeFrozenBatch = (id: string, overrides?: Record<string, unknown>) => ({
  id,
  stallionId: 'st-1',
  collectionId: null,
  freezeDate: '2026-04-03',
  rawSemenVolumeUsedMl: null,
  extender: 'INRA Freeze',
  extenderOther: null,
  wasCentrifuged: false,
  centrifuge: {
    speedRpm: null,
    durationMin: null,
    cushionUsed: null,
    cushionType: null,
    resuspensionVolumeMl: null,
    notes: null,
  },
  strawCount: 12,
  strawsRemaining: 10,
  strawVolumeMl: 0.5,
  concentrationMillionsPerMl: 200,
  strawsPerDose: 2,
  strawColor: 'Blue',
  strawColorOther: null,
  strawLabel: null,
  postThawMotilityPercent: 45,
  longevityHours: 24,
  storageDetails: 'Tank 1 / Cane A',
  notes: null,
  createdAt: '2026-04-03T00:00:00.000Z',
  updatedAt: '2026-04-03T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  mockUseHorseExport.mockReturnValue({
    isExporting: false,
    errorMessage: null,
    exportMarePackage: mockExportMarePackage,
    exportStallionPackage: mockExportStallionPackage,
  });
  repositories.getStallionById.mockResolvedValue(makeStallion());
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({});
  repositories.listFrozenSemenBatchesByCollectionIds.mockResolvedValue({});
  repositories.listFrozenSemenBatchesByStallion.mockResolvedValue([]);
  repositories.listSemenCollectionsByStallion.mockResolvedValue([]);
  repositories.listBreedingRecordsForStallion.mockResolvedValue([]);
  repositories.listLegacyBreedingRecordsMatchingStallionName.mockResolvedValue([]);
  repositories.listMares.mockResolvedValue([]);
  repositories.getProfilePhoto.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderScreen(
  params: { stallionId: string; initialTab?: 'collections' | 'breeding' | 'frozen' } = { stallionId: 'st-1' },
) {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  return {
    navigation,
    ...render(
      <StallionDetailScreen
        navigation={navigation as never}
        route={{ key: 'StallionDetail', name: 'StallionDetail', params } as never}
      />,
    ),
  };
}

it('renders stallion name in header', async () => {
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('Thunder')).toBeTruthy());
  expect(screen.navigation.setOptions).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Thunder' }),
  );
});

it('shows Collections, Breeding, and Frozen tab labels', async () => {
  const screen = renderScreen();
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Collections' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Breeding' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Frozen' })).toBeTruthy();
  });
});

it('selects Frozen tab when initialTab is frozen', async () => {
  const screen = renderScreen({ stallionId: 'st-1', initialTab: 'frozen' });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Frozen' })).toBeTruthy());
  expect(screen.getByRole('tab', { name: 'Frozen' }).props.accessibilityState.selected).toBe(true);
});

it('shows AV preferences when values exist', async () => {
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('120\u00B0F')).toBeTruthy());
  expect(screen.getByText('Colorado')).toBeTruthy();
  expect(screen.getByText('Disposable')).toBeTruthy();
  expect(screen.getByText('500 mL')).toBeTruthy();
});

it('opens the profile photo selector from the stallion header photo area', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByLabelText('Change Thunder profile photo')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Change Thunder profile photo'));

  expect(Alert.alert).toHaveBeenCalledWith(
    'Profile Photo',
    undefined,
    expect.arrayContaining([
      expect.objectContaining({ text: 'Camera' }),
      expect.objectContaining({ text: 'Library' }),
      expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
    ]),
  );
  expect(screen.navigation.navigate).not.toHaveBeenCalledWith('PhotoViewer', expect.anything());
});

it('shows empty state when no collections', async () => {
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('No collections recorded.')).toBeTruthy());
});

it('shows collection cards when collections exist', async () => {
  repositories.listSemenCollectionsByStallion.mockResolvedValue([
    makeCollection('col-1', '2026-04-01'),
  ]);
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({
    'col-1': [],
  });
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('50.00 mL')).toBeTruthy());
  expect(screen.getByText('INRA 96')).toBeTruthy();
  expect(screen.getByText('75%')).toBeTruthy();
  expect(screen.getByText('500 M')).toBeTruthy();
  expect(screen.getByText('100 M/mL')).toBeTruthy();
});

it('shows total-mode target labels on collection cards', async () => {
  repositories.listSemenCollectionsByStallion.mockResolvedValue([
    makeCollection('col-1', '2026-04-01', {
      targetMode: 'total',
      targetSpermMillionsPerDose: 500,
    }),
  ]);
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({
    'col-1': [],
  });

  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('Target Total / Dose')).toBeTruthy());
  expect(screen.getByText('Target Post-Ext Total Concentration')).toBeTruthy();
});

it('shows shipped and on-farm volume details in allocation rows', async () => {
  repositories.listSemenCollectionsByStallion.mockResolvedValue([
    makeCollection('col-1', '2026-04-01'),
  ]);
  repositories.listBreedingRecordsForStallion.mockResolvedValue([
    {
      id: 'br-1',
      mareId: 'mare-1',
      stallionId: 'st-1',
      stallionName: null,
      collectionId: 'col-1',
      date: '2026-04-02',
      method: 'freshAI',
      notes: null,
      volumeMl: 4,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  repositories.listMares.mockResolvedValue([
    { id: 'mare-1', name: 'Nova', breed: 'Warmblood', createdAt: '', updatedAt: '' },
  ]);
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({
    'col-1': [
      {
        id: 'ship-1',
        collectionId: 'col-1',
        eventType: 'shipped',
        recipient: 'Bluegrass Farm',
        recipientPhone: '555-111-1111',
        recipientStreet: '1 Main',
        recipientCity: 'Lexington',
        recipientState: 'KY',
        recipientZip: '40511',
        carrierService: 'FedEx',
        containerType: 'Equitainer',
        trackingNumber: 'TRACK-1',
        breedingRecordId: null,
        doseSemenVolumeMl: 3,
        doseExtenderVolumeMl: 2,
        doseCount: 2,
        eventDate: '2026-04-02',
        notes: null,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
      {
        id: 'farm-1',
        collectionId: 'col-1',
        eventType: 'usedOnSite',
        recipient: 'Nova',
        recipientPhone: null,
        recipientStreet: null,
        recipientCity: null,
        recipientState: null,
        recipientZip: null,
        carrierService: null,
        containerType: null,
        trackingNumber: null,
        breedingRecordId: 'br-1',
        doseSemenVolumeMl: null,
        doseExtenderVolumeMl: null,
        doseCount: 1,
        eventDate: '2026-04-02',
        notes: null,
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    ],
  });

  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Semen/Extender per dose: 3.00 mL + 2.00 mL')).toBeTruthy());
  expect(screen.getByText('Total semen/extender: 6.00 mL + 4.00 mL')).toBeTruthy();
  expect(screen.getByText('Semen used: not recorded')).toBeTruthy();

  fireEvent.press(screen.getAllByLabelText('Open breeding event for Nova')[0]);
  expect(screen.navigation.navigate).toHaveBeenCalledWith('BreedingEventDetail', {
    breedingRecordId: 'br-1',
  });
});

it('navigates to the collection wizard from Add Collection', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Add Collection')).toBeTruthy());
  fireEvent.press(screen.getByText('Add Collection'));

  expect(screen.navigation.navigate).toHaveBeenCalledWith('CollectionCreateWizard', {
    stallionId: 'st-1',
  });
});

it('navigates to frozen batch wizard from Freeze button with collectionId', async () => {
  repositories.listSemenCollectionsByStallion.mockResolvedValue([
    makeCollection('col-1', '2026-04-01'),
  ]);
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({
    'col-1': [],
  });
  repositories.listFrozenSemenBatchesByCollectionIds.mockResolvedValue({
    'col-1': [],
  });

  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Freeze')).toBeTruthy());
  fireEvent.press(screen.getByText('Freeze'));

  expect(screen.navigation.navigate).toHaveBeenCalledWith('FrozenBatchCreateWizard', {
    stallionId: 'st-1',
    collectionId: 'col-1',
  });
});

it('navigates to the collection form from a collection card edit button', async () => {
  repositories.listSemenCollectionsByStallion.mockResolvedValue([
    makeCollection('col-1', '2026-04-01'),
  ]);
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({
    'col-1': [],
  });

  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('04-01-2026')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Edit'));

  expect(screen.navigation.navigate).toHaveBeenCalledWith('CollectionForm', {
    stallionId: 'st-1',
    collectionId: 'col-1',
  });
});

it('hides Add Collection button when stallion is soft-deleted', async () => {
  repositories.getStallionById.mockResolvedValue(
    makeStallion({ deletedAt: '2026-04-01T00:00:00.000Z' }),
  );
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('Thunder')).toBeTruthy());
  expect(screen.queryByText('Add Collection')).toBeNull();
});

it('hides Add Frozen Batch button when stallion is soft-deleted', async () => {
  repositories.getStallionById.mockResolvedValue(
    makeStallion({ deletedAt: '2026-04-01T00:00:00.000Z' }),
  );
  repositories.listFrozenSemenBatchesByStallion.mockResolvedValue([
    makeFrozenBatch('frozen-1'),
  ]);

  const screen = renderScreen({ stallionId: 'st-1', initialTab: 'frozen' });

  await waitFor(() => expect(screen.getByText('Thunder')).toBeTruthy());
  expect(screen.queryByText('Add Frozen Batch')).toBeNull();
});

it('renders frozen allocation rows and navigates to frozen batch form from row and edit button', async () => {
  repositories.listSemenCollectionsByStallion.mockResolvedValue([
    makeCollection('col-1', '2026-04-01'),
  ]);
  repositories.listDoseEventsByCollectionIds.mockResolvedValue({
    'col-1': [],
  });
  repositories.listFrozenSemenBatchesByCollectionIds.mockResolvedValue({
    'col-1': [makeFrozenBatch('frozen-1', { collectionId: 'col-1', freezeDate: '2026-04-04', strawCount: 8 })],
  });

  const screen = renderScreen();

  await waitFor(() => expect(screen.getByText('Frozen: 8 straws')).toBeTruthy());
  expect(screen.getByText('Freeze date: 04-04-2026')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Open frozen batch from 04-04-2026'));
  fireEvent.press(screen.getByLabelText('Edit frozen batch'));

  const frozenFormCalls = screen.navigation.navigate.mock.calls.filter(
    (call) => call[0] === 'FrozenBatchForm',
  );
  expect(frozenFormCalls).toHaveLength(2);
  expect(frozenFormCalls[0]).toEqual([
    'FrozenBatchForm',
    { stallionId: 'st-1', frozenBatchId: 'frozen-1' },
  ]);
  expect(frozenFormCalls[1]).toEqual([
    'FrozenBatchForm',
    { stallionId: 'st-1', frozenBatchId: 'frozen-1' },
  ]);
});

it('shows linked breeding records with mare names', async () => {
  repositories.listBreedingRecordsForStallion.mockResolvedValue([
    {
      id: 'br-1',
      mareId: 'mare-1',
      stallionId: 'st-1',
      stallionName: null,
      collectionId: null,
      date: '2026-03-15',
      method: 'freshAI',
      notes: null,
      volumeMl: null,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  repositories.listMares.mockResolvedValue([
    { id: 'mare-1', name: 'Nova', breed: 'Warmblood', createdAt: '', updatedAt: '' },
  ]);

  const screen = renderScreen({ stallionId: 'st-1', initialTab: 'breeding' });
  await waitFor(() => expect(screen.getByText('Linked Breeding Records')).toBeTruthy());
  expect(screen.getByText('Mare: Nova')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Open breeding event for Nova'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('BreedingEventDetail', {
    breedingRecordId: 'br-1',
  });
});

it('updates the active tab on tab press', async () => {
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Collections' })).toBeTruthy());
  fireEvent.press(screen.getByRole('tab', { name: 'Breeding' }));
  expect(screen.getByRole('tab', { name: 'Breeding' }).props.accessibilityState.selected).toBe(true);
});

it('does not show an extra success alert after sharing a stallion package', async () => {
  mockExportStallionPackage.mockResolvedValueOnce({
    ok: true,
    fileName: 'breedwise-stallion-thunder-v1-20260428-120000.json',
    fileUri: 'file:///breedwise-stallion-thunder-v1-20260428-120000.json',
    shared: true,
  });

  const screen = renderScreen();
  await waitFor(() => expect(screen.navigation.setOptions).toHaveBeenCalled());

  const headerOptions = screen.navigation.setOptions.mock.calls
    .map(([options]) => options)
    .find((options) => typeof options.headerRight === 'function');
  expect(headerOptions).toBeTruthy();

  const headerRight = render(headerOptions?.headerRight());
  fireEvent.press(headerRight.getByLabelText('Export stallion package'));

  await waitFor(() => expect(mockExportStallionPackage).toHaveBeenCalledWith('st-1'));
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('shows the local save alert when stallion package sharing does not open', async () => {
  mockExportStallionPackage.mockResolvedValueOnce({
    ok: true,
    fileName: 'breedwise-stallion-thunder-v1-20260428-120000.json',
    fileUri: 'file:///breedwise-stallion-thunder-v1-20260428-120000.json',
    shared: false,
  });

  const screen = renderScreen();
  await waitFor(() => expect(screen.navigation.setOptions).toHaveBeenCalled());

  const headerOptions = screen.navigation.setOptions.mock.calls
    .map(([options]) => options)
    .find((options) => typeof options.headerRight === 'function');
  expect(headerOptions).toBeTruthy();

  const headerRight = render(headerOptions?.headerRight());
  fireEvent.press(headerRight.getByLabelText('Export stallion package'));

  await waitFor(() => expect(mockExportStallionPackage).toHaveBeenCalledWith('st-1'));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Stallion package ready',
      expect.stringContaining('The horse package was saved locally.'),
    ),
  );
});

it('shows stallion export failures', async () => {
  mockExportStallionPackage.mockResolvedValueOnce({
    ok: false,
    errorMessage: 'Stallion st-1 was not found.',
  });

  const screen = renderScreen();
  await waitFor(() => expect(screen.navigation.setOptions).toHaveBeenCalled());

  const headerOptions = screen.navigation.setOptions.mock.calls
    .map(([options]) => options)
    .find((options) => typeof options.headerRight === 'function');
  expect(headerOptions).toBeTruthy();

  const headerRight = render(headerOptions?.headerRight());
  fireEvent.press(headerRight.getByLabelText('Export stallion package'));

  await waitFor(() => expect(mockExportStallionPackage).toHaveBeenCalledWith('st-1'));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Export failed', 'Stallion st-1 was not found.'),
  );
});
