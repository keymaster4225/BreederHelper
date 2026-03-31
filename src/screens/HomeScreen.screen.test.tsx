import { fireEvent, render } from '@testing-library/react-native';

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

const { HomeScreen } = require('@/screens/HomeScreen') as typeof import('@/screens/HomeScreen');
const { useHomeScreenData } = jest.requireMock('@/hooks/useHomeScreenData') as {
  useHomeScreenData: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
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
    dashboardAlerts: [],
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

  const screen = render(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

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
  screen.rerender(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

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
  screen.rerender(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

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

  const screen = render(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

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
  screen.rerender(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

  fireEvent.press(screen.getByText('Delete'));
  expect(onDeleteMare).toHaveBeenCalledWith(openMare);
});

it('routes alert taps to the expected destination', () => {
  const navigation = createNavigation();

  useHomeScreenData.mockReturnValue(
    buildState({
      mares: [openMare],
      filteredMares: [openMare],
      pregnantInfo: new Map(),
      dashboardAlerts: [
        {
          kind: 'pregnancyCheckNeeded',
          priority: 'high',
          mareId: openMare.id,
          mareName: openMare.name,
          title: 'Day 15 post-breeding',
          subtitle: 'Preg check due',
          sortKey: -15,
        },
      ],
    }),
  );

  const screen = render(<HomeScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />);

  fireEvent.press(screen.getByText("Today's Tasks"));
  fireEvent.press(screen.getByText('Day 15 post-breeding'));

  expect(navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', { mareId: openMare.id });
});
