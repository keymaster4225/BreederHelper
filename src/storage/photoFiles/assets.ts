import { File } from 'expo-file-system';

import type { PhotoAsset, UUID } from '@/models/types';
import { newId } from '@/utils/id';

import type { NormalizedPhotoDraft } from './normalize';
import { deletePhotoDraftDirectory } from './drafts';
import {
  ensurePhotoRootDirectories,
  getPhotoAssetDirectory,
  getPhotoAssetFile,
  getPhotoAssetRelativePath,
  resolvePhotoAssetUri,
  storageIdFromPhotoAssetRelativePath,
} from './paths';
import { assertPhotoStorageReadyForWrites, withPhotoStorageLock } from './mutex';

function copyFile(sourceUri: string, destination: File): void {
  if (destination.exists) {
    destination.delete();
  }

  new File(sourceUri).copy(destination);
}

function createCollisionFreeStorageId(preferredStorageId: string): string {
  let storageId = preferredStorageId;
  let attempts = 0;

  while (getPhotoAssetDirectory(storageId).exists) {
    attempts += 1;
    storageId = `${preferredStorageId}-${newId()}`;

    if (attempts > 10) {
      throw new Error('Could not allocate photo storage directory.');
    }
  }

  return storageId;
}

export async function finalizePhotoDraft(input: {
  readonly assetId: UUID;
  readonly draft: NormalizedPhotoDraft;
  readonly storageId?: string;
  readonly now?: string;
}): Promise<PhotoAsset> {
  assertPhotoStorageReadyForWrites();

  return withPhotoStorageLock(async () => {
    ensurePhotoRootDirectories();
    const storageId = createCollisionFreeStorageId(input.storageId ?? input.assetId);
    const assetDirectory = getPhotoAssetDirectory(storageId);
    assetDirectory.create({ intermediates: true, idempotent: false });

    copyFile(input.draft.masterUri, getPhotoAssetFile(storageId, 'master'));
    copyFile(input.draft.thumbnailUri, getPhotoAssetFile(storageId, 'thumbnail'));
    deletePhotoDraftDirectory(input.draft.draftId);

    const now = input.now ?? new Date().toISOString();

    return {
      id: input.assetId,
      masterRelativePath: getPhotoAssetRelativePath(storageId, 'master'),
      thumbnailRelativePath: getPhotoAssetRelativePath(storageId, 'thumbnail'),
      masterMimeType: 'image/jpeg',
      thumbnailMimeType: 'image/jpeg',
      width: input.draft.width,
      height: input.draft.height,
      fileSizeBytes: input.draft.fileSizeBytes,
      sourceKind: input.draft.sourceKind,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function resolvePhotoUri(relativePath: string): string {
  return resolvePhotoAssetUri(relativePath);
}

export async function deletePhotoAssetDirectoryByStorageId(storageId: string): Promise<void> {
  await withPhotoStorageLock(async () => {
    const directory = getPhotoAssetDirectory(storageId);
    if (directory.exists) {
      directory.delete();
    }
  });
}

export async function deletePhotoAssetDirectoryByRelativePath(
  relativePath: string,
): Promise<void> {
  const storageId = storageIdFromPhotoAssetRelativePath(relativePath);
  if (storageId == null) {
    return;
  }

  await deletePhotoAssetDirectoryByStorageId(storageId);
}
