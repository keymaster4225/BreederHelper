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

type ChunkWriter = {
  readonly bytesWritten: number;
  write(chunk: Uint8Array): void;
  close(): void;
};

const FILE_COUNT = 100;
const FILE_SIZE_BYTES = 2 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 64 * 1024;

export type PhotosArchiveSpikeResult = {
  readonly platform: string;
  readonly fileSystemImportPath: 'expo-file-system';
  readonly bytesRoundTrip: boolean;
  readonly appendWrite: boolean;
  readonly streamedBytesWritten: number;
  readonly peakJsHeapBytes: number | null;
  readonly fallbackDecision: string;
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

  const archiveFile = new File(spikeDirectory, 'archive-output.bin');
  archiveFile.create({ overwrite: true });
  const writer = createAppendChunkWriter(archiveFile);
  let peakJsHeapBytes = readJsHeapBytes();

  for (let fileIndex = 0; fileIndex < FILE_COUNT; fileIndex += 1) {
    for (let offset = 0; offset < FILE_SIZE_BYTES; offset += CHUNK_SIZE_BYTES) {
      writer.write(createRepresentativeJpegChunk(fileIndex, offset));
      peakJsHeapBytes = maxNullable(peakJsHeapBytes, readJsHeapBytes());
    }
  }

  writer.close();

  return {
    platform,
    fileSystemImportPath: 'expo-file-system',
    bytesRoundTrip: sameBytes(expectedBytes, actualBytes),
    appendWrite: sameBytes(new Uint8Array([1, 2, 3, 4, 5, 6]), appendedBytes),
    streamedBytesWritten: writer.bytesWritten,
    peakJsHeapBytes,
    fallbackDecision:
      'Proceed only if this passes on both iOS and Android and peak JS heap remains below 150 MB.',
  };
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
