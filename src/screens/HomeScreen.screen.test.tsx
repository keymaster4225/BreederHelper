import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

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

jest.mock('@/hooks/useHomeScreenData', () => ({
  useHomeScreenData: jest.fn(),
}));

jest.mock('@/utils/devSeed', () => ({
  seedPreviewData: jest.fn(),
}));

jest.mock('@/utils/buildProfile', () => ({
  isPreviewBuild: jest.fn(),
}));

const { HomeScreen } = require('@/screens/HomeScreen') as typeof import('@/screens/HomeScreen');
const { useHomeScreenData } = jest.requireMock('@/hooks/useHomeScreenData') as {
  useHomeScreenData: jest.Mock;
};
const { seedPreviewData } = jest.requireMock('@/utils/devSeed') as {
  seedPreviewData: jest.Mock;
};
const { isPreviewBuild } = jest.requireMock('@/utils/buildProfile') as {
  isPreviewBuild: jest.Mock;
};
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

function createNavigation() {
  return {
    navigate: jest.fn(),
    setParams: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

const pregnantMare = {
  id: 'mare-1',
  name: 'Nova',
  breed: 'Warmblood',
  dateOfBirth: '2015-01-01',
  registrationNumber: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const openMare = {
  id: 'mare-2',
  name: 'Maple',
  breed: 'Quarter Horse',
  dateOfBirth: '2016-02-02',
  registrationNumber: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function buildState(overrides: Record<string, unknown> = {}) {
  return {
    mares: [pregnantMare, openMare],
    isLoading: false,
    error: null,
    selectedMareId: null,
    pregnantInfo: new Map([
      [
        pregnantMare.id,
        {
          daysPostOvulation: 340,
          estimatedDueDate: '2026-04-10',
        },
      ],
    ]),
    searchText: '',
    statusFilter: 'all',
    filteredMares: [pregnantMare, openMare],
    loadMares: jest.fn().mockResolvedValue(undefined),
    onDeleteMare: jest.fn(),
    setSelectedMareId: jest.fn(),
    setSearchText: jest.fn(),
    setStatusFilter: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  isPreviewBuild.mockReturnValue(false);
});

it('loads dashboard, search, and filter state correctly', () => {
  const setSearchText = jest.fn();
  const setStatusFilter = jest.fn();
  const loadMares = jest.fn().mockResolvedValue(undefined);
  const setSelectedMareId = jest.fn();
  const navigation = createNavigation();

  useHomeScreenData.mockReturnValue(
    buildState({
      loadMares,
      setSelectedMareId,
      setSearchText,
      setStatusFilter,
    }),
  );

  const screen = render(
    <HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />,
  );

  expect(screen.getByText('Nova')).toBeTruthy();
  expect(screen.getByText('Maple')).toBeTruthy();
  expect(screen.getAllByText('Pregnant').length).toBeGreaterThan(0);
  expect(loadMares).toHaveBeenCalled();

  fireEvent.changeText(screen.getByPlaceholderText('Search mares...'), 'map');
  expect(setSearchText).toHaveBeenCalledWith('map');

  useHomeScreenData.mockReturnValue(
    buildState({
      loadMares,
      setSelectedMareId,
      setSearchText,
      setStatusFilter,
      searchText: 'map',
      filteredMares: [openMare],
    }),
  );
  screen.rerender(<HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />);

  expect(screen.queryByText('Nova')).toBeNull();
  expect(screen.getByText('Maple')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Clear search'));
  expect(setSearchText).toHaveBeenCalledWith('');

  fireEvent.press(screen.getByRole('button', { name: 'Open' }));
  expect(setStatusFilter).toHaveBeenCalledWith('open');

  useHomeScreenData.mockReturnValue(
    buildState({
      loadMares,
      setSelectedMareId,
      setSearchText,
      setStatusFilter,
      statusFilter: 'open',
      filteredMares: [openMare],
    }),
  );
  screen.rerender(<HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />);

  expect(screen.queryByText('Nova')).toBeNull();
  expect(screen.getByText('Maple')).toBeTruthy();
});

it('refreshes the list after deleting a mare', () => {
  const setSelectedMareId = jest.fn();
  const onDeleteMare = jest.fn();
  const navigation = createNavigation();

  useHomeScreenData.mockReturnValue(
    buildState({
      setSelectedMareId,
      onDeleteMare,
    }),
  );

  const screen = render(
    <HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />,
  );

  setSelectedMareId.mockClear();
  fireEvent(screen.getByText('Maple'), 'longPress');
  expect(setSelectedMareId).toHaveBeenCalledWith(openMare.id);

  useHomeScreenData.mockReturnValue(
    buildState({
      selectedMareId: openMare.id,
      setSelectedMareId,
      onDeleteMare,
    }),
  );
  screen.rerender(<HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />);

  fireEvent.press(screen.getByText('Delete'));
  expect(onDeleteMare).toHaveBeenCalledWith(openMare);
});

it('applies initialFilter from route params and clears them', () => {
  const navigation = createNavigation();
  const setStatusFilter = jest.fn();

  useHomeScreenData.mockReturnValue(
    buildState({
      setStatusFilter,
    }),
  );

  render(
    <HomeScreen
      navigation={navigation as never}
      route={{
        key: 'Mares',
        name: 'Mares',
        params: { initialFilter: 'pregnant', requestKey: 'request-1' },
      } as never}
    />,
  );

  expect(setStatusFilter).toHaveBeenCalledWith('pregnant');
  expect(navigation.setParams).toHaveBeenCalledWith({ initialFilter: undefined, requestKey: undefined });
});

it('does not re-apply the filter when requestKey is unchanged', () => {
  const navigation = createNavigation();
  const setStatusFilter = jest.fn();

  useHomeScreenData.mockReturnValue(
    buildState({
      setStatusFilter,
    }),
  );

  const route = {
    key: 'Mares',
    name: 'Mares',
    params: { initialFilter: 'pregnant', requestKey: 'request-1' },
  } as never;

  const screen = render(<HomeScreen navigation={navigation as never} route={route} />);

  expect(setStatusFilter).toHaveBeenCalledTimes(1);
  expect(navigation.setParams).toHaveBeenCalledTimes(1);

  screen.rerender(<HomeScreen navigation={navigation as never} route={route} />);

  expect(setStatusFilter).toHaveBeenCalledTimes(1);
  expect(navigation.setParams).toHaveBeenCalledTimes(1);
});

it('shows the preview seed button on the empty state only for preview builds', () => {
  const navigation = createNavigation();
  isPreviewBuild.mockReturnValue(true);

  useHomeScreenData.mockReturnValue(
    buildState({
      mares: [],
      filteredMares: [],
    }),
  );

  const screen = render(
    <HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />,
  );

  expect(screen.getByRole('button', { name: 'Seed preview data' })).toBeTruthy();
});

it('seeds preview data from the populated mares screen', async () => {
  const navigation = createNavigation();
  const loadMares = jest.fn().mockResolvedValue(undefined);
  isPreviewBuild.mockReturnValue(true);
  seedPreviewData.mockResolvedValue('inserted');

  useHomeScreenData.mockReturnValue(
    buildState({
      loadMares,
    }),
  );

  const screen = render(
    <HomeScreen navigation={navigation as never} route={{ key: 'Mares', name: 'Mares' } as never} />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Seed preview data' }));

  expect(seedPreviewData).toHaveBeenCalled();
  await waitFor(() => {
    expect(loadMares).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Preview Data', 'Preview sample data is ready.');
  });
});
