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
  createDoseEvent,
  deleteDoseEvent,
  listDoseEventsByCollection,
  listDoseEventsByCollectionIds,
  updateDoseEvent,
} from './collectionDoseEvents';

type CollectionRow = {
  id: string;
  dose_count: number | null;
};

type DoseEventRow = {
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
  dose_count: number | null;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeDb() {
  const collections = new Map<string, CollectionRow>([
    ['col-1', { id: 'col-1', dose_count: 10 }],
    ['col-2', { id: 'col-2', dose_count: 12 }],
    ['col-no-dose', { id: 'col-no-dose', dose_count: null }],
  ]);
  const doseEvents = new Map<string, DoseEventRow>();

  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

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
          doseCount,
          eventDate,
          notes,
          createdAt,
          updatedAt,
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
          recipient_phone: recipientPhone,
          recipient_street: recipientStreet,
          recipient_city: recipientCity,
          recipient_state: recipientState,
          recipient_zip: recipientZip,
          carrier_service: carrierService,
          container_type: containerType,
          tracking_number: trackingNumber,
          breeding_record_id: breedingRecordId,
          dose_count: doseCount,
          event_date: eventDate,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update collection_dose_events')) {
        const [
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
          doseCount,
          eventDate,
          notes,
          updatedAt,
          id,
        ] = params as [
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
        const existing = doseEvents.get(id);
        if (!existing) {
          return;
        }
        doseEvents.set(id, {
          ...existing,
          event_type: eventType,
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
          dose_count: doseCount,
          event_date: eventDate,
          notes,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('delete from collection_dose_events')) {
        const [id] = params as [string];
        doseEvents.delete(id);
      }
    },

    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = normalized(sql);

      if (stmt.includes('select dose_count from semen_collections where id = ?')) {
        const [id] = params as [string];
        return (collections.get(id) as T | undefined) ?? null;
      }

      if (stmt.includes('allocated_dose_count') && stmt.includes('from collection_dose_events')) {
        const [collectionId, excludeId] = params as [string, string?];
        const allocatedDoseCount = Array.from(doseEvents.values())
          .filter((event) => event.collection_id === collectionId && (!excludeId || event.id !== excludeId))
          .reduce((total, event) => total + (event.dose_count ?? 0), 0);
        return { allocated_dose_count: allocatedDoseCount } as T;
      }

      if (stmt.includes('from collection_dose_events') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (doseEvents.get(id) as T | undefined) ?? null;
      }

      return null;
    },

    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = normalized(sql);

      if (stmt.includes('from collection_dose_events') && stmt.includes('where collection_id = ?')) {
        const [collectionId] = params as [string];
        return Array.from(doseEvents.values())
          .filter((event) => event.collection_id === collectionId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)) as T[];
      }

      if (stmt.includes('from collection_dose_events') && stmt.includes('where collection_id in')) {
        const collectionIds = params as string[];
        return Array.from(doseEvents.values())
          .filter((event) => collectionIds.includes(event.collection_id))
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)) as T[];
      }

      return [];
    },
  };
}

