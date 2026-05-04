/*
 * Photos V1 Phase 0 archive spike.
 *
 * This file is intentionally not part of the app build. Run it only in a
 * development client or Expo runtime where native modules are available.
 *
 * SDK 55.0.16 finding:
 * - `expo-file-system/next` physically exists in node_modules, but it is not
 *   exported by expo-file-system/package.json.
 * - Use root `expo-file-system` imports for the new File/Directory/Paths APIs.
 */

import { Directory, File, Paths } from 'expo-file-system';
import {
  strFromU8,
  strToU8,
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  Zip,
  ZipPassThrough,
} from 'fflate';

type ChunkWriter = {
  readonly bytesWritten: number;
  write(chunk: Uint8Array): void;
  close(): void;
};

const FILE_COUNT = 100;
const FILE_SIZE_BYTES = 2 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 64 * 1024;
const THUMBNAIL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0xff, 0xd9]);
const ARCHIVE_FILE_NAME = 'photos-v1-archive-spike.breedwisebackup';

export type PhotosArchiveSpikeResult = {
  readonly platform: string;
  readonly fileSystemImportPath: 'expo-file-system';
  readonly zipLibrary: 'fflate';
  readonly zipApi: 'Zip + ZipPassThrough streaming callbacks';
  readonly bytesRoundTrip: boolean;
  readonly appendWrite: boolean;
  readonly archiveWrite: boolean;
  readonly archiveReadBack: boolean;
  readonly backupJsonEntry: boolean;
  readonly masterPhotoEntry: boolean;
  readonly thumbnailPhotoEntry: boolean;
  readonly manifestMatchesEntries: boolean;
  readonly archiveEntryCount: number;
  readonly streamedBytesWritten: number;
  readonly peakJsHeapBytes: number | null;
  readonly fallbackDecision: string;
};

type PhotoAssetManifestRow = {
  readonly id: string;
  readonly master_relative_path: string;
  readonly thumbnail_relative_path: string;
  readonly master_mime_type: 'image/jpeg';
  readonly thumbnail_mime_type: 'image/jpeg';
  readonly width: number;
  readonly height: number;
  readonly file_size_bytes: number;
  readonly source_kind: 'imported';
  readonly created_at: string;
  readonly updated_at: string;
};

type PhotoAttachmentManifestRow = {
  readonly id: string;
  readonly photo_asset_id: string;
  readonly owner_type: 'dailyLog';
  readonly owner_id: string;
  readonly role: 'attachment';
  readonly sort_order: number;
  readonly caption: null;
  readonly created_at: string;
  readonly updated_at: string;
};

type ArchiveManifest = {
  readonly app: {
    readonly name: 'BreedWise';
    readonly version: 'photos-v1-phase-0-spike';
  };
  readonly schemaVersion: 'photos-v1-phase-0-spike';
  readonly createdAt: string;
  readonly tables: {
    readonly photo_assets: readonly PhotoAssetManifestRow[];
    readonly photo_attachments: readonly PhotoAttachmentManifestRow[];
  };
};

type ArchiveReadBackResult = {
  readonly archiveReadBack: boolean;
  readonly backupJsonEntry: boolean;
  readonly masterPhotoEntry: boolean;
  readonly thumbnailPhotoEntry: boolean;
  readonly manifestMatchesEntries: boolean;
  readonly archiveEntryCount: number;
  readonly peakJsHeapBytes: number | null;
};

export async function runPhotosArchiveSpike(platform: string): Promise<PhotosArchiveSpikeResult> {
  const spikeDirectory = new Directory(Paths.cache, 'photos-archive-spike');
  spikeDirectory.create({ idempotent: true, intermediates: true });

  const roundTripFile = new File(spikeDirectory, 'round-trip.bin');
  roundTripFile.create({ overwrite: true });
  const expectedBytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
  roundTripFile.write(expectedBytes);
  const actualBytes = await roundTripFile.bytes();

  const appendFile = new File(spikeDirectory, 'append.bin');
  appendFile.create({ overwrite: true });
  appendFile.write(new Uint8Array([1, 2, 3]));
  appendFile.write(new Uint8Array([4, 5, 6]), { append: true });
  const appendedBytes = await appendFile.bytes();

  const manifest = buildArchiveManifest();
  const firstAsset = manifest.tables.photo_assets[0];
  const archiveFile = new File(spikeDirectory, ARCHIVE_FILE_NAME);
  archiveFile.create({ overwrite: true });
  const archiveWriteResult = writeArchiveSpikeFile(archiveFile, manifest);
  const archiveReadBackResult = readArchiveSpikeFile(archiveFile, firstAsset);

  return {
    platform,
    fileSystemImportPath: 'expo-file-system',
    zipLibrary: 'fflate',
    zipApi: 'Zip + ZipPassThrough streaming callbacks',
    bytesRoundTrip: sameBytes(expectedBytes, actualBytes),
    appendWrite: sameBytes(new Uint8Array([1, 2, 3, 4, 5, 6]), appendedBytes),
    archiveWrite: archiveWriteResult.archiveWrite,
    ...archiveReadBackResult,
    streamedBytesWritten: archiveWriteResult.streamedBytesWritten,
    peakJsHeapBytes: maxNullable(
      archiveWriteResult.peakJsHeapBytes,
      archiveReadBackResult.peakJsHeapBytes,
    ),
    fallbackDecision:
      'Proceed only if the real archive writer passes on both iOS and Android and peak JS heap remains below 150 MB.',
  };
}

