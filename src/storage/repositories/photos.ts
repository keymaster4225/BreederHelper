import type {
  PhotoAsset,
  PhotoAttachment,
  PhotoAttachmentRole,
  PhotoOwnerType,
  PhotoSourceKind,
  UUID,
} from '@/models/types';

import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

export const DAILY_LOG_PHOTO_LIMIT = 12;

export type PhotoAttachmentWithAsset = PhotoAttachment & {
  readonly asset: PhotoAsset;
};

export type SetProfilePhotoInput = {
  readonly attachmentId: UUID;
  readonly ownerType: Extract<PhotoOwnerType, 'mare' | 'stallion'>;
  readonly ownerId: UUID;
  readonly asset: PhotoAsset;
};

export type AddAttachmentPhotoInput = {
  readonly attachmentId: UUID;
  readonly asset: PhotoAsset;
  readonly caption?: string | null;
};

export type ReplaceAttachmentPhotoInput =
  | {
      readonly kind: 'existing';
      readonly attachmentId: UUID;
    }
  | {
      readonly kind: 'new';
      readonly attachmentId: UUID;
      readonly asset: PhotoAsset;
      readonly caption?: string | null;
    };

type PhotoAssetRow = {
  id: string;
  master_relative_path: string;
  thumbnail_relative_path: string;
  master_mime_type: 'image/jpeg';
  thumbnail_mime_type: 'image/jpeg';
  width: number;
  height: number;
  file_size_bytes: number;
  source_kind: PhotoSourceKind;
  created_at: string;
  updated_at: string;
};

type PhotoAttachmentRow = {
  id: string;
  photo_asset_id: string;
  owner_type: PhotoOwnerType;
  owner_id: string;
  role: PhotoAttachmentRole;
  sort_order: number;
  caption: string | null;
  created_at: string;
  updated_at: string;
};

type PhotoAttachmentJoinedRow = PhotoAttachmentRow & PhotoAssetRow;

type CountRow = {
  count: number;
};

const PHOTO_ATTACHMENT_JOIN_COLUMNS = `
  pa.id,
  pa.photo_asset_id,
  pa.owner_type,
  pa.owner_id,
  pa.role,
  pa.sort_order,
  pa.caption,
  pa.created_at,
  pa.updated_at,
  asset.id AS asset_id,
  asset.master_relative_path,
  asset.thumbnail_relative_path,
  asset.master_mime_type,
  asset.thumbnail_mime_type,
  asset.width,
  asset.height,
  asset.file_size_bytes,
  asset.source_kind,
  asset.created_at AS asset_created_at,
  asset.updated_at AS asset_updated_at
`;

type SelectedJoinedRow = Omit<
  PhotoAttachmentJoinedRow,
  'id' | 'created_at' | 'updated_at'
> & {
  id: string;
  asset_id: string;
  created_at: string;
  updated_at: string;
  asset_created_at: string;
  asset_updated_at: string;
};

