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

type DoseEventRow = {
  id: string;
  collection_id: string;
  event_type: 'shipped' | 'usedOnSite';
  recipient: string;
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
  const doseEvents = new Map<string, DoseEventRow>();

  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('insert into collection_dose_events')) {
        const [id, collectionId, eventType, recipient, doseCount, eventDate, notes, createdAt, updatedAt] =
          params as [string, string, DoseEventRow['event_type'], string, number | null, string | null, string | null, string, string];
        doseEvents.set(id, {
          id,
          collection_id: collectionId,
          event_type: eventType,
          recipient,
          dose_count: doseCount,
          event_date: eventDate,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      if (stmt.startsWith('update collection_dose_events')) {
        const [eventType, recipient, doseCount, eventDate, notes, updatedAt, id] =
          params as [DoseEventRow['event_type'], string, number | null, string | null, string | null, string, string];
        const existing = doseEvents.get(id);
        if (!existing) return;
        doseEvents.set(id, {
          ...existing,
          event_type: eventType,
          recipient,
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

  it('creates and lists a dose event for one collection', async () => {
    const created = await createDoseEvent({
      collectionId: 'col-1',
      eventType: 'shipped',
      recipient: ' Farm ABC ',
      doseCount: 8,
      eventDate: '2026-04-01',
      notes: 'Handled cold chain',
    });

    expect(created.id).toBe('dose-1');
    expect(created.recipient).toBe('Farm ABC');

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
    });
    await createDoseEvent({
      collectionId: 'col-2',
      eventType: 'usedOnSite',
      recipient: 'Mare Nova',
    });

    const grouped = await listDoseEventsByCollectionIds(['col-1', 'col-2', 'col-3']);
    expect(grouped['col-1']).toHaveLength(1);
    expect(grouped['col-2'][0].eventType).toBe('usedOnSite');
    expect(grouped['col-3']).toEqual([]);
  });

  it('updates and deletes a dose event', async () => {
    await createDoseEvent({
      collectionId: 'col-1',
      eventType: 'shipped',
      recipient: 'Farm ABC',
      doseCount: 8,
    });

    const updated = await updateDoseEvent('dose-1', {
      eventType: 'usedOnSite',
      recipient: 'Mare Nova',
      doseCount: 4,
      notes: 'Split shipment',
    });

    expect(updated.eventType).toBe('usedOnSite');
    expect(updated.recipient).toBe('Mare Nova');

    await deleteDoseEvent('dose-1');
    const events = await listDoseEventsByCollection('col-1');
    expect(events).toHaveLength(0);
  });
});
