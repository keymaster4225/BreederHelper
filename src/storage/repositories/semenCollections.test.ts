import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/storage/db';
import {
  createSemenCollection,
  deleteSemenCollection,
  getSemenCollectionById,
  isSemenCollectionLinked,
  listSemenCollectionsByStallion,
  updateSemenCollection,
} from './semenCollections';
import {
  createBreedingRecord,
  listBreedingRecordsForStallion,
  listLegacyBreedingRecordsMatchingStallionName,
} from './breedingRecords';
import { createStallion, softDeleteStallion } from './stallions';

type StallionRow = {
  id: string;
  name: string;
  breed: string | null;
  registration_number: string | null;
  sire: string | null;
  dam: string | null;
  notes: string | null;
  date_of_birth: string | null;
  av_temperature_f: number | null;
  av_type: string | null;
  av_liner_type: string | null;
  av_water_volume_ml: number | null;
  av_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CollectionRow = {
  id: string;
  stallion_id: string;
  collection_date: string;
  raw_volume_ml: number | null;
  extended_volume_ml: number | null;
  extender_volume_ml: number | null;
  extender_type: string | null;
  concentration_millions_per_ml: number | null;
  progressive_motility_percent: number | null;
  dose_count: number | null;
  dose_size_millions: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BreedingRow = {
  id: string;
  mare_id: string;
  stallion_id: string | null;
  stallion_name: string | null;
  collection_id: string | null;
  date: string;
  method: string;
  notes: string | null;
  volume_ml: number | null;
  concentration_m_per_ml: number | null;
  motility_percent: number | null;
  number_of_straws: number | null;
  straw_volume_ml: number | null;
  straw_details: string | null;
  collection_date: string | null;
  created_at: string;
  updated_at: string;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeDb() {
  const stallions = new Map<string, StallionRow>();
  const collections = new Map<string, CollectionRow>();
  const breedings = new Map<string, BreedingRow>();

  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('insert into stallions')) {
        const [id, name, breed, regNum, sire, dam, notes, dob, avTemp, avType, avLiner, avWater, avNotes, createdAt, updatedAt] =
          params as [string, string, string | null, string | null, string | null, string | null, string | null, string | null, number | null, string | null, string | null, number | null, string | null, string, string];
        stallions.set(id, {
          id, name, breed, registration_number: regNum, sire, dam, notes,
          date_of_birth: dob, av_temperature_f: avTemp, av_type: avType,
          av_liner_type: avLiner, av_water_volume_ml: avWater, av_notes: avNotes,
          created_at: createdAt, updated_at: updatedAt, deleted_at: null,
        });
        return;
      }

      if (stmt.startsWith('update stallions') && stmt.includes('deleted_at')) {
        const [deletedAt, updatedAt, id] = params as [string, string, string];
        const existing = stallions.get(id);
        if (existing) stallions.set(id, { ...existing, deleted_at: deletedAt, updated_at: updatedAt });
        return;
      }

      if (stmt.startsWith('insert into semen_collections')) {
        const [id, stallionId, collectionDate, rawVol, totalVol, extenderVol, extenderType, conc, motility, doseCount, doseSize, notes, createdAt, updatedAt] =
          params as [string, string, string, number | null, number | null, number | null, string | null, number | null, number | null, number | null, number | null, string | null, string, string];
        collections.set(id, {
          id, stallion_id: stallionId, collection_date: collectionDate,
          raw_volume_ml: rawVol, extended_volume_ml: totalVol,
          extender_volume_ml: extenderVol, extender_type: extenderType,
          concentration_millions_per_ml: conc, progressive_motility_percent: motility,
          dose_count: doseCount, dose_size_millions: doseSize,
          notes,
          created_at: createdAt, updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update semen_collections')) {
        const [collectionDate, rawVol, totalVol, extenderVol, extenderType, conc, motility, doseCount, doseSize, notes, updatedAt, id] =
          params as [string, number | null, number | null, number | null, string | null, number | null, number | null, number | null, number | null, string | null, string, string];
        const existing = collections.get(id);
        if (existing) {
          collections.set(id, {
            ...existing, collection_date: collectionDate,
            raw_volume_ml: rawVol, extended_volume_ml: totalVol,
            extender_volume_ml: extenderVol, extender_type: extenderType,
            concentration_millions_per_ml: conc, progressive_motility_percent: motility,
            dose_count: doseCount, dose_size_millions: doseSize,
            notes, updated_at: updatedAt,
          });
        }
        return;
      }

      if (stmt.startsWith('delete from semen_collections')) {
        const [id] = params as [string];
        collections.delete(id);
        return;
      }

      if (stmt.startsWith('insert into breeding_records')) {
        const [id, mareId, stallionId, stallionName, collectionId, date, method, notes, vol, conc, mot, straws, strawVol, strawDetails, collDate, createdAt, updatedAt] =
          params as [string, string, string | null, string | null, string | null, string, string, string | null, number | null, number | null, number | null, number | null, number | null, string | null, string | null, string, string];
        breedings.set(id, {
          id, mare_id: mareId, stallion_id: stallionId, stallion_name: stallionName,
          collection_id: collectionId, date, method, notes,
          volume_ml: vol, concentration_m_per_ml: conc, motility_percent: mot,
          number_of_straws: straws, straw_volume_ml: strawVol,
          straw_details: strawDetails, collection_date: collDate,
          created_at: createdAt, updated_at: updatedAt,
        });
        return;
      }
    },

    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = normalized(sql);

      if (stmt.includes('from stallions') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (stallions.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('from semen_collections') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (collections.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('count(*)') && stmt.includes('breeding_records') && stmt.includes('collection_id = ?')) {
        const [collectionId] = params as [string];
        const count = Array.from(breedings.values()).filter((b) => b.collection_id === collectionId).length;
        return { count } as T;
      }

      return null;
    },

    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = normalized(sql);

      if (stmt.includes('from semen_collections') && stmt.includes('stallion_id = ?')) {
        const [stallionId] = params as [string];
        const rows = Array.from(collections.values())
          .filter((c) => c.stallion_id === stallionId)
          .sort((a, b) => b.collection_date.localeCompare(a.collection_date));
        return rows as T[];
      }

      if (stmt.includes('from breeding_records') && stmt.includes('stallion_id = ?') && !stmt.includes('stallion_id is null')) {
        const [stallionId] = params as [string];
        const rows = Array.from(breedings.values())
          .filter((b) => b.stallion_id === stallionId)
          .sort((a, b) => b.date.localeCompare(a.date));
        return rows as T[];
      }

      if (stmt.includes('from breeding_records') && stmt.includes('stallion_id is null') && stmt.includes('lower(stallion_name) = lower(?)')) {
        const [name] = params as [string];
        const rows = Array.from(breedings.values())
          .filter((b) => b.stallion_id === null && b.stallion_name?.toLowerCase() === name.toLowerCase())
          .sort((a, b) => b.date.localeCompare(a.date));
        return rows as T[];
      }

      return [];
    },
  };
}

describe('semen collection repository', () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createFakeDb() as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it('creates, reads, updates, and deletes a collection (happy path)', async () => {
    await createStallion({ id: 'st-1', name: 'Thunder' });

    await createSemenCollection({
      id: 'col-1',
      stallionId: 'st-1',
      collectionDate: '2026-04-01',
      rawVolumeMl: 50,
      totalVolumeMl: 450,
      extenderVolumeMl: 400,
      extenderType: 'INRA 96',
      progressiveMotilityPercent: 75,
      doseCount: 10,
    });

    const fetched = await getSemenCollectionById('col-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.stallionId).toBe('st-1');
    expect(fetched?.rawVolumeMl).toBe(50);
    expect(fetched?.totalVolumeMl).toBe(450);
    expect(fetched?.extenderVolumeMl).toBe(400);
    expect(fetched?.extenderType).toBe('INRA 96');
    expect(fetched?.progressiveMotilityPercent).toBe(75);

    await updateSemenCollection('col-1', {
      collectionDate: '2026-04-02',
      rawVolumeMl: 55,
      totalVolumeMl: 500,
      extenderVolumeMl: 445,
      extenderType: 'BotuSemen',
      progressiveMotilityPercent: 80,
    });

    const updated = await getSemenCollectionById('col-1');
    expect(updated?.collectionDate).toBe('2026-04-02');
    expect(updated?.rawVolumeMl).toBe(55);
    expect(updated?.totalVolumeMl).toBe(500);
    expect(updated?.extenderVolumeMl).toBe(445);
    expect(updated?.extenderType).toBe('BotuSemen');

    await deleteSemenCollection('col-1');
    const deleted = await getSemenCollectionById('col-1');
    expect(deleted).toBeNull();
  });

  it('lists collections by stallion in date DESC order', async () => {
    await createStallion({ id: 'st-2', name: 'Lightning' });

    await createSemenCollection({ id: 'col-a', stallionId: 'st-2', collectionDate: '2026-03-01' });
    await createSemenCollection({ id: 'col-b', stallionId: 'st-2', collectionDate: '2026-04-01' });

    const list = await listSemenCollectionsByStallion('st-2');
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('col-b'); // newer first
  });

  it('stores dose-related collection fields without legacy shipping columns', async () => {
    await createStallion({ id: 'st-3', name: 'Bolt' });

    await createSemenCollection({
      id: 'col-ship',
      stallionId: 'st-3',
      collectionDate: '2026-04-01',
      totalVolumeMl: 600,
      extenderVolumeMl: 525,
      extenderType: 'INRA 96',
      doseCount: 12,
      doseSizeMillions: 500,
    });

    const fetched = await getSemenCollectionById('col-ship');
    expect(fetched?.doseCount).toBe(12);
    expect(fetched?.doseSizeMillions).toBe(500);
    expect(fetched?.totalVolumeMl).toBe(600);
    expect(fetched?.extenderVolumeMl).toBe(525);
    expect(fetched?.extenderType).toBe('INRA 96');
  });

  describe('invariant I4: soft-deleted stallion blocks collection creation', () => {
    it('throws when creating collection for deleted stallion', async () => {
      await createStallion({ id: 'st-del', name: 'Ghost' });
      await softDeleteStallion('st-del');

      await expect(
        createSemenCollection({ id: 'col-fail', stallionId: 'st-del', collectionDate: '2026-04-01' }),
      ).rejects.toThrow('Cannot add collection for a deleted stallion.');
    });
  });

  it('throws when stallion not found', async () => {
    await expect(
      createSemenCollection({ id: 'col-fail2', stallionId: 'nonexistent', collectionDate: '2026-04-01' }),
    ).rejects.toThrow('Stallion not found.');
  });

  describe('invariant I3: linked collection delete rejection', () => {
    it('throws when deleting collection linked to breeding record', async () => {
      await createStallion({ id: 'st-link', name: 'Atlas' });
      await createSemenCollection({ id: 'col-link', stallionId: 'st-link', collectionDate: '2026-04-01' });

      await createBreedingRecord({
        id: 'br-link',
        mareId: 'mare-1',
        stallionId: 'st-link',
        collectionId: 'col-link',
        date: '2026-04-02',
        method: 'freshAI',
      });

      const linked = await isSemenCollectionLinked('col-link');
      expect(linked).toBe(true);

      await expect(deleteSemenCollection('col-link')).rejects.toThrow(
        'This collection is linked to a breeding record and cannot be deleted.',
      );
    });
  });

  describe('invariant I2: cross-stallion rejection', () => {
    it('throws when breeding record links collection from different stallion', async () => {
      await createStallion({ id: 'st-a', name: 'Alpha' });
      await createStallion({ id: 'st-b', name: 'Beta' });
      await createSemenCollection({ id: 'col-a', stallionId: 'st-a', collectionDate: '2026-04-01' });

      await expect(
        createBreedingRecord({
          id: 'br-cross',
          mareId: 'mare-1',
          stallionId: 'st-b',
          collectionId: 'col-a',
          date: '2026-04-02',
          method: 'freshAI',
        }),
      ).rejects.toThrow('Collection belongs to a different stallion.');
    });
  });

  it('collection_id requires stallion_id', async () => {
    await createStallion({ id: 'st-req', name: 'Required' });
    await createSemenCollection({ id: 'col-req', stallionId: 'st-req', collectionDate: '2026-04-01' });

    await expect(
      createBreedingRecord({
        id: 'br-req',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Other',
        collectionId: 'col-req',
        date: '2026-04-02',
        method: 'freshAI',
      }),
    ).rejects.toThrow('A collection requires a linked stallion.');
  });

  describe('stallion breeding queries', () => {
    it('listBreedingRecordsForStallion returns linked records', async () => {
      await createStallion({ id: 'st-q', name: 'Query' });
      await createBreedingRecord({
        id: 'br-q1',
        mareId: 'mare-1',
        stallionId: 'st-q',
        date: '2026-03-01',
        method: 'liveCover',
      });
      await createBreedingRecord({
        id: 'br-q2',
        mareId: 'mare-2',
        stallionId: 'st-q',
        date: '2026-04-01',
        method: 'freshAI',
      });

      const results = await listBreedingRecordsForStallion('st-q');
      expect(results).toHaveLength(2);
      expect(results[0].date).toBe('2026-04-01'); // DESC order
    });

    it('listLegacyBreedingRecordsMatchingStallionName returns case-insensitive matches', async () => {
      await createBreedingRecord({
        id: 'br-leg',
        mareId: 'mare-1',
        stallionId: null,
        stallionName: 'Thunder',
        date: '2026-03-01',
        method: 'liveCover',
      });

      const results = await listLegacyBreedingRecordsMatchingStallionName('thunder');
      expect(results).toHaveLength(1);

      const noResults = await listLegacyBreedingRecordsMatchingStallionName('Lightning');
      expect(noResults).toHaveLength(0);
    });
  });
});
