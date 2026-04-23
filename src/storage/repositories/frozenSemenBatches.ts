import {
  CreateFrozenSemenBatchInput,
  FrozenSemenBatch,
  UpdateFrozenSemenBatchInput,
  UUID,
} from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { newId } from '@/utils/id';
import {
  assertCollectionSemenVolumeCanSupportAllocation,
} from './internal/collectionAllocation';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';
import { getSemenCollectionById } from './semenCollections';
import { getStallionById } from './stallions';

type FrozenSemenBatchRow = {
  id: string;
  stallion_id: string;
  collection_id: string | null;
  freeze_date: string;
  raw_semen_volume_used_ml: number | null;
  extender: FrozenSemenBatch['extender'];
  extender_other: string | null;
  was_centrifuged: 0 | 1;
  centrifuge_speed_rpm: number | null;
  centrifuge_duration_min: number | null;
  centrifuge_cushion_used: 0 | 1 | null;
  centrifuge_cushion_type: string | null;
  centrifuge_resuspension_vol_ml: number | null;
  centrifuge_notes: string | null;
  straw_count: number;
  straws_remaining: number;
  straw_volume_ml: number;
  concentration_millions_per_ml: number | null;
  straws_per_dose: number | null;
  straw_color: FrozenSemenBatch['strawColor'];
  straw_color_other: string | null;
  straw_label: string | null;
  post_thaw_motility_percent: number | null;
  longevity_hours: number | null;
  storage_details: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: FrozenSemenBatchRow): FrozenSemenBatch {
  return {
    id: row.id,
    stallionId: row.stallion_id,
    collectionId: row.collection_id,
    freezeDate: row.freeze_date,
    rawSemenVolumeUsedMl: row.raw_semen_volume_used_ml,
    extender: row.extender,
    extenderOther: row.extender_other,
    wasCentrifuged: row.was_centrifuged === 1,
    centrifuge: {
      speedRpm: row.centrifuge_speed_rpm,
      durationMin: row.centrifuge_duration_min,
      cushionUsed:
        row.centrifuge_cushion_used == null
          ? null
          : row.centrifuge_cushion_used === 1,
      cushionType: row.centrifuge_cushion_type,
      resuspensionVolumeMl: row.centrifuge_resuspension_vol_ml,
      notes: row.centrifuge_notes,
    },
    strawCount: row.straw_count,
    strawsRemaining: row.straws_remaining,
    strawVolumeMl: row.straw_volume_ml,
    concentrationMillionsPerMl: row.concentration_millions_per_ml,
    strawsPerDose: row.straws_per_dose,
    strawColor: row.straw_color,
    strawColorOther: row.straw_color_other,
    strawLabel: row.straw_label,
    postThawMotilityPercent: row.post_thaw_motility_percent,
    longevityHours: row.longevity_hours,
    storageDetails: row.storage_details,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  return value;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }
  return value;
}

function normalizeRequiredPositiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return value;
}

function normalizeOptionalPositiveNumber(value: number | null | undefined, label: string): number | null {
  if (value == null) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return value;
}

function normalizeOptionalIntegerAtLeastOne(value: number | null | undefined, label: string): number | null {
  if (value == null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }
  return value;
}

