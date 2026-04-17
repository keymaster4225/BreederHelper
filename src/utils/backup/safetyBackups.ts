import {
  createSafetySnapshotFileName,
  deleteFile,
  ensureDirectoryExists,
  getSafetySnapshotDirectoryUri,
  joinFileUri,
  listDirectoryFiles,
  readTextFile,
  writeJsonFile,
} from './fileIO';
import { serializeBackup } from './serialize';
import type { SafetySnapshotSummary } from './types';
import { validateBackupJson } from './validate';

const MAX_SAFETY_SNAPSHOTS = 3;

export async function createSafetySnapshot(): Promise<SafetySnapshotSummary> {
  const backup = await serializeBackup();
  const directoryUri = getSafetySnapshotDirectoryUri();
  const fileName = createSafetySnapshotFileName(backup.createdAt);
  const fileUri = joinFileUri(directoryUri, fileName);

  await ensureDirectoryExists(directoryUri);
  await writeJsonFile(fileUri, JSON.stringify(backup, null, 2));
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
    if (!fileUri.endsWith('.json')) {
      continue;
    }

    try {
      const text = await readTextFile(fileUri);
      const validation = validateBackupJson(text);
      if (!validation.ok) {
        continue;
      }

      summaries.push({
        fileName: fileUri.slice(fileUri.lastIndexOf('/') + 1),
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

async function cleanupOldSafetySnapshots(): Promise<void> {
  try {
    const snapshots = await listSafetySnapshots();
    const staleSnapshots = snapshots.slice(MAX_SAFETY_SNAPSHOTS);

    await Promise.all(staleSnapshots.map((snapshot) => deleteFile(snapshot.fileUri)));
  } catch {
    // Retention cleanup is best-effort only.
  }
}
