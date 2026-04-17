import { useCallback, useEffect, useState } from 'react';

import {
  createManualBackupFileName,
  ensureDirectoryExists,
  getManualBackupDirectoryUri,
  joinFileUri,
  pickBackupFile,
  readTextFile,
  shareFileIfAvailable,
  writeJsonFile,
} from '@/utils/backup/fileIO';
import { restoreBackup } from '@/utils/backup/restore';
import { serializeBackup } from '@/utils/backup/serialize';
import { listSafetySnapshots } from '@/utils/backup/safetyBackups';
import type {
  BackupPreviewSummary,
  RestoreBackupResult,
  SafetySnapshotSummary,
} from '@/utils/backup/types';
import { validateBackupJson } from '@/utils/backup/validate';

type PendingRestoreState = {
  readonly candidateText: string;
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
      await writeJsonFile(fileUri, JSON.stringify(backup, null, 2));

      let shared = false;
      try {
        setBusyStepLabel('Sharing backup...');
        shared = await shareFileIfAvailable(fileUri);
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

        const jsonText = await readTextFile(pickedFile.uri);
        setBusyStepLabel('Validating backup...');

        const validation = validateBackupJson(jsonText);
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
          candidateText: jsonText,
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
      const result = await restoreBackup(pendingRestore.candidateText, {
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
        const jsonText = await readTextFile(snapshot.fileUri);
        setBusyStepLabel('Validating backup...');

        const validation = validateBackupJson(jsonText);
        if (!validation.ok) {
          setErrorMessage(validation.error.message);
          return {
            ok: false,
            errorMessage: validation.error.message,
          };
        }

        const result = await restoreBackup(jsonText, {
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