function normalizeOptionalPercentage(value: number | null | undefined, label: string): number | null {
  if (value == null) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100.`);
  }
  return value;
}

function normalizeCushionUsed(value: boolean | null | undefined): 0 | 1 | null {
  if (value == null) {
    return null;
  }
  return value ? 1 : 0;
}

function normalizeExtenderOther(
  extender: FrozenSemenBatch['extender'],
  extenderOther: string | null | undefined,
): string | null {
  if (extender !== 'Other') {
    return null;
  }

  const normalized = normalizeOptionalText(extenderOther);
  if (normalized == null) {
    throw new Error('Extender other value is required when extender is Other.');
  }
  return normalized;
}

function normalizeStrawColorOther(
  strawColor: FrozenSemenBatch['strawColor'],
  strawColorOther: string | null | undefined,
): string | null {
  if (strawColor !== 'Other') {
    return null;
  }

  const normalized = normalizeOptionalText(strawColorOther);
  if (normalized == null) {
    throw new Error('Straw color other value is required when straw color is Other.');
  }
  return normalized;
}

function buildCentrifugeWriteFields(
  wasCentrifuged: boolean,
  centrifuge: FrozenSemenBatch['centrifuge'],
): {
  speedRpm: number | null;
  durationMin: number | null;
  cushionUsed: 0 | 1 | null;
  cushionType: string | null;
  resuspensionVolumeMl: number | null;
  notes: string | null;
} {
  if (!wasCentrifuged) {
    return {
      speedRpm: null,
      durationMin: null,
      cushionUsed: null,
      cushionType: null,
      resuspensionVolumeMl: null,
      notes: null,
    };
  }

  return {
    speedRpm: normalizeOptionalIntegerAtLeastOne(
      centrifuge.speedRpm,
      'Centrifuge speed',
    ),
    durationMin: normalizeOptionalIntegerAtLeastOne(
      centrifuge.durationMin,
      'Centrifuge duration',
    ),
    cushionUsed: normalizeCushionUsed(centrifuge.cushionUsed),
    cushionType: normalizeOptionalText(centrifuge.cushionType),
    resuspensionVolumeMl: normalizeOptionalPositiveNumber(
      centrifuge.resuspensionVolumeMl,
      'Resuspension volume',
    ),
    notes: normalizeOptionalText(centrifuge.notes),
  };
}

async function getFrozenSemenBatchRowById(
  id: UUID,
  db?: RepoDb,
): Promise<FrozenSemenBatchRow | null> {
  const handle = await resolveDb(db);
  return handle.getFirstAsync<FrozenSemenBatchRow>(
    `
    SELECT
      id,
      stallion_id,
      collection_id,
      freeze_date,
      raw_semen_volume_used_ml,
      extender,
      extender_other,
      was_centrifuged,
      centrifuge_speed_rpm,
      centrifuge_duration_min,
      centrifuge_cushion_used,
      centrifuge_cushion_type,
      centrifuge_resuspension_vol_ml,
      centrifuge_notes,
      straw_count,
      straws_remaining,
      straw_volume_ml,
      concentration_millions_per_ml,
      straws_per_dose,
      straw_color,
      straw_color_other,
      straw_label,
      post_thaw_motility_percent,
      longevity_hours,
      storage_details,
      notes,
      created_at,
      updated_at
    FROM frozen_semen_batches
    WHERE id = ?;
    `,
    [id],
  );
}

async function assertValidCreateTarget(
  stallionId: UUID,
  collectionId: UUID | null,
  db?: RepoDb,
): Promise<void> {
  const stallion = await getStallionById(stallionId, db);
  if (!stallion) {
    throw new Error('Stallion not found.');
  }
  if (stallion.deletedAt != null) {
    throw new Error('Cannot add frozen batch for a deleted stallion.');
  }

  if (collectionId == null) {
    return;
  }

  const collection = await getSemenCollectionById(collectionId, db);
  if (!collection) {
    throw new Error('Collection not found.');
  }

  if (collection.stallionId !== stallionId) {
    throw new Error('Collection belongs to a different stallion.');
  }
}

function normalizeCollectionLinkedRawVolume(
  collectionId: UUID | null,
  rawSemenVolumeUsedMl: number | null | undefined,
): number | null {
  if (collectionId == null) {
    return null;
  }

  const normalized = normalizeOptionalFiniteNumber(rawSemenVolumeUsedMl);
  if (normalized == null || Number.isNaN(normalized) || normalized <= 0) {
    throw new Error('Raw semen volume used is required for linked frozen batches.');
  }

  return normalized;
}

function ensureUpdateImmutablesNotPatched(
  patch: UpdateFrozenSemenBatchInput,
): void {
  const unsafePatch = patch as Record<string, unknown>;
  if ('stallionId' in unsafePatch || 'collectionId' in unsafePatch) {
    throw new Error('Stallion and collection cannot be changed for an existing frozen batch.');
  }
}

function buildCollectionIdPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function createFrozenSemenBatch(
  input: CreateFrozenSemenBatchInput,
  db?: RepoDb,
): Promise<FrozenSemenBatch> {
  const collectionId = input.collectionId ?? null;
  const handle = await resolveDb(db);
  await assertValidCreateTarget(input.stallionId, collectionId, handle);

  const id = newId();
  const now = new Date().toISOString();

  if (typeof input.wasCentrifuged !== 'boolean') {
    throw new Error('Was centrifuged is required.');
  }

  const rawSemenVolumeUsedMl = normalizeCollectionLinkedRawVolume(
    collectionId,
    input.rawSemenVolumeUsedMl,
  );
  if (collectionId != null) {
    await assertCollectionSemenVolumeCanSupportAllocation(
      handle,
      collectionId,
      rawSemenVolumeUsedMl,
      1,
    );
  }

  const strawCount = normalizePositiveInteger(input.strawCount, 'Straw count');
  const strawVolumeMl = normalizeRequiredPositiveNumber(input.strawVolumeMl, 'Straw volume');
  const extender = input.extender ?? null;
  const strawColor = input.strawColor ?? null;

  const centrifuge = buildCentrifugeWriteFields(input.wasCentrifuged, input.centrifuge);

  await handle.runAsync(
    `
    INSERT INTO frozen_semen_batches (
      id,
      stallion_id,
      collection_id,
      freeze_date,
      raw_semen_volume_used_ml,
      extender,
      extender_other,
      was_centrifuged,
      centrifuge_speed_rpm,
      centrifuge_duration_min,
      centrifuge_cushion_used,
      centrifuge_cushion_type,
      centrifuge_resuspension_vol_ml,
      centrifuge_notes,
      straw_count,
      straws_remaining,
      straw_volume_ml,
      concentration_millions_per_ml,
      straws_per_dose,
      straw_color,
      straw_color_other,
      straw_label,
      post_thaw_motility_percent,
      longevity_hours,
      storage_details,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      id,
      input.stallionId,
      collectionId,
      input.freezeDate,
      rawSemenVolumeUsedMl,
      extender,
      normalizeExtenderOther(extender, input.extenderOther),
      input.wasCentrifuged ? 1 : 0,
      centrifuge.speedRpm,
      centrifuge.durationMin,
      centrifuge.cushionUsed,
      centrifuge.cushionType,
      centrifuge.resuspensionVolumeMl,
      centrifuge.notes,
      strawCount,
      strawCount,
      strawVolumeMl,
      normalizeOptionalPositiveNumber(
        input.concentrationMillionsPerMl,
        'Concentration (millions/mL)',
      ),
      normalizeOptionalIntegerAtLeastOne(input.strawsPerDose, 'Straws per dose'),
      strawColor,
      normalizeStrawColorOther(strawColor, input.strawColorOther),
      normalizeOptionalText(input.strawLabel),
      normalizeOptionalPercentage(input.postThawMotilityPercent, 'Post-thaw motility'),
      normalizeOptionalPositiveNumber(input.longevityHours, 'Longevity'),
      normalizeOptionalText(input.storageDetails),
      normalizeOptionalText(input.notes),
      now,
      now,
    ],
  );

  emitDataInvalidation('all');

  const created = await getFrozenSemenBatch(id, handle);
  if (!created) {
    throw new Error('Failed to load created frozen semen batch.');
  }

  return created;
}

