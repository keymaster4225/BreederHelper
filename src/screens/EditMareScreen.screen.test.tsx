import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createMare: jest.fn(),
  getMareById: jest.fn(),
  softDeleteMare: jest.fn(),
  updateMare: jest.fn(),
}));

const { EditMareScreen } = require('@/screens/EditMareScreen') as typeof import('@/screens/EditMareScreen');
const { createMare, getMareById, updateMare } = jest.requireMock('@/storage/repositories') as {
  createMare: jest.Mock;
  getMareById: jest.Mock;
  updateMare: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('loads an existing mare and saves updates', async () => {
  const navigation = createNavigation();
  getMareById.mockResolvedValue({
    id: 'mare-1',
    name: 'Nova',
    breed: 'Warmblood',
    gestationLengthDays: 345,
    dateOfBirth: '2016-02-14',
    registrationNumber: 'REG-123',
    notes: 'Steady temperament',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  });
  updateMare.mockResolvedValue(undefined);

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => {
    expect(getMareById).toHaveBeenCalledWith('mare-1');
  });

  await screen.findByDisplayValue('Warmblood');
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateMare).toHaveBeenCalledWith(
      'mare-1',
      expect.objectContaining({
        name: 'Nova',
        breed: 'Warmblood',
        gestationLengthDays: 345,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

it('filters breed suggestions and saves a selected breed on create', async () => {
  const navigation = createNavigation();
  createMare.mockResolvedValue(undefined);

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: undefined } as never}
    />,
  );

  fireEvent.changeText(screen.getByPlaceholderText('Mare name'), 'Luna');
  fireEvent.changeText(screen.getByPlaceholderText('Type or select breed'), 'warm');
  fireEvent.press(await screen.findByText('Warmblood'));
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(createMare).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Luna',
        breed: 'Warmblood',
        gestationLengthDays: 340,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

it('saves a custom typed breed for a mare', async () => {
  const navigation = createNavigation();
  createMare.mockResolvedValue(undefined);

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: undefined } as never}
    />,
  );

  fireEvent.changeText(screen.getByPlaceholderText('Mare name'), 'Nova');
  fireEvent.changeText(screen.getByPlaceholderText('Type or select breed'), 'Spanish Barb Cross');
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(createMare).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nova',
        breed: 'Spanish Barb Cross',
        gestationLengthDays: 340,
      }),
    );
  });
});

it('requires a breed for mares', () => {
  const navigation = createNavigation();

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: undefined } as never}
    />,
  );

  fireEvent.changeText(screen.getByPlaceholderText('Mare name'), 'Nova');
  fireEvent.press(screen.getByText('Save'));

  expect(createMare).not.toHaveBeenCalled();
  expect(screen.getByText('Breed is required.')).toBeTruthy();
});

it('requires gestation length to stay within the supported whole-number range', () => {
  const navigation = createNavigation();

  const screen = render(
    <EditMareScreen
      navigation={navigation as never}
      route={{ key: 'EditMare', name: 'EditMare', params: undefined } as never}
    />,
  );

  fireEvent.changeText(screen.getByPlaceholderText('Mare name'), 'Nova');
  fireEvent.changeText(screen.getByPlaceholderText('Type or select breed'), 'Warmblood');
  fireEvent.changeText(screen.getByDisplayValue('340'), '299');
  fireEvent.press(screen.getByText('Save'));

  expect(createMare).not.toHaveBeenCalled();
  expect(screen.getByText('Gestation length must be between 300 and 420.')).toBeTruthy();
});
