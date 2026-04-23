import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/utils/id', () => ({
  newId: vi.fn(),
}));

vi.mock('./stallions', () => ({
  getStallionById: vi.fn(),
}));

vi.mock('./semenCollections', () => ({
  getSemenCollectionById: vi.fn(),
}));

vi.mock('./internal/collectionAllocation', () => ({
  assertCollectionSemenVolumeCanSupportAllocation: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { newId } from '@/utils/id';
import {
  createFrozenSemenBatch,
  deleteFrozenSemenBatch,
  getFrozenSemenBatch,
  listFrozenSemenBatchesByCollection,
  listFrozenSemenBatchesByStallion,
  updateFrozenSemenBatch,
} from './frozenSemenBatches';
import { assertCollectionSemenVolumeCanSupportAllocation } from './internal/collectionAllocation';
import { getSemenCollectionById } from './semenCollections';
import { getStallionById } from './stallions';

type FrozenRow = {
  id: string;
  stallion_id: string;
  collection_id: string | null;
  freeze_date: string;
  raw_semen_volume_used_ml: number | null;
  extender: string | null;
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
  straw_color: string | null;
  straw_color_other: string | null;
  straw_label: string | null;
  post_thaw_motility_percent: number | null;
  longevity_hours: number | null;
  storage_details: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeDb() {
  const frozen = new Map<string, FrozenRow>();

  return {
    frozen,
    db: {
      async runAsync(sql: string, params: unknown[] = []): Promise<void> {
        const stmt = normalized(sql);

        if (stmt.startsWith('insert into frozen_semen_batches')) {
          const [
            id,
            stallionId,
            collectionId,
            freezeDate,
            rawSemenVolumeUsedMl,
            extender,
            extenderOther,
            wasCentrifuged,
            centrifugeSpeedRpm,
            centrifugeDurationMin,
            centrifugeCushionUsed,
            centrifugeCushionType,
            centrifugeResuspensionVolMl,
            centrifugeNotes,
            strawCount,
            strawsRemaining,
            strawVolumeMl,
            concentrationMillionsPerMl,
            strawsPerDose,
            strawColor,
            strawColorOther,
            strawLabel,
            postThawMotilityPercent,
            longevityHours,
            storageDetails,
            notes,
            createdAt,
            updatedAt,
          ] = params as [
            string,
            string,
            string | null,
            string,
            number | null,
            string | null,
            string | null,
            0 | 1,
            number | null,
            number | null,
            0 | 1 | null,
            string | null,
            number | null,
            string | null,
            number,
            number,
            number,
            number | null,
            number | null,
            string | null,
            string | null,
            string | null,
            number | null,
            number | null,
            string | null,
            string | null,
            string,
            string,
          ];

          frozen.set(id, {
            id,
            stallion_id: stallionId,
            collection_id: collectionId,
            freeze_date: freezeDate,
            raw_semen_volume_used_ml: rawSemenVolumeUsedMl,
            extender,
            extender_other: extenderOther,
            was_centrifuged: wasCentrifuged,
            centrifuge_speed_rpm: centrifugeSpeedRpm,
            centrifuge_duration_min: centrifugeDurationMin,
            centrifuge_cushion_used: centrifugeCushionUsed,
            centrifuge_cushion_type: centrifugeCushionType,
            centrifuge_resuspension_vol_ml: centrifugeResuspensionVolMl,
            centrifuge_notes: centrifugeNotes,
            straw_count: strawCount,
            straws_remaining: strawsRemaining,
            straw_volume_ml: strawVolumeMl,
            concentration_millions_per_ml: concentrationMillionsPerMl,
            straws_per_dose: strawsPerDose,
            straw_color: strawColor,
            straw_color_other: strawColorOther,
            straw_label: strawLabel,
            post_thaw_motility_percent: postThawMotilityPercent,
            longevity_hours: longevityHours,
            storage_details: storageDetails,
            notes,
            created_at: createdAt,
            updated_at: updatedAt,
          });
          return;
        }

        if (stmt.startsWith('update frozen_semen_batches')) {
          const existing = frozen.get(params[24] as string);
          if (!existing) {
            return;
          }

          frozen.set(params[24] as string, {
            ...existing,
            freeze_date: params[0] as string,
            raw_semen_volume_used_ml: params[1] as number | null,
            extender: params[2] as string | null,
            extender_other: params[3] as string | null,
            was_centrifuged: params[4] as 0 | 1,
            centrifuge_speed_rpm: params[5] as number | null,
            centrifuge_duration_min: params[6] as number | null,
            centrifuge_cushion_used: params[7] as 0 | 1 | null,
            centrifuge_cushion_type: params[8] as string | null,
            centrifuge_resuspension_vol_ml: params[9] as number | null,
            centrifuge_notes: params[10] as string | null,
            straw_count: params[11] as number,
            straws_remaining: params[12] as number,
            straw_volume_ml: params[13] as number,
            concentration_millions_per_ml: params[14] as number | null,
            straws_per_dose: params[15] as number | null,
            straw_color: params[16] as string | null,
            straw_color_other: params[17] as string | null,
            straw_label: params[18] as string | null,
            post_thaw_motility_percent: params[19] as number | null,
            longevity_hours: params[20] as number | null,
            storage_details: params[21] as string | null,
            notes: params[22] as string | null,
            updated_at: params[23] as string,
          });
          return;
        }

        if (stmt.startsWith('delete from frozen_semen_batches')) {
          frozen.delete(params[0] as string);
        }
      },

      async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
        const stmt = normalized(sql);
        if (stmt.includes('from frozen_semen_batches') && stmt.includes('where id = ?')) {
          return (frozen.get(params[0] as string) as T | undefined) ?? null;
        }
        return null;
      },

      async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
        const stmt = normalized(sql);

        if (stmt.includes('from frozen_semen_batches') && stmt.includes('where stallion_id = ?')) {
          const rows = Array.from(frozen.values())
            .filter((row) => row.stallion_id === params[0])
            .sort((a, b) => b.freeze_date.localeCompare(a.freeze_date));
          return rows as T[];
        }

        if (stmt.includes('from frozen_semen_batches') && stmt.includes('where collection_id = ?')) {
          const rows = Array.from(frozen.values())
            .filter((row) => row.collection_id === params[0])
            .sort((a, b) => b.freeze_date.localeCompare(a.freeze_date));
          return rows as T[];
        }

        return [];
      },
    },
  };
}

function buildCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    stallionId: 'stallion-1',
    collectionId: null,
    freezeDate: '2026-04-22',
    rawSemenVolumeUsedMl: null,
    extender: 'BotuCrio',
    extenderOther: null,
    wasCentrifuged: false,
    centrifuge: {
      speedRpm: 1500,
      durationMin: 10,
      cushionUsed: true,
      cushionType: 'EqCellSafe',
      resuspensionVolumeMl: 4,
      notes: 'clear me',
    },
    strawCount: 20,
    strawVolumeMl: 0.5,
    concentrationMillionsPerMl: 250,
    strawsPerDose: 2,
    strawColor: 'Blue',
    strawColorOther: null,
    strawLabel: 'Lot A',
    postThawMotilityPercent: 65.5,
    longevityHours: 12.5,
    storageDetails: 'Tank A / Cane 2',
    notes: 'Initial batch',
    ...overrides,
  };
}

