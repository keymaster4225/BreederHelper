import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/hooks/useEditMareForm', () => ({
  useEditMareForm: jest.fn(),
}));

const { EditMareScreen } = require('@/screens/EditMareScreen') as typeof import('@/screens/EditMareScreen');
const { useEditMareForm } = jest.requireMock('@/hooks/useEditMareForm') as {
  useEditMareForm: jest.Mock;
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
    isEdit: false,
    today: new Date('2026-04-23T12:00:00Z'),
    name: '',
    isRecipient: false,
    breed: '',
    gestationLengthDays: '340',
    dateOfBirth: '',
    registrationNumber: '',
    notes: '',
    errors: {},
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    setName: jest.fn(),
    setIsRecipient: jest.fn(),
    setBreed: jest.fn(),
    setGestationLengthDays: jest.fn(),
    setDateOfBirth: jest.fn(),
    setRegistrationNumber: jest.fn(),
    setNotes: jest.fn(),
    onSave: jest.fn(),
    requestDelete: jest.fn(),
    profilePhoto: {
      enabled: false,
      ownerId: 'mare-1',
      photoUri: null,
      existingPhoto: null,
      isProcessing: false,
      error: null,
      hasStagedChange: false,
      takePhoto: jest.fn(),
      choosePhoto: jest.fn(),
      removePhoto: jest.fn(),
      prepareForSave: jest.fn(),
      markSaveCommitted: jest.fn(),
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders edit-mode values and wires save/delete actions to the hook', () => {
  const navigation = createNavigation();
  const hookState = createHookState({
    isEdit: true,
    name: 'Nova',
    breed: 'Warmblood',
    gestationLengthDays: '345',
    dateOfBirth: '2016-02-14',
    registrationNumber: 'REG-123',
    notes: 'Steady temperament',
    isRecipient: true,
  });
  useEditMareForm.mockReturnValue(hookState);

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: { mareId: 'mare-1' } } as never}
    />,
  );

  expect(screen.getByDisplayValue('Nova')).toBeTruthy();
  expect(screen.getByDisplayValue('Warmblood')).toBeTruthy();
  expect(screen.getByDisplayValue('345')).toBeTruthy();
  expect(screen.getByDisplayValue('REG-123')).toBeTruthy();
  expect(screen.getByDisplayValue('Steady temperament')).toBeTruthy();
  expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(true);

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Delete Mare'));

  expect(hookState.onSave).toHaveBeenCalled();
  expect(hookState.requestDelete).toHaveBeenCalled();
});

it('renders validation errors and forwards field edits in create mode', () => {
  const navigation = createNavigation();
  const hookState = createHookState({
    errors: {
      breed: 'Breed is required.',
      gestationLengthDays: 'Gestation length must be between 300 and 420.',
    },
  });
  useEditMareForm.mockReturnValue(hookState);

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: undefined } as never}
    />,
  );

  fireEvent.changeText(screen.getByPlaceholderText('Mare name'), 'Luna');
  fireEvent.changeText(screen.getByPlaceholderText('Type or select breed'), 'Spanish Barb');
  fireEvent.changeText(screen.getByDisplayValue('340'), '299');
  fireEvent.press(screen.getByRole('checkbox'));
  fireEvent.press(screen.getByText('Save'));

  expect(hookState.setName).toHaveBeenCalledWith('Luna');
  expect(hookState.setBreed).toHaveBeenCalledWith('Spanish Barb');
  expect(hookState.setGestationLengthDays).toHaveBeenCalledWith('299');
  expect(hookState.setIsRecipient).toHaveBeenCalledWith(true);
  expect(hookState.onSave).toHaveBeenCalled();
  expect(screen.getByText('Breed is required.')).toBeTruthy();
  expect(screen.getByText('Gestation length must be between 300 and 420.')).toBeTruthy();
});

it('renders profile photo controls when photos are enabled', () => {
  const navigation = createNavigation();
  const profilePhoto = {
    enabled: true,
    ownerId: 'mare-1',
    photoUri: 'file:///photo.jpg',
    existingPhoto: null,
    isProcessing: false,
    error: null,
    hasStagedChange: true,
    takePhoto: jest.fn(),
    choosePhoto: jest.fn(),
    removePhoto: jest.fn(),
    prepareForSave: jest.fn(),
    markSaveCommitted: jest.fn(),
  };
  useEditMareForm.mockReturnValue(createHookState({ name: 'Nova', profilePhoto }));

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: undefined } as never}
    />,
  );

  fireEvent.press(screen.getByText('Camera'));
  fireEvent.press(screen.getByText('Library'));
  fireEvent.press(screen.getByLabelText('Remove profile photo'));

  expect(profilePhoto.takePhoto).toHaveBeenCalled();
  expect(profilePhoto.choosePhoto).toHaveBeenCalled();
  expect(profilePhoto.removePhoto).toHaveBeenCalled();
});
