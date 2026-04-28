import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { cloneBackupFixture } from '@/storage/backup/testFixtures';
import type {
  BackupCollectionDoseEventRowV3,
  BackupFrozenSemenBatchRow,
  BackupStallionRow,
  BackupTablesV11,
} from '@/storage/backup/types';

import { exportMareTransfer, MareNotFoundError } from './serializeMare';
import { validateHorseTransfer } from './validate';

type FakeDb = {
  getFirstAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
  withTransactionAsync: ReturnType<typeof vi.fn>;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createFakeMareExportDb(tables: BackupTablesV11): FakeDb {
  const db: FakeDb = {
    getFirstAsync: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      const stmt = normalizeSql(sql);
      if (stmt.includes('from mares')) {
        const mareId = params?.[0];
        return tables.mares.find((row) => row.id === mareId && row.deleted_at === null) ?? null;
      }

      throw new Error(`Unexpected getFirstAsync query: ${sql}`);
    }),
    getAllAsync: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      const stmt = normalizeSql(sql);
      const mareId = params?.[0];
      const mareBreedingRecords = tables.breeding_records.filter((row) => row.mare_id === mareId);
      const dailyLogIds = new Set(
        tables.daily_logs.filter((row) => row.mare_id === mareId).map((row) => row.id),
      );
      const flushIds = new Set(
        tables.uterine_flushes
          .filter((row) => dailyLogIds.has(row.daily_log_id))
          .map((row) => row.id),
      );
      const foalingRecordIds = new Set(
        tables.foaling_records.filter((row) => row.mare_id === mareId).map((row) => row.id),
      );

      if (stmt.includes('from tasks')) {
        return tables.tasks.filter((row) => row.mare_id === mareId);
      }
      if (stmt.includes('from daily_logs')) {
        return tables.daily_logs.filter((row) => row.mare_id === mareId);
      }
      if (stmt.includes('from uterine_fluid')) {
        return tables.uterine_fluid.filter((row) => dailyLogIds.has(row.daily_log_id));
      }
      if (stmt.includes('from uterine_flush_products')) {
        return tables.uterine_flush_products.filter((row) =>
          flushIds.has(row.uterine_flush_id),
        );
      }
      if (stmt.includes('from uterine_flushes')) {
        return tables.uterine_flushes.filter((row) => dailyLogIds.has(row.daily_log_id));
      }
      if (stmt.includes('from medication_logs')) {
        return tables.medication_logs.filter((row) => row.mare_id === mareId);
      }
      if (stmt.includes('from pregnancy_checks')) {
        return tables.pregnancy_checks.filter((row) => row.mare_id === mareId);
      }
      if (stmt.includes('from foals')) {
        return tables.foals.filter((row) => foalingRecordIds.has(row.foaling_record_id));
      }
      if (stmt.includes('from foaling_records')) {
        return tables.foaling_records.filter((row) => row.mare_id === mareId);
      }
      if (stmt.includes('from stallions')) {
        expect(stmt).toContain('null as sire');
        expect(stmt).toContain('null as av_notes');
        const stallionIds = new Set(
          mareBreedingRecords
            .map((row) => row.stallion_id)
            .filter((stallionId): stallionId is string => stallionId !== null),
        );
        return tables.stallions
          .filter((row) => stallionIds.has(row.id))
          .map(redactContextStallion);
      }
      if (stmt.includes('from semen_collections')) {
        const collectionIds = new Set(
          mareBreedingRecords
            .map((row) => row.collection_id)
            .filter((collectionId): collectionId is string => collectionId !== null),
        );
        return tables.semen_collections.filter((row) => collectionIds.has(row.id));
      }
      if (stmt.includes('from breeding_records')) {
        return mareBreedingRecords;
      }

      throw new Error(`Unexpected getAllAsync query: ${sql}`);
    }),
    withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
      await callback();
    }),
  };

  return db;
}

function redactContextStallion(row: BackupStallionRow): BackupStallionRow {
  return {
    ...row,
    sire: null,
    dam: null,
    notes: null,
    av_temperature_f: null,
    av_type: null,
    av_liner_type: null,
    av_water_volume_ml: null,
    av_notes: null,
  };
}

function normalizeCreatedAtForJson(envelope: Awaited<ReturnType<typeof exportMareTransfer>>): string {
  return JSON.stringify({
    ...envelope,
    createdAt: '<createdAt>',
  });
}

