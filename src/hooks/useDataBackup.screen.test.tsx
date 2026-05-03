import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
} from '@/storage/horseTransfer/types';

jest.mock('@/storage/backup', () => ({
  BACKUP_ARCHIVE_MIME_TYPE: 'application/octet-stream',
  BACKUP_ARCHIVE_SHARE_TITLE: 'Share backup',
  createManualBackupFileName: jest.fn(),
  ensureDirectoryExists: jest.fn(),
  getManualBackupDirectoryUri: jest.fn(),
  isBackupArchiveFileName: jest.fn((fileName: string) => fileName.endsWith('.breedwisebackup')),
  joinFileUri: jest.fn(),
  listSafetySnapshots: jest.fn(),
  pickBackupFile: jest.fn(),
  readBackupArchive: jest.fn(),
  readTextFile: jest.fn(),
  restoreBackup: jest.fn(),
  serializeBackup: jest.fn(),
  shareFileIfAvailable: jest.fn(),
  validateBackup: jest.fn(),
  validateBackupArchiveEntries: jest.fn(),
  validateBackupJson: jest.fn(),
  writeBackupArchive: jest.fn(),
}));

const backup = jest.requireMock('@/storage/backup') as {
  listSafetySnapshots: jest.Mock;
  pickBackupFile: jest.Mock;
  readTextFile: jest.Mock;
  validateBackup: jest.Mock;
  validateBackupJson: jest.Mock;
};

import { useDataBackup } from './useDataBackup';

describe('useDataBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    backup.listSafetySnapshots.mockResolvedValue([]);
  });

  it('rejects horse-transfer files before preparing a destructive restore preview', async () => {
    backup.pickBackupFile.mockResolvedValue({
      canceled: false,
      name: 'maple-horse-package.json',
      uri: 'file:///maple-horse-package.json',
      mimeType: 'application/json',
    });
    backup.readTextFile.mockResolvedValue(
      JSON.stringify({
        artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
        transferVersion: 1,
      }),
    );

    const { result } = renderHook(() => useDataBackup());

    await waitFor(() => expect(result.current.isLoadingSnapshots).toBe(false));

    let prepareResult: Awaited<
      ReturnType<typeof result.current.prepareRestoreFromPickedFile>
    > | null = null;
    await act(async () => {
      prepareResult = await result.current.prepareRestoreFromPickedFile();
    });

    expect(prepareResult).toEqual({
      ok: false,
      errorMessage: HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
    });
    expect(result.current.errorMessage).toBe(HORSE_TRANSFER_RESTORE_ERROR_MESSAGE);
    expect(result.current.pendingRestorePreview).toBeNull();
    expect(backup.validateBackup).not.toHaveBeenCalled();
    expect(backup.validateBackupJson).not.toHaveBeenCalled();
  });
});

