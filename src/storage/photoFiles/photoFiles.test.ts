import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystemMock = vi.hoisted(() => {
  type Entry = {
    readonly type: 'file' | 'directory';
    size: number;
    modificationTime: number;
  };

  const entries = new Map<string, Entry>();
  const imageResults: Array<{
    readonly uri: string;
    readonly width: number;
    readonly height: number;
    readonly size: number;
  }> = [];

  function normalizeUri(uri: string): string {
    return uri.replace(/\/+$/, '');
  }

  function partUri(part: string | { readonly uri: string }): string {
    return typeof part === 'string' ? part : part.uri;
  }

  function joinParts(parts: readonly (string | { readonly uri: string })[]): string {
    return normalizeUri(
      parts
        .map(partUri)
        .reduce((acc, part) => {
          if (acc.length === 0) {
            return part;
          }
          return `${normalizeUri(acc)}/${part.replace(/^\/+/, '')}`;
        }, ''),
    );
  }

  function deleteTree(uri: string): void {
    const normalized = normalizeUri(uri);
    for (const key of Array.from(entries.keys())) {
      if (key === normalized || key.startsWith(`${normalized}/`)) {
        entries.delete(key);
      }
    }
  }

  function basename(uri: string): string {
    return normalizeUri(uri).split('/').pop() ?? '';
  }

  class MockFile {
    readonly uri: string;

    constructor(...parts: (string | MockFile | MockDirectory)[]) {
      this.uri = joinParts(parts);
    }

    get exists(): boolean {
      return entries.get(this.uri)?.type === 'file';
    }

    get size(): number {
      return entries.get(this.uri)?.size ?? 0;
    }

    get name(): string {
      return basename(this.uri);
    }

    create(): void {
      entries.set(this.uri, { type: 'file', size: 0, modificationTime: Date.now() });
    }

    copy(destination: MockFile | MockDirectory): void {
      if (!this.exists) {
        throw new Error(`Missing source file: ${this.uri}`);
      }

      const target =
        destination instanceof MockDirectory ? new MockFile(destination, this.name) : destination;
      entries.set(target.uri, {
        type: 'file',
        size: this.size,
        modificationTime: Date.now(),
      });
    }

    delete(): void {
      entries.delete(this.uri);
    }

    info() {
      return {
        exists: this.exists,
        uri: this.uri,
        size: this.size,
        modificationTime: entries.get(this.uri)?.modificationTime,
      };
    }
  }

  class MockDirectory {
    readonly uri: string;

    constructor(...parts: (string | MockFile | MockDirectory)[]) {
      this.uri = joinParts(parts);
    }

    get exists(): boolean {
      return entries.get(this.uri)?.type === 'directory';
    }

    get name(): string {
      return basename(this.uri);
    }

    create(): void {
      entries.set(this.uri, {
        type: 'directory',
        size: 0,
        modificationTime: Date.now(),
      });
    }

    delete(): void {
      deleteTree(this.uri);
    }

    list(): Array<MockDirectory | MockFile> {
      const prefix = `${this.uri}/`;
      const children = new Map<string, Entry>();
      for (const [uri, entry] of entries) {
        if (!uri.startsWith(prefix)) {
          continue;
        }

        const rest = uri.slice(prefix.length);
        if (rest.length === 0 || rest.includes('/')) {
          continue;
        }
        children.set(uri, entry);
      }

      return Array.from(children, ([uri, entry]) =>
        entry.type === 'directory' ? new MockDirectory(uri) : new MockFile(uri),
      );
    }

    info() {
      return {
        exists: this.exists,
        uri: this.uri,
        modificationTime: entries.get(this.uri)?.modificationTime,
      };
    }
  }

  function reset(): void {
    entries.clear();
    imageResults.length = 0;
    entries.set('file:///documents', {
      type: 'directory',
      size: 0,
      modificationTime: Date.now(),
    });
  }

  function putDirectory(uri: string, modificationTime = Date.now()): void {
    entries.set(normalizeUri(uri), { type: 'directory', size: 0, modificationTime });
  }

  function putFile(uri: string, size = 1, modificationTime = Date.now()): void {
    entries.set(normalizeUri(uri), { type: 'file', size, modificationTime });
  }

  const manipulateAsync = vi.fn(async () => {
    const result = imageResults.shift() ?? {
      uri: `file:///cache/manipulated-${Date.now()}.jpg`,
      width: 1600,
      height: 1200,
      size: 1024,
    };
    putFile(result.uri, result.size);
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  });

  reset();

  return {
    entries,
    imageResults,
    manipulateAsync,
    reset,
    putDirectory,
    putFile,
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      document: new MockDirectory('file:///documents'),
      cache: new MockDirectory('file:///cache'),
    },
  };
});

