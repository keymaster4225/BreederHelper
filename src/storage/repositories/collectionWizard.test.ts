import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/utils/id', () => ({
  newId: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { newId } from '@/utils/id';
import {
  createCollectionWithAllocations,
  getAllocatedDoseCountForCollection,
} from './collectionWizard';

type StallionRow = {
  id: string;
  name: string;
  deleted_at: string | null;
};

type MareRow = {
  id: string;
  name: string;
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
  collection_id: string | null;
  date: string;
  method: string;
  notes: string | null;
  volume_ml: number | null;
  concentration_m_per_ml: number | null;
  motility_percent: number | null;
  collection_date: string | null;
};

type DoseEventRow = {
  id: string;
  collection_id: string;
  event_type: 'shipped' | 'usedOnSite';
  recipient: string;
  breeding_record_id: string | null;
  dose_count: number | null;
  event_date: string | null;
  notes: string | null;
  carrier_service: string | null;
  container_type: string | null;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function cloneMapEntries<T extends Record<string, unknown>>(source: Map<string, T>): Map<string, T> {
  return new Map(Array.from(source.entries()).map(([key, value]) => [key, { ...value }]));
}

function createFakeDb() {
  const stallions = new Map<string, StallionRow>([
    ['st-1', { id: 'st-1', name: 'Atlas', deleted_at: null }],
  ]);
  const mares = new Map<string, MareRow>([
    ['mare-1', { id: 'mare-1', name: 'Maple', deleted_at: null }],
    ['mare-2', { id: 'mare-2', name: 'Nova', deleted_at: null }],
  ]);
  const collections = new Map<string, CollectionRow>();
  const breedingRecords = new Map<string, BreedingRow>();
  const doseEvents = new Map<string, DoseEventRow>();

  return {
    collections,
    breedingRecords,
    doseEvents,
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('insert into semen_collections')) {
        const [
          id,
          stallionId,
          collectionDate,
          rawVolumeMl,
          totalVolumeMl,
          extenderVolumeMl,
          extenderType,
          concentrationMillionsPerMl,
          progressiveMotilityPercent,
          doseCount,
          doseSizeMillions,
          notes,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
          number | null,
          number | null,
          number | null,
          string | null,
          number | null,
          number | null,
          number | null,
          number | null,
          string | null,
          string,
          string,
        ];
        collections.set(id, {
          id,
          stallion_id: stallionId,
          collection_date: collectionDate,
          raw_volume_ml: rawVolumeMl,
          extended_volume_ml: totalVolumeMl,
          extender_volume_ml: extenderVolumeMl,
          extender_type: extenderType,
          concentration_millions_per_ml: concentrationMillionsPerMl,
          progressive_motility_percent: progressiveMotilityPercent,
          dose_count: doseCount,
          dose_size_millions: doseSizeMillions,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('insert into breeding_records')) {
        const [
          id,
          mareId,
          stallionId,
          ,
          collectionId,
          date,
          method,
          notes,
          volumeMl,
          concentrationMPerMl,
          motilityPercent,
          ,
          ,
          ,
          collectionDate,
        ] = params as [
          string,
          string,
          string | null,
          string | null,
          string | null,
          string,
          string,
          string | null,
          number | null,
          number | null,
          number | null,
          number | null,
          number | null,
          string | null,
          string | null,
          string,
          string,
        ];
        breedingRecords.set(id, {
          id,
          mare_id: mareId,
          stallion_id: stallionId,
          collection_id: collectionId,
          date,
          method,
          notes,
          volume_ml: volumeMl,
          concentration_m_per_ml: concentrationMPerMl,
          motility_percent: motilityPercent,
          collection_date: collectionDate,
        });
        return;
      }

      if (stmt.startsWith('insert into collection_dose_events')) {
        const [
          id,
          collectionId,
          eventType,
          recipient,
          ,
          ,
          ,
          ,
          ,
          carrierService,
          containerType,
          ,
          breedingRecordId,
          doseCount,
          eventDate,
          notes,
        ] = params as [
          string,
          string,
          DoseEventRow['event_type'],
          string,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          number | null,
          string | null,
          string | null,
          string,
          string,
        ];
        doseEvents.set(id, {
          id,
          collection_id: collectionId,
          event_type: eventType,
          recipient,
          breeding_record_id: breedingRecordId,
          dose_count: doseCount,
          event_date: eventDate,
          notes,
          carrier_service: carrierService,
          container_type: containerType,
        });
      }
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = normalized(sql);

      if (stmt.includes('select name, deleted_at from stallions where id = ?')) {
        const [stallionId] = params as [string];
        return (stallions.get(stallionId) as T | undefined) ?? null;
      }

      if (stmt.includes('select name, deleted_at from mares where id = ?')) {
        const [mareId] = params as [string];
        return (mares.get(mareId) as T | undefined) ?? null;
      }

      if (stmt.includes('select dose_count from semen_collections where id = ?')) {
        const [collectionId] = params as [string];
        const collection = collections.get(collectionId);
        return collection ? ({ dose_count: collection.dose_count } as T) : null;
      }

      if (stmt.includes('allocated_dose_count') && stmt.includes('from collection_dose_events')) {
        const [collectionId, excludeId] = params as [string, string?];
        const allocatedDoseCount = Array.from(doseEvents.values())
          .filter((event) => event.collection_id === collectionId && (!excludeId || event.id !== excludeId))
          .reduce((total, event) => total + (event.dose_count ?? 0), 0);
        return { allocated_dose_count: allocatedDoseCount } as T;
      }

      return null;
    },
    async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
      const collectionsSnapshot = cloneMapEntries(collections);
      const breedingSnapshot = cloneMapEntries(breedingRecords);
      const doseEventsSnapshot = cloneMapEntries(doseEvents);

      try {
        return await callback();
      } catch (error) {
        collections.clear();
        breedingRecords.clear();
        doseEvents.clear();

        for (const [id, row] of collectionsSnapshot.entries()) {
          collections.set(id, row);
        }
        for (const [id, row] of breedingSnapshot.entries()) {
          breedingRecords.set(id, row);
        }
        for (const [id, row] of doseEventsSnapshot.entries()) {
          doseEvents.set(id, row);
        }
        throw error;
      }
    },
  };
}