export async function updateFrozenSemenBatch(
  id: UUID,
  patch: UpdateFrozenSemenBatchInput,
  db?: RepoDb,
): Promise<FrozenSemenBatch> {
  ensureUpdateImmutablesNotPatched(patch);

  const handle = await resolveDb(db);
  const existing = await getFrozenSemenBatch(id, handle);
  if (!existing) {
    throw new Error('Frozen semen batch not found.');
  }

  const wasCentrifuged = patch.wasCentrifuged ?? existing.wasCentrifuged;
  const strawCount =
    patch.strawCount == null
      ? existing.strawCount
      : normalizePositiveInteger(patch.strawCount, 'Straw count');
  const usedSoFar = existing.strawCount - existing.strawsRemaining;
  const strawsRemaining =
    strawCount !== existing.strawCount ? strawCount - usedSoFar : existing.strawsRemaining;

  if (strawsRemaining < 0) {
    throw new Error('Straw count cannot be lower than the number of straws already used.');
  }

  const freezeDate = patch.freezeDate ?? existing.freezeDate;
  const extender = patch.extender === undefined ? existing.extender : patch.extender;
  const strawColor = patch.strawColor === undefined ? existing.strawColor : patch.strawColor;
  const rawSemenVolumeUsedMl = normalizeCollectionLinkedRawVolume(
    existing.collectionId,
    patch.rawSemenVolumeUsedMl === undefined
      ? existing.rawSemenVolumeUsedMl
      : patch.rawSemenVolumeUsedMl,
  );

  if (existing.collectionId != null) {
    await assertCollectionSemenVolumeCanSupportAllocation(
      handle,
      existing.collectionId,
      rawSemenVolumeUsedMl,
      1,
      { excludeFrozenBatchId: id },
    );
  }

  const centrifuge = buildCentrifugeWriteFields(wasCentrifuged, {
    speedRpm: patch.centrifuge?.speedRpm ?? existing.centrifuge.speedRpm,
    durationMin: patch.centrifuge?.durationMin ?? existing.centrifuge.durationMin,
    cushionUsed:
      patch.centrifuge?.cushionUsed === undefined
        ? existing.centrifuge.cushionUsed
        : patch.centrifuge.cushionUsed,
    cushionType: patch.centrifuge?.cushionType ?? existing.centrifuge.cushionType,
    resuspensionVolumeMl:
      patch.centrifuge?.resuspensionVolumeMl ?? existing.centrifuge.resuspensionVolumeMl,
    notes: patch.centrifuge?.notes ?? existing.centrifuge.notes,
  });

  await handle.runAsync(
    `
    UPDATE frozen_semen_batches
    SET
      freeze_date = ?,
      raw_semen_volume_used_ml = ?,
      extender = ?,
      extender_other = ?,
      was_centrifuged = ?,
      centrifuge_speed_rpm = ?,
      centrifuge_duration_min = ?,
      centrifuge_cushion_used = ?,
      centrifuge_cushion_type = ?,
      centrifuge_resuspension_vol_ml = ?,
      centrifuge_notes = ?,
      straw_count = ?,
      straws_remaining = ?,
      straw_volume_ml = ?,
      concentration_millions_per_ml = ?,
      straws_per_dose = ?,
      straw_color = ?,
      straw_color_other = ?,
      straw_label = ?,
      post_thaw_motility_percent = ?,
      longevity_hours = ?,
      storage_details = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?;
    `,
    [
      freezeDate,
      rawSemenVolumeUsedMl,
      extender,
      normalizeExtenderOther(
        extender,
        patch.extenderOther === undefined ? existing.extenderOther : patch.extenderOther,
      ),
      wasCentrifuged ? 1 : 0,
      centrifuge.speedRpm,
      centrifuge.durationMin,
      centrifuge.cushionUsed,
      centrifuge.cushionType,
      centrifuge.resuspensionVolumeMl,
      centrifuge.notes,
      strawCount,
      strawsRemaining,
      normalizeRequiredPositiveNumber(
        patch.strawVolumeMl === undefined ? existing.strawVolumeMl : patch.strawVolumeMl,
        'Straw volume',
      ),
      normalizeOptionalPositiveNumber(
        patch.concentrationMillionsPerMl === undefined
          ? existing.concentrationMillionsPerMl
          : patch.concentrationMillionsPerMl,
        'Concentration (millions/mL)',
      ),
      normalizeOptionalIntegerAtLeastOne(
        patch.strawsPerDose === undefined ? existing.strawsPerDose : patch.strawsPerDose,
        'Straws per dose',
      ),
      strawColor,
      normalizeStrawColorOther(
        strawColor,
        patch.strawColorOther === undefined
          ? existing.strawColorOther
          : patch.strawColorOther,
      ),
      normalizeOptionalText(patch.strawLabel === undefined ? existing.strawLabel : patch.strawLabel),
      normalizeOptionalPercentage(
        patch.postThawMotilityPercent === undefined
          ? existing.postThawMotilityPercent
          : patch.postThawMotilityPercent,
        'Post-thaw motility',
      ),
      normalizeOptionalPositiveNumber(
        patch.longevityHours === undefined ? existing.longevityHours : patch.longevityHours,
        'Longevity',
      ),
      normalizeOptionalText(
        patch.storageDetails === undefined ? existing.storageDetails : patch.storageDetails,
      ),
      normalizeOptionalText(patch.notes === undefined ? existing.notes : patch.notes),
      new Date().toISOString(),
      id,
    ],
  );

  emitDataInvalidation('all');

  const updated = await getFrozenSemenBatch(id, handle);
  if (!updated) {
    throw new Error('Failed to load updated frozen semen batch.');
  }

  return updated;
}

