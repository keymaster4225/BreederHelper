import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/utils/id', () => ({
  newId: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { newId } from '@/utils/id';
import { createRepoDb, type SqlCall } from '@/test/repoDb';
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
import { createDoseEvent } from './collectionDoseEvents';

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

function createSemenCollectionRepoHarness() {
  const stallions = new Map<string, StallionRow>();
  const collections = new Map<string, CollectionRow>();
  const breedings = new Map<string, BreedingRow>();
  const frozenBatches = new Map<string, { id: string; collection_id: string | null }>();
  const doseEvents = new Map<string, {
    id: string;
    collection_id: string;
    event_type: 'shipped' | 'usedOnSite';
    recipient: string;
    recipient_phone: string | null;
    recipient_street: string | null;
    recipient_city: string | null;
    recipient_state: string | null;
    recipient_zip: string | null;
    carrier_service: string | null;
    container_type: string | null;
    tracking_number: string | null;
    breeding_record_id: string | null;
    dose_semen_volume_ml: number | null;
    dose_extender_volume_ml: number | null;
    dose_count: number | null;
    event_date: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>();

  return createRepoDb({
    onRun(call) {
      const stmt = call.normalizedSql;
      const params = call.params;

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
        const [
          id,
          stallionId,
          collectionDate,
          rawVol,
          extenderType,
          conc,
          motility,
          progressiveMotility,
          targetMode,
          targetMotile,
          targetPostExtension,
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
          id, stallion_id: stallionId, collection_date: collectionDate,
          raw_volume_ml: rawVol, extender_type: extenderType,
          concentration_millions_per_ml: conc,
          motility_percent: motility,
          progressive_motility_percent: progressiveMotility,
          target_mode: targetMode,
          target_motile_sperm_millions_per_dose: targetMotile,
          target_post_extension_concentration_millions_per_ml: targetPostExtension,
          notes,
          created_at: createdAt, updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update semen_collections')) {
        const [
          collectionDate,
          rawVol,
          extenderType,
          conc,
          motility,
          progressiveMotility,
          targetMode,
          targetMotile,
          targetPostExtension,
          notes,
          updatedAt,
          id,
        ] = params as [
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
        const existing = collections.get(id);
        if (existing) {
          collections.set(id, {
            ...existing, collection_date: collectionDate,
            raw_volume_ml: rawVol, extender_type: extenderType,
            concentration_millions_per_ml: conc,
            motility_percent: motility,
            progressive_motility_percent: progressiveMotility,
            target_mode: targetMode,
            target_motile_sperm_millions_per_dose: targetMotile,
            target_post_extension_concentration_millions_per_ml: targetPostExtension,
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
        const [id, mareId, stallionId, stallionName, collectionId, date, , method, notes, vol, conc, mot, straws, strawVol, strawDetails, collDate, createdAt, updatedAt] =
          params as [string, string, string | null, string | null, string | null, string, string | null, string, string | null, number | null, number | null, number | null, number | null, number | null, string | null, string | null, string, string];
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

      if (stmt.startsWith('insert into collection_dose_events')) {
        const [
          id,
          collectionId,
          eventType,
          recipient,
          recipientPhone,
          recipientStreet,
          recipientCity,
          recipientState,
          recipientZip,
          carrierService,
          containerType,
          trackingNumber,
          breedingRecordId,
          doseSemenVolumeMl,
          doseExtenderVolumeMl,
          doseCount,
          eventDate,
          notes,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
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
          event_type: eventType as 'shipped' | 'usedOnSite',
          recipient,
          recipient_phone: recipientPhone,
          recipient_street: recipientStreet,
          recipient_city: recipientCity,
          recipient_state: recipientState,
          recipient_zip: recipientZip,
          carrier_service: carrierService,
          container_type: containerType,
          tracking_number: trackingNumber,
          breeding_record_id: breedingRecordId,
          dose_semen_volume_ml: doseSemenVolumeMl,
          dose_extender_volume_ml: doseExtenderVolumeMl,
          dose_count: doseCount,
          event_date: eventDate,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('insert into frozen_semen_batches')) {
        const [id, , collectionId] = params as [string, string, string | null];
        frozenBatches.set(id, {
          id,
          collection_id: collectionId,
        });
        return;
      }
    },

    onGetFirst<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

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

      if (stmt.includes('count(*)') && stmt.includes('frozen_semen_batches') && stmt.includes('collection_id = ?')) {
        const [collectionId] = params as [string];
        const count = Array.from(frozenBatches.values()).filter((batch) => batch.collection_id === collectionId).length;
        return { count } as T;
      }

      if (stmt.includes('allocated_semen_volume_ml') && stmt.includes('from collection_dose_events')) {
        const [collectionId] = params as [string];
        const allocatedSemenVolume = Array.from(doseEvents.values())
          .filter((event) => event.collection_id === collectionId)
          .reduce(
            (total, event) => total + (event.dose_semen_volume_ml ?? 0) * (event.dose_count ?? 0),
            0,
          );
        return { allocated_semen_volume_ml: allocatedSemenVolume } as T;
      }

      if (stmt.includes('from collection_dose_events') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (doseEvents.get(id) as T | undefined) ?? null;
      }

      return null;
    },

    onGetAll<T>(call: SqlCall) {
      const stmt = call.normalizedSql;
      const params = call.params;

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
  });
}

describe('semen collection repository', () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createSemenCollectionRepoHarness() as unknown as Awaited<ReturnType<typeof getDb>>);
    vi.mocked(newId).mockReturnValue('dose-1');
  });

  it('creates, reads, updates, and deletes a collection (happy path)', async () => {
    await createStallion({ id: 'st-1', name: 'Thunder' });

    await createSemenCollection({
      id: 'col-1',
      stallionId: 'st-1',
      collectionDate: '2026-04-01',
      rawVolumeMl: 50,
      extenderType: 'INRA 96',
      motilityPercent: 85,
      progressiveMotilityPercent: 75,
      targetMode: 'progressive',
      targetSpermMillionsPerDose: 500,
      targetPostExtensionConcentrationMillionsPerMl: 200,
    });

    const fetched = await getSemenCollectionById('col-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.stallionId).toBe('st-1');
    expect(fetched?.rawVolumeMl).toBe(50);
    expect(fetched?.extenderType).toBe('INRA 96');
    expect(fetched?.motilityPercent).toBe(85);
    expect(fetched?.progressiveMotilityPercent).toBe(75);
    expect(fetched?.targetMode).toBe('progressive');
    expect(fetched?.targetSpermMillionsPerDose).toBe(500);
    expect(fetched?.targetPostExtensionConcentrationMillionsPerMl).toBe(200);

    await updateSemenCollection('col-1', {
      collectionDate: '2026-04-02',
      rawVolumeMl: 55,
      extenderType: 'BotuSemen',
      motilityPercent: 88,
      progressiveMotilityPercent: 80,
      targetMode: 'total',
      targetSpermMillionsPerDose: 550,
      targetPostExtensionConcentrationMillionsPerMl: 220,
    });

    const updated = await getSemenCollectionById('col-1');
    expect(updated?.collectionDate).toBe('2026-04-02');
    expect(updated?.rawVolumeMl).toBe(55);
    expect(updated?.extenderType).toBe('BotuSemen');
    expect(updated?.motilityPercent).toBe(88);
    expect(updated?.targetMode).toBe('total');
    expect(updated?.targetSpermMillionsPerDose).toBe(550);
    expect(updated?.targetPostExtensionConcentrationMillionsPerMl).toBe(220);

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

  it('stores target collection fields', async () => {
    await createStallion({ id: 'st-3', name: 'Bolt' });

    await createSemenCollection({
      id: 'col-ship',
      stallionId: 'st-3',
      collectionDate: '2026-04-01',
      extenderType: 'INRA 96',
      targetMode: 'total',
      targetSpermMillionsPerDose: 450,
      targetPostExtensionConcentrationMillionsPerMl: 150,
    });

    const fetched = await getSemenCollectionById('col-ship');
    expect(fetched?.targetMode).toBe('total');
    expect(fetched?.targetSpermMillionsPerDose).toBe(450);
    expect(fetched?.targetPostExtensionConcentrationMillionsPerMl).toBe(150);
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
        time: '09:00',
        method: 'freshAI',
      });

      const linked = await isSemenCollectionLinked('col-link');
      expect(linked).toBe(true);

      await expect(deleteSemenCollection('col-link')).rejects.toThrow(
        'This collection is linked to breeding or frozen records and cannot be deleted.',
      );
    });

    it('throws when deleting collection linked to frozen inventory', async () => {
      await createStallion({ id: 'st-freeze', name: 'Freeze Stallion' });
      await createSemenCollection({
        id: 'col-freeze',
        stallionId: 'st-freeze',
        collectionDate: '2026-04-01',
      });

      const db = await getDb();
      await db.runAsync(
        'INSERT INTO frozen_semen_batches (id, stallion_id, collection_id) VALUES (?, ?, ?);',
        ['freeze-1', 'st-freeze', 'col-freeze'],
      );

      await expect(deleteSemenCollection('col-freeze')).rejects.toThrow(
        'This collection is linked to breeding or frozen records and cannot be deleted.',
      );
    });
  });

  it('rejects lowering total volume below the allocated semen volume', async () => {
    await createStallion({ id: 'st-dose', name: 'Dose Guard' });
    await createSemenCollection({
      id: 'col-dose',
      stallionId: 'st-dose',
      collectionDate: '2026-04-01',
      rawVolumeMl: 50,
    });

    await createDoseEvent({
      collectionId: 'col-dose',
      eventType: 'shipped',
      recipient: 'Farm ABC',
      recipientPhone: '555-0100',
      recipientStreet: '100 Main St',
      recipientCity: 'Lexington',
      recipientState: 'KY',
      recipientZip: '40511',
      carrierService: 'FedEx Priority Overnight',
      containerType: 'Equitainer',
      doseSemenVolumeMl: 10,
      doseExtenderVolumeMl: 5,
      doseCount: 4,
      eventDate: '2026-04-01',
    });

    await expect(
      updateSemenCollection('col-dose', {
        collectionDate: '2026-04-01',
        rawVolumeMl: 39,
      }),
    ).rejects.toThrow('Total volume cannot be lower than the allocated semen volume.');
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
          time: '09:00',
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
        time: '09:00',
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
        time: '09:00',
        method: 'liveCover',
      });
      await createBreedingRecord({
        id: 'br-q2',
        mareId: 'mare-2',
        stallionId: 'st-q',
        date: '2026-04-01',
        time: '09:00',
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
        time: '09:00',
        method: 'liveCover',
      });

      const results = await listLegacyBreedingRecordsMatchingStallionName('thunder');
      expect(results).toHaveLength(1);

      const noResults = await listLegacyBreedingRecordsMatchingStallionName('Lightning');
      expect(noResults).toHaveLength(0);
    });
  });
});
