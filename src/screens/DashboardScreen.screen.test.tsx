import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

jest.mock('@/utils/devSeed', () => ({
  seedPreviewData: jest.fn(),
}));

jest.mock('@/utils/buildProfile', () => ({
  canSeedPreviewData: jest.fn(),
}));

jest.mock('@/utils/onboarding', () => ({
  getOnboardingComplete: jest.fn(),
  setOnboardingComplete: jest.fn(),
}));

const { DashboardScreen } = require('@/screens/DashboardScreen') as typeof import('@/screens/DashboardScreen');
const { useDashboardData } = jest.requireMock('@/hooks/useDashboardData') as {
  useDashboardData: jest.Mock;
};
const { seedPreviewData } = jest.requireMock('@/utils/devSeed') as {
  seedPreviewData: jest.Mock;
};
const { canSeedPreviewData } = jest.requireMock('@/utils/buildProfile') as {
  canSeedPreviewData: jest.Mock;
};
const onboardingStorage = jest.requireMock('@/utils/onboarding') as {
  getOnboardingComplete: jest.Mock;
  setOnboardingComplete: jest.Mock;
};
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

const dashboardTask = {
  id: 'task-1',
  mareId: 'mare-1',
  taskType: 'pregnancyCheck' as const,
  title: 'Pregnancy check',
  dueDate: '2035-04-27' as const,
  dueTime: null,
  notes: null,
  status: 'open' as const,
  completedAt: null,
  completedRecordType: null,
  completedRecordId: null,
  sourceType: 'breedingRecord' as const,
  sourceRecordId: 'breed-1',
  sourceReason: 'breedingPregnancyCheck' as const,
  createdAt: '2026-04-13T00:00:00.000Z',
  updatedAt: '2026-04-13T00:00:00.000Z',
  mareName: 'Nova',
};

function buildState(overrides: Record<string, unknown> = {}) {
  const reload = jest.fn().mockResolvedValue(undefined);
  return {
    totalMares: 3,
    pregnantMares: 1,
    totalStallions: 2,
    tasks: [dashboardTask],
    isLoading: false,
    error: null,
    reload,
    reloadIfStale: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  onboardingStorage.getOnboardingComplete.mockResolvedValue(true);
  onboardingStorage.setOnboardingComplete.mockResolvedValue(undefined);
  canSeedPreviewData.mockReturnValue(false);
});

it('renders stat cards and dashboard tasks', async () => {
  const navigation = createNavigation();
  const reloadIfStale = jest.fn().mockResolvedValue(undefined);
  useDashboardData.mockReturnValue(buildState({ reloadIfStale }));

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => {
    expect(screen.getByLabelText('3 Mares')).toBeTruthy();
    expect(screen.getByLabelText('1 Pregnant')).toBeTruthy();
    expect(screen.getByLabelText('2 Stallions')).toBeTruthy();
    expect(screen.getByText("Today's Tasks")).toBeTruthy();
    expect(screen.getByText('Pregnancy check')).toBeTruthy();
    expect(screen.getByText('Nova - 2035-04-27')).toBeTruthy();
  });
  expect(reloadIfStale).toHaveBeenCalledTimes(1);
});

it('navigates from stat cards', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(buildState());

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByLabelText('3 Mares')).toBeTruthy());

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
});

it('shows the onboarding carousel when there are no animals and onboarding is incomplete', async () => {
  const navigation = createNavigation();
  onboardingStorage.getOnboardingComplete.mockResolvedValue(false);
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => {
    expect(screen.getByText('Welcome to BreedWise')).toBeTruthy();
    expect(screen.getByText('Swipe to learn more')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
    expect(screen.queryByText('Offline-first breeding records')).toBeNull();
  });
});

it('shows local sample data action during onboarding when enabled', async () => {
  const navigation = createNavigation();
  const reload = jest.fn().mockResolvedValue(undefined);
  onboardingStorage.getOnboardingComplete.mockResolvedValue(false);
  canSeedPreviewData.mockReturnValue(true);
  seedPreviewData.mockResolvedValue('inserted');
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
      reload,
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'Load sample data' })).toBeTruthy());

  fireEvent.press(screen.getByRole('button', { name: 'Load sample data' }));

  await waitFor(() => {
    expect(seedPreviewData).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onboardingStorage.setOnboardingComplete).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Sample Data', 'Sample mares, stallions, and records are ready.');
  });
});

it('shows the empty dashboard when onboarding is complete', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => {
    expect(screen.getByLabelText('Add a Mare')).toBeTruthy();
    expect(screen.getByText('Get started')).toBeTruthy();
  });
  expect(screen.queryByText('Skip')).toBeNull();
});

it('dismisses onboarding when skip is pressed', async () => {
  const navigation = createNavigation();
  onboardingStorage.getOnboardingComplete.mockResolvedValue(false);
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByText('Skip')).toBeTruthy());

  fireEvent.press(screen.getByText('Skip'));

  await waitFor(() => {
    expect(screen.getByLabelText('Add a Mare')).toBeTruthy();
    expect(screen.queryByText('Skip')).toBeNull();
  });
  expect(onboardingStorage.setOnboardingComplete).toHaveBeenCalledTimes(1);
});

it('dismisses onboarding even if the completion write fails', async () => {
  const navigation = createNavigation();
  onboardingStorage.getOnboardingComplete.mockResolvedValue(false);
  onboardingStorage.setOnboardingComplete.mockRejectedValue(new Error('write failed'));
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByText('Skip')).toBeTruthy());
  fireEvent.press(screen.getByText('Skip'));

  await waitFor(() => expect(screen.getByLabelText('Add a Mare')).toBeTruthy());
});

it('falls back to the empty dashboard when onboarding state cannot be read', async () => {
  const navigation = createNavigation();
  onboardingStorage.getOnboardingComplete.mockRejectedValue(new Error('read failed'));
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => {
    expect(screen.getByLabelText('Add a Mare')).toBeTruthy();
    expect(screen.queryByText('Skip')).toBeNull();
  });
});

it('navigates from empty-dashboard action cards', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      totalMares: 0,
      totalStallions: 0,
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByLabelText('Add a Mare')).toBeTruthy());

  fireEvent.press(screen.getByLabelText('Add a Mare'));
  expect(navigation.navigate).toHaveBeenCalledWith('EditMare');

  fireEvent.press(screen.getByLabelText('Add a Stallion'));
  expect(navigation.navigate).toHaveBeenCalledWith('StallionForm', {});
});

it('auto-completes onboarding when animals already exist', async () => {
  const navigation = createNavigation();
  onboardingStorage.getOnboardingComplete.mockResolvedValue(false);
  useDashboardData.mockReturnValue(buildState());

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByLabelText('3 Mares')).toBeTruthy());
  expect(onboardingStorage.setOnboardingComplete).toHaveBeenCalledTimes(1);
});

it('shows the all caught up state when there are no tasks', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByText('All caught up! No tasks due soon.')).toBeTruthy());
});

it('shows hook-level load errors', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      error: 'Failed to load dashboard data.',
      tasks: [],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByText('Failed to load dashboard data.')).toBeTruthy());
});
