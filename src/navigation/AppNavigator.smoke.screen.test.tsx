import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppNavigator } from '@/navigation/AppNavigator';

jest.mock('@/utils/buildProfile', () => ({
  canSeedPreviewData: jest.fn(() => false),
  isPreviewBuild: jest.fn(() => false),
}));

jest.mock('@/utils/devSeed', () => ({
  seedPreviewData: jest.fn(),
}));

jest.mock('@/storage/repositories', () => ({
  listMares: jest.fn(),
  listStallions: jest.fn(),
  listAllDailyLogs: jest.fn(),
  listAllBreedingRecords: jest.fn(),
  listAllPregnancyChecks: jest.fn(),
  listAllFoalingRecords: jest.fn(),
  listOpenDashboardTasks: jest.fn(),
  listAllMedicationLogs: jest.fn(),
  listAllFoals: jest.fn(),
  softDeleteMare: jest.fn(),
  softDeleteStallion: jest.fn(),
}));

jest.mock('@/storage/backup', () => ({
  createManualBackupFileName: jest.fn(() => 'breedwise-backup.json'),
  ensureDirectoryExists: jest.fn().mockResolvedValue(undefined),
  getManualBackupDirectoryUri: jest.fn(() => 'file:///mock-backups/'),
  joinFileUri: jest.fn((_directory: string, fileName: string) => `file:///mock-backups/${fileName}`),
  pickBackupFile: jest.fn().mockResolvedValue({ canceled: true }),
  readTextFile: jest.fn().mockResolvedValue('{}'),
  restoreBackup: jest.fn().mockResolvedValue({ ok: true, safetySnapshotCreated: true }),
  serializeBackup: jest.fn().mockResolvedValue({ createdAt: '2026-04-01T00:00:00.000Z' }),
  listSafetySnapshots: jest.fn().mockResolvedValue([]),
  shareFileIfAvailable: jest.fn().mockResolvedValue(false),
  validateBackupJson: jest.fn().mockReturnValue({
    ok: false,
    error: { message: 'No backup selected.' },
  }),
  writeJsonFile: jest.fn().mockResolvedValue(undefined),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;
const backup = jest.requireMock('@/storage/backup') as Record<string, jest.Mock>;

function localDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

beforeEach(() => {
  jest.clearAllMocks();

  repositories.listMares.mockResolvedValue([
    {
      id: 'mare-1',
      name: 'Maple',
      breed: 'Quarter Horse',
      gestationLengthDays: 340,
      dateOfBirth: '2016-02-02',
      registrationNumber: null,
      isRecipient: false,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  repositories.listStallions.mockResolvedValue([
    {
      id: 'stallion-1',
      name: 'Atlas',
      breed: 'Warmblood',
      dateOfBirth: '2014-03-03',
      registrationNumber: null,
      sire: null,
      dam: null,
      notes: null,
      avPreferences: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    },
  ]);
  repositories.listAllDailyLogs.mockResolvedValue([]);
  repositories.listAllBreedingRecords.mockResolvedValue([
    {
      id: 'breed-1',
      mareId: 'mare-1',
      stallionId: 'stallion-1',
      stallionName: null,
      collectionId: null,
      date: localDateDaysAgo(15),
      time: '09:30',
      method: 'freshAI',
      notes: null,
      volumeMl: null,
      concentrationMPerMl: null,
      motilityPercent: null,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  repositories.listAllPregnancyChecks.mockResolvedValue([]);
  repositories.listAllFoalingRecords.mockResolvedValue([]);
  repositories.listOpenDashboardTasks.mockResolvedValue([
    {
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
      mareName: 'Maple',
    },
  ]);
  repositories.listAllMedicationLogs.mockResolvedValue([]);
  repositories.listAllFoals.mockResolvedValue([]);
  backup.listSafetySnapshots.mockResolvedValue([]);
});

it('smoke-renders real navigator destinations with repository fixtures', async () => {
  const screen = render(<AppNavigator />);

  await waitFor(() => expect(screen.getByText("Today's Tasks")).toBeTruthy());
  expect(screen.getByLabelText('1 Mares')).toBeTruthy();

  const mareTabs = screen.getAllByText('Mares');
  fireEvent.press(mareTabs[mareTabs.length - 1]!);
  await waitFor(() => expect(screen.getByText('Maple')).toBeTruthy());

  const stallionTabs = screen.getAllByText('Stallions');
  fireEvent.press(stallionTabs[stallionTabs.length - 1]!);
  await waitFor(() => expect(screen.getByText('Atlas')).toBeTruthy());

  const settingsTabs = screen.getAllByText('Settings');
  fireEvent.press(settingsTabs[settingsTabs.length - 1]!);
  await waitFor(() => expect(screen.getByLabelText('Data Backup & Restore')).toBeTruthy());

  fireEvent.press(screen.getByLabelText('Data Backup & Restore'));
  await waitFor(() => expect(screen.getByText('Create Backup')).toBeTruthy());
  expect(backup.listSafetySnapshots).toHaveBeenCalled();
});