export async function deleteFrozenSemenBatch(id: UUID, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.runAsync('DELETE FROM frozen_semen_batches WHERE id = ?;', [id]);
  emitDataInvalidation('all');
}

export async function getFrozenSemenBatch(id: UUID, db?: RepoDb): Promise<FrozenSemenBatch | null> {
  const row = await getFrozenSemenBatchRowById(id, db);
  return row ? mapRow(row) : null;
}

export async function listFrozenSemenBatchesByStallion(
  stallionId: UUID,
  db?: RepoDb,
): Promise<FrozenSemenBatch[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FrozenSemenBatchRow>(
    `
    SELECT
      id,
      stallion_id,
      collection_id,
      freeze_date,
      raw_semen_volume_used_ml,
      extender,
      extender_other,
      was_centrifuged,
      centrifuge_speed_rpm,
      centrifuge_duration_min,
      centrifuge_cushion_used,
      centrifuge_cushion_type,
      centrifuge_resuspension_vol_ml,
      centrifuge_notes,
      straw_count,
      straws_remaining,
      straw_volume_ml,
      concentration_millions_per_ml,
      straws_per_dose,
      straw_color,
      straw_color_other,
      straw_label,
      post_thaw_motility_percent,
      longevity_hours,
      storage_details,
      notes,
      created_at,
      updated_at
    FROM frozen_semen_batches
    WHERE stallion_id = ?
    ORDER BY freeze_date DESC, created_at DESC, id DESC;
    `,
    [stallionId],
  );

  return rows.map(mapRow);
}

