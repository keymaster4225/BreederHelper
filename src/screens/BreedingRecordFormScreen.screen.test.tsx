import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/hooks/useBreedingRecordForm', () => ({
  COVERAGE_OPTIONS: [
    { label: 'Live Cover', value: 'liveCover' },
    { label: 'AI', value: 'ai' },
  ],
  NO_COLLECTION: '__none__',
  OTHER_STALLION: '__other__',
  useBreedingRecordForm: jest.fn(),
}));

const { BreedingRecordFormScreen } = require('@/screens/BreedingRecordFormScreen') as typeof import('@/screens/BreedingRecordFormScreen');
const { useBreedingRecordForm } = jest.requireMock('@/hooks/useBreedingRecordForm') as {
  useBreedingRecordForm: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

function createHookState(overrides: Record<string, unknown> = {}) {
  return {
    today: new Date('2026-04-23T12:00:00Z'),
    isEdit: true,
    date: '2026-04-01',
    stallionName: '',
    method: 'freshAI',
    volumeMl: '20',
    concentrationMPerMl: '120',
    motilityPercent: '70',
    numberOfStraws: '',
    strawVolumeMl: '',
    strawDetails: '',
    collectionDate: '',
    notes: '',
    errors: {},
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    coverageType: 'ai',
    lockMethodAndCollection: false,
    selectedStallionId: 'stallion-1',
    selectedCollectionId: 'col-1',
    useCustomStallion: false,
    selectedStallionLabel: 'Atlas',
    selectedCollectionLabel: '03-30-2026 - 20 mL - 70% motility',
    stallionPickerOptions: [{ label: 'Atlas', value: 'stallion-1' }],
    collectionPickerOptions: [{ label: '03-30-2026 - 20 mL - 70% motility', value: 'col-1' }],
    showCollectionPicker: true,
    canShowAllCollections: false,
    showAllCollectionsList: jest.fn(),
    aiMethodOptions: [{ label: 'Fresh AI', value: 'freshAI' }],
    setDate: jest.fn(),
    setStallionName: jest.fn(),
    setMethod: jest.fn(),
    setVolumeMl: jest.fn(),
    setConcentrationMPerMl: jest.fn(),
    setMotilityPercent: jest.fn(),
    setNumberOfStraws: jest.fn(),
    setStrawVolumeMl: jest.fn(),
    setStrawDetails: jest.fn(),
    setCollectionDate: jest.fn(),
    setNotes: jest.fn(),
    onCoverageChange: jest.fn(),
    onStallionChange: jest.fn(),
    onCollectionChange: jest.fn(),
    onSave: jest.fn(),
    requestDelete: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders an editable breeding record and wires save/delete actions', () => {
  const navigation = createNavigation();
  const hookState = createHookState();
  useBreedingRecordForm.mockReturnValue(hookState);

  const screen = render(
    <BreedingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'BreedingRecordForm',
        name: 'BreedingRecordForm',
        params: { mareId: 'mare-1', breedingRecordId: 'br-1' },
      } as never}
    />,
  );

  expect(screen.getByText('Breeding Method *')).toBeTruthy();
  expect(screen.getByText('Collection')).toBeTruthy();

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Delete'));

  expect(hookState.onSave).toHaveBeenCalled();
  expect(hookState.requestDelete).toHaveBeenCalled();
});

it('renders linked on-farm records as locked and shows the resolved labels', () => {
  const navigation = createNavigation();
  useBreedingRecordForm.mockReturnValue(
    createHookState({
      lockMethodAndCollection: true,
    }),
  );

  const screen = render(
    <BreedingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'BreedingRecordForm',
        name: 'BreedingRecordForm',
        params: { mareId: 'mare-1', breedingRecordId: 'br-locked' },
      } as never}
    />,
  );

  expect(screen.getByText(/linked to an on-farm allocation/i)).toBeTruthy();
  expect(screen.getByDisplayValue('Atlas')).toBeTruthy();
  expect(screen.getByDisplayValue('Fresh AI')).toBeTruthy();
  expect(screen.getByDisplayValue('03-30-2026 - 20 mL - 70% motility')).toBeTruthy();
});

it('renders frozen-ai specific fields with decimal straw volume from hook state', () => {
  const navigation = createNavigation();
  useBreedingRecordForm.mockReturnValue(
    createHookState({
      method: 'frozenAI',
      numberOfStraws: '2',
      strawVolumeMl: '0.5',
      strawDetails: 'Batch A',
      collectionDate: '2026-03-28',
      showCollectionPicker: false,
    }),
  );

  const screen = render(
    <BreedingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'BreedingRecordForm',
        name: 'BreedingRecordForm',
        params: { mareId: 'mare-1', breedingRecordId: 'br-frozen' },
      } as never}
    />,
  );

  expect(screen.getByDisplayValue('2')).toBeTruthy();
  expect(screen.getByDisplayValue('0.5')).toBeTruthy();
  expect(screen.getByDisplayValue('Batch A')).toBeTruthy();
});
