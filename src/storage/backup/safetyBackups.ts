import {
  readBackupArchive,
  validateBackupArchiveEntries,
  writeBackupArchive,
} from './archiveIO';
import {
  createSafetySnapshotFileName,
  deleteFile,
  ensureDirectoryExists,
  getSafetySnapshotDirectoryUri,
  isBackupArchiveFileName,
  isLegacyJsonBackupFileName,
  joinFileUri,
  listDirectoryFiles,
  readTextFile,
} from './fileIO';
import { serializeBackup } from './serialize';
import type { SafetySnapshotSummary } from './types';
import { validateBackup, validateBackupJson } from './validate';

const MAX_SAFETY_SNAPSHOTS = 3;

export async function createSafetySnapshot(): Promise<SafetySnapshotSummary> {
  const backup = await serializeBackup();
  const directoryUri = getSafetySnapshotDirectoryUri();
  const fileName = createSafetySnapshotFileName(backup.createdAt);
  const fileUri = joinFileUri(directoryUri, fileName);

  await ensureDirectoryExists(directoryUri);
  await writeBackupArchive(fileUri, backup);
  await cleanupOldSafetySnapshots();

  return {
    fileName,
    fileUri,
    createdAt: backup.createdAt,
    mareCount: backup.tables.mares.length,
    schemaVersion: backup.schemaVersion,
  };
}

export async function listSafetySnapshots(): Promise<readonly SafetySnapshotSummary[]> {
  const directoryUri = getSafetySnapshotDirectoryUri();
  const fileUris = await listDirectoryFiles(directoryUri);
  const summaries: SafetySnapshotSummary[] = [];

  for (const fileUri of fileUris) {
    const fileName = fileUri.slice(fileUri.lastIndexOf('/') + 1);
    if (!isLegacyJsonBackupFileName(fileName) && !isBackupArchiveFileName(fileName)) {
      continue;
    }

    try {
      const validation = isBackupArchiveFileName(fileName)
        ? validateSafetyArchive(fileUri)
        : validateBackupJson(await readTextFile(fileUri));
      if (!validation.ok) {
        continue;
      }

      summaries.push({
        fileName,
        fileUri,
        createdAt: validation.backup.createdAt,
        mareCount: validation.backup.tables.mares.length,
        schemaVersion: validation.backup.schemaVersion,
      });
    } catch {
      // Ignore unreadable snapshot files. They should not block the restore UI.
    }
  }

  return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function validateSafetyArchive(fileUri: string): ReturnType<typeof validateBackup> {
  const archive = readBackupArchive(fileUri);
  const archiveValidation = validateBackupArchiveEntries(archive);
  if (!archiveValidation.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid_shape',
        message: archiveValidation.message,
      },
    };
  }

  return validateBackup(archive.backup);
}

async function cleanupOldSafetySnapshots(): Promise<void> {
  try {
    const snapshots = await listSafetySnapshots();
    const staleSnapshots = snapshots.slice(MAX_SAFETY_SNAPSHOTS);

    await Promise.all(staleSnapshots.map((snapshot) => deleteFile(snapshot.fileUri)));
  } catch {
    // Retention cleanup is best-effort only.
  }
}