function normalizeCaption(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapAssetRow(row: PhotoAssetRow): PhotoAsset {
  return {
    id: row.id,
    masterRelativePath: row.master_relative_path,
    thumbnailRelativePath: row.thumbnail_relative_path,
    masterMimeType: row.master_mime_type,
    thumbnailMimeType: row.thumbnail_mime_type,
    width: row.width,
    height: row.height,
    fileSizeBytes: row.file_size_bytes,
    sourceKind: row.source_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttachmentRow(row: PhotoAttachmentRow): PhotoAttachment {
  return {
    id: row.id,
    photoAssetId: row.photo_asset_id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    role: row.role,
    sortOrder: row.sort_order,
    caption: row.caption,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJoinedRow(row: SelectedJoinedRow): PhotoAttachmentWithAsset {
  return {
    ...mapAttachmentRow(row),
    asset: mapAssetRow({
      id: row.asset_id,
      master_relative_path: row.master_relative_path,
      thumbnail_relative_path: row.thumbnail_relative_path,
      master_mime_type: row.master_mime_type,
      thumbnail_mime_type: row.thumbnail_mime_type,
      width: row.width,
      height: row.height,
      file_size_bytes: row.file_size_bytes,
      source_kind: row.source_kind,
      created_at: row.asset_created_at,
      updated_at: row.asset_updated_at,
    }),
  };
}

async function insertAsset(asset: PhotoAsset, db: RepoDb): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO photo_assets (
      id,
      master_relative_path,
      thumbnail_relative_path,
      master_mime_type,
      thumbnail_mime_type,
      width,
      height,
      file_size_bytes,
      source_kind,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      asset.id,
      asset.masterRelativePath,
      asset.thumbnailRelativePath,
      asset.masterMimeType,
      asset.thumbnailMimeType,
      asset.width,
      asset.height,
      asset.fileSizeBytes,
      asset.sourceKind,
      asset.createdAt,
      asset.updatedAt,
    ],
  );
}

async function insertAttachment(
  input: {
    readonly id: UUID;
    readonly photoAssetId: UUID;
    readonly ownerType: PhotoOwnerType;
    readonly ownerId: UUID;
    readonly role: PhotoAttachmentRole;
    readonly sortOrder: number;
    readonly caption?: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  },
  db: RepoDb,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO photo_attachments (
      id,
      photo_asset_id,
      owner_type,
      owner_id,
      role,
      sort_order,
      caption,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.id,
      input.photoAssetId,
      input.ownerType,
      input.ownerId,
      input.role,
      input.sortOrder,
      normalizeCaption(input.caption),
      input.createdAt,
      input.updatedAt,
    ],
  );
}

async function listAssetIdsForProfile(
  ownerType: PhotoOwnerType,
  ownerId: UUID,
  db: RepoDb,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ photo_asset_id: string }>(
    `
    SELECT photo_asset_id
    FROM photo_attachments
    WHERE owner_type = ?
      AND owner_id = ?
      AND role = 'profile';
    `,
    [ownerType, ownerId],
  );

  return rows.map((row) => row.photo_asset_id);
}

async function getAssetById(assetId: string, db: RepoDb): Promise<PhotoAsset | null> {
  const row = await db.getFirstAsync<PhotoAssetRow>(
    `
    SELECT
      id,
      master_relative_path,
      thumbnail_relative_path,
      master_mime_type,
      thumbnail_mime_type,
      width,
      height,
      file_size_bytes,
      source_kind,
      created_at,
      updated_at
    FROM photo_assets
    WHERE id = ?;
    `,
    [assetId],
  );

  return row ? mapAssetRow(row) : null;
}

async function cleanupOrphanedAssets(assetIds: readonly string[], db: RepoDb): Promise<PhotoAsset[]> {
  const deletedAssets: PhotoAsset[] = [];

  for (const assetId of new Set(assetIds)) {
    const row = await db.getFirstAsync<CountRow>(
      `
      SELECT COUNT(*) AS count
      FROM photo_attachments
      WHERE photo_asset_id = ?;
      `,
      [assetId],
    );

    if ((row?.count ?? 0) === 0) {
      const asset = await getAssetById(assetId, db);
      await db.runAsync('DELETE FROM photo_assets WHERE id = ?;', [assetId]);
      if (asset) {
        deletedAssets.push(asset);
      }
    }
  }

  return deletedAssets;
}

async function countAttachmentPhotos(
  ownerType: PhotoOwnerType,
  ownerId: UUID,
  db: RepoDb,
): Promise<number> {
  const row = await db.getFirstAsync<CountRow>(
    `
    SELECT COUNT(*) AS count
    FROM photo_attachments
    WHERE owner_type = ?
      AND owner_id = ?
      AND role = 'attachment';
    `,
    [ownerType, ownerId],
  );

  return row?.count ?? 0;
}

export async function getProfilePhoto(
  ownerType: Extract<PhotoOwnerType, 'mare' | 'stallion'>,
  ownerId: UUID,
  db?: RepoDb,
): Promise<PhotoAttachmentWithAsset | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<SelectedJoinedRow>(
    `
    SELECT ${PHOTO_ATTACHMENT_JOIN_COLUMNS}
    FROM photo_attachments pa
    INNER JOIN photo_assets asset ON asset.id = pa.photo_asset_id
    WHERE pa.owner_type = ?
      AND pa.owner_id = ?
      AND pa.role = 'profile'
    ORDER BY pa.sort_order ASC, pa.created_at ASC, pa.id ASC
    LIMIT 1;
    `,
    [ownerType, ownerId],
  );

  return row ? mapJoinedRow(row) : null;
}

