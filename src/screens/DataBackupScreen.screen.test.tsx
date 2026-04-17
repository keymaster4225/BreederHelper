import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DataBackupScreen } from '@/screens/DataBackupScreen';
import { useDataBackup } from '@/hooks/useDataBackup';
import type { SafetySnapshotSummary } from '@/utils/backup/types';

jest.mock('@/hooks/useDataBackup', () => ({
  useDataBackup: jest.fn(),
}));

const mockUseDataBackup = useDataBackup as jest.MockedFunction<typeof useDataBackup>;

function createSnapshot(overrides: Partial<SafetySnapshotSummary> = {}): SafetySnapshotSummary {
  return {
    fileName: 'breedwise-safety-backup-v1-20260416-120000.json',
    fileUri: 'file:///safety/breedwise-safety-backup-v1-20260416-120000.json',
    createdAt: '2026-04-16T12:00:00.000Z',
    mareCount: 4,
    schemaVersion: 1,
    ...overrides,
  };
}

function buildHookState(overrides: Partial<ReturnType<typeof useDataBackup>> = {}) {
  return {
    isBusy: false,
    busyStepLabel: null,
    errorMessage: null,
    safetySnapshots: [createSnapshot()],
    isLoadingSnapshots: false,
    pendingRestorePreview: null,
    refreshSafetySnapshots: jest.fn(),
    createBackup: jest.fn().mockResolvedValue({
      ok: true,
      fileName: 'breedwise-backup-v1-20260416-120000.json',
      fileUri: 'file:///manual/breedwise-backup-v1-20260416-120000.json',
      shared: true,
    }),
    prepareRestoreFromPickedFile: jest.fn().mockResolvedValue({ ok: true }),
    confirmPreparedRestore: jest.fn().mockResolvedValue({
      ok: true,
      safetySnapshotCreated: true,
    }),
    restoreSafetySnapshot: jest.fn().mockResolvedValue({
      ok: true,
      safetySnapshotCreated: false,
    }),
    clearPendingRestore: jest.fn(),
    ...overrides,
  };
}

function renderScreen(overrides: Partial<ReturnType<typeof useDataBackup>> = {}) {
  const hookState = buildHookState(overrides);
  mockUseDataBackup.mockReturnValue(hookState);

  const navigation = {
    reset: jest.fn(),
  };
  const route = {
    key: 'DataBackup',
    name: 'DataBackup',
    params: undefined,
  };

  return {
    hookState,
    navigation,
    ...render(<DataBackupScreen navigation={navigation as never} route={route as never} />),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('renders primary actions and safety snapshots', () => {
  const screen = renderScreen({
    pendingRestorePreview: {
      sourceName: 'picked-backup.json',
      createdAt: '2026-04-16T11:00:00.000Z',
      mareCount: 7,
      stallionCount: 2,
      dailyLogCount: 14,
      onboardingComplete: true,
      schemaVersion: 1,
    },
  });

  expect(screen.getByText('Create Backup')).toBeTruthy();
  expect(screen.getByText('Restore From File')).toBeTruthy();
  expect(screen.getByText('Ready to restore')).toBeTruthy();
  expect(screen.getByText('Safety snapshots')).toBeTruthy();
  expect(screen.getByText('Restore Snapshot')).toBeTruthy();
});

it('wires backup creation and file restore actions', async () => {
  const screen = renderScreen();

  fireEvent.press(screen.getByText('Create Backup'));
  await waitFor(() => expect(screen.hookState.createBackup).toHaveBeenCalled());
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Backup created',
      expect.stringContaining('breedwise-backup-v1-20260416-120000.json'),
    ),
  );

  fireEvent.press(screen.getByText('Restore From File'));
  await waitFor(() => expect(screen.hookState.prepareRestoreFromPickedFile).toHaveBeenCalled());
});

it('confirms a prepared restore and resets navigation on success', async () => {
  const screen = renderScreen({
    pendingRestorePreview: {
      sourceName: 'picked-backup.json',
      createdAt: '2026-04-16T11:00:00.000Z',
      mareCount: 7,
      stallionCount: 2,
      dailyLogCount: 14,
      onboardingComplete: false,
      schemaVersion: 1,
    },
  });

  fireEvent.press(screen.getByText('Restore This Backup'));

  const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
    ([title]) => title === 'Replace local data?',
  );
  expect(confirmCall).toBeTruthy();

  const confirmButtons = confirmCall?.[2] as
    | Array<{ text?: string; onPress?: () => void }>
    | undefined;
  const restoreButton = confirmButtons?.find((button) => button.text === 'Restore');
  expect(restoreButton?.onPress).toBeTruthy();

  restoreButton?.onPress?.();

  await waitFor(() => expect(screen.hookState.confirmPreparedRestore).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
    }),
  );
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Restore complete',
      expect.stringContaining('Restore complete. Returning to dashboard.'),
    ),
  );
});

it('confirms safety snapshot restore and uses the snapshot action', async () => {
  const screen = renderScreen();

  fireEvent.press(screen.getByText('Restore Snapshot'));

  const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
    ([title]) => title === 'Restore safety snapshot?',
  );
  expect(confirmCall).toBeTruthy();

  const confirmButtons = confirmCall?.[2] as
    | Array<{ text?: string; onPress?: () => void }>
    | undefined;
  const restoreButton = confirmButtons?.find((button) => button.text === 'Restore Snapshot');
  expect(restoreButton?.onPress).toBeTruthy();

  restoreButton?.onPress?.();

  await waitFor(() =>
    expect(screen.hookState.restoreSafetySnapshot).toHaveBeenCalledWith(
      screen.hookState.safetySnapshots[0],
    ),
  );
});
