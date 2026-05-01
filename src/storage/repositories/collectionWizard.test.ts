import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/utils/id', () => ({
  newId: vi.fn(),
}));

import { newId } from '@/utils/id';
import { createRepoDb, type SqlCall } from '@/test/repoDb';
import {
  createCollectionWithAllocations,
  getAllocatedSemenVolumeForCollection,
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
  extender_type: string | null;
  concentration_millions_per_ml: number | null;
  motility_percent: number | null;
  progressive_motility_percent: number | null;
  target_mode: 'progressive' | 'total' | null;
  target_motile_sperm_millions_per_dose: number | null;
  target_post_extension_concentration_millions_per_ml: number | null;
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
  time: string | null;
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
  dose_semen_volume_ml: number | null;
  dose_extender_volume_ml: number | null;
  dose_count: number | null;
  event_date: string | null;
  notes: string | null;
  carrier_service: string | null;
  container_type: string | null;
};

function cloneMapEntries<T extends Record<string, unknown>>(source: Map<string, T>): Map<string, T> {
  return new Map(Array.from(source.entries()).map(([key, value]) => [key, { ...value }]));
}

function createCollectionWizardRepoHarness() {
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

  const db = createRepoDb({
    onRun(call) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.startsWith('insert into semen_collections')) {
        const [
          id,
          stallionId,
          collectionDate,
          rawVolumeMl,
          extenderType,
          concentrationMillionsPerMl,
          motilityPercent,
          progressiveMotilityPercent,
          targetMode,
          targetSpermMillionsPerDose,
          targetPostExtensionConcentrationMillionsPerMl,
          notes,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
          number | null,
          string | null,
          number | null,
          number | null,
          number | null,
          'progressive' | 'total' | null,
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
          extender_type: extenderType,
          concentration_millions_per_ml: concentrationMillionsPerMl,
          motility_percent: motilityPercent,
          progressive_motility_percent: progressiveMotilityPercent,
          target_mode: targetMode,
          target_motile_sperm_millions_per_dose: targetSpermMillionsPerDose,
          target_post_extension_concentration_millions_per_ml:
            targetPostExtensionConcentrationMillionsPerMl,
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
          time,
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
          string | null,
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
          time,
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
          doseSemenVolumeMl,
          doseExtenderVolumeMl,
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
          number | null,
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
          dose_semen_volume_ml: doseSemenVolumeMl,
          dose_extender_volume_ml: doseExtenderVolumeMl,
          dose_count: doseCount,
          event_date: eventDate,
          notes,
          carrier_service: carrierService,
          container_type: containerType,
        });
      }
    },
    onGetAll<T>() {
      return [] as T[];
    },
    onGetFirst<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

      if (stmt.includes('select name, deleted_at from stallions where id = ?')) {
        const [stallionId] = params as [string];
        return (stallions.get(stallionId) as T | undefined) ?? null;
      }

      if (stmt.includes('select name, deleted_at from mares where id = ?')) {
        const [mareId] = params as [string];
        return (mares.get(mareId) as T | undefined) ?? null;
      }

      if (stmt.includes('select raw_volume_ml from semen_collections where id = ?')) {
        const [collectionId] = params as [string];
        const collection = collections.get(collectionId);
        return collection ? ({ raw_volume_ml: collection.raw_volume_ml } as T) : null;
      }

      if (stmt.includes('allocated_semen_volume_ml') && stmt.includes('from collection_dose_events')) {
        const [collectionId, excludeId] = params as [string, string?];
        const allocatedSemenVolume = Array.from(doseEvents.values())
          .filter((event) => event.collection_id === collectionId && (!excludeId || event.id !== excludeId))
          .reduce(
            (total, event) => total + (event.dose_semen_volume_ml ?? 0) * (event.dose_count ?? 0),
            0,
          );
        return { allocated_semen_volume_ml: allocatedSemenVolume } as T;
      }

      return null;
    },
    async onTransaction<T>(callback: () => Promise<T>): Promise<T> {
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
  });

  return Object.assign(db, {
    collections,
    breedingRecords,
    doseEvents,
  });
}

