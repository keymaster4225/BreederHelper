import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { createRepoDb, type SqlCall } from '@/test/repoDb';
import type { PhotoAsset } from '@/models/types';
import {
  addDailyLogAttachmentPhotos,
  clearProfilePhoto,
  deleteAttachmentPhoto,
  deleteAttachmentPhotosForOwners,
  getProfilePhoto,
  listAttachmentPhotos,
  replaceAttachmentPhotoOrder,
  setProfilePhoto,
} from './photos';

type PhotoAssetRow = {
  id: string;
  master_relative_path: string;
  thumbnail_relative_path: string;
  master_mime_type: 'image/jpeg';
  thumbnail_mime_type: 'image/jpeg';
  width: number;
  height: number;
  file_size_bytes: number;
  source_kind: 'camera' | 'library' | 'imported';
  created_at: string;
  updated_at: string;
};

type PhotoAttachmentRow = {
  id: string;
  photo_asset_id: string;
  owner_type: 'mare' | 'stallion' | 'dailyLog' | 'pregnancyCheck' | 'foalingRecord';
  owner_id: string;
  role: 'profile' | 'attachment';
  sort_order: number;
  caption: string | null;
  created_at: string;
  updated_at: string;
};

function createAsset(id: string, sourceKind: PhotoAsset['sourceKind'] = 'library'): PhotoAsset {
  return {
    id,
    masterRelativePath: `photo-assets/${id}/master.jpg`,
    thumbnailRelativePath: `photo-assets/${id}/thumbnail.jpg`,
    masterMimeType: 'image/jpeg',
    thumbnailMimeType: 'image/jpeg',
    width: 1600,
    height: 1200,
    fileSizeBytes: 1200000,
    sourceKind,
    createdAt: '2026-05-02T12:00:00.000Z',
    updatedAt: '2026-05-02T12:00:00.000Z',
  };
}

