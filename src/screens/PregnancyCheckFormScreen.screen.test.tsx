import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/hooks/usePregnancyCheckForm', () => ({
  usePregnancyCheckForm: jest.fn(),
}));

const { PregnancyCheckFormScreen } = require('@/screens/PregnancyCheckFormScreen') as typeof import('@/screens/PregnancyCheckFormScreen');
const { usePregnancyCheckForm } = jest.requireMock('@/hooks/usePregnancyCheckForm') as {
  usePregnancyCheckForm: jest.Mock;
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
    breedingRecords: [{ id: 'br-1', date: '2026-03-20', stallionName: 'Atlas', method: 'liveCover' }],
    breedingRecordId: 'br-1',
    date: '2026-04-04',
    result: 'positive',
    heartbeat: 'yes',
    notes: '',
    errors: {},
    daysPostBreeding: 15,
    approxDueDate: '2027-02-03',
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    setBreedingRecordId: jest.fn(),
    setDate: jest.fn(),
    setResult: jest.fn(),
    setHeartbeat: jest.fn(),
    setNotes: jest.fn(),
    onSave: jest.fn(),
    onSaveAndAddFollowUp: jest.fn(),
    requestDelete: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders derived pregnancy context and wires save/delete actions', () => {
  const navigation = createNavigation();
  const hookState = createHookState();
  usePregnancyCheckForm.mockReturnValue(hookState);

  const screen = render(
    <PregnancyCheckFormScreen
      navigation={navigation as never}
      route={{
        key: 'PregnancyCheckForm',
        name: 'PregnancyCheckForm',
        params: { mareId: 'mare-1', pregnancyCheckId: 'pc-1' },
      } as never}
    />,
  );

  expect(screen.getByText('Days post-breeding: 15')).toBeTruthy();
  expect(screen.getByText('Approx. due date: 02-03-2027')).toBeTruthy();
  expect(screen.getByText('Save & Add Follow-up')).toBeTruthy();

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Save & Add Follow-up'));
  fireEvent.press(screen.getByText('Delete'));

  expect(hookState.onSave).toHaveBeenCalled();
  expect(hookState.onSaveAndAddFollowUp).toHaveBeenCalled();
  expect(hookState.requestDelete).toHaveBeenCalled();
});

it('shows the empty breeding-record state and keeps the save action disabled', () => {
  const navigation = createNavigation();
  const hookState = createHookState({
    isEdit: false,
    breedingRecords: [],
    breedingRecordId: '',
    approxDueDate: null,
    daysPostBreeding: null,
  });
  usePregnancyCheckForm.mockReturnValue(hookState);

  const screen = render(
    <PregnancyCheckFormScreen
      navigation={navigation as never}
      route={{
        key: 'PregnancyCheckForm',
        name: 'PregnancyCheckForm',
        params: { mareId: 'mare-1' },
      } as never}
    />,
  );

  expect(screen.getByText('No breeding records')).toBeTruthy();
  expect(screen.getByText('Add a breeding record for this mare first.')).toBeTruthy();
  expect(screen.getByText('Save & Add Follow-up')).toBeTruthy();

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Save & Add Follow-up'));

  expect(hookState.onSave).not.toHaveBeenCalled();
  expect(hookState.onSaveAndAddFollowUp).not.toHaveBeenCalled();
});