describe('collection wizard repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a collection plus mixed shipped and on-farm allocations in one transaction', async () => {
    const fakeDb = createCollectionWizardRepoHarness();
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
        motilityPercent: 85,
        progressiveMotilityPercent: 75,
        targetMode: 'progressive',
        targetSpermMillionsPerDose: 500,
        targetPostExtensionConcentrationMillionsPerMl: 180,
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
          doseSemenVolumeMl: 4,
          doseExtenderVolumeMl: 3,
          doseCount: 4,
          eventDate: '2026-04-01',
          notes: 'Cold chain',
        },
      ],
      onFarmRows: [
        {
          mareId: 'mare-1',
          eventDate: '2026-04-02',
          eventTime: '09:30',
          doseSemenVolumeMl: 5,
          notes: 'Bred in barn 2',
        },
      ],
    }, fakeDb);

    expect(result.collectionId).toBe('collection-1');
    expect(result.breedingRecordIds).toEqual(['breeding-1']);

    expect(fakeDb.collections.size).toBe(1);
    expect(fakeDb.breedingRecords.size).toBe(1);
    expect(fakeDb.doseEvents.size).toBe(2);
    const collection = fakeDb.collections.get('collection-1');
    expect(collection?.motility_percent).toBe(85);
    expect(collection?.progressive_motility_percent).toBe(75);
    expect(collection?.target_mode).toBe('progressive');

    const breedingRecord = fakeDb.breedingRecords.get('breeding-1');
    expect(breedingRecord?.collection_id).toBe('collection-1');
    expect(breedingRecord?.method).toBe('freshAI');
    expect(breedingRecord?.time).toBe('09:30');
    expect(breedingRecord?.volume_ml).toBe(5);
    expect(breedingRecord?.concentration_m_per_ml).toBe(200);
    expect(breedingRecord?.motility_percent).toBe(85);
    expect(breedingRecord?.collection_date).toBe('2026-04-01');

    const usedOnSiteEvent = Array.from(fakeDb.doseEvents.values()).find((event) => event.event_type === 'usedOnSite');
    expect(usedOnSiteEvent?.breeding_record_id).toBe('breeding-1');
    expect(usedOnSiteEvent?.recipient).toBe('Maple');
  });

  it('returns allocated semen volume totals for a collection', async () => {
    const fakeDb = createCollectionWizardRepoHarness();
    vi.mocked(newId)
      .mockReturnValueOnce('collection-1')
      .mockReturnValueOnce('event-1')
      .mockReturnValueOnce('event-2');

    await createCollectionWithAllocations({
      collection: {
        stallionId: 'st-1',
        collectionDate: '2026-04-01',
        rawVolumeMl: 100,
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
          doseSemenVolumeMl: 3,
          doseExtenderVolumeMl: 1,
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
          doseSemenVolumeMl: 2,
          doseExtenderVolumeMl: 1,
          doseCount: 2,
          eventDate: '2026-04-02',
        },
      ],
      onFarmRows: [],
    }, fakeDb);

    await expect(getAllocatedSemenVolumeForCollection('collection-1', undefined, fakeDb)).resolves.toBe(13);
  });

  it('rejects duplicate on-farm mares in one wizard session', async () => {
    const fakeDb = createCollectionWizardRepoHarness();
    vi.mocked(newId).mockReturnValue('collection-1');

    await expect(
      createCollectionWithAllocations({
        collection: {
          stallionId: 'st-1',
          collectionDate: '2026-04-01',
          rawVolumeMl: 20,
        },
        shippedRows: [],
        onFarmRows: [
          { mareId: 'mare-1', eventDate: '2026-04-02', eventTime: '09:00', doseSemenVolumeMl: 4 },
          { mareId: 'mare-1', eventDate: '2026-04-03', eventTime: '10:00', doseSemenVolumeMl: 4 },
        ],
      }, fakeDb),
    ).rejects.toThrow('A mare can only be selected once per collection wizard.');
  });

  it('rolls back the whole transaction if an on-farm mare lookup fails', async () => {
    const fakeDb = createCollectionWizardRepoHarness();
    vi.mocked(newId)
      .mockReturnValueOnce('collection-1')
      .mockReturnValueOnce('event-1')
      .mockReturnValueOnce('breeding-1');

    await expect(
      createCollectionWithAllocations({
        collection: {
          stallionId: 'st-1',
          collectionDate: '2026-04-01',
          rawVolumeMl: 20,
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
            doseSemenVolumeMl: 2,
            doseExtenderVolumeMl: 1,
            doseCount: 2,
            eventDate: '2026-04-01',
          },
        ],
        onFarmRows: [
          {
            mareId: 'mare-missing',
            eventDate: '2026-04-02',
            eventTime: '09:00',
            doseSemenVolumeMl: 3,
          },
        ],
      }, fakeDb),
    ).rejects.toThrow('Mare not found.');

    expect(fakeDb.collections.size).toBe(0);
    expect(fakeDb.breedingRecords.size).toBe(0);
    expect(fakeDb.doseEvents.size).toBe(0);
  });

  it('rejects allocations that exceed the collection total volume', async () => {
    const fakeDb = createCollectionWizardRepoHarness();
    vi.mocked(newId).mockReturnValue('collection-1');

    await expect(
      createCollectionWithAllocations({
        collection: {
          stallionId: 'st-1',
          collectionDate: '2026-04-01',
          rawVolumeMl: 10,
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
            doseSemenVolumeMl: 4,
            doseExtenderVolumeMl: 2,
            doseCount: 3,
            eventDate: '2026-04-01',
          },
        ],
        onFarmRows: [],
      }, fakeDb),
    ).rejects.toThrow('Allocated semen volume cannot exceed the collection total volume.');
  });

  it('rejects on-farm rows with dose count values other than one', async () => {
    const fakeDb = createCollectionWizardRepoHarness();
    vi.mocked(newId).mockReturnValue('collection-1');

    await expect(
      createCollectionWithAllocations({
        collection: {
          stallionId: 'st-1',
          collectionDate: '2026-04-01',
          rawVolumeMl: 20,
        },
        shippedRows: [],
        onFarmRows: [
          {
            mareId: 'mare-1',
            eventDate: '2026-04-02',
            eventTime: '09:00',
            doseSemenVolumeMl: 4,
            doseCount: 2,
          },
        ],
      }, fakeDb),
    ).rejects.toThrow('On-farm allocations must always use a dose count of 1.');
  });
});