function createAssetRow(asset: PhotoAsset): PhotoAssetRow {
  return {
    id: asset.id,
    master_relative_path: asset.masterRelativePath,
    thumbnail_relative_path: asset.thumbnailRelativePath,
    master_mime_type: asset.masterMimeType,
    thumbnail_mime_type: asset.thumbnailMimeType,
    width: asset.width,
    height: asset.height,
    file_size_bytes: asset.fileSizeBytes,
    source_kind: asset.sourceKind,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

function createAttachment(
  id: string,
  assetId: string,
  overrides: Partial<PhotoAttachmentRow> = {},
): PhotoAttachmentRow {
  return {
    id,
    photo_asset_id: assetId,
    owner_type: 'dailyLog',
    owner_id: 'log-1',
    role: 'attachment',
    sort_order: 0,
    caption: null,
    created_at: '2026-05-02T12:00:00.000Z',
    updated_at: '2026-05-02T12:00:00.000Z',
    ...overrides,
  };
}

function createPhotoRepoHarness() {
  const assets = new Map<string, PhotoAssetRow>();
  const attachments = new Map<string, PhotoAttachmentRow>();

  function attachmentWithAsset(row: PhotoAttachmentRow) {
    const asset = assets.get(row.photo_asset_id);
    return asset
      ? {
          ...row,
          asset_id: asset.id,
          master_relative_path: asset.master_relative_path,
          thumbnail_relative_path: asset.thumbnail_relative_path,
          master_mime_type: asset.master_mime_type,
          thumbnail_mime_type: asset.thumbnail_mime_type,
          width: asset.width,
          height: asset.height,
          file_size_bytes: asset.file_size_bytes,
          source_kind: asset.source_kind,
          asset_created_at: asset.created_at,
          asset_updated_at: asset.updated_at,
        }
      : null;
  }

  const db = createRepoDb({
    async onTransaction(callback) {
      return callback();
    },
    onRun(call) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.startsWith('insert into photo_assets')) {
        const [
          id,
          masterRelativePath,
          thumbnailRelativePath,
          masterMimeType,
          thumbnailMimeType,
          width,
          height,
          fileSizeBytes,
          sourceKind,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
          'image/jpeg',
          'image/jpeg',
          number,
          number,
          number,
          PhotoAssetRow['source_kind'],
          string,
          string,
        ];

        assets.set(id, {
          id,
          master_relative_path: masterRelativePath,
          thumbnail_relative_path: thumbnailRelativePath,
          master_mime_type: masterMimeType,
          thumbnail_mime_type: thumbnailMimeType,
          width,
          height,
          file_size_bytes: fileSizeBytes,
          source_kind: sourceKind,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('insert into photo_attachments')) {
        const [
          id,
          photoAssetId,
          ownerType,
          ownerId,
          role,
          sortOrder,
          caption,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          PhotoAttachmentRow['owner_type'],
          string,
          PhotoAttachmentRow['role'],
          number,
          string | null,
          string,
          string,
        ];

        if (
          role === 'profile' &&
          Array.from(attachments.values()).some(
            (row) =>
              row.owner_type === ownerType &&
              row.owner_id === ownerId &&
              row.role === 'profile',
          )
        ) {
          throw new Error('UNIQUE constraint failed: photo_attachments.owner_type');
        }

        attachments.set(id, {
          id,
          photo_asset_id: photoAssetId,
          owner_type: ownerType,
          owner_id: ownerId,
          role,
          sort_order: sortOrder,
          caption,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update photo_attachments')) {
        const [sortOrder, updatedAt, id] = params as [number, string, string];
        const existing = attachments.get(id);
        if (existing) {
          attachments.set(id, { ...existing, sort_order: sortOrder, updated_at: updatedAt });
        }
        return;
      }

      if (stmt.startsWith('delete from photo_attachments') && stmt.includes('where id = ?')) {
        attachments.delete(params[0] as string);
        return;
      }

      if (
        stmt.startsWith('delete from photo_attachments') &&
        stmt.includes('owner_type = ?') &&
        stmt.includes("role = 'profile'")
      ) {
        const [ownerType, ownerId] = params as [PhotoAttachmentRow['owner_type'], string];
        for (const [id, row] of attachments) {
          if (row.owner_type === ownerType && row.owner_id === ownerId && row.role === 'profile') {
            attachments.delete(id);
          }
        }
        return;
      }

      if (
        stmt.startsWith('delete from photo_attachments') &&
        stmt.includes('owner_type = ?') &&
        stmt.includes('owner_id in')
      ) {
        const [ownerType, ...ownerIds] = params as [PhotoAttachmentRow['owner_type'], ...string[]];
        const ownerIdSet = new Set(ownerIds);
        for (const [id, row] of attachments) {
          if (row.owner_type === ownerType && ownerIdSet.has(row.owner_id)) {
            attachments.delete(id);
          }
        }
        return;
      }

      if (stmt.startsWith('delete from photo_assets')) {
        assets.delete(params[0] as string);
      }
    },
    onGetFirst<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.includes('count(*) as count') && stmt.includes('from photo_attachments')) {
        if (stmt.includes('photo_asset_id = ?')) {
          const [assetId] = params as [string];
          return {
            count: Array.from(attachments.values()).filter((row) => row.photo_asset_id === assetId).length,
          } as T;
        }

        const [ownerType, ownerId] = params as [PhotoAttachmentRow['owner_type'], string];
        return {
          count: Array.from(attachments.values()).filter(
            (row) =>
              row.owner_type === ownerType &&
              row.owner_id === ownerId &&
              row.role === 'attachment',
          ).length,
        } as T;
      }

      if (stmt.includes('from photo_attachments') && stmt.includes("role = 'profile'")) {
        const [ownerType, ownerId] = params as [PhotoAttachmentRow['owner_type'], string];
        const row = Array.from(attachments.values())
          .filter(
            (attachment) =>
              attachment.owner_type === ownerType &&
              attachment.owner_id === ownerId &&
              attachment.role === 'profile',
          )
          .sort(compareAttachmentRows)[0];
        return (row ? attachmentWithAsset(row) : null) as T | null;
      }

      return null;
    },
    onGetAll<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.includes('from photo_attachments') && stmt.includes("role = 'attachment'")) {
        const [ownerType, ownerId] = params as [PhotoAttachmentRow['owner_type'], string];
        return Array.from(attachments.values())
          .filter(
            (row) =>
              row.owner_type === ownerType &&
              row.owner_id === ownerId &&
              row.role === 'attachment',
          )
          .sort(compareAttachmentRows)
          .map(attachmentWithAsset)
          .filter((row): row is NonNullable<typeof row> => row != null) as T[];
      }

      if (stmt.includes('from photo_attachments') && stmt.includes('where id = ?')) {
        const row = attachments.get(params[0] as string);
        return (row ? [row] : []) as T[];
      }

      if (stmt.includes('from photo_attachments') && stmt.includes('owner_type = ?')) {
        const [ownerType, ...ownerIds] = params as [PhotoAttachmentRow['owner_type'], ...string[]];
        const ownerIdSet = new Set(ownerIds);
        return Array.from(attachments.values()).filter(
          (row) => row.owner_type === ownerType && ownerIdSet.has(row.owner_id),
        ) as T[];
      }

      return [];
    },
  });

  return { assets, attachments, db };
}