export async function listFrozenSemenBatchesByCollection(
  collectionId: UUID,
  db?: RepoDb,
): Promise<FrozenSemenBatch[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FrozenSemenBatchRow>(
    `
    SELECT
      id,
      stallion_id,
      collection_id,
      freeze_date,
      raw_semen_volume_used_ml,
      extender,
      extender_other,
      was_centrifuged,
      centrifuge_speed_rpm,
      centrifuge_duration_min,
      centrifuge_cushion_used,
      centrifuge_cushion_type,
      centrifuge_resuspension_vol_ml,
      centrifuge_notes,
      straw_count,
      straws_remaining,
      straw_volume_ml,
      concentration_millions_per_ml,
      straws_per_dose,
      straw_color,
      straw_color_other,
      straw_label,
      post_thaw_motility_percent,
      longevity_hours,
      storage_details,
      notes,
      created_at,
      updated_at
    FROM frozen_semen_batches
    WHERE collection_id = ?
    ORDER BY freeze_date DESC, created_at DESC, id DESC;
    `,
    [collectionId],
  );

  return rows.map(mapRow);
}

export async function listFrozenSemenBatchesByCollectionIds(
  collectionIds: readonly UUID[],
  db?: RepoDb,
): Promise<Record<UUID, FrozenSemenBatch[]>> {
  const grouped: Record<UUID, FrozenSemenBatch[]> = {};

  for (const collectionId of collectionIds) {
    grouped[collectionId] = [];
  }

  if (collectionIds.length === 0) {
    return grouped;
  }

  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<FrozenSemenBatchRow>(
    `
    SELECT
      id,
      stallion_id,
      collection_id,
      freeze_date,
      raw_semen_volume_used_ml,
      extender,
      extender_other,
      was_centrifuged,
      centrifuge_speed_rpm,
      centrifuge_duration_min,
      centrifuge_cushion_used,
      centrifuge_cushion_type,
      centrifuge_resuspension_vol_ml,
      centrifuge_notes,
      straw_count,
      straws_remaining,
      straw_volume_ml,
      concentration_millions_per_ml,
      straws_per_dose,
      straw_color,
      straw_color_other,
      straw_label,
      post_thaw_motility_percent,
      longevity_hours,
      storage_details,
      notes,
      created_at,
      updated_at
    FROM frozen_semen_batches
    WHERE collection_id IN (${buildCollectionIdPlaceholders(collectionIds.length)})
    ORDER BY freeze_date DESC, created_at DESC, id DESC;
    `,
    [...collectionIds],
  );

  for (const row of rows) {
    if (!row.collection_id) {
      continue;
    }
    grouped[row.collection_id] ??= [];
    grouped[row.collection_id].push(mapRow(row));
  }

  return grouped;
}