export async function listAttachmentPhotos(
  ownerType: PhotoOwnerType,
  ownerId: UUID,
  db?: RepoDb,
): Promise<PhotoAttachmentWithAsset[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<SelectedJoinedRow>(
    `
    SELECT ${PHOTO_ATTACHMENT_JOIN_COLUMNS}
    FROM photo_attachments pa
    INNER JOIN photo_assets asset ON asset.id = pa.photo_asset_id
    WHERE pa.owner_type = ?
      AND pa.owner_id = ?
      AND pa.role = 'attachment'
    ORDER BY pa.sort_order ASC, pa.created_at ASC, pa.id ASC;
    `,
    [ownerType, ownerId],
  );

  return rows.map(mapJoinedRow);
}

export async function setProfilePhoto(
  input: SetProfilePhotoInput,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  await handle.withTransactionAsync(async () => {
    await setProfilePhotoInTransaction(input, handle);
  });
}

export async function clearProfilePhoto(
  ownerType: Extract<PhotoOwnerType, 'mare' | 'stallion'>,
  ownerId: UUID,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  await handle.withTransactionAsync(async () => {
    await clearProfilePhotoInTransaction(ownerType, ownerId, handle);
  });
}

export async function setProfilePhotoInTransaction(
  input: SetProfilePhotoInput,
  db: RepoDb,
): Promise<void> {
  const oldAssetIds = await listAssetIdsForProfile(input.ownerType, input.ownerId, db);
  await insertAsset(input.asset, db);
  await db.runAsync(
    `
    DELETE FROM photo_attachments
    WHERE owner_type = ?
      AND owner_id = ?
      AND role = 'profile';
    `,
    [input.ownerType, input.ownerId],
  );
  await cleanupOrphanedAssets(oldAssetIds, db);
  await insertAttachment(
    {
      id: input.attachmentId,
      photoAssetId: input.asset.id,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      role: 'profile',
      sortOrder: 0,
      createdAt: input.asset.createdAt,
      updatedAt: input.asset.updatedAt,
    },
    db,
  );
}

export async function clearProfilePhotoInTransaction(
  ownerType: Extract<PhotoOwnerType, 'mare' | 'stallion'>,
  ownerId: UUID,
  db: RepoDb,
): Promise<void> {
  const oldAssetIds = await listAssetIdsForProfile(ownerType, ownerId, db);
  await db.runAsync(
    `
    DELETE FROM photo_attachments
    WHERE owner_type = ?
      AND owner_id = ?
      AND role = 'profile';
    `,
    [ownerType, ownerId],
  );
  await cleanupOrphanedAssets(oldAssetIds, db);
}

export async function addDailyLogAttachmentPhotos(
  dailyLogId: UUID,
  photos: readonly AddAttachmentPhotoInput[],
  db?: RepoDb,
): Promise<void> {
  if (photos.length === 0) {
    return;
  }

  const handle = await resolveDb(db);
  await handle.withTransactionAsync(async () => {
    const existingCount = await countAttachmentPhotos('dailyLog', dailyLogId, handle);
    if (existingCount + photos.length > DAILY_LOG_PHOTO_LIMIT) {
      throw new Error('Daily logs can have at most 12 photos.');
    }

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index]!;
      await insertAsset(photo.asset, handle);
      await insertAttachment(
        {
          id: photo.attachmentId,
          photoAssetId: photo.asset.id,
          ownerType: 'dailyLog',
          ownerId: dailyLogId,
          role: 'attachment',
          sortOrder: existingCount + index,
          caption: photo.caption,
          createdAt: photo.asset.createdAt,
          updatedAt: photo.asset.updatedAt,
        },
        handle,
      );
    }
  });
}

