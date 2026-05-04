import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';

import type { PhotoSourceKind } from '@/models/types';

import {
  createPhotoDraftDirectory,
  getPhotoDraftMasterFile,
  getPhotoDraftThumbnailFile,
} from './drafts';

const MASTER_LONG_EDGE_LIMIT = 2400;
const THUMBNAIL_LONG_EDGE = 512;
const MASTER_BYTE_LIMIT = 2 * 1024 * 1024;
const MASTER_QUALITY_CANDIDATES = [0.85, 0.75, 0.65, 0.55] as const;
const MASTER_LONG_EDGE_CANDIDATES = [2400, 2000, 1600, 1200] as const;

export type NormalizedPhotoDraft = {
  readonly draftId: string;
  readonly masterUri: string;
  readonly thumbnailUri: string;
  readonly width: number;
  readonly height: number;
  readonly fileSizeBytes: number;
  readonly sourceKind: PhotoSourceKind;
};

export class PhotoFileError extends Error {
  readonly code: 'disk_full' | 'missing_source' | 'normalization_failed';
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    code: PhotoFileError['code'],
    message: string,
    options: { readonly retryable: boolean; readonly cause?: unknown },
  ) {
    super(message);
    this.name = 'PhotoFileError';
    this.code = code;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}

function isDiskFullError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /enospc|no space|disk full|quota/i.test(message);
}

function normalizeError(error: unknown): PhotoFileError {
  if (error instanceof PhotoFileError) {
    return error;
  }

  if (isDiskFullError(error)) {
    return new PhotoFileError('disk_full', 'Not enough storage to save this photo.', {
      retryable: true,
      cause: error,
    });
  }

  return new PhotoFileError('normalization_failed', 'Could not prepare this photo.', {
    retryable: true,
    cause: error,
  });
}

function getFileSize(file: File): number {
  try {
    const info = file.info();
    if (info.exists && typeof info.size === 'number') {
      return info.size;
    }
  } catch {
    // Fall through to the synchronous size property.
  }

  return file.size;
}

function copyFile(sourceUri: string, destination: File): void {
  if (destination.exists) {
    destination.delete();
  }

  new File(sourceUri).copy(destination);
}

function createResizeAction(width: number, height: number, longEdge: number): Action[] {
  const cappedLongEdge = Math.min(Math.max(width, height), longEdge);
  if (Math.max(width, height) <= cappedLongEdge) {
    return [];
  }

  return width >= height
    ? [{ resize: { width: cappedLongEdge } }]
    : [{ resize: { height: cappedLongEdge } }];
}

function assertReadableSource(sourceUri: string): void {
  if (!sourceUri.startsWith('file://')) {
    return;
  }

  const source = new File(sourceUri);
  if (!source.exists) {
    throw new PhotoFileError('missing_source', 'The selected photo is no longer available.', {
      retryable: true,
    });
  }
}

export async function normalizePhotoToDraft(input: {
  readonly sourceUri: string;
  readonly sourceKind: PhotoSourceKind;
  readonly draftId?: string;
}): Promise<NormalizedPhotoDraft> {
  try {
    assertReadableSource(input.sourceUri);
    const { draftId } = createPhotoDraftDirectory(input.draftId);
    const masterFile = getPhotoDraftMasterFile(draftId);
    const thumbnailFile = getPhotoDraftThumbnailFile(draftId);
    const probe = await manipulateAsync(input.sourceUri, [], {
      compress: MASTER_QUALITY_CANDIDATES[0],
      format: SaveFormat.JPEG,
    });
    let selectedMaster: { readonly uri: string; readonly width: number; readonly height: number } | null =
      null;

    for (const longEdge of MASTER_LONG_EDGE_CANDIDATES) {
      for (const quality of MASTER_QUALITY_CANDIDATES) {
        const result = await manipulateAsync(
          input.sourceUri,
          createResizeAction(probe.width, probe.height, Math.min(longEdge, MASTER_LONG_EDGE_LIMIT)),
          {
            compress: quality,
            format: SaveFormat.JPEG,
          },
        );
        const candidateSize = getFileSize(new File(result.uri));
        if (candidateSize <= MASTER_BYTE_LIMIT) {
          selectedMaster = result;
          break;
        }
      }

      if (selectedMaster) {
        break;
      }
    }

    if (!selectedMaster) {
      throw new PhotoFileError(
        'normalization_failed',
        'Photo is too large to save. Try a smaller image.',
        { retryable: true },
      );
    }

    copyFile(selectedMaster.uri, masterFile);

    const thumbnail = await manipulateAsync(
      masterFile.uri,
      createResizeAction(selectedMaster.width, selectedMaster.height, THUMBNAIL_LONG_EDGE),
      {
        compress: 0.8,
        format: SaveFormat.JPEG,
      },
    );
    copyFile(thumbnail.uri, thumbnailFile);

    return {
      draftId,
      masterUri: masterFile.uri,
      thumbnailUri: thumbnailFile.uri,
      width: selectedMaster.width,
      height: selectedMaster.height,
      fileSizeBytes: getFileSize(masterFile),
      sourceKind: input.sourceKind,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}