function compareAttachmentRows(a: PhotoAttachmentRow, b: PhotoAttachmentRow): number {
  return (
    a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

describe('photos repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets and reads a profile photo for one owner', async () => {
    const { db } = createPhotoRepoHarness();

    await setProfilePhoto({
      attachmentId: 'attachment-1',
      ownerType: 'mare',
      ownerId: 'mare-1',
      asset: createAsset('asset-1', 'camera'),
    }, db);

    await expect(getProfilePhoto('mare', 'mare-1', db)).resolves.toMatchObject({
      id: 'attachment-1',
      ownerType: 'mare',
      ownerId: 'mare-1',
      role: 'profile',
      asset: {
        id: 'asset-1',
        sourceKind: 'camera',
      },
    });
  });

  it('replacing the same profile photo repeatedly leaves one profile attachment', async () => {
    const { attachments, assets, db } = createPhotoRepoHarness();

    for (let index = 0; index < 50; index += 1) {
      await setProfilePhoto({
        attachmentId: `attachment-${index}`,
        ownerType: 'stallion',
        ownerId: 'stallion-1',
        asset: createAsset(`asset-${index}`),
      }, db);
    }

    expect(Array.from(attachments.values()).filter((row) => row.role === 'profile')).toHaveLength(1);
    expect(Array.from(assets.values())).toHaveLength(1);
    expect(await getProfilePhoto('stallion', 'stallion-1', db)).toMatchObject({
      id: 'attachment-49',
      asset: { id: 'asset-49' },
    });
  });

  it('clears a profile photo and deletes orphaned asset metadata', async () => {
    const { attachments, assets, db } = createPhotoRepoHarness();
    await setProfilePhoto({
      attachmentId: 'attachment-1',
      ownerType: 'mare',
      ownerId: 'mare-1',
      asset: createAsset('asset-1'),
    }, db);

    await clearProfilePhoto('mare', 'mare-1', db);

    expect(attachments.size).toBe(0);
    expect(assets.size).toBe(0);
  });

  it('adds ordered daily log attachments and preserves imported source kind', async () => {
    const { db } = createPhotoRepoHarness();

    await addDailyLogAttachmentPhotos('log-1', [
      {
        attachmentId: 'attachment-1',
        asset: createAsset('asset-1', 'imported'),
        caption: '  First  ',
      },
      {
        attachmentId: 'attachment-2',
        asset: createAsset('asset-2'),
      },
    ], db);

    const photos = await listAttachmentPhotos('dailyLog', 'log-1', db);
    expect(photos.map((photo) => photo.id)).toEqual(['attachment-1', 'attachment-2']);
    expect(photos.map((photo) => photo.sortOrder)).toEqual([0, 1]);
    expect(photos[0]?.caption).toBe('First');
    expect(photos[0]?.asset.sourceKind).toBe('imported');
  });

  it('replaces attachment order with contiguous values and uses created/id tie-break order', async () => {
    const { attachments, db } = createPhotoRepoHarness();
    await addDailyLogAttachmentPhotos('log-1', [
      { attachmentId: 'attachment-a', asset: createAsset('asset-a') },
      { attachmentId: 'attachment-b', asset: createAsset('asset-b') },
      { attachmentId: 'attachment-c', asset: createAsset('asset-c') },
    ], db);
    attachments.set('attachment-a', {
      ...attachments.get('attachment-a')!,
      sort_order: 0,
      created_at: '2026-05-02T12:00:02.000Z',
    });
    attachments.set('attachment-b', {
      ...attachments.get('attachment-b')!,
      sort_order: 0,
      created_at: '2026-05-02T12:00:01.000Z',
    });

    expect((await listAttachmentPhotos('dailyLog', 'log-1', db)).map((photo) => photo.id)).toEqual([
      'attachment-b',
      'attachment-a',
      'attachment-c',
    ]);

    await replaceAttachmentPhotoOrder('dailyLog', 'log-1', [
      'attachment-c',
      'attachment-a',
      'attachment-b',
    ], db);

    expect((await listAttachmentPhotos('dailyLog', 'log-1', db)).map((photo) => photo.id)).toEqual([
      'attachment-c',
      'attachment-a',
      'attachment-b',
    ]);
    expect((await listAttachmentPhotos('dailyLog', 'log-1', db)).map((photo) => photo.sortOrder)).toEqual([
      0,
      1,
      2,
    ]);
  });

  it('enforces the 12-photo daily log attachment limit', async () => {
    const { db } = createPhotoRepoHarness();
    await addDailyLogAttachmentPhotos(
      'log-1',
      Array.from({ length: 12 }, (_, index) => ({
        attachmentId: `attachment-${index}`,
        asset: createAsset(`asset-${index}`),
      })),
      db,
    );

    await expect(
      addDailyLogAttachmentPhotos('log-1', [
        { attachmentId: 'attachment-13', asset: createAsset('asset-13') },
      ], db),
    ).rejects.toThrow('Daily logs can have at most 12 photos.');
  });

  it('deletes one attachment and cleans orphaned asset metadata only after the last attachment', async () => {
    const { assets, attachments, db } = createPhotoRepoHarness();
    await addDailyLogAttachmentPhotos('log-1', [
      { attachmentId: 'attachment-1', asset: createAsset('asset-1') },
    ], db);
    attachments.set('attachment-2', createAttachment('attachment-2', 'asset-1', { owner_id: 'log-2' }));

    await deleteAttachmentPhoto('attachment-1', db);
    expect(assets.has('asset-1')).toBe(true);

    await deleteAttachmentPhoto('attachment-2', db);
    expect(assets.has('asset-1')).toBe(false);
  });

  it('bulk deletes attachments for hard-deleted owners and cleans orphaned assets', async () => {
    const { assets, attachments, db } = createPhotoRepoHarness();
    assets.set('asset-log', createAssetRow(createAsset('asset-log')));
    assets.set('asset-preg', createAssetRow(createAsset('asset-preg')));
    assets.set('asset-foal', createAssetRow(createAsset('asset-foal')));
    attachments.set('log-attachment', createAttachment('log-attachment', 'asset-log'));
    attachments.set(
      'preg-attachment',
      createAttachment('preg-attachment', 'asset-preg', {
        owner_type: 'pregnancyCheck',
        owner_id: 'preg-1',
      }),
    );
    attachments.set(
      'foal-attachment',
      createAttachment('foal-attachment', 'asset-foal', {
        owner_type: 'foalingRecord',
        owner_id: 'foaling-1',
      }),
    );

    await deleteAttachmentPhotosForOwners('dailyLog', ['log-1'], db);
    await deleteAttachmentPhotosForOwners('pregnancyCheck', ['preg-1'], db);
    await deleteAttachmentPhotosForOwners('foalingRecord', ['foaling-1'], db);

    expect(attachments.size).toBe(0);
    expect(assets.size).toBe(0);
  });
});
