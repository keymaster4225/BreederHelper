import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { DataBackupScreen } from '@/screens/DataBackupScreen';
import { useDataBackup } from '@/hooks/useDataBackup';
import { useHorseImport, type PendingHorseImportPreview } from '@/hooks/useHorseImport';
import { HORSE_TRANSFER_RESTORE_ERROR_MESSAGE } from '@/storage/horseTransfer/types';
import type { SafetySnapshotSummary } from '@/storage/backup';

jest.mock('@/hooks/useDataBackup', () => ({
  useDataBackup: jest.fn(),
}));

jest.mock('@/hooks/useHorseImport', () => ({
  useHorseImport: jest.fn(),
}));

const mockUseDataBackup = useDataBackup as jest.MockedFunction<typeof useDataBackup>;
const mockUseHorseImport = useHorseImport as jest.MockedFunction<typeof useHorseImport>;

function createSnapshot(overrides: Partial<SafetySnapshotSummary> = {}): SafetySnapshotSummary {
  return {
    fileName: 'breedwise-safety-backup-v5-20260416-120000.json',
    fileUri: 'file:///safety/breedwise-safety-backup-v5-20260416-120000.json',
    createdAt: '2026-04-16T12:00:00.000Z',
    mareCount: 4,
    schemaVersion: 5,
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
      fileName: 'breedwise-backup-v5-20260416-120000.json',
      fileUri: 'file:///manual/breedwise-backup-v5-20260416-120000.json',
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

function buildHorseImportHookState(overrides: Partial<ReturnType<typeof useHorseImport>> = {}) {
  return {
    isBusy: false,
    busyStepLabel: null,
    errorMessage: null,
    pendingImport: null,
    finalSummary: null,
    prepareImportFromPickedFile: jest.fn().mockResolvedValue({ ok: true }),
    selectCreateNewTarget: jest.fn(),
    selectExistingTarget: jest.fn(),
    confirmPreparedImport: jest.fn().mockResolvedValue({
      ok: true,
      safetySnapshotCreated: true,
      summary: createImportSummary(),
    }),
    clearPendingImport: jest.fn(),
    clearFinalSummary: jest.fn(),
    ...overrides,
  };
}

function renderScreen(
  overrides: Partial<ReturnType<typeof useDataBackup>> = {},
  horseImportOverrides: Partial<ReturnType<typeof useHorseImport>> = {},
) {
  const hookState = buildHookState(overrides);
  const horseImportState = buildHorseImportHookState(horseImportOverrides);
  mockUseDataBackup.mockReturnValue(hookState);
  mockUseHorseImport.mockReturnValue(horseImportState);

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
    horseImportState,
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
  expect(screen.getByText('Import Horse')).toBeTruthy();
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
      expect.stringContaining('breedwise-backup-v5-20260416-120000.json'),
    ),
  );

  fireEvent.press(screen.getByText('Restore From File'));
  await waitFor(() => expect(screen.hookState.prepareRestoreFromPickedFile).toHaveBeenCalled());
});

it('wires the horse import action', async () => {
  const screen = renderScreen();

  fireEvent.press(screen.getByText('Import Horse'));

  await waitFor(() =>
    expect(screen.horseImportState.prepareImportFromPickedFile).toHaveBeenCalled(),
  );
});

it('shows invalid horse package errors from import preparation', async () => {
  const screen = renderScreen({}, {
    prepareImportFromPickedFile: jest.fn().mockResolvedValue({
      ok: false,
      errorMessage: 'Horse package artifactType is invalid.',
    }),
  });

  fireEvent.press(screen.getByText('Import Horse'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Import failed',
      'Horse package artifactType is invalid.',
    ),
  );
});

it('shows clean horse-package rejection from full restore without a destructive preview', async () => {
  const screen = renderScreen({
    prepareRestoreFromPickedFile: jest.fn().mockResolvedValue({
      ok: false,
      errorMessage: HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
    }),
    pendingRestorePreview: null,
  });

  fireEvent.press(screen.getByText('Restore From File'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Restore failed',
      HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
    ),
  );
  expect(screen.queryByText('Restore This Backup')).toBeNull();
});

it('renders horse import preview with counts, redactions, safety copy, and no-overwrite copy', () => {
  const pendingImport = createPendingHorseImport();
  const screen = renderScreen({}, { pendingImport });

  expect(screen.getByText('Ready to import horse')).toBeTruthy();
  expect(screen.getByText('Nova (mare)')).toBeTruthy();
  expect(screen.getByText('Importing never overwrites existing data.')).toBeTruthy();
  expect(screen.getByText('3 rows | mares 1 | daily logs 2')).toBeTruthy();
  expect(screen.getByText('Estimated conflicts: 1')).toBeTruthy();
  expect(screen.getByText('Safety snapshot will be created before import.')).toBeTruthy();
  expect(screen.getByText('Context stallion details were redacted before export.')).toBeTruthy();
});