describe('collection dose event repository', () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createFakeDb() as unknown as Awaited<ReturnType<typeof getDb>>);
    vi.mocked(newId).mockReturnValue('dose-1');
  });

  it('creates and lists a shipped dose event with structured shipping details', async () => {
    const created = await createDoseEvent({
      collectionId: 'col-1',
      eventType: 'shipped',
      recipient: ' Farm ABC ',
      recipientPhone: '555-0100',
      recipientStreet: '100 Main St',
      recipientCity: 'Lexington',
      recipientState: 'KY',
      recipientZip: '40511',
      carrierService: 'FedEx Priority Overnight',
      containerType: 'Equitainer',
      trackingNumber: 'TRACK-1',
      doseCount: 8,
      eventDate: '2026-04-01',
      notes: 'Handled cold chain',
    });

    expect(created.id).toBe('dose-1');
    expect(created.recipient).toBe('Farm ABC');
    expect(created.carrierService).toBe('FedEx Priority Overnight');
    expect(created.containerType).toBe('Equitainer');

    const events = await listDoseEventsByCollection('col-1');
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('shipped');
  });

  it('groups events by collection id for bulk loading', async () => {
    vi.mocked(newId)
      .mockReturnValueOnce('dose-1')
      .mockReturnValueOnce('dose-2');

    await createDoseEvent({
      collectionId: 'col-1',
      eventType: 'shipped',
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
    });
    await createDoseEvent({
      collectionId: 'col-2',
      eventType: 'shipped',
      recipient: 'Farm XYZ',
      recipientPhone: '555-0101',
      recipientStreet: '200 Main St',
      recipientCity: 'Ocala',
      recipientState: 'FL',
      recipientZip: '34470',
      carrierService: 'UPS Next Day Air',
      containerType: 'Equine Express II',
      doseCount: 3,
      eventDate: '2026-04-02',
    });

    const grouped = await listDoseEventsByCollectionIds(['col-1', 'col-2', 'col-3']);
    expect(grouped['col-1']).toHaveLength(1);
    expect(grouped['col-2'][0].eventType).toBe('shipped');
    expect(grouped['col-3']).toEqual([]);
  });

  it('updates and deletes a shipped dose event', async () => {
    await createDoseEvent({
      collectionId: 'col-1',
      eventType: 'shipped',
      recipient: 'Farm ABC',
      recipientPhone: '555-0100',
      recipientStreet: '100 Main St',
      recipientCity: 'Lexington',
      recipientState: 'KY',
      recipientZip: '40511',
      carrierService: 'FedEx Priority Overnight',
      containerType: 'Equitainer',
      doseCount: 6,
      eventDate: '2026-04-01',
    });

    const updated = await updateDoseEvent('dose-1', {
      recipient: 'Farm Nova',
      recipientPhone: '555-0199',
      recipientStreet: '200 Main St',
      recipientCity: 'Paris',
      recipientState: 'KY',
      recipientZip: '40361',
      carrierService: 'UPS Next Day Air',
      containerType: 'Equine Express II',
      trackingNumber: 'TRACK-99',
      doseCount: 4,
      eventDate: '2026-04-02',
      notes: 'Split shipment',
    });

    expect(updated.recipient).toBe('Farm Nova');
    expect(updated.trackingNumber).toBe('TRACK-99');

    await deleteDoseEvent('dose-1');
    const events = await listDoseEventsByCollection('col-1');
    expect(events).toHaveLength(0);
  });

  it('blocks over-allocation against the parent collection dose count', async () => {
    await createDoseEvent({
      collectionId: 'col-1',
      eventType: 'shipped',
      recipient: 'Farm ABC',
      recipientPhone: '555-0100',
      recipientStreet: '100 Main St',
      recipientCity: 'Lexington',
      recipientState: 'KY',
      recipientZip: '40511',
      carrierService: 'FedEx Priority Overnight',
      containerType: 'Equitainer',
      doseCount: 8,
      eventDate: '2026-04-01',
    });

    vi.mocked(newId).mockReturnValue('dose-2');

    await expect(
      createDoseEvent({
        collectionId: 'col-1',
        eventType: 'shipped',
        recipient: 'Farm XYZ',
        recipientPhone: '555-0101',
        recipientStreet: '200 Main St',
        recipientCity: 'Ocala',
        recipientState: 'FL',
        recipientZip: '34470',
        carrierService: 'UPS Next Day Air',
        containerType: 'Equine Express II',
        doseCount: 3,
        eventDate: '2026-04-02',
      }),
    ).rejects.toThrow('Allocated doses cannot exceed the collection dose count.');
  });

  it('blocks shipment events when the parent collection has no dose count', async () => {
    await expect(
      createDoseEvent({
        collectionId: 'col-no-dose',
        eventType: 'shipped',
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
      }),
    ).rejects.toThrow('Dose count is required on the collection before allocating doses.');
  });

  it('rejects usedOnSite events from the standalone dose event repository', async () => {
    await expect(
      createDoseEvent({
        collectionId: 'col-1',
        eventType: 'usedOnSite',
        recipient: 'Maple',
        doseCount: 1,
        eventDate: '2026-04-01',
      }),
    ).rejects.toThrow('On-farm allocations must be created through the collection wizard.');
  });
});