function buildArchiveManifest(): ArchiveManifest {
  const createdAt = new Date(0).toISOString();
  const photoAssets: PhotoAssetManifestRow[] = [];
  const photoAttachments: PhotoAttachmentManifestRow[] = [];

  for (let index = 0; index < FILE_COUNT; index += 1) {
    const storageId = `spike-asset-${String(index + 1).padStart(3, '0')}`;
    const assetId = `asset-${String(index + 1).padStart(3, '0')}`;

    photoAssets.push({
      id: assetId,
      master_relative_path: `photo-assets/${storageId}/master.jpg`,
      thumbnail_relative_path: `photo-assets/${storageId}/thumbnail.jpg`,
      master_mime_type: 'image/jpeg',
      thumbnail_mime_type: 'image/jpeg',
      width: 2400,
      height: 1600,
      file_size_bytes: FILE_SIZE_BYTES,
      source_kind: 'imported',
      created_at: createdAt,
      updated_at: createdAt,
    });

    photoAttachments.push({
      id: `attachment-${String(index + 1).padStart(3, '0')}`,
      photo_asset_id: assetId,
      owner_type: 'dailyLog',
      owner_id: 'daily-log-spike',
      role: 'attachment',
      sort_order: index,
      caption: null,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  return {
    app: {
      name: 'BreedWise',
      version: 'photos-v1-phase-0-spike',
    },
    schemaVersion: 'photos-v1-phase-0-spike',
    createdAt,
    tables: {
      photo_assets: photoAssets,
      photo_attachments: photoAttachments,
    },
  };
}

function writeArchiveSpikeFile(
  archiveFile: File,
  manifest: ArchiveManifest,
): {
  readonly archiveWrite: boolean;
  readonly streamedBytesWritten: number;
  readonly peakJsHeapBytes: number | null;
} {
  const writer = createAppendChunkWriter(archiveFile);
  let peakJsHeapBytes = readJsHeapBytes();
  let archiveWrite = false;
  let archiveError: Error | null = null;

  const zip = new Zip((error, chunk, final) => {
    if (error) {
      archiveError = error;
      return;
    }

    writer.write(chunk);
    peakJsHeapBytes = maxNullable(peakJsHeapBytes, readJsHeapBytes());

    if (final) {
      archiveWrite = true;
    }
  });

  try {
    pushZipEntry(zip, 'backup.json', [strToU8(JSON.stringify(manifest))]);

    manifest.tables.photo_assets.forEach((asset, index) => {
      pushZipEntry(zip, asset.master_relative_path, createMasterChunks(index));
      pushZipEntry(zip, asset.thumbnail_relative_path, [THUMBNAIL_BYTES]);
      peakJsHeapBytes = maxNullable(peakJsHeapBytes, readJsHeapBytes());
    });

    zip.end();

    if (archiveError) {
      throw archiveError;
    }
  } finally {
    writer.close();
  }

  return {
    archiveWrite,
    streamedBytesWritten: writer.bytesWritten,
    peakJsHeapBytes,
  };
}

function pushZipEntry(zip: Zip, filename: string, chunks: Iterable<Uint8Array>): void {
  const entry = new ZipPassThrough(filename);
  zip.add(entry);

  const chunkArray = Array.from(chunks);
  chunkArray.forEach((chunk, index) => {
    entry.push(chunk, index === chunkArray.length - 1);
  });
}

function* createMasterChunks(fileIndex: number): Iterable<Uint8Array> {
  for (let offset = 0; offset < FILE_SIZE_BYTES; offset += CHUNK_SIZE_BYTES) {
    yield createRepresentativeJpegChunk(fileIndex, offset);
  }
}

function readArchiveSpikeFile(
  archiveFile: File,
  firstAsset: PhotoAssetManifestRow | undefined,
): ArchiveReadBackResult {
  const entryNames = new Set<string>();
  const backupJsonChunks: Uint8Array[] = [];
  let readError: Error | null = null;
  let peakJsHeapBytes = readJsHeapBytes();

  const unzip = new Unzip((file) => {
    entryNames.add(file.name);
    file.ondata = (error, chunk) => {
      if (error) {
        readError = error;
        return;
      }

      if (file.name === 'backup.json') {
        backupJsonChunks.push(chunk);
      }
      peakJsHeapBytes = maxNullable(peakJsHeapBytes, readJsHeapBytes());
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
      const length = Math.min(CHUNK_SIZE_BYTES, fileSize - offset);
      handle.offset = offset;
      const chunk = handle.readBytes(length);
      if (chunk.byteLength === 0) {
        throw new Error('Archive read returned an empty chunk before EOF.');
      }
      offset += chunk.byteLength;
      unzip.push(chunk, offset >= fileSize);
      peakJsHeapBytes = maxNullable(peakJsHeapBytes, readJsHeapBytes());
    }
  } finally {
    handle.close();
  }

  if (readError) {
    throw readError;
  }

  const backupJsonEntry = entryNames.has('backup.json');
  const parsedManifest = parseManifestFromChunks(backupJsonChunks);
  const masterPhotoEntry = firstAsset
    ? entryNames.has(firstAsset.master_relative_path)
    : false;
  const thumbnailPhotoEntry = firstAsset
    ? entryNames.has(firstAsset.thumbnail_relative_path)
    : false;
  const manifestMatchesEntries = parsedManifest
    ? manifestMatchesArchiveEntries(parsedManifest, entryNames)
    : false;

  return {
    archiveReadBack: backupJsonEntry && entryNames.size > 0,
    backupJsonEntry,
    masterPhotoEntry,
    thumbnailPhotoEntry,
    manifestMatchesEntries,
    archiveEntryCount: entryNames.size,
    peakJsHeapBytes,
  };
}

function parseManifestFromChunks(chunks: readonly Uint8Array[]): ArchiveManifest | null {
  if (chunks.length === 0) {
    return null;
  }

  try {
    return JSON.parse(strFromU8(concatChunks(chunks))) as ArchiveManifest;
  } catch {
    return null;
  }
}

function manifestMatchesArchiveEntries(
  manifest: ArchiveManifest,
  entryNames: ReadonlySet<string>,
): boolean {
  const manifestPaths = new Set<string>(['backup.json']);

  for (const asset of manifest.tables.photo_assets) {
    if (!isSafePhotoArchivePath(asset.master_relative_path)) {
      return false;
    }
    if (!isSafePhotoArchivePath(asset.thumbnail_relative_path)) {
      return false;
    }

    manifestPaths.add(asset.master_relative_path);
    manifestPaths.add(asset.thumbnail_relative_path);
  }

  if (manifestPaths.size !== entryNames.size) {
    return false;
  }

  for (const path of manifestPaths) {
    if (!entryNames.has(path)) {
      return false;
    }
  }

  return true;
}

function isSafePhotoArchivePath(path: string): boolean {
  if (!path.startsWith('photo-assets/')) {
    return false;
  }
  if (path.startsWith('/') || path.includes('://') || path.includes('\\')) {
    return false;
  }
  if (path.split('/').includes('..')) {
    return false;
  }
  return /^photo-assets\/[^/]+\/(?:master|thumbnail)\.jpg$/.test(path);
}

function createAppendChunkWriter(file: File): ChunkWriter {
  const handle = file.open();
  let bytesWritten = 0;

  return {
    get bytesWritten(): number {
      return bytesWritten;
    },
    write(chunk: Uint8Array): void {
      handle.offset = handle.size;
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

function createRepresentativeJpegChunk(fileIndex: number, offset: number): Uint8Array {
  const chunk = new Uint8Array(CHUNK_SIZE_BYTES);
  chunk[0] = 0xff;
  chunk[1] = 0xd8;
  chunk[2] = fileIndex % 256;
  chunk[3] = Math.floor(offset / CHUNK_SIZE_BYTES) % 256;
  chunk[CHUNK_SIZE_BYTES - 2] = 0xff;
  chunk[CHUNK_SIZE_BYTES - 1] = 0xd9;
  return chunk;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function readJsHeapBytes(): number | null {
  const performanceWithMemory = globalThis.performance as
    | (Performance & { memory?: { usedJSHeapSize?: number } })
    | undefined;

  return performanceWithMemory?.memory?.usedJSHeapSize ?? null;
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left == null) {
    return right;
  }
  if (right == null) {
    return left;
  }
  return Math.max(left, right);
}
