import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const MANUAL_BACKUP_PREFIX = 'breedwise-backup-v5-';
const SAFETY_BACKUP_PREFIX = 'breedwise-safety-backup-v5-';
export const BACKUP_JSON_EXTENSION = '.json';
export const BACKUP_ARCHIVE_EXTENSION = '.breedwisebackup';
export const BACKUP_JSON_MIME_TYPE = 'application/json';
export const BACKUP_ARCHIVE_MIME_TYPE = 'application/octet-stream';
export const BACKUP_ARCHIVE_SHARE_TITLE = 'Share backup';
export const BACKUP_JSON_SHARE_TITLE = 'Share legacy backup';

export type PickedBackupFile =
  | {
      readonly canceled: true;
    }
  | {
      readonly canceled: false;
      readonly name: string;
      readonly uri: string;
      readonly mimeType: string | null;
    };

export function getManualBackupDirectoryUri(): string {
  return ensureTrailingSlash(FileSystem.documentDirectory ?? 'file:///');
}

export function getSafetySnapshotDirectoryUri(): string {
  return `${getManualBackupDirectoryUri()}safety-snapshots/`;
}

export function createManualBackupFileName(createdAtIso: string): string {
  return `${MANUAL_BACKUP_PREFIX}${formatTimestampForFileName(createdAtIso)}${BACKUP_ARCHIVE_EXTENSION}`;
}

export function createSafetySnapshotFileName(createdAtIso: string): string {
  return `${SAFETY_BACKUP_PREFIX}${formatTimestampForFileName(createdAtIso)}${BACKUP_ARCHIVE_EXTENSION}`;
}

export function isBackupArchiveFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(BACKUP_ARCHIVE_EXTENSION);
}

export function isLegacyJsonBackupFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(BACKUP_JSON_EXTENSION);
}

export function joinFileUri(directoryUri: string, fileName: string): string {
  return `${ensureTrailingSlash(directoryUri)}${fileName}`;
}

export async function ensureDirectoryExists(directoryUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (info.exists) {
    return;
  }

  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
}

export async function writeJsonFile(fileUri: string, content: string): Promise<void> {
  await FileSystem.writeAsStringAsync(fileUri, content);
}

export async function readTextFile(fileUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(fileUri);
}

export async function shareFileIfAvailable(
  fileUri: string,
  options: {
    readonly mimeType?: string;
    readonly dialogTitle?: string;
  } = {},
): Promise<boolean> {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    return false;
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: options.mimeType ?? BACKUP_ARCHIVE_MIME_TYPE,
    dialogTitle: options.dialogTitle ?? BACKUP_ARCHIVE_SHARE_TITLE,
  });

  return true;
}

export async function pickBackupFile(): Promise<PickedBackupFile> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [BACKUP_ARCHIVE_MIME_TYPE, BACKUP_JSON_MIME_TYPE, '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets == null || result.assets.length === 0) {
    return { canceled: true };
  }

  const asset = result.assets[0];

  return {
    canceled: false,
    name: asset.name,
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
  };
}

export async function listDirectoryFiles(directoryUri: string): Promise<readonly string[]> {
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (!info.exists) {
    return [];
  }

  const entries = await FileSystem.readDirectoryAsync(directoryUri);
  return entries.map((entry) => joinFileUri(directoryUri, entry));
}

export async function deleteFile(fileUri: string): Promise<void> {
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
}

export async function fileExists(fileUri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists;
}

function formatTimestampForFileName(createdAtIso: string): string {
  const date = new Date(createdAtIso);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
