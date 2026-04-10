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

jest.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: jest.fn(),
}));

const { DashboardScreen } = require('@/screens/DashboardScreen') as typeof import('@/screens/DashboardScreen');
const { useDashboardData } = jest.requireMock('@/hooks/useDashboardData') as {
  useDashboardData: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

const alert = {
  kind: 'pregnancyCheckNeeded' as const,
  priority: 'high' as const,
  mareId: 'mare-1',
  mareName: 'Nova',
  title: 'Day 15 post-breeding',
  subtitle: 'Preg check due',
  sortKey: -15,
};

function buildState(overrides: Record<string, unknown> = {}) {
  const reload = jest.fn().mockResolvedValue(undefined);
  return {
    totalMares: 3,
    pregnantMares: 1,
    totalStallions: 2,
    alerts: [alert],
    isLoading: false,
    error: null,
    reload,
    reloadIfStale: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders stat cards and expanded alerts', () => {
  const navigation = createNavigation();
  const reloadIfStale = jest.fn().mockResolvedValue(undefined);
  useDashboardData.mockReturnValue(buildState({ reloadIfStale }));

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  expect(screen.getByLabelText('3 Mares')).toBeTruthy();
  expect(screen.getByLabelText('1 Pregnant')).toBeTruthy();
  expect(screen.getByLabelText('2 Stallions')).toBeTruthy();
  expect(screen.getByText("Today's Tasks")).toBeTruthy();
  expect(screen.getByText('Day 15 post-breeding')).toBeTruthy();
  expect(reloadIfStale).toHaveBeenCalledTimes(1);
});

it('navigates from stat cards and alert taps', () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(buildState());

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  fireEvent.press(screen.getByLabelText('3 Mares'));
  expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', {
    screen: 'Mares',
    params: expect.objectContaining({ initialFilter: 'all' }),
  });

  fireEvent.press(screen.getByLabelText('1 Pregnant'));
  expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', {
    screen: 'Mares',
    params: expect.objectContaining({ initialFilter: 'pregnant' }),
  });

  fireEvent.press(screen.getByLabelText('2 Stallions'));
  expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', { screen: 'Stallions' });

  fireEvent.press(screen.getByText('Day 15 post-breeding'));
  expect(navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', { mareId: 'mare-1' });
});

it('shows the first-time empty state when there are no animals', () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      alerts: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  expect(screen.getByText('Welcome to BreedWise')).toBeTruthy();
  expect(screen.getByText(/mare and stallion recordkeeping/)).toBeTruthy();
  expect(screen.getByText('What you can track')).toBeTruthy();
});

it('navigates from first-time action cards', () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      alerts: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  fireEvent.press(screen.getByLabelText('Add a Mare'));
  expect(navigation.navigate).toHaveBeenCalledWith('EditMare');

  fireEvent.press(screen.getByLabelText('Add a Stallion'));
  expect(navigation.navigate).toHaveBeenCalledWith('StallionForm', {});
});

it('shows the all caught up state when there are no alerts', () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      alerts: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  expect(screen.getByText('All caught up! No tasks today.')).toBeTruthy();
});

it('shows hook-level load errors', () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      error: 'Failed to load dashboard data.',
      alerts: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  expect(screen.getByText('Failed to load dashboard data.')).toBeTruthy();
});
