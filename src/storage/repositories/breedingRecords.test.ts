import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

vi.mock('./semenCollections', () => ({
  getSemenCollectionById: vi.fn(),
}));

import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { getSemenCollectionById } from './semenCollections';
import { hasLinkedOnFarmDoseEvent, updateBreedingRecord } from './breedingRecords';

type BreedingRecordRow = {
  id: string;
  collection_id: string | null;
  date: string;
  method: string;
  notes: string | null;
  volume_ml: number | null;
  concentration_m_per_ml: number | null;
  motility_percent: number | null;
  stallion_id: string | null;
  stallion_name: string | null;
  number_of_straws: number | null;
  straw_volume_ml: number | null;
  straw_details: string | null;
  collection_date: string | null;
  updated_at: string;
};

type DoseEventRow = {
  id: string;
  collection_id: string;
  event_type: 'shipped' | 'usedOnSite';
  breeding_record_id: string | null;
  dose_semen_volume_ml: number | null;
  dose_count: number | null;
  event_date: string | null;
  notes: string | null;
  updated_at: string;
};

type CollectionRow = {
  id: string;
  raw_volume_ml: number | null;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeDb() {
  const breedingRecords = new Map<string, BreedingRecordRow>([
    [
      'breed-1',
      {
        id: 'breed-1',
        collection_id: 'col-1',
        date: '2026-04-01',
        method: 'freshAI',
        notes: 'Old note',
        volume_ml: 1,
        concentration_m_per_ml: 120,
        motility_percent: 70,
        stallion_id: 'stallion-1',
        stallion_name: null,
        number_of_straws: null,
        straw_volume_ml: null,
        straw_details: null,
        collection_date: '2026-04-01',
        updated_at: '2026-04-01T00:00:00.000Z',
      },
    ],
  ]);

  const doseEvents = new Map<string, DoseEventRow>([
    [
      'event-used-on-site',
      {
        id: 'event-used-on-site',
        collection_id: 'col-1',
        event_type: 'usedOnSite',
        breeding_record_id: 'breed-1',
        dose_semen_volume_ml: 1,
        dose_count: 1,
        event_date: '2026-04-01',
        notes: 'Old note',
        updated_at: '2026-04-01T00:00:00.000Z',
      },
    ],
    [
      'event-shipped',
      {
        id: 'event-shipped',
        collection_id: 'col-1',
        event_type: 'shipped',
        breeding_record_id: null,
        dose_semen_volume_ml: 2,
        dose_count: 2,
        event_date: '2026-04-01',
        notes: null,
        updated_at: '2026-04-01T00:00:00.000Z',
      },
    ],
  ]);

  const collections = new Map<string, CollectionRow>([
    ['col-1', { id: 'col-1', raw_volume_ml: 10 }],
    ['col-2', { id: 'col-2', raw_volume_ml: 10 }],
  ]);

  return {
    breedingRecords,
    doseEvents,
    collections,
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('update breeding_records set')) {
        const [
          stallionId,
          stallionName,
          collectionId,
          date,
          method,
          notes,
          volumeMl,
          concentration,
          motility,
          numberOfStraws,
          strawVolumeMl,
          strawDetails,
          collectionDate,
          updatedAt,
          id,
        ] = params as [
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

        const existing = breedingRecords.get(id);
        if (!existing) return;

        breedingRecords.set(id, {
          ...existing,
          stallion_id: stallionId,
          stallion_name: stallionName,
          collection_id: collectionId,
          date,
          method,
          notes,
          volume_ml: volumeMl,
          concentration_m_per_ml: concentration,
          motility_percent: motility,
          number_of_straws: numberOfStraws,
          straw_volume_ml: strawVolumeMl,
          straw_details: strawDetails,
          collection_date: collectionDate,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update collection_dose_events set')) {
        const [eventDate, doseSemenVolumeMl, notes, updatedAt, id] = params as [
          string,
          number | null,
          string | null,
          string,
          string,
        ];
        const existing = doseEvents.get(id);
        if (!existing) return;

        doseEvents.set(id, {
          ...existing,
          event_date: eventDate,
          dose_semen_volume_ml: doseSemenVolumeMl,
          notes,
          updated_at: updatedAt,
        });
      }
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = normalized(sql);

      if (stmt.includes('from breeding_records') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (breedingRecords.get(id) as T | undefined) ?? null;
      }

      if (
        stmt.includes('from collection_dose_events') &&
        stmt.includes("event_type = 'usedonsite'")
      ) {
        const [breedingRecordId] = params as [string];
        const row = Array.from(doseEvents.values())
          .filter(
            (event) =>
              event.breeding_record_id === breedingRecordId &&
              event.event_type === 'usedOnSite',
          )
          .sort((a, b) => b.id.localeCompare(a.id))[0];

        return row
          ? ({ id: row.id, collection_id: row.collection_id } as T)
          : null;
      }

      if (stmt.includes('select raw_volume_ml from semen_collections where id = ?')) {
        const [collectionId] = params as [string];
        const row = collections.get(collectionId);
        return row ? ({ raw_volume_ml: row.raw_volume_ml } as T) : null;
      }

      if (stmt.includes('allocated_semen_volume_ml') && stmt.includes('from collection_dose_events')) {
        const [collectionId, excludeDoseEventId] = params as [string, string?];
        const total = Array.from(doseEvents.values())
          .filter(
            (event) =>
              event.collection_id === collectionId &&
              event.dose_semen_volume_ml != null &&
              (excludeDoseEventId == null || event.id !== excludeDoseEventId),
          )
          .reduce(
            (sum, event) =>
              sum + (event.dose_semen_volume_ml ?? 0) * (event.dose_count ?? 0),
            0,
          );

        return { allocated_semen_volume_ml: total } as T;
      }

      return null;
    },
    async getAllAsync<T>(): Promise<T[]> {
      return [];
    },
    async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
  };
}

describe('breedingRecords linked on-farm behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSemenCollectionById).mockImplementation(async (collectionId: string) => {
      if (collectionId === 'col-1') {
        return {
          id: 'col-1',
          stallionId: 'stallion-1',
          collectionDate: '2026-04-01',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        } as never;
      }
      if (collectionId === 'col-2') {
        return {
          id: 'col-2',
          stallionId: 'stallion-1',
          collectionDate: '2026-04-01',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        } as never;
      }
      return null;
    });
  });

  it('mirrors linked on-farm updates to the companion usedOnSite event', async () => {
    const fakeDb = createFakeDb();

    await updateBreedingRecord('breed-1', {
      stallionId: 'stallion-1',
      collectionId: 'col-1',
      date: '2026-04-04',
      method: 'freshAI',
      notes: 'Updated note',
      volumeMl: 3,
      concentrationMPerMl: 120,
      motilityPercent: 70,
      numberOfStraws: null,
      strawVolumeMl: null,
      strawDetails: null,
      collectionDate: '2026-04-01',
    }, fakeDb);

    const breedingRecord = fakeDb.breedingRecords.get('breed-1');
    const companionEvent = fakeDb.doseEvents.get('event-used-on-site');

    expect(breedingRecord?.date).toBe('2026-04-04');
    expect(breedingRecord?.volume_ml).toBe(3);
    expect(companionEvent?.event_date).toBe('2026-04-04');
    expect(companionEvent?.dose_semen_volume_ml).toBe(3);
    expect(companionEvent?.notes).toBe('Updated note');
    expect(emitDataInvalidation).toHaveBeenCalledWith('breedingRecords');
    expect(emitDataInvalidation).toHaveBeenCalledWith('collectionDoseEvents');
  });

  it('blocks changing linked on-farm method away from freshAI', async () => {
    const fakeDb = createFakeDb();

    await expect(
      updateBreedingRecord('breed-1', {
        stallionId: 'stallion-1',
        collectionId: 'col-1',
        date: '2026-04-04',
        method: 'shippedCooledAI',
        notes: null,
        volumeMl: 3,
      }, fakeDb),
    ).rejects.toThrow('Linked on-farm breeding records must remain Fresh AI.');
  });

  it('blocks clearing linked on-farm collection_id', async () => {
    const fakeDb = createFakeDb();

    await expect(
      updateBreedingRecord('breed-1', {
        stallionId: 'stallion-1',
        collectionId: null,
        date: '2026-04-04',
        method: 'freshAI',
        notes: null,
        volumeMl: 3,
      }, fakeDb),
    ).rejects.toThrow('Linked on-farm breeding records must keep their collection link.');
  });

  it('blocks moving linked on-farm breeding records to a different collection', async () => {
    const fakeDb = createFakeDb();

    await expect(
      updateBreedingRecord('breed-1', {
        stallionId: 'stallion-1',
        collectionId: 'col-2',
        date: '2026-04-04',
        method: 'freshAI',
        notes: null,
        volumeMl: 3,
      }, fakeDb),
    ).rejects.toThrow(
      'Linked on-farm breeding records cannot be moved to a different collection.',
    );
  });

  it('reruns semen-volume cap check when linked on-farm volume changes', async () => {
    const fakeDb = createFakeDb();
    fakeDb.collections.set('col-1', { id: 'col-1', raw_volume_ml: 5 });

    await expect(
      updateBreedingRecord('breed-1', {
        stallionId: 'stallion-1',
        collectionId: 'col-1',
        date: '2026-04-04',
        method: 'freshAI',
        notes: null,
        volumeMl: 3,
      }, fakeDb),
    ).rejects.toThrow('Allocated semen volume cannot exceed the collection total volume.');
  });

  it('reports whether a breeding record has a linked on-farm dose event', async () => {
    const fakeDb = createFakeDb();

    await expect(hasLinkedOnFarmDoseEvent('breed-1', fakeDb)).resolves.toBe(true);
    await expect(hasLinkedOnFarmDoseEvent('missing', fakeDb)).resolves.toBe(false);
  });
});