export async function replaceDailyLogAttachmentPhotosInTransaction(
  dailyLogId: UUID,
  photos: readonly ReplaceAttachmentPhotoInput[],
  db: RepoDb,
): Promise<PhotoAsset[]> {
  if (photos.length > DAILY_LOG_PHOTO_LIMIT) {
    throw new Error('Daily logs can have at most 12 photos.');
  }

  const existing = await listAttachmentPhotos('dailyLog', dailyLogId, db);
  const existingById = new Map(existing.map((photo) => [photo.id, photo]));
  const retainedIds = new Set(
    photos
      .filter((photo): photo is Extract<ReplaceAttachmentPhotoInput, { kind: 'existing' }> => photo.kind === 'existing')
      .map((photo) => photo.attachmentId),
  );

  for (const retainedId of retainedIds) {
    if (!existingById.has(retainedId)) {
      throw new Error('Photo attachment order includes an unknown attachment.');
    }
  }

  const removedAssetIds = existing
    .filter((photo) => !retainedIds.has(photo.id))
    .map((photo) => photo.photoAssetId);

  if (removedAssetIds.length > 0) {
    await db.runAsync(
      `
      DELETE FROM photo_attachments
      WHERE owner_type = 'dailyLog'
        AND owner_id = ?
        AND id NOT IN (${Array.from(retainedIds).map(() => '?').join(', ') || "''"});
      `,
      [dailyLogId, ...Array.from(retainedIds)],
    );
  }

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]!;

    if (photo.kind === 'new') {
      await insertAsset(photo.asset, db);
      await insertAttachment(
        {
          id: photo.attachmentId,
          photoAssetId: photo.asset.id,
          ownerType: 'dailyLog',
          ownerId: dailyLogId,
          role: 'attachment',
          sortOrder: index,
          caption: photo.caption,
          createdAt: photo.asset.createdAt,
          updatedAt: photo.asset.updatedAt,
        },
        db,
      );
      continue;
    }

    await db.runAsync(
      `
      UPDATE photo_attachments
      SET sort_order = ?, updated_at = ?
      WHERE id = ?
        AND owner_type = 'dailyLog'
        AND owner_id = ?;
      `,
      [index, new Date().toISOString(), photo.attachmentId, dailyLogId],
    );
  }

  return cleanupOrphanedAssets(removedAssetIds, db);
}

export async function replaceAttachmentPhotoOrder(
  ownerType: PhotoOwnerType,
  ownerId: UUID,
  attachmentIds: readonly UUID[],
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await listAttachmentPhotos(ownerType, ownerId, handle);
  const existingIds = new Set(existing.map((photo) => photo.id));
  if (existingIds.size !== attachmentIds.length || attachmentIds.some((id) => !existingIds.has(id))) {
    throw new Error('Photo attachment order must include exactly the current attachments.');
  }

  const now = new Date().toISOString();
  await handle.withTransactionAsync(async () => {
    for (let index = 0; index < attachmentIds.length; index += 1) {
      await handle.runAsync(
        `
        UPDATE photo_attachments
        SET sort_order = ?, updated_at = ?
        WHERE id = ?;
        `,
        [index, now, attachmentIds[index]!],
      );
    }
  });
}

export async function deleteAttachmentPhoto(id: UUID, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.withTransactionAsync(async () => {
    const rows = await handle.getAllAsync<PhotoAttachmentRow>(
      `
      SELECT id, photo_asset_id, owner_type, owner_id, role, sort_order, caption, created_at, updated_at
      FROM photo_attachments
      WHERE id = ?;
      `,
      [id],
    );
    const assetIds = rows.map((row) => row.photo_asset_id);
    await handle.runAsync('DELETE FROM photo_attachments WHERE id = ?;', [id]);
    await cleanupOrphanedAssets(assetIds, handle);
  });
}

export async function deleteAttachmentPhotosForOwnersInTransaction(
  ownerType: Extract<PhotoOwnerType, 'dailyLog' | 'pregnancyCheck' | 'foalingRecord'>,
  ownerIds: readonly UUID[],
  db: RepoDb,
): Promise<PhotoAsset[]> {
  if (ownerIds.length === 0) {
    return [];
  }

  const placeholders = ownerIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<PhotoAttachmentRow>(
    `
    SELECT id, photo_asset_id, owner_type, owner_id, role, sort_order, caption, created_at, updated_at
    FROM photo_attachments
    WHERE owner_type = ?
      AND owner_id IN (${placeholders});
    `,
    [ownerType, ...ownerIds],
  );
  const assetIds = rows.map((row) => row.photo_asset_id);
  await db.runAsync(
    `
    DELETE FROM photo_attachments
    WHERE owner_type = ?
      AND owner_id IN (${placeholders});
    `,
    [ownerType, ...ownerIds],
  );
  return cleanupOrphanedAssets(assetIds, db);
}

export async function deleteAttachmentPhotosForOwners(
  ownerType: Extract<PhotoOwnerType, 'dailyLog' | 'pregnancyCheck' | 'foalingRecord'>,
  ownerIds: readonly UUID[],
  db?: RepoDb,
): Promise<void> {
  if (ownerIds.length === 0) {
    return;
  }

  const handle = await resolveDb(db);
  await handle.withTransactionAsync(async () => {
    await deleteAttachmentPhotosForOwnersInTransaction(ownerType, ownerIds, handle);
  });
}
