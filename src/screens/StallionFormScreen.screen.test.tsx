import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/hooks/useStallionForm', () => ({
  useStallionForm: jest.fn(),
}));

const { StallionFormScreen } = require('@/screens/StallionFormScreen') as typeof import('@/screens/StallionFormScreen');
const { useStallionForm } = jest.requireMock('@/hooks/useStallionForm') as {
  useStallionForm: jest.Mock;
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
    dateOfBirth: '',
    breed: '',
    registrationNumber: '',
    sire: '',
    dam: '',
    notes: '',
    errors: {},
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    setName: jest.fn(),
    setDateOfBirth: jest.fn(),
    setBreed: jest.fn(),
    setRegistrationNumber: jest.fn(),
    setSire: jest.fn(),
    setDam: jest.fn(),
    setNotes: jest.fn(),
    onSave: jest.fn(),
    requestDelete: jest.fn(),
    profilePhoto: {
      enabled: false,
      ownerId: 'stallion-1',
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

it('renders edit-mode values and wires update/delete actions to the hook', () => {
  const navigation = createNavigation();
  const hookState = createHookState({
    isEdit: true,
    name: 'Atlas',
    dateOfBirth: '2014-03-10',
    breed: 'Warmblood',
    registrationNumber: 'ST-001',
  });
  useStallionForm.mockReturnValue(hookState);

  const screen = render(
    <StallionFormScreen
      navigation={navigation as never}
      route={{ key: 'StallionForm', name: 'StallionForm', params: { stallionId: 'stallion-1' } } as never}
    />,
  );

  expect(screen.getByDisplayValue('Atlas')).toBeTruthy();
  expect(screen.getByDisplayValue('Warmblood')).toBeTruthy();
  expect(screen.getByDisplayValue('ST-001')).toBeTruthy();

  fireEvent.press(screen.getByText('Update Stallion'));
  fireEvent.press(screen.getByText('Delete Stallion'));

  expect(hookState.onSave).toHaveBeenCalled();
  expect(hookState.requestDelete).toHaveBeenCalled();
});

it('renders create-mode errors and forwards user input to the hook setters', () => {
  const navigation = createNavigation();
  const hookState = createHookState({
    errors: { name: 'Name is required.' },
  });
  useStallionForm.mockReturnValue(hookState);

  const screen = render(
    <StallionFormScreen
      navigation={navigation as never}
      route={{ key: 'StallionForm', name: 'StallionForm', params: undefined } as never}
    />,
  );

  fireEvent.changeText(screen.getByPlaceholderText('Stallion name'), 'Atlas');
  fireEvent.changeText(screen.getByPlaceholderText('Type or select breed'), 'Warmblood');
  fireEvent.press(screen.getByText('Add Stallion'));

  expect(hookState.setName).toHaveBeenCalledWith('Atlas');
  expect(hookState.setBreed).toHaveBeenCalledWith('Warmblood');
  expect(hookState.onSave).toHaveBeenCalled();
  expect(screen.getByText('Name is required.')).toBeTruthy();
});

it('renders profile photo controls when photos are enabled', () => {
  const navigation = createNavigation();
  const profilePhoto = {
    enabled: true,
    ownerId: 'stallion-1',
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
  useStallionForm.mockReturnValue(createHookState({ name: 'Atlas', profilePhoto }));

  const screen = render(
    <StallionFormScreen
      navigation={navigation as never}
      route={{ key: 'StallionForm', name: 'StallionForm', params: undefined } as never}
    />,
  );

  fireEvent.press(screen.getByText('Camera'));
  fireEvent.press(screen.getByText('Library'));
  fireEvent.press(screen.getByLabelText('Remove profile photo'));

  expect(profilePhoto.takePhoto).toHaveBeenCalled();
  expect(profilePhoto.choosePhoto).toHaveBeenCalled();
  expect(profilePhoto.removePhoto).toHaveBeenCalled();
});
