import { useCallback, useEffect, useState } from 'react';

import {
  BACKUP_ARCHIVE_MIME_TYPE,
  BACKUP_ARCHIVE_SHARE_TITLE,
  type BackupArchive,
  createManualBackupFileName,
  ensureDirectoryExists,
  getManualBackupDirectoryUri,
  isBackupArchiveFileName,
  joinFileUri,
  pickBackupFile,
  readBackupArchive,
  readTextFile,
  restoreBackup,
  serializeBackup,
  listSafetySnapshots,
  shareFileIfAvailable,
  type BackupPreviewSummary,
  type RestoreBackupResult,
  type SafetySnapshotSummary,
  validateBackup,
  validateBackupArchiveEntries,
  validateBackupJson,
  writeBackupArchive,
} from '@/storage/backup';
import {
  HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
} from '@/storage/horseTransfer/types';
import {
  isHorseTransferArtifactPayload,
} from '@/storage/horseTransfer/validate';

type PendingRestoreState = {
  readonly candidate: string | BackupArchive;
  readonly preview: PendingRestorePreview;
};

export type PendingRestorePreview = BackupPreviewSummary & {
  readonly sourceName: string;
};

export type CreateBackupResult =
  | {
      readonly ok: true;
      readonly fileName: string;
      readonly fileUri: string;
      readonly shared: boolean;
    }
  | {
      readonly ok: false;
      readonly errorMessage: string;
    };

export type PrepareRestoreResult =
  | {
      readonly ok: true;
      readonly preview: PendingRestorePreview;
    }
  | {
      readonly ok: false;
      readonly canceled?: boolean;
      readonly errorMessage?: string;
    };

type UseDataBackupResult = {
  readonly isBusy: boolean;
  readonly busyStepLabel: string | null;
  readonly errorMessage: string | null;
  readonly safetySnapshots: readonly SafetySnapshotSummary[];
  readonly isLoadingSnapshots: boolean;
  readonly pendingRestorePreview: PendingRestorePreview | null;
  readonly refreshSafetySnapshots: () => Promise<void>;
  readonly createBackup: () => Promise<CreateBackupResult>;
  readonly prepareRestoreFromPickedFile: () => Promise<PrepareRestoreResult>;
  readonly confirmPreparedRestore: () => Promise<RestoreBackupResult>;
  readonly restoreSafetySnapshot: (
    snapshot: SafetySnapshotSummary,
  ) => Promise<RestoreBackupResult>;
  readonly clearPendingRestore: () => void;
};

