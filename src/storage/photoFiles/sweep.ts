import { Directory } from 'expo-file-system';

import type { PhotoOwnerType } from '@/models/types';
import { getDb } from '@/storage/db';
import type { RepoDb } from '@/storage/repositories/internal/dbTypes';

import {
  ensurePhotoRootDirectories,
  getPhotoAssetDirectory,
  getPhotoAssetsDirectory,
  getPhotoDraftsDirectory,
  resolvePhotoAssetFile,
  storageIdFromPhotoAssetRelativePath,
} from './paths';
import { markPhotoStorageReadyForWrites, withPhotoStorageLock } from './mutex';

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const NEW_ASSET_GRACE_MS = 60 * 1000;

type PhotoAssetRow = {
  readonly id: string;
  readonly master_relative_path: string;
  readonly thumbnail_relative_path: string;
};

type PhotoAttachmentRow = {
  readonly id: string;
  readonly photo_asset_id: string;
  readonly owner_type: PhotoOwnerType;
  readonly owner_id: string;
};

type IdRow = {
  readonly id: string;
};

export type PhotoSweepResult = {
  readonly staleDraftsDeleted: number;
  readonly orphanAssetDirectoriesDeleted: number;
  readonly missingFileAssetsDeleted: number;
  readonly danglingOwnerAttachmentsDeleted: number;
  readonly orphanAssetRowsDeleted: number;
};

const OWNER_TABLES: Readonly<Record<PhotoOwnerType, string>> = {
  mare: 'mares',
  stallion: 'stallions',
  dailyLog: 'daily_logs',
  pregnancyCheck: 'pregnancy_checks',
  foalingRecord: 'foaling_records',
};

function isDirectory(entry: Directory | unknown): entry is Directory {
  return entry instanceof Directory;
}

function getDirectoryMtimeMs(directory: Directory, fallback: number): number {
  try {
    return directory.info().modificationTime ?? fallback;
  } catch {
    return fallback;
  }
}

