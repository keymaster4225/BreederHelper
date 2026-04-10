import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createMare: jest.fn(),
  getMareById: jest.fn(),
  softDeleteMare: jest.fn(),
  updateMare: jest.fn(),
}));

const { EditMareScreen } = require('@/screens/EditMareScreen') as typeof import('@/screens/EditMareScreen');
const { getMareById, updateMare } = jest.requireMock('@/storage/repositories') as {
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

  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateMare).toHaveBeenCalledWith(
      'mare-1',
      expect.objectContaining({
        name: 'Nova',
        breed: 'Warmblood',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
