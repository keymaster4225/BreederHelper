import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/hooks/useFoalingRecordForm', () => ({
  useFoalingRecordForm: jest.fn(),
}));

const { FoalingRecordFormScreen } = require('@/screens/FoalingRecordFormScreen') as typeof import('@/screens/FoalingRecordFormScreen');
const { useFoalingRecordForm } = jest.requireMock('@/hooks/useFoalingRecordForm') as {
  useFoalingRecordForm: jest.Mock;
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
    isEdit: true,
    today: new Date('2026-04-23T12:00:00Z'),
    breedingOptions: [
      { label: 'None', value: '' },
      { label: '2025-05-10 (liveCover)', value: 'br-1' },
    ],
    breedingRecordId: 'br-1',
    date: '2026-04-01',
    outcome: 'liveFoal',
    foalSex: 'filly',
    complications: '',
    notes: '',
    errors: {},
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    setBreedingRecordId: jest.fn(),
    setDate: jest.fn(),
    setOutcome: jest.fn(),
    setFoalSex: jest.fn(),
    setComplications: jest.fn(),
    setNotes: jest.fn(),
    onSave: jest.fn(),
    requestDelete: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders existing foaling values and wires save/delete actions', () => {
  const navigation = createNavigation();
  const hookState = createHookState();
  useFoalingRecordForm.mockReturnValue(hookState);

  const screen = render(
    <FoalingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'FoalingRecordForm',
        name: 'FoalingRecordForm',
        params: { mareId: 'mare-1', foalingRecordId: 'fr-1' },
      } as never}
    />,
  );

  expect(screen.getByText('Outcome *')).toBeTruthy();
  expect(screen.getByText('Foal Sex')).toBeTruthy();

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Delete'));

  expect(hookState.onSave).toHaveBeenCalled();
  expect(hookState.requestDelete).toHaveBeenCalled();
});

it('shows validation errors supplied by the foaling hook', () => {
  const navigation = createNavigation();
  useFoalingRecordForm.mockReturnValue(
    createHookState({
      isEdit: false,
      errors: { date: 'Date is required.' },
    }),
  );

  const screen = render(
    <FoalingRecordFormScreen
      navigation={navigation as never}
      route={{
        key: 'FoalingRecordForm',
        name: 'FoalingRecordForm',
        params: { mareId: 'mare-1' },
      } as never}
    />,
  );

  expect(screen.getByText('Date is required.')).toBeTruthy();
});
