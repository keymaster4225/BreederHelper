import { render, waitFor } from '@testing-library/react-native';

import { CollectionFormScreen } from '@/screens/CollectionFormScreen';

jest.mock('@/storage/repositories', () => ({
  getSemenCollectionById: jest.fn(),
  createSemenCollection: jest.fn(),
  updateSemenCollection: jest.fn(),
  deleteSemenCollection: jest.fn(),
  getStallionById: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  repositories.getSemenCollectionById.mockResolvedValue(null);
  repositories.getStallionById.mockResolvedValue({
    id: 'st-1',
    name: 'Thunder',
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
});

function renderForm(params: { stallionId: string; collectionId?: string } = { stallionId: 'st-1' }) {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() };
  return {
    navigation,
    ...render(
      <CollectionFormScreen
        navigation={navigation as never}
        route={{ key: 'CollectionForm', name: 'CollectionForm', params } as never}
      />,
    ),
  };
}

it('renders all form fields in create mode', async () => {
  const screen = renderForm();
  await waitFor(() => {
    expect(screen.getByText('Collection Date *')).toBeTruthy();
    expect(screen.getByText('Raw Volume (mL)')).toBeTruthy();
    expect(screen.getByText('Total Volume (mL)')).toBeTruthy();
    expect(screen.getByText('Extender Volume (mL)')).toBeTruthy();
    expect(screen.getByText('Extender Type')).toBeTruthy();
    expect(screen.getByText('Concentration (M/mL)')).toBeTruthy();
    expect(screen.getByText('Progressive Motility (%)')).toBeTruthy();
    expect(screen.getByText('Dose Count')).toBeTruthy();
    expect(screen.getByText('Dose Size (millions)')).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
  });
});

it('does not show the legacy extended volume label', async () => {
  const screen = renderForm();
  await waitFor(() => {
    expect(screen.queryByText('Extended Volume (mL)')).toBeNull();
  });
});

it('does not show legacy shipping controls', () => {
  const screen = renderForm();
  expect(screen.queryByText('Shipped To *')).toBeNull();
  expect(screen.queryByText('Semen was shipped')).toBeNull();
});

it('does not show delete button in create mode', () => {
  const screen = renderForm();
  expect(screen.queryByText('Delete Collection')).toBeNull();
});

it('shows delete button in edit mode', async () => {
  repositories.getSemenCollectionById.mockResolvedValue({
    id: 'col-1',
    stallionId: 'st-1',
    collectionDate: '2026-04-01',
    rawVolumeMl: 50,
    totalVolumeMl: 450,
    extenderVolumeMl: 400,
    extenderType: 'INRA 96',
    concentrationMillionsPerMl: null,
    progressiveMotilityPercent: 75,
    doseCount: null,
    doseSizeMillions: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const screen = renderForm({ stallionId: 'st-1', collectionId: 'col-1' });
  await waitFor(() => expect(screen.getByText('Delete Collection')).toBeTruthy());
});