describe('frozenSemenBatches repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(newId).mockReturnValue('batch-1');
    vi.mocked(getStallionById).mockResolvedValue({
      id: 'stallion-1',
      name: 'Atlas',
      deletedAt: null,
    } as never);
    vi.mocked(getSemenCollectionById).mockResolvedValue(null);
    vi.mocked(assertCollectionSemenVolumeCanSupportAllocation).mockResolvedValue(undefined);
  });

  it('creates standalone batches with null linked volume and cleared centrifuge fields', async () => {
    const { db } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const created = await createFrozenSemenBatch(
      buildCreateInput({
        rawSemenVolumeUsedMl: 11,
      }) as never,
    );

    expect(created.collectionId).toBeNull();
    expect(created.rawSemenVolumeUsedMl).toBeNull();
    expect(created.strawCount).toBe(20);
    expect(created.strawsRemaining).toBe(20);
    expect(created.wasCentrifuged).toBe(false);
    expect(created.centrifuge.speedRpm).toBeNull();
    expect(created.centrifuge.cushionUsed).toBeNull();
    expect(assertCollectionSemenVolumeCanSupportAllocation).not.toHaveBeenCalled();
  });

  it('rejects linked batches when the collection belongs to a different stallion', async () => {
    const { db } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getSemenCollectionById).mockResolvedValue({
      id: 'collection-1',
      stallionId: 'stallion-2',
    } as never);

    await expect(
      createFrozenSemenBatch(
        buildCreateInput({
          collectionId: 'collection-1',
          rawSemenVolumeUsedMl: 5,
        }) as never,
      ),
    ).rejects.toThrow('Collection belongs to a different stallion.');
  });

  it('requires positive raw volume for linked batches and runs allocation checks', async () => {
    const { db } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getSemenCollectionById).mockResolvedValue({
      id: 'collection-1',
      stallionId: 'stallion-1',
    } as never);

    await expect(
      createFrozenSemenBatch(
        buildCreateInput({
          collectionId: 'collection-1',
          rawSemenVolumeUsedMl: null,
        }) as never,
      ),
    ).rejects.toThrow('Raw semen volume used is required for linked frozen batches.');

    const created = await createFrozenSemenBatch(
      buildCreateInput({
        collectionId: 'collection-1',
        rawSemenVolumeUsedMl: 8.5,
      }) as never,
    );

    expect(created.collectionId).toBe('collection-1');
    expect(created.rawSemenVolumeUsedMl).toBe(8.5);
    expect(assertCollectionSemenVolumeCanSupportAllocation).toHaveBeenCalledWith(
      db,
      'collection-1',
      8.5,
      1,
    );
  });

  it('preserves used straws when straw count changes and blocks impossible updates', async () => {
    const { db, frozen } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await createFrozenSemenBatch(buildCreateInput() as never);

    const existing = frozen.get('batch-1');
    if (!existing) {
      throw new Error('Expected seeded batch');
    }

    existing.straw_count = 20;
    existing.straws_remaining = 15; // 5 used so far

    const updated = await updateFrozenSemenBatch('batch-1', {
      strawCount: 18,
    });

    expect(updated.strawCount).toBe(18);
    expect(updated.strawsRemaining).toBe(13);

    const refreshed = frozen.get('batch-1');
    if (!refreshed) {
      throw new Error('Expected refreshed batch');
    }

    refreshed.straw_count = 20;
    refreshed.straws_remaining = 3; // 17 used so far

    await expect(
      updateFrozenSemenBatch('batch-1', {
        strawCount: 10,
      }),
    ).rejects.toThrow('Straw count cannot be lower than the number of straws already used.');
  });

  it('passes excludeFrozenBatchId when validating linked allocation on update', async () => {
    const { db } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getSemenCollectionById).mockResolvedValue({
      id: 'collection-1',
      stallionId: 'stallion-1',
    } as never);

    await createFrozenSemenBatch(
      buildCreateInput({
        collectionId: 'collection-1',
        rawSemenVolumeUsedMl: 6,
      }) as never,
    );

    await updateFrozenSemenBatch('batch-1', {
      rawSemenVolumeUsedMl: 7,
    });

    expect(assertCollectionSemenVolumeCanSupportAllocation).toHaveBeenLastCalledWith(
      db,
      'collection-1',
      7,
      1,
      { excludeFrozenBatchId: 'batch-1' },
    );
  });

  it('keeps stallion and collection immutable during updates', async () => {
    const { db } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    await createFrozenSemenBatch(buildCreateInput() as never);

    await expect(
      updateFrozenSemenBatch('batch-1', {
        stallionId: 'stallion-2',
      } as never),
    ).rejects.toThrow('Stallion and collection cannot be changed for an existing frozen batch.');
  });

  it('lists and deletes batches by stallion/collection', async () => {
    const { db } = createFakeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await createFrozenSemenBatch(buildCreateInput({ collectionId: null }) as never);
    vi.mocked(newId).mockReturnValue('batch-2');
    vi.mocked(getSemenCollectionById).mockResolvedValue({
      id: 'collection-1',
      stallionId: 'stallion-1',
    } as never);
    await createFrozenSemenBatch(
      buildCreateInput({
        collectionId: 'collection-1',
        rawSemenVolumeUsedMl: 5,
      }) as never,
    );

    const byStallion = await listFrozenSemenBatchesByStallion('stallion-1');
    expect(byStallion).toHaveLength(2);

    const byCollection = await listFrozenSemenBatchesByCollection('collection-1');
    expect(byCollection).toHaveLength(1);
    expect(byCollection[0]?.id).toBe('batch-2');

    await deleteFrozenSemenBatch('batch-1');
    expect(await getFrozenSemenBatch('batch-1')).toBeNull();
  });
});