it('allows fuzzy candidate selection before confirming import', async () => {
  const pendingImport = createPendingHorseImport({
    match: {
      state: 'create_new',
      fuzzySuggestions: [
        {
          horse: {
            id: 'mare-local',
            name: 'Local Nova',
            registrationNumber: null,
            dateOfBirth: null,
            deletedAt: null,
          },
          score: 0.74,
        },
      ],
    },
  });
  const screen = renderScreen({}, { pendingImport });

  fireEvent.press(screen.getByText('Use Local Nova'));
  expect(screen.horseImportState.selectExistingTarget).toHaveBeenCalledWith('mare-local');

  fireEvent.press(screen.getByText('Confirm Import'));
  pressAlertButton('Import horse package?', 'Import');

  await waitFor(() => expect(screen.horseImportState.confirmPreparedImport).toHaveBeenCalled());
});

it('allows create-new imports to be confirmed', async () => {
  const pendingImport = createPendingHorseImport();
  const screen = renderScreen({}, { pendingImport });

  fireEvent.press(screen.getByText('Create New Horse'));
  expect(screen.horseImportState.selectCreateNewTarget).toHaveBeenCalled();

  fireEvent.press(screen.getByText('Confirm Import'));
  pressAlertButton('Import horse package?', 'Import');

  await waitFor(() => expect(screen.horseImportState.confirmPreparedImport).toHaveBeenCalled());
});

it('cancels a horse import preview without confirming import', () => {
  const pendingImport = createPendingHorseImport();
  const screen = renderScreen({}, { pendingImport });

  fireEvent.press(screen.getAllByText('Cancel')[0]);

  expect(screen.horseImportState.clearPendingImport).toHaveBeenCalled();
  expect(screen.horseImportState.confirmPreparedImport).not.toHaveBeenCalled();
});

it('renders final horse import summary counts and row details', () => {
  const screen = renderScreen({}, { finalSummary: createImportSummary() });

  expect(screen.getByText('Horse import summary')).toBeTruthy();
  expect(screen.getByText('Inserted 2 | Already present 1 | Skipped 1 | Conflicts 1')).toBeTruthy();
  expect(screen.getByText(/foals foal-1: Destination foal was preserved/)).toBeTruthy();

  fireEvent.press(screen.getByText('Clear Summary'));
  expect(screen.horseImportState.clearFinalSummary).toHaveBeenCalled();
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

function pressAlertButton(title: string, buttonText: string): void {
  const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
    ([callTitle]) => callTitle === title,
  );
  expect(confirmCall).toBeTruthy();

  const confirmButtons = confirmCall?.[2] as
    | Array<{ text?: string; onPress?: () => void }>
    | undefined;
  const button = confirmButtons?.find((candidate) => candidate.text === buttonText);
  expect(button?.onPress).toBeTruthy();

  button?.onPress?.();
}

function createPendingHorseImport(
  overrides: Partial<PendingHorseImportPreview> = {},
): PendingHorseImportPreview {
  return {
    sourceName: 'nova-horse-package.json',
    preview: {
      createdAt: '2026-04-28T12:00:00.000Z',
      appVersion: '1.3.5',
      dataSchemaVersion: 11 as never,
      sourceHorse: {
        type: 'mare',
        id: 'mare-import',
        name: 'Nova',
        registrationNumber: 'REG-1',
        dateOfBirth: '2015-01-01',
      },
      privacy: {
        redactedContextStallions: true,
        redactedDoseRecipientAndShipping: false,
      },
      tableCounts: createTableCounts({ mares: 1, daily_logs: 2 }),
      totalRowCount: 3,
      estimatedConflictCounts: createTableCounts({ daily_logs: 1 }),
      estimatedConflictTotal: 1,
      targetState: 'create_new',
      redactionNotices: [{ code: 'context_stallions_redacted' }],
      nonOverwritePolicy: true,
      safetySnapshotPolicy: 'before_import',
    },
    match: {
      state: 'create_new',
      fuzzySuggestions: [],
    },
    selectedTarget: { kind: 'create_new' },
    ...overrides,
  };
}

function createImportSummary(): ReturnType<typeof useHorseImport>['finalSummary'] {
  return {
    tableCounts: {} as never,
    totalCounts: {
      inserted: 2,
      already_present: 1,
      skipped: 1,
      conflict: 1,
    },
    rowResults: [
      {
        table: 'foals',
        sourceId: 'foal-1',
        destinationId: 'foal-local',
        outcome: 'conflict',
        reason: 'natural_key_conflict',
        message: 'Destination foal was preserved. Imported milestones differ; imported IgG history match.',
      },
      {
        table: 'tasks',
        sourceId: 'task-1',
        outcome: 'skipped',
        reason: 'cascade_parent_conflict',
        message: 'Skipped because parent breeding_records.br-1 was not imported.',
      },
    ],
  };
}

function createTableCounts(overrides: Record<string, number> = {}) {
  return {
    mares: 0,
    stallions: 0,
    daily_logs: 0,
    uterine_fluid: 0,
    uterine_flushes: 0,
    uterine_flush_products: 0,
    breeding_records: 0,
    pregnancy_checks: 0,
    foaling_records: 0,
    foals: 0,
    medication_logs: 0,
    tasks: 0,
    semen_collections: 0,
    collection_dose_events: 0,
    frozen_semen_batches: 0,
    ...overrides,
  } as never;
}