vi.mock('expo-file-system', () => ({
  Directory: fileSystemMock.Directory,
  File: fileSystemMock.File,
  Paths: fileSystemMock.Paths,
}));

vi.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
  },
  manipulateAsync: fileSystemMock.manipulateAsync,
}));

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { createRepoDb, type SqlCall } from '@/test/repoDb';
import { finalizePhotoDraft } from './assets';
import { markPhotoStorageReadyForWrites, resetPhotoStorageReadinessForTests } from './mutex';
import { normalizePhotoToDraft, PhotoFileError } from './normalize';
import { getPhotoAssetRelativePath, resolvePhotoAssetUri } from './paths';
import { runBootPhotoConsistencySweep } from './sweep';

describe('photo file service', () => {
  beforeEach(() => {
    fileSystemMock.reset();
    fileSystemMock.manipulateAsync.mockClear();
    resetPhotoStorageReadinessForTests();
  });

  it('stores and resolves only safe relative asset paths', () => {
    expect(getPhotoAssetRelativePath('asset-1', 'master')).toBe(
      'photo-assets/asset-1/master.jpg',
    );
    expect(resolvePhotoAssetUri('photo-assets/asset-1/thumbnail.jpg')).toBe(
      'file:///documents/photo-assets/asset-1/thumbnail.jpg',
    );
    expect(() => getPhotoAssetRelativePath('../bad', 'master')).toThrow(
      'Invalid photo storage id.',
    );
    expect(() => resolvePhotoAssetUri('../photo-assets/asset-1/master.jpg')).toThrow(
      'Invalid photo asset relative path.',
    );
  });

  it('normalizes a source file into draft master and thumbnail files', async () => {
    fileSystemMock.putFile('file:///library/source.png', 500000);
    fileSystemMock.imageResults.push(
      { uri: 'file:///cache/probe.jpg', width: 3200, height: 2400, size: 2600000 },
      { uri: 'file:///cache/master.jpg', width: 2400, height: 1800, size: 1800000 },
      { uri: 'file:///cache/thumb.jpg', width: 512, height: 384, size: 120000 },
    );

    const draft = await normalizePhotoToDraft({
      sourceUri: 'file:///library/source.png',
      sourceKind: 'library',
      draftId: 'draft-1',
    });

    expect(draft).toMatchObject({
      draftId: 'draft-1',
      masterUri: 'file:///documents/photo-drafts/draft-1/master.jpg',
      thumbnailUri: 'file:///documents/photo-drafts/draft-1/thumbnail.jpg',
      width: 2400,
      height: 1800,
      fileSizeBytes: 1800000,
      sourceKind: 'library',
    });
    expect(fileSystemMock.entries.has(draft.masterUri)).toBe(true);
    expect(fileSystemMock.entries.has(draft.thumbnailUri)).toBe(true);
  });

  it('surfaces a retryable missing-source error before normalization', async () => {
    await expect(
      normalizePhotoToDraft({
        sourceUri: 'file:///library/missing.jpg',
        sourceKind: 'camera',
      }),
    ).rejects.toMatchObject({
      code: 'missing_source',
      retryable: true,
    } satisfies Partial<PhotoFileError>);
  });

  it('blocks finalization until the boot sweep has marked photo storage ready', async () => {
    const draft = {
      draftId: 'draft-1',
      masterUri: 'file:///documents/photo-drafts/draft-1/master.jpg',
      thumbnailUri: 'file:///documents/photo-drafts/draft-1/thumbnail.jpg',
      width: 1600,
      height: 1200,
      fileSizeBytes: 1000,
      sourceKind: 'camera' as const,
    };

    await expect(finalizePhotoDraft({ assetId: 'asset-1', draft })).rejects.toThrow(
      'Photo storage is not ready yet.',
    );

    fileSystemMock.putDirectory('file:///documents/photo-drafts');
    fileSystemMock.putDirectory('file:///documents/photo-drafts/draft-1');
    fileSystemMock.putFile(draft.masterUri, 1000);
    fileSystemMock.putFile(draft.thumbnailUri, 100);
    markPhotoStorageReadyForWrites();

    await expect(
      finalizePhotoDraft({
        assetId: 'asset-1',
        draft,
        now: '2026-05-02T12:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      id: 'asset-1',
      masterRelativePath: 'photo-assets/asset-1/master.jpg',
      thumbnailRelativePath: 'photo-assets/asset-1/thumbnail.jpg',
      masterMimeType: 'image/jpeg',
      thumbnailMimeType: 'image/jpeg',
    });
    expect(fileSystemMock.entries.has('file:///documents/photo-drafts/draft-1')).toBe(false);
    expect(fileSystemMock.entries.has('file:///documents/photo-assets/asset-1/master.jpg')).toBe(
      true,
    );
  });

  it('sweeps stale drafts, orphan files, missing-file rows, and dangling owners', async () => {
    const now = Date.UTC(2026, 4, 2, 12, 0, 0);
    const assets = new Map([
      [
        'missing-asset',
        {
          id: 'missing-asset',
          master_relative_path: 'photo-assets/missing-asset/master.jpg',
          thumbnail_relative_path: 'photo-assets/missing-asset/thumbnail.jpg',
        },
      ],
      [
        'dangling-owner-asset',
        {
          id: 'dangling-owner-asset',
          master_relative_path: 'photo-assets/dangling-owner-asset/master.jpg',
          thumbnail_relative_path: 'photo-assets/dangling-owner-asset/thumbnail.jpg',
        },
      ],
    ]);
    const attachments = new Map([
      [
        'missing-attachment',
        {
          id: 'missing-attachment',
          photo_asset_id: 'missing-asset',
          owner_type: 'dailyLog' as const,
          owner_id: 'log-1',
        },
      ],
      [
        'dangling-owner-attachment',
        {
          id: 'dangling-owner-attachment',
          photo_asset_id: 'dangling-owner-asset',
          owner_type: 'dailyLog' as const,
          owner_id: 'missing-log',
        },
      ],
    ]);
    const existingOwners = new Set(['log-1']);
    const db = createRepoDb({
      async onTransaction(callback) {
        return callback();
      },
      onGetAll<T>(call: SqlCall) {
        if (call.normalizedSql.includes('from photo_assets')) {
          return Array.from(assets.values()) as T[];
        }
        if (call.normalizedSql.includes('from photo_attachments')) {
          return Array.from(attachments.values()) as T[];
        }
        return [];
      },
      onGetFirst<T>(call: SqlCall) {
        if (call.normalizedSql.includes('from daily_logs')) {
          return existingOwners.has(call.params[0] as string)
            ? ({ id: call.params[0] } as T)
            : null;
        }
        return null;
      },
      onRun(call) {
        if (call.normalizedSql.startsWith('delete from photo_attachments')) {
          for (const id of call.params as string[]) {
            attachments.delete(id);
          }
        }
        if (call.normalizedSql.startsWith('delete from photo_assets')) {
          for (const id of call.params as string[]) {
            assets.delete(id);
          }
        }
      },
    });

    fileSystemMock.putDirectory('file:///documents/photo-drafts');
    fileSystemMock.putDirectory('file:///documents/photo-drafts/old-draft', now - 25 * 60 * 60 * 1000);
    fileSystemMock.putDirectory('file:///documents/photo-assets');
    fileSystemMock.putDirectory('file:///documents/photo-assets/missing-asset', now - 120000);
    fileSystemMock.putFile('file:///documents/photo-assets/missing-asset/master.jpg');
    fileSystemMock.putDirectory('file:///documents/photo-assets/dangling-owner-asset', now - 120000);
    fileSystemMock.putFile('file:///documents/photo-assets/dangling-owner-asset/master.jpg');
    fileSystemMock.putFile('file:///documents/photo-assets/dangling-owner-asset/thumbnail.jpg');
    fileSystemMock.putDirectory('file:///documents/photo-assets/orphan-old', now - 120000);
    fileSystemMock.putDirectory('file:///documents/photo-assets/orphan-new', now - 1000);

    const result = await runBootPhotoConsistencySweep(db, now);

    expect(result).toMatchObject({
      staleDraftsDeleted: 1,
      orphanAssetDirectoriesDeleted: 1,
      missingFileAssetsDeleted: 1,
      danglingOwnerAttachmentsDeleted: 1,
    });
    expect(attachments.size).toBe(0);
    expect(assets.size).toBe(0);
    expect(fileSystemMock.entries.has('file:///documents/photo-drafts/old-draft')).toBe(false);
    expect(fileSystemMock.entries.has('file:///documents/photo-assets/orphan-old')).toBe(false);
    expect(fileSystemMock.entries.has('file:///documents/photo-assets/orphan-new')).toBe(true);
  });
});
