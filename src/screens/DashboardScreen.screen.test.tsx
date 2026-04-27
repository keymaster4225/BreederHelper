import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { TaskWithMare } from '@/models/types';

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

jest.mock('@/storage/repositories', () => ({
  completeTask: jest.fn(),
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
const repositories = jest.requireMock('@/storage/repositories') as {
  completeTask: jest.Mock;
};
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

const dashboardTask: TaskWithMare = {
  id: 'task-1',
  mareId: 'mare-1',
  taskType: 'pregnancyCheck',
  title: 'Pregnancy check',
  dueDate: '2035-04-27',
  dueTime: null,
  notes: null,
  status: 'open',
  completedAt: null,
  completedRecordType: null,
  completedRecordId: null,
  sourceType: 'breedingRecord',
  sourceRecordId: 'breed-1',
  sourceReason: 'breedingPregnancyCheck',
  createdAt: '2026-04-13T00:00:00.000Z',
  updatedAt: '2026-04-13T00:00:00.000Z',
  mareName: 'Nova',
};

function makeDashboardTask(overrides: Partial<TaskWithMare> = {}): TaskWithMare {
  return {
    ...dashboardTask,
    ...overrides,
  };
}

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
  repositories.completeTask.mockResolvedValue(undefined);
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
    expect(screen.getByText('Nova')).toBeTruthy();
    expect(screen.getByText('04-27-2035')).toBeTruthy();
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

it('completes dashboard tasks from the task card', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(buildState());

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByText('Pregnancy check')).toBeTruthy());

  fireEvent.press(screen.getByRole('button', { name: 'Complete Pregnancy check' }));

  await waitFor(() => expect(repositories.completeTask).toHaveBeenCalledWith('task-1'));
});

it('opens the task form from the dashboard add-task action', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(buildState());

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Task' })).toBeTruthy());

  fireEvent.press(screen.getByRole('button', { name: 'Add Task' }));

  expect(navigation.navigate).toHaveBeenCalledWith('TaskForm');
});

it('opens due task work forms from dashboard task presses', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      tasks: [
        makeDashboardTask({
          id: 'daily-task',
          taskType: 'dailyCheck',
          title: 'Check mare',
          dueDate: '2000-01-01',
          dueTime: '09:30',
        }),
        makeDashboardTask({
          id: 'med-task',
          taskType: 'medication',
          title: 'Give medication',
          dueDate: '2000-01-02',
        }),
        makeDashboardTask({
          id: 'breed-task',
          taskType: 'breeding',
          title: 'Breed mare',
          dueDate: '2000-01-03',
          dueTime: '10:15',
        }),
        makeDashboardTask({
          id: 'preg-task',
          taskType: 'pregnancyCheck',
          title: 'Pregnancy check',
          dueDate: '2000-01-04',
        }),
      ],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'Nova: Check mare' })).toBeTruthy());

  fireEvent.press(screen.getByRole('button', { name: 'Nova: Check mare' }));
  expect(navigation.navigate).toHaveBeenCalledWith('DailyLogForm', {
    mareId: 'mare-1',
    taskId: 'daily-task',
    defaultDate: '2000-01-01',
    defaultTime: '09:30',
  });

  fireEvent.press(screen.getByRole('button', { name: 'Nova: Give medication' }));
  expect(navigation.navigate).toHaveBeenCalledWith('MedicationForm', {
    mareId: 'mare-1',
    taskId: 'med-task',
    defaultDate: '2000-01-02',
  });

  fireEvent.press(screen.getByRole('button', { name: 'Nova: Breed mare' }));
  expect(navigation.navigate).toHaveBeenCalledWith('BreedingRecordForm', {
    mareId: 'mare-1',
    taskId: 'breed-task',
    defaultDate: '2000-01-03',
    defaultTime: '10:15',
  });

  fireEvent.press(screen.getByRole('button', { name: 'Nova: Pregnancy check' }));
  expect(navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', {
    mareId: 'mare-1',
    taskId: 'preg-task',
    defaultDate: '2000-01-04',
  });
});

it('opens future and edit task actions in the task form', async () => {
  const navigation = createNavigation();
  useDashboardData.mockReturnValue(
    buildState({
      tasks: [
        makeDashboardTask({
          id: 'future-task',
          taskType: 'dailyCheck',
          title: 'Future check',
          dueDate: '2035-01-01',
        }),
      ],
    }),
  );

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: 'Nova: Future check' })).toBeTruthy());

  fireEvent.press(screen.getByRole('button', { name: 'Nova: Future check' }));
  expect(navigation.navigate).toHaveBeenCalledWith('TaskForm', { taskId: 'future-task' });

  fireEvent.press(screen.getByRole('button', { name: 'Edit Future check' }));
  expect(navigation.navigate).toHaveBeenCalledWith('TaskForm', { taskId: 'future-task' });
});

it('shows a task update error when manual completion fails', async () => {
  const navigation = createNavigation();
  repositories.completeTask.mockRejectedValue(new Error('write failed'));
  useDashboardData.mockReturnValue(buildState());

  const screen = render(
    <DashboardScreen navigation={navigation as never} route={{ key: 'Home', name: 'Home' } as never} />,
  );

  await waitFor(() => expect(screen.getByText('Pregnancy check')).toBeTruthy());

  fireEvent.press(screen.getByRole('button', { name: 'Complete Pregnancy check' }));

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith('Task update failed', 'write failed');
  });
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
