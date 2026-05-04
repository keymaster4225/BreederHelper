import { Directory, File, Paths } from 'expo-file-system';

export const PHOTO_ASSETS_DIR_NAME = 'photo-assets';
export const PHOTO_DRAFTS_DIR_NAME = 'photo-drafts';
export const PHOTO_MASTER_FILE_NAME = 'master.jpg';
export const PHOTO_THUMBNAIL_FILE_NAME = 'thumbnail.jpg';

export type PhotoFileVariant = 'master' | 'thumbnail';

const PHOTO_FILE_NAMES: Readonly<Record<PhotoFileVariant, string>> = {
  master: PHOTO_MASTER_FILE_NAME,
  thumbnail: PHOTO_THUMBNAIL_FILE_NAME,
};

function assertSafeSegment(value: string, label: string): void {
  if (
    value.length === 0 ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    value.includes(':')
  ) {
    throw new Error(`Invalid ${label}.`);
  }
}

export function getPhotoAssetsDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_ASSETS_DIR_NAME);
}

export function getPhotoDraftsDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DRAFTS_DIR_NAME);
}

export function getPhotoAssetDirectory(storageId: string): Directory {
  assertSafeSegment(storageId, 'photo storage id');
  return new Directory(getPhotoAssetsDirectory(), storageId);
}

export function getPhotoDraftDirectory(draftId: string): Directory {
  assertSafeSegment(draftId, 'photo draft id');
  return new Directory(getPhotoDraftsDirectory(), draftId);
}

export function getPhotoAssetFile(storageId: string, variant: PhotoFileVariant): File {
  return new File(getPhotoAssetDirectory(storageId), PHOTO_FILE_NAMES[variant]);
}

export function getPhotoDraftFile(draftId: string, variant: PhotoFileVariant): File {
  return new File(getPhotoDraftDirectory(draftId), PHOTO_FILE_NAMES[variant]);
}

export function getPhotoAssetRelativePath(
  storageId: string,
  variant: PhotoFileVariant,
): string {
  assertSafeSegment(storageId, 'photo storage id');
  return `${PHOTO_ASSETS_DIR_NAME}/${storageId}/${PHOTO_FILE_NAMES[variant]}`;
}

export function storageIdFromPhotoAssetRelativePath(relativePath: string): string | null {
  const parts = relativePath.split('/');
  if (
    parts.length !== 3 ||
    parts[0] !== PHOTO_ASSETS_DIR_NAME ||
    (parts[2] !== PHOTO_MASTER_FILE_NAME && parts[2] !== PHOTO_THUMBNAIL_FILE_NAME)
  ) {
    return null;
  }

  try {
    assertSafeSegment(parts[1] ?? '', 'photo storage id');
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

export function assertSafePhotoAssetRelativePath(relativePath: string): void {
  if (storageIdFromPhotoAssetRelativePath(relativePath) == null) {
    throw new Error('Invalid photo asset relative path.');
  }
}

export function resolvePhotoAssetFile(relativePath: string): File {
  assertSafePhotoAssetRelativePath(relativePath);
  return new File(Paths.document, relativePath);
}

export function resolvePhotoAssetUri(relativePath: string): string {
  return resolvePhotoAssetFile(relativePath).uri;
}

export function ensurePhotoRootDirectories(): void {
  getPhotoAssetsDirectory().create({ intermediates: true, idempotent: true });
  getPhotoDraftsDirectory().create({ intermediates: true, idempotent: true });
}