describe('exportMareTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T14:15:16.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports the mare closure, redacted context stallions, and no stallion inventory', async () => {
    const backup = cloneBackupFixture();
    const tables: BackupTablesV11 = {
      ...backup.tables,
      mares: [
        backup.tables.mares[0],
        {
          ...backup.tables.mares[0],
          id: 'mare-2',
          name: 'Willow',
        },
      ],
      stallions: [
        {
          ...backup.tables.stallions[0],
          deleted_at: '2026-04-20T00:00:00.000Z',
          sire: 'Private sire',
          dam: 'Private dam',
          notes: 'Private notes',
          av_temperature_f: 110,
          av_type: 'Missouri',
          av_liner_type: 'smooth',
          av_water_volume_ml: 2000,
          av_notes: 'Private AV notes',
        },
        {
          ...backup.tables.stallions[0],
          id: 'stallion-2',
          name: 'Not Referenced',
        },
      ],
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
      ] satisfies BackupFrozenSemenBatchRow[],
      collection_dose_events: [
        backup.tables.collection_dose_events[0],
      ] satisfies BackupCollectionDoseEventRowV3[],
    };
    const db = createFakeMareExportDb(tables);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const envelope = await exportMareTransfer('mare-1');
    const validation = validateHorseTransfer(envelope);

    if (!validation.ok) {
      throw new Error(validation.error.message);
    }
    expect(validation.ok).toBe(true);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(envelope.createdAt).toBe('2026-04-28T14:15:16.000Z');
    expect(envelope.sourceHorse).toEqual({
      type: 'mare',
      id: 'mare-1',
      name: 'Maple',
      registrationNumber: null,
      dateOfBirth: '2018-02-02',
    });
    expect(envelope.privacy).toEqual({
      redactedContextStallions: true,
      redactedDoseRecipientAndShipping: false,
    });
    expect(envelope.tables.mares.map((row) => row.id)).toEqual(['mare-1']);
    expect(envelope.tables.tasks.map((row) => row.id)).toEqual([
      'task-open-1',
      'task-completed-1',
    ]);
    expect(envelope.tables.breeding_records.map((row) => row.id)).toEqual(['breed-1']);
    expect(envelope.tables.daily_logs.map((row) => row.id)).toEqual(['log-1']);
    expect(envelope.tables.uterine_fluid.map((row) => row.id)).toEqual(['fluid-1']);
    expect(envelope.tables.uterine_flushes.map((row) => row.id)).toEqual(['flush-1']);
    expect(envelope.tables.uterine_flush_products.map((row) => row.id)).toEqual([
      'flush-product-1',
    ]);
    expect(envelope.tables.medication_logs.map((row) => row.id)).toEqual(['med-1']);
    expect(envelope.tables.pregnancy_checks.map((row) => row.id)).toEqual(['check-1']);
    expect(envelope.tables.foaling_records.map((row) => row.id)).toEqual(['foaling-1']);
    expect(envelope.tables.foals.map((row) => row.id)).toEqual(['foal-1']);
    expect(envelope.tables.stallions).toEqual([
      {
        ...tables.stallions[0],
        sire: null,
        dam: null,
        notes: null,
        av_temperature_f: null,
        av_type: null,
        av_liner_type: null,
        av_water_volume_ml: null,
        av_notes: null,
      },
    ]);
    expect(envelope.tables.semen_collections.map((row) => row.id)).toEqual(['collection-1']);
    expect(envelope.tables.frozen_semen_batches).toEqual([]);
    expect(envelope.tables.collection_dose_events).toEqual([]);
  });

  it('produces deterministic JSON after normalizing createdAt', async () => {
    const tables = cloneBackupFixture().tables;
    const db = createFakeMareExportDb(tables);
    vi.mocked(getDb).mockResolvedValue(db as never);

    vi.setSystemTime(new Date('2026-04-28T14:15:16.000Z'));
    const first = await exportMareTransfer('mare-1');
    vi.setSystemTime(new Date('2026-04-28T14:16:17.000Z'));
    const second = await exportMareTransfer('mare-1');

    expect(normalizeCreatedAtForJson(first)).toBe(normalizeCreatedAtForJson(second));
  });

  it('throws when the root mare is missing or deleted', async () => {
    const tables = cloneBackupFixture().tables;
    const db = createFakeMareExportDb(tables);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(exportMareTransfer('missing-mare')).rejects.toBeInstanceOf(MareNotFoundError);
  });
});
