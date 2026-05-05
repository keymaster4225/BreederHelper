import {
  strFromU8,
  strToU8,
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  Zip,
  ZipPassThrough,
} from 'fflate';

import { createCollisionFreeStorageId } from '@/storage/photoFiles/assets';
import {
  ensurePhotoRootDirectories,
  getPhotoAssetDirectory,
  getPhotoAssetFile,
  getPhotoAssetRelativePath,
  resolvePhotoAssetFile,
  storageIdFromPhotoAssetRelativePath,
} from '@/storage/photoFiles/paths';

import type { BackupEnvelope, BackupPhotoAssetRow } from './types';

export const BACKUP_JSON_ENTRY_NAME = 'backup.json';

const ARCHIVE_READ_CHUNK_SIZE_BYTES = 64 * 1024;
const ARCHIVE_WRITE_CHUNK_SIZE_BYTES = 64 * 1024;

export type BackupArchive = {
  readonly backup: BackupEnvelope;
  readonly entries: ReadonlyMap<string, Uint8Array>;
};

export type BackupArchiveValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

function getBackupPhotoAssets(backup: BackupEnvelope): readonly BackupPhotoAssetRow[] {
  return backup.schemaVersion >= 12 && 'photo_assets' in backup.tables
    ? backup.tables.photo_assets
    : [];
}

type ArchiveChunkWriter = {
  readonly bytesWritten: number;
  write(chunk: Uint8Array): void;
  close(): void;
};

type FileHandleLike = {
  offset: number | null;
  readonly size?: number | null;
  readBytes(length: number): Uint8Array;
  writeBytes(chunk: Uint8Array): void;
  close(): void;
};

type FileLike = {
  readonly size: number;
  create(options?: { readonly overwrite?: boolean }): void;
  open(): FileHandleLike;
};

type FileConstructor = new (uri: string) => FileLike;

function createFile(uri: string): FileLike {
  const module = require('expo-file-system') as { readonly File: FileConstructor };
  return new module.File(uri);
}

export async function writeBackupArchive(
  fileUri: string,
  backup: BackupEnvelope,
): Promise<void> {
  const archiveFile = createFile(fileUri);
  archiveFile.create({ overwrite: true });

  const writer = createAppendChunkWriter(archiveFile);
  let archiveError: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) {
      archiveError = error;
      return;
    }
    writer.write(chunk);
  });

  try {
    pushSingleChunkEntry(zip, BACKUP_JSON_ENTRY_NAME, strToU8(JSON.stringify(backup, null, 2)));

    for (const asset of getBackupPhotoAssets(backup)) {
      pushFileEntry(zip, asset.master_relative_path, resolvePhotoAssetFile(asset.master_relative_path));
      pushFileEntry(zip, asset.thumbnail_relative_path, resolvePhotoAssetFile(asset.thumbnail_relative_path));
    }

    zip.end();
    if (archiveError) {
      throw archiveError;
    }
  } finally {
    writer.close();
  }
}

export function readBackupArchive(fileUri: string): BackupArchive {
  const archiveFile = createFile(fileUri);
  const entries = new Map<string, Uint8Array>();
  const entryChunks = new Map<string, Uint8Array[]>();
  let readError: Error | null = null;

  const unzip = new Unzip((file) => {
    if (entries.has(file.name) || entryChunks.has(file.name)) {
      readError = new Error(`Backup archive contains duplicate entry: ${file.name}`);
      file.terminate();
      return;
    }

    const chunks: Uint8Array[] = [];
    entryChunks.set(file.name, chunks);
    file.ondata = (error, chunk, final) => {
      if (error) {
        readError = error;
        return;
      }

      chunks.push(chunk);
      if (final) {
        entries.set(file.name, concatChunks(chunks));
      }
    };
    file.start();
  });

  unzip.register(UnzipPassThrough);
  unzip.register(UnzipInflate);

  const handle = archiveFile.open();
  try {
    const fileSize = handle.size ?? archiveFile.size;
    let offset = 0;

    while (offset < fileSize) {
      const length = Math.min(ARCHIVE_READ_CHUNK_SIZE_BYTES, fileSize - offset);
      handle.offset = offset;
      const chunk = handle.readBytes(length);
      if (chunk.byteLength === 0) {
        throw new Error('Backup archive read returned an empty chunk before EOF.');
      }
      offset += chunk.byteLength;
      unzip.push(chunk, offset >= fileSize);
      if (readError) {
        throw readError;
      }
    }
  } finally {
    handle.close();
  }

  if (readError) {
    throw readError;
  }

  const backupJson = entries.get(BACKUP_JSON_ENTRY_NAME);
  if (backupJson == null) {
    throw new Error('Backup archive is missing backup.json.');
  }

  return {
    backup: JSON.parse(strFromU8(backupJson)) as BackupEnvelope,
    entries,
  };
}