export function useDataBackup(): UseDataBackupResult {
  const [isBusy, setIsBusy] = useState(false);
  const [busyStepLabel, setBusyStepLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [safetySnapshots, setSafetySnapshots] = useState<readonly SafetySnapshotSummary[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(true);
  const [pendingRestore, setPendingRestore] = useState<PendingRestoreState | null>(null);

  const refreshSafetySnapshots = useCallback(async () => {
    try {
      setIsLoadingSnapshots(true);
      const snapshots = await listSafetySnapshots();
      setSafetySnapshots(snapshots);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load safety snapshots.';
      setErrorMessage(message);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    void refreshSafetySnapshots();
  }, [refreshSafetySnapshots]);

  const createBackup = useCallback(async (): Promise<CreateBackupResult> => {
    setIsBusy(true);
    setBusyStepLabel('Creating backup...');
    setErrorMessage(null);

    try {
      const backup = await serializeBackup();
      const directoryUri = getManualBackupDirectoryUri();
      const fileName = createManualBackupFileName(backup.createdAt);
      const fileUri = joinFileUri(directoryUri, fileName);

      await ensureDirectoryExists(directoryUri);
      await writeBackupArchive(fileUri, backup);

      let shared = false;
      try {
        setBusyStepLabel('Sharing backup...');
        shared = await shareFileIfAvailable(fileUri, {
          mimeType: BACKUP_ARCHIVE_MIME_TYPE,
          dialogTitle: BACKUP_ARCHIVE_SHARE_TITLE,
        });
      } catch {
        shared = false;
      }

      return {
        ok: true,
        fileName,
        fileUri,
        shared,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Backup could not be created.';
      setErrorMessage(message);
      return {
        ok: false,
        errorMessage: message,
      };
    } finally {
      setIsBusy(false);
      setBusyStepLabel(null);
    }
  }, []);

  const prepareRestoreFromPickedFile = useCallback(
    async (): Promise<PrepareRestoreResult> => {
      setIsBusy(true);
      setBusyStepLabel('Reading backup...');
      setErrorMessage(null);
      setPendingRestore(null);

      try {
        const pickedFile = await pickBackupFile();
        if (pickedFile.canceled) {
          return {
            ok: false,
            canceled: true,
          };
        }

        setBusyStepLabel('Validating backup...');

        const candidate = isBackupArchiveFileName(pickedFile.name)
          ? readBackupArchive(pickedFile.uri)
          : await readLegacyJsonBackupCandidate(pickedFile.uri);

        if (typeof candidate !== 'string') {
          const archiveValidation = validateBackupArchiveEntries(candidate);
          if (!archiveValidation.ok) {
            setErrorMessage(archiveValidation.message);
            return {
              ok: false,
              errorMessage: archiveValidation.message,
            };
          }
        }

        const validation =
          typeof candidate === 'string'
            ? validatePickedBackupJson(candidate)
            : validateBackup(candidate.backup);
        if (!validation.ok) {
          setErrorMessage(validation.error.message);
          return {
            ok: false,
            errorMessage: validation.error.message,
          };
        }

        const preview: PendingRestorePreview = {
          ...validation.preview,
          sourceName: pickedFile.name,
        };

        setPendingRestore({
          candidate,
          preview,
        });

        return {
          ok: true,
          preview,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Backup file could not be read.';
        setErrorMessage(message);
        return {
          ok: false,
          errorMessage: message,
        };
      } finally {
        setIsBusy(false);
        setBusyStepLabel(null);
      }
    },
    [],
  );

  const confirmPreparedRestore = useCallback(async (): Promise<RestoreBackupResult> => {
    if (pendingRestore == null) {
      const message = 'Choose and validate a backup before restoring.';
      setErrorMessage(message);
      return {
        ok: false,
        errorMessage: message,
      };
    }

    setIsBusy(true);
    setBusyStepLabel('Creating safety snapshot...');
    setErrorMessage(null);

    try {
      const result = await restoreBackup(pendingRestore.candidate, {
        onStepChange: setBusyStepLabel,
      });

      if (!result.ok) {
        setErrorMessage(result.errorMessage);
        return result;
      }

      setPendingRestore(null);
      await refreshSafetySnapshots();

      return result;
    } finally {
      setIsBusy(false);
      setBusyStepLabel(null);
    }
  }, [pendingRestore, refreshSafetySnapshots]);

  const restoreSafetySnapshot = useCallback(
    async (snapshot: SafetySnapshotSummary): Promise<RestoreBackupResult> => {
      setIsBusy(true);
      setBusyStepLabel('Reading backup...');
      setErrorMessage(null);
      setPendingRestore(null);

      try {
        setBusyStepLabel('Validating backup...');

        const candidate = isBackupArchiveFileName(snapshot.fileName)
          ? readBackupArchive(snapshot.fileUri)
          : await readLegacyJsonBackupCandidate(snapshot.fileUri);

        if (typeof candidate !== 'string') {
          const archiveValidation = validateBackupArchiveEntries(candidate);
          if (!archiveValidation.ok) {
            setErrorMessage(archiveValidation.message);
            return {
              ok: false,
              errorMessage: archiveValidation.message,
            };
          }
        }

        const validation =
          typeof candidate === 'string'
            ? validatePickedBackupJson(candidate)
            : validateBackup(candidate.backup);
        if (!validation.ok) {
          setErrorMessage(validation.error.message);
          return {
            ok: false,
            errorMessage: validation.error.message,
          };
        }

        const result = await restoreBackup(candidate, {
          skipSafetySnapshot: true,
          onStepChange: setBusyStepLabel,
        });

        if (!result.ok) {
          setErrorMessage(result.errorMessage);
          return result;
        }

        await refreshSafetySnapshots();

        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Safety snapshot restore failed unexpectedly.';
        setErrorMessage(message);
        return {
          ok: false,
          errorMessage: message,
        };
      } finally {
        setIsBusy(false);
        setBusyStepLabel(null);
      }
    },
    [refreshSafetySnapshots],
  );

  const clearPendingRestore = useCallback(() => {
    setPendingRestore(null);
  }, []);

  return {
    isBusy,
    busyStepLabel,
    errorMessage,
    safetySnapshots,
    isLoadingSnapshots,
    pendingRestorePreview: pendingRestore?.preview ?? null,
    refreshSafetySnapshots,
    createBackup,
    prepareRestoreFromPickedFile,
    confirmPreparedRestore,
    restoreSafetySnapshot,
    clearPendingRestore,
  };
}

async function readLegacyJsonBackupCandidate(fileUri: string): Promise<string> {
  return readTextFile(fileUri);
}

function validatePickedBackupJson(jsonText: string): ReturnType<typeof validateBackupJson> {
  try {
    const parsed = JSON.parse(jsonText);
    if (isHorseTransferArtifactPayload(parsed)) {
      return {
        ok: false,
        error: {
          code: 'invalid_shape',
          message: HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
        },
      };
    }
    return validateBackup(parsed);
  } catch {
    return validateBackupJson(jsonText);
  }
}