function deleteDirectoryBestEffort(directory: Directory): boolean {
  try {
    if (directory.exists) {
      directory.delete();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function fileExists(relativePath: string): boolean {
  try {
    return resolvePhotoAssetFile(relativePath).exists;
  } catch {
    return false;
  }
}

async function ownerExists(attachment: PhotoAttachmentRow, db: RepoDb): Promise<boolean> {
  const tableName = OWNER_TABLES[attachment.owner_type];
  const row = await db.getFirstAsync<IdRow>(
    `SELECT id FROM ${tableName} WHERE id = ? LIMIT 1;`,
    [attachment.owner_id],
  );
  return row != null;
}

async function deleteRows(
  tableName: 'photo_attachments' | 'photo_assets',
  ids: readonly string[],
  db: RepoDb,
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(`DELETE FROM ${tableName} WHERE id IN (${placeholders});`, ids);
}

async function cleanupStaleDrafts(nowMs: number): Promise<number> {
  const draftRoot = getPhotoDraftsDirectory();
  if (!draftRoot.exists) {
    return 0;
  }

  let deleted = 0;
  for (const entry of draftRoot.list()) {
    if (!isDirectory(entry)) {
      continue;
    }

    const mtime = getDirectoryMtimeMs(entry, 0);
    if (nowMs - mtime > DRAFT_MAX_AGE_MS && deleteDirectoryBestEffort(entry)) {
      deleted += 1;
    }
  }

  return deleted;
}

async function sweepUnlocked(db: RepoDb, nowMs: number): Promise<PhotoSweepResult> {
  ensurePhotoRootDirectories();

  const staleDraftsDeleted = await cleanupStaleDrafts(nowMs);
  const assets = await db.getAllAsync<PhotoAssetRow>(
    `
    SELECT id, master_relative_path, thumbnail_relative_path
    FROM photo_assets;
    `,
  );
  const attachments = await db.getAllAsync<PhotoAttachmentRow>(
    `
    SELECT id, photo_asset_id, owner_type, owner_id
    FROM photo_attachments;
    `,
  );

  const attachmentIdsToDelete = new Set<string>();
  const assetIdsToDelete = new Set<string>();
  const storageIdsToDelete = new Set<string>();
  let missingFileAssetsDeleted = 0;
  let danglingOwnerAttachmentsDeleted = 0;

  for (const asset of assets) {
    const masterStorageId = storageIdFromPhotoAssetRelativePath(asset.master_relative_path);
    const thumbnailStorageId = storageIdFromPhotoAssetRelativePath(asset.thumbnail_relative_path);
    const storageId =
      masterStorageId && masterStorageId === thumbnailStorageId ? masterStorageId : null;

    if (
      storageId == null ||
      !fileExists(asset.master_relative_path) ||
      !fileExists(asset.thumbnail_relative_path)
    ) {
      assetIdsToDelete.add(asset.id);
      if (masterStorageId) {
        storageIdsToDelete.add(masterStorageId);
      }
      if (thumbnailStorageId) {
        storageIdsToDelete.add(thumbnailStorageId);
      }
      missingFileAssetsDeleted += 1;
    }
  }

  for (const attachment of attachments) {
    if (assetIdsToDelete.has(attachment.photo_asset_id)) {
      attachmentIdsToDelete.add(attachment.id);
      continue;
    }

    if (!(await ownerExists(attachment, db))) {
      attachmentIdsToDelete.add(attachment.id);
      danglingOwnerAttachmentsDeleted += 1;
    }
  }

  const survivingAttachmentAssetIds = new Set(
    attachments
      .filter((attachment) => !attachmentIdsToDelete.has(attachment.id))
      .map((attachment) => attachment.photo_asset_id),
  );

  for (const asset of assets) {
    if (!assetIdsToDelete.has(asset.id) && !survivingAttachmentAssetIds.has(asset.id)) {
      assetIdsToDelete.add(asset.id);
      const storageId = storageIdFromPhotoAssetRelativePath(asset.master_relative_path);
      if (storageId) {
        storageIdsToDelete.add(storageId);
      }
    }
  }

  await db.withTransactionAsync(async () => {
    await deleteRows('photo_attachments', Array.from(attachmentIdsToDelete), db);
    await deleteRows('photo_assets', Array.from(assetIdsToDelete), db);
  });

  for (const storageId of storageIdsToDelete) {
    deleteDirectoryBestEffort(getPhotoAssetDirectory(storageId));
  }

  let orphanAssetDirectoriesDeleted = 0;
  const validStorageIds = new Set(
    assets
      .filter((asset) => !assetIdsToDelete.has(asset.id))
      .map((asset) => storageIdFromPhotoAssetRelativePath(asset.master_relative_path))
      .filter((storageId): storageId is string => storageId != null),
  );

  const assetRoot = getPhotoAssetsDirectory();
  if (assetRoot.exists) {
    for (const entry of assetRoot.list()) {
      if (!isDirectory(entry) || validStorageIds.has(entry.name)) {
        continue;
      }

      const mtime = getDirectoryMtimeMs(entry, nowMs);
      if (nowMs - mtime < NEW_ASSET_GRACE_MS) {
        continue;
      }

      if (deleteDirectoryBestEffort(entry)) {
        orphanAssetDirectoriesDeleted += 1;
      }
    }
  }

  return {
    staleDraftsDeleted,
    orphanAssetDirectoriesDeleted,
    missingFileAssetsDeleted,
    danglingOwnerAttachmentsDeleted,
    orphanAssetRowsDeleted: assetIdsToDelete.size - missingFileAssetsDeleted,
  };
}

export async function runPhotoConsistencySweep(
  db?: RepoDb,
  nowMs: number = Date.now(),
): Promise<PhotoSweepResult> {
  const handle = db ?? ((await getDb()) as unknown as RepoDb);
  return withPhotoStorageLock(() => sweepUnlocked(handle, nowMs));
}

export async function runBootPhotoConsistencySweep(
  db?: RepoDb,
  nowMs: number = Date.now(),
): Promise<PhotoSweepResult> {
  const handle = db ?? ((await getDb()) as unknown as RepoDb);
  const result = await withPhotoStorageLock(() => sweepUnlocked(handle, nowMs));
  markPhotoStorageReadyForWrites();
  return result;
}

export async function preparePhotoStorageForExclusiveOperation(db?: RepoDb): Promise<void> {
  await runPhotoConsistencySweep(db);
}