describe('collection wizard repository', () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createFakeDb() as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it('creates a collection plus mixed shipped and on-farm allocations in one transaction', async () => {
    vi.mocked(newId)
      .mockReturnValueOnce('collection-1')
      .mockReturnValueOnce('event-1')
      .mockReturnValueOnce('breeding-1')
      .mockReturnValueOnce('event-2');

    const result = await createCollectionWithAllocations({
      collection: {
        stallionId: 'st-1',
        collectionDate: '2026-04-01',
        rawVolumeMl: 50,
        concentrationMillionsPerMl: 200,
        progressiveMotilityPercent: 75,
        doseCount: 10,
      },
      shippedRows: [
        {
          recipient: 'Farm ABC',
          recipientPhone: '555-0100',
          recipientStreet: '100 Main St',
          recipientCity: 'Lexington',
          recipientState: 'KY',
          recipientZip: '40511',
          carrierService: 'FedEx Priority Overnight',
          containerType: 'Equitainer',
          doseCount: 4,
          eventDate: '2026-04-01',
          notes: 'Cold chain',
        },
      ],
      onFarmRows: [
        {
          mareId: 'mare-1',
          eventDate: '2026-04-02',
          doseCount: 2,
          notes: 'Bred in barn 2',
        },
      ],
    });

    expect(result.collectionId).toBe('collection-1');
    expect(result.breedingRecordIds).toEqual(['breeding-1']);

    const db = await getDb();
    const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;
    expect(fakeDb.collections.size).toBe(1);
    expect(fakeDb.breedingRecords.size).toBe(1);
    expect(fakeDb.doseEvents.size).toBe(2);

    const breedingRecord = fakeDb.breedingRecords.get('breeding-1');
    expect(breedingRecord?.collection_id).toBe('collection-1');
    expect(breedingRecord?.method).toBe('freshAI');
    expect(breedingRecord?.volume_ml).toBe(50);
    expect(breedingRecord?.concentration_m_per_ml).toBe(200);
    expect(breedingRecord?.motility_percent).toBe(75);
    expect(breedingRecord?.collection_date).toBe('2026-04-01');

    const usedOnSiteEvent = Array.from(fakeDb.doseEvents.values()).find((event) => event.event_type === 'usedOnSite');
    expect(usedOnSiteEvent?.breeding_record_id).toBe('breeding-1');
    expect(usedOnSiteEvent?.recipient).toBe('Maple');
  });

  it('returns allocated dose totals for a collection', async () => {
    vi.mocked(newId)
      .mockReturnValueOnce('collection-1')
      .mockReturnValueOnce('event-1')
      .mockReturnValueOnce('event-2');

    await createCollectionWithAllocations({
      collection: {
        stallionId: 'st-1',
        collectionDate: '2026-04-01',
        doseCount: 10,
      },
      shippedRows: [
        {
          recipient: 'Farm ABC',
          recipientPhone: '555-0100',
          recipientStreet: '100 Main St',
          recipientCity: 'Lexington',
          recipientState: 'KY',
          recipientZip: '40511',
          carrierService: 'FedEx Priority Overnight',
          containerType: 'Equitainer',
          doseCount: 3,
          eventDate: '2026-04-01',
        },
        {
          recipient: 'Farm XYZ',
          recipientPhone: '555-0101',
          recipientStreet: '200 Main St',
          recipientCity: 'Ocala',
          recipientState: 'FL',
          recipientZip: '34470',
          carrierService: 'UPS Next Day Air',
          containerType: 'Equine Express II',
          doseCount: 2,
          eventDate: '2026-04-02',
        },
      ],
      onFarmRows: [],
    });

    await expect(getAllocatedDoseCountForCollection('collection-1')).resolves.toBe(5);
  });

  it('rejects duplicate on-farm mares in one wizard session', async () => {
    vi.mocked(newId).mockReturnValue('collection-1');

    await expect(
      createCollectionWithAllocations({
        collection: {
          stallionId: 'st-1',
          collectionDate: '2026-04-01',
          doseCount: 10,
        },
        shippedRows: [],
        onFarmRows: [
          { mareId: 'mare-1', eventDate: '2026-04-02', doseCount: 1 },
          { mareId: 'mare-1', eventDate: '2026-04-03', doseCount: 1 },
        ],
      }),
    ).rejects.toThrow('A mare can only be selected once per collection wizard.');
  });

  it('rolls back the whole transaction if an on-farm mare lookup fails', async () => {
    vi.mocked(newId)
      .mockReturnValueOnce('collection-1')
      .mockReturnValueOnce('event-1')
      .mockReturnValueOnce('breeding-1');

    await expect(
      createCollectionWithAllocations({
        collection: {
          stallionId: 'st-1',
          collectionDate: '2026-04-01',
          doseCount: 10,
        },
        shippedRows: [
          {
            recipient: 'Farm ABC',
            recipientPhone: '555-0100',
            recipientStreet: '100 Main St',
            recipientCity: 'Lexington',
            recipientState: 'KY',
            recipientZip: '40511',
            carrierService: 'FedEx Priority Overnight',
            containerType: 'Equitainer',
            doseCount: 2,
            eventDate: '2026-04-01',
          },
        ],
        onFarmRows: [
          {
            mareId: 'mare-missing',
            eventDate: '2026-04-02',
            doseCount: 1,
          },
        ],
      }),
    ).rejects.toThrow('Mare not found.');

    const db = await getDb();
    const fakeDb = db as unknown as ReturnType<typeof createFakeDb>;
    expect(fakeDb.collections.size).toBe(0);
    expect(fakeDb.breedingRecords.size).toBe(0);
    expect(fakeDb.doseEvents.size).toBe(0);
  });
});
