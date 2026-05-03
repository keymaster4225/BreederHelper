import { Directory } from 'expo-file-system';

import { newId } from '@/utils/id';

import {
  ensurePhotoRootDirectories,
  getPhotoDraftDirectory,
  getPhotoDraftFile,
} from './paths';

export type PhotoDraftDirectory = {
  readonly draftId: string;
  readonly directory: Directory;
};

export function createPhotoDraftDirectory(draftId: string = newId()): PhotoDraftDirectory {
  ensurePhotoRootDirectories();
  const directory = getPhotoDraftDirectory(draftId);
  directory.create({ intermediates: true, idempotent: true });
  return { draftId, directory };
}

export function getPhotoDraftMasterFile(draftId: string) {
  return getPhotoDraftFile(draftId, 'master');
}

export function getPhotoDraftThumbnailFile(draftId: string) {
  return getPhotoDraftFile(draftId, 'thumbnail');
}

export function deletePhotoDraftDirectory(draftId: string): void {
  const directory = getPhotoDraftDirectory(draftId);
  if (!directory.exists) {
    return;
  }

  directory.delete();
}
