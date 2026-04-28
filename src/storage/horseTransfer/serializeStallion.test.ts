import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { cloneBackupFixture } from '@/storage/backup/testFixtures';
import type {
  BackupCollectionDoseEventRowV3,
  BackupTablesV11,
} from '@/storage/backup/types';

import { exportStallionTransfer, StallionNotFoundError } from './serializeStallion';
import { validateHorseTransfer } from './validate';

type FakeDb = {
  getFirstAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
  withTransactionAsync: ReturnType<typeof vi.fn>;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeStallionExportDb(tables: BackupTablesV11): FakeDb {
  const db: FakeDb = {
    getFirstAsync: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      const stmt = normalizeSql(sql);
      if (stmt.includes('from stallions')) {
        const stallionId = params?.[0];
        return (
          tables.stallions.find((row) => row.id === stallionId && row.deleted_at === null) ??
          null
        );
      }

      throw new Error(`Unexpected getFirstAsync query: ${sql}`);
    }),
    getAllAsync: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      const stmt = normalizeSql(sql);
      const stallionId = params?.[0];
      const collectionIds = new Set(
        tables.semen_collections
          .filter((row) => row.stallion_id === stallionId)
          .map((row) => row.id),
      );

      if (stmt.includes('from semen_collections')) {
        return tables.semen_collections.filter((row) => row.stallion_id === stallionId);
      }
      if (stmt.includes('from frozen_semen_batches')) {
        return tables.frozen_semen_batches.filter((row) => row.stallion_id === stallionId);
      }
      if (stmt.includes('from collection_dose_events')) {
        expect(stmt).toContain("'redacted' as recipient");
        expect(stmt).toContain('null as breeding_record_id');
        expect(stmt).toContain('null as tracking_number');
        return tables.collection_dose_events
          .filter((row) => collectionIds.has(row.collection_id))
          .map(redactDoseEvent);
      }

      throw new Error(`Unexpected getAllAsync query: ${sql}`);
    }),
    withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
      await callback();
    }),
  };

  return db;
}

function redactDoseEvent(row: BackupCollectionDoseEventRowV3): BackupCollectionDoseEventRowV3 {
  return {
    ...row,
    recipient: 'Redacted',
    recipient_phone: null,
    recipient_street: null,
    recipient_city: null,
    recipient_state: null,
    recipient_zip: null,
    carrier_service: null,
    container_type: null,
    tracking_number: null,
    breeding_record_id: null,
    notes: null,
  };
}

function normalizeCreatedAtForJson(
  envelope: Awaited<ReturnType<typeof exportStallionTransfer>>,
): string {
  return JSON.stringify({
    ...envelope,
    createdAt: '<createdAt>',
  });
}

describe('exportStallionTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T14:15:16.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports the stallion closure and redacts dose recipient/shipping fields', async () => {
    const backup = cloneBackupFixture();
    const tables: BackupTablesV11 = {
      ...backup.tables,
      semen_collections: [
        backup.tables.semen_collections[0],
        {
          ...backup.tables.semen_collections[0],
          id: 'collection-2',
          stallion_id: 'stallion-2',
        },
      ],
      frozen_semen_batches: [
        backup.tables.frozen_semen_batches[0],
        {
          ...backup.tables.frozen_semen_batches[0],
          id: 'frozen-2',
          stallion_id: 'stallion-2',
        },
      ],
      collection_dose_events: [
        {
          ...backup.tables.collection_dose_events[0],
          recipient_phone: '555-0101',
          recipient_street: '123 Barn Road',
          recipient_city: 'Lexington',
          recipient_state: 'KY',
          recipient_zip: '40511',
          carrier_service: 'FedEx',
          container_type: 'Equitainer',
          tracking_number: 'TRACK-1',
          notes: 'Private shipping note',
        },
        {
          ...backup.tables.collection_dose_events[0],
          id: 'event-2',
          collection_id: 'collection-2',
        },
      ],
    };
    const db = createFakeStallionExportDb(tables);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const envelope = await exportStallionTransfer('stallion-1');
    const validation = validateHorseTransfer(envelope);

    expect(validation.ok).toBe(true);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(envelope.createdAt).toBe('2026-04-28T14:15:16.000Z');
    expect(envelope.sourceHorse).toEqual({
      type: 'stallion',
      id: 'stallion-1',
      name: 'Atlas',
      registrationNumber: null,
      dateOfBirth: '2016-03-03',
    });
    expect(envelope.privacy).toEqual({
      redactedContextStallions: false,
      redactedDoseRecipientAndShipping: true,
    });
    expect(envelope.tables.stallions.map((row) => row.id)).toEqual(['stallion-1']);
    expect(envelope.tables.semen_collections.map((row) => row.id)).toEqual(['collection-1']);
    expect(envelope.tables.frozen_semen_batches.map((row) => row.id)).toEqual(['frozen-1']);
    expect(envelope.tables.collection_dose_events).toEqual([
      {
        ...tables.collection_dose_events[0],
        recipient: 'Redacted',
        recipient_phone: null,
        recipient_street: null,
        recipient_city: null,
        recipient_state: null,
        recipient_zip: null,
        carrier_service: null,
        container_type: null,
        tracking_number: null,
        breeding_record_id: null,
        notes: null,
      },
    ]);
    expect(envelope.tables.mares).toEqual([]);
    expect(envelope.tables.daily_logs).toEqual([]);
    expect(envelope.tables.breeding_records).toEqual([]);
    expect(envelope.tables.tasks).toEqual([]);
  });

  it('produces deterministic JSON after normalizing createdAt', async () => {
    const tables = cloneBackupFixture().tables;
    const db = createFakeStallionExportDb(tables);
    vi.mocked(getDb).mockResolvedValue(db as never);

    vi.setSystemTime(new Date('2026-04-28T14:15:16.000Z'));
    const first = await exportStallionTransfer('stallion-1');
    vi.setSystemTime(new Date('2026-04-28T14:16:17.000Z'));
    const second = await exportStallionTransfer('stallion-1');

    expect(normalizeCreatedAtForJson(first)).toBe(normalizeCreatedAtForJson(second));
  });

  it('throws when the root stallion is missing or deleted', async () => {
    const tables = cloneBackupFixture().tables;
    const db = createFakeStallionExportDb(tables);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(exportStallionTransfer('missing-stallion')).rejects.toBeInstanceOf(
      StallionNotFoundError,
    );
  });
});
