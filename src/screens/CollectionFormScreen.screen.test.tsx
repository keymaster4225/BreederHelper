import { render, waitFor } from '@testing-library/react-native';

import { CollectionFormScreen } from '@/screens/CollectionFormScreen';

jest.mock('@/storage/repositories', () => ({
  getSemenCollectionById: jest.fn(),
  updateSemenCollection: jest.fn(),
  deleteSemenCollection: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  repositories.getSemenCollectionById.mockResolvedValue({
    id: 'col-1',
    stallionId: 'st-1',
    collectionDate: '2026-04-01',
    rawVolumeMl: 100,
    extenderType: 'INRA 96',
    concentrationMillionsPerMl: 200,
    progressiveMotilityPercent: 50,
    targetMotileSpermMillionsPerDose: 500,
    targetPostExtensionConcentrationMillionsPerMl: 100,
    notes: 'Collection note',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
});

function renderForm(
  params: { stallionId: string; collectionId: string } = {
    stallionId: 'st-1',
    collectionId: 'col-1',
  },
) {
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

it('renders updated collection fields and derived plan panel', async () => {
  const screen = renderForm();
  await waitFor(() => {
    expect(screen.navigation.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edit Collection' }),
    );
    expect(screen.getByText('Collection Date *')).toBeTruthy();
    expect(screen.getByText('Total Volume (mL)')).toBeTruthy();
    expect(screen.getByText('Concentration (M/mL, raw)')).toBeTruthy();
    expect(screen.getByText('Progressive Motility (%)')).toBeTruthy();
    expect(screen.getByText('Target motile sperm / dose (M)')).toBeTruthy();
    expect(
      screen.getByText('Target post-extension concentration (M motile/mL)'),
    ).toBeTruthy();
    expect(screen.getByText('Derived Plan')).toBeTruthy();
    expect(screen.getByText('Semen Per Dose')).toBeTruthy();
    expect(screen.getByText('Extender Per Dose')).toBeTruthy();
  });
});

it('does not show removed legacy collection fields', async () => {
  const screen = renderForm();
  await waitFor(() => {
    expect(screen.queryByText('Total Volume (mL)')).toBeTruthy();
  });

  expect(screen.queryByText('Extender Volume (mL)')).toBeNull();
  expect(screen.queryByText('Dose Count')).toBeNull();
  expect(screen.queryByText('Dose Size (millions)')).toBeNull();
});

it('shows delete button in edit mode', async () => {
  const screen = renderForm();
  await waitFor(() => expect(screen.getByText('Delete Collection')).toBeTruthy());
});