export function validateBackupArchiveEntries(
  archive: BackupArchive,
): BackupArchiveValidationResult {
  const entryNames = archive.entries;
  if (!entryNames.has(BACKUP_JSON_ENTRY_NAME)) {
    return { ok: false, message: 'Backup archive is missing backup.json.' };
  }

  const backup = archive.backup;
  if (backup.schemaVersion < 12) {
    return { ok: true };
  }

  const expectedEntries = new Set<string>([BACKUP_JSON_ENTRY_NAME]);

  for (const asset of getBackupPhotoAssets(backup)) {
    const assetValidation = validatePhotoAssetArchivePaths(asset);
    if (!assetValidation.ok) {
      return assetValidation;
    }

    expectedEntries.add(asset.master_relative_path);
    expectedEntries.add(asset.thumbnail_relative_path);
  }

  for (const expectedEntry of expectedEntries) {
    if (!entryNames.has(expectedEntry)) {
      return {
        ok: false,
        message: `Backup archive is missing ${expectedEntry}.`,
      };
    }
  }

  for (const entryName of entryNames.keys()) {
    if (!expectedEntries.has(entryName)) {
      return {
        ok: false,
        message: `Backup archive contains unexpected entry: ${entryName}`,
      };
    }
  }

  return { ok: true };
}

export function restorePhotoFilesFromArchive(archive: BackupArchive): readonly BackupPhotoAssetRow[] {
  if (archive.backup.schemaVersion < 12) {
    return [];
  }

  ensurePhotoRootDirectories();

  return getBackupPhotoAssets(archive.backup).map((asset) => {
    const masterBytes = archive.entries.get(asset.master_relative_path);
    const thumbnailBytes = archive.entries.get(asset.thumbnail_relative_path);
    if (masterBytes == null || thumbnailBytes == null) {
      throw new Error(`Backup archive is missing photo files for asset ${asset.id}.`);
    }

    const preferredStorageId =
      storageIdFromPhotoAssetRelativePath(asset.master_relative_path) ?? asset.id;
    const storageId = createCollisionFreeStorageId(preferredStorageId);
    getPhotoAssetDirectory(storageId).create({
      intermediates: true,
      idempotent: false,
    });

    const masterFile = getPhotoAssetFile(storageId, 'master');
    masterFile.create({ overwrite: true });
    masterFile.write(masterBytes);

    const thumbnailFile = getPhotoAssetFile(storageId, 'thumbnail');
    thumbnailFile.create({ overwrite: true });
    thumbnailFile.write(thumbnailBytes);

    return {
      ...asset,
      master_relative_path: getPhotoAssetRelativePath(storageId, 'master'),
      thumbnail_relative_path: getPhotoAssetRelativePath(storageId, 'thumbnail'),
    };
  });
}

export function isSafePhotoArchiveEntryPath(path: string): boolean {
  if (path.startsWith('/') || path.includes('://') || path.includes('\\')) {
    return false;
  }
  if (path.split('/').includes('..')) {
    return false;
  }
  return /^photo-assets\/[^/]+\/(?:master|thumbnail)\.jpg$/.test(path);
}

function validatePhotoAssetArchivePaths(
  asset: BackupPhotoAssetRow,
): BackupArchiveValidationResult {
  if (!isSafePhotoArchiveEntryPath(asset.master_relative_path)) {
    return {
      ok: false,
      message: `Backup archive has an unsafe master path for photo asset ${asset.id}.`,
    };
  }
  if (!isSafePhotoArchiveEntryPath(asset.thumbnail_relative_path)) {
    return {
      ok: false,
      message: `Backup archive has an unsafe thumbnail path for photo asset ${asset.id}.`,
    };
  }

  const masterStorageId = asset.master_relative_path.split('/')[1];
  const thumbnailStorageId = asset.thumbnail_relative_path.split('/')[1];
  if (masterStorageId !== thumbnailStorageId) {
    return {
      ok: false,
      message: `Backup archive path mismatch for photo asset ${asset.id}.`,
    };
  }

  return { ok: true };
}

function pushSingleChunkEntry(zip: Zip, filename: string, chunk: Uint8Array): void {
  const entry = new ZipPassThrough(filename);
  zip.add(entry);
  entry.push(chunk, true);
}

function pushFileEntry(zip: Zip, filename: string, file: FileLike): void {
  const entry = new ZipPassThrough(filename);
  zip.add(entry);

  const handle = file.open();
  try {
    const fileSize = handle.size ?? file.size;
    if (fileSize === 0) {
      entry.push(new Uint8Array(), true);
      return;
    }

    let offset = 0;
    while (offset < fileSize) {
      const length = Math.min(ARCHIVE_WRITE_CHUNK_SIZE_BYTES, fileSize - offset);
      handle.offset = offset;
      const chunk = handle.readBytes(length);
      if (chunk.byteLength === 0) {
        throw new Error(`Photo file read returned an empty chunk: ${filename}`);
      }
      offset += chunk.byteLength;
      entry.push(chunk, offset >= fileSize);
    }
  } finally {
    handle.close();
  }
}

function createAppendChunkWriter(file: FileLike): ArchiveChunkWriter {
  const handle = file.open();
  let bytesWritten = 0;

  return {
    get bytesWritten(): number {
      return bytesWritten;
    },
    write(chunk: Uint8Array): void {
      handle.offset = handle.size ?? file.size;
      handle.writeBytes(chunk);
      bytesWritten += chunk.byteLength;
    },
    close(): void {
      handle.close();
    },
  };
}

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const byteLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
