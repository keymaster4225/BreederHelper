import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

vi.mock('@/storage/backup/safetyBackups', () => ({
  createSafetySnapshot: vi.fn(),
}));

vi.mock('@/utils/id', () => ({
  newId: vi.fn(() => 'generated-id'),
}));

import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { createSafetySnapshot } from '@/storage/backup/safetyBackups';
import { cloneBackupFixture } from '@/storage/backup/testFixtures';
import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  BACKUP_TABLE_NAMES,
  type BackupTableName,
} from '@/storage/backup/types';
import {
  createRepoDb,
  expectInsertForTable,
  type RepoDbHarness,
  type SqlCall,
} from '@/test/repoDb';
import { newId } from '@/utils/id';

import { importHorseTransfer } from './importHorse';
import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_VERSION,
  type HorseTransferEnvelopeV1,
  type HorseTransferTablesV1,
} from './types';

type RowRecord = Record<string, unknown> & {
  readonly id: string;
};

type RowStore = Partial<Record<BackupTableName, RowRecord[]>>;

function createMareEnvelope(
  tableOverrides: Partial<HorseTransferTablesV1> = {},
): HorseTransferEnvelopeV1 {
  const backup = cloneBackupFixture();
  const tables: HorseTransferTablesV1 = {
    ...backup.tables,
    collection_dose_events: [],
    frozen_semen_batches: [],
    ...tableOverrides,
  };

  return {
    artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
    transferVersion: HORSE_TRANSFER_VERSION,
    dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    createdAt: backup.createdAt,
    app: backup.app,
    sourceHorse: {
      type: 'mare',
      id: 'mare-1',
      name: 'Maple',
      registrationNumber: null,
      dateOfBirth: '2018-02-02',
    },
    privacy: {
      redactedContextStallions: true,
      redactedDoseRecipientAndShipping: false,
    },
    tables,
  };
}

function createStallionEnvelope(
  tableOverrides: Partial<HorseTransferTablesV1> = {},
): HorseTransferEnvelopeV1 {
  const backup = cloneBackupFixture();
  const tables: HorseTransferTablesV1 = {
    mares: [],
    stallions: backup.tables.stallions,
    daily_logs: [],
    uterine_fluid: [],
    uterine_flushes: [],
    uterine_flush_products: [],
    breeding_records: [],
    pregnancy_checks: [],
    foaling_records: [],
    foals: [],
    medication_logs: [],
    tasks: [],
    semen_collections: backup.tables.semen_collections,
    collection_dose_events: backup.tables.collection_dose_events.map((row) => ({
      ...row,
      breeding_record_id: null,
    })),
    frozen_semen_batches: backup.tables.frozen_semen_batches,
    ...tableOverrides,
  };

  return {
    artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
    transferVersion: HORSE_TRANSFER_VERSION,
    dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    createdAt: backup.createdAt,
    app: backup.app,
    sourceHorse: {
      type: 'stallion',
      id: 'stallion-1',
      name: 'Atlas',
      registrationNumber: null,
      dateOfBirth: '2016-03-03',
    },
    privacy: {
      redactedContextStallions: false,
      redactedDoseRecipientAndShipping: true,
    },
    tables,
  };
}

function createStoreFromTables(tables: HorseTransferTablesV1): RowStore {
  const store: RowStore = {};
  for (const tableName of BACKUP_TABLE_NAMES) {
    store[tableName] = [...(tables[tableName] as readonly RowRecord[])];
  }
  return store;
}

function createImportDb(
  store: RowStore = {},
  onRun?: (call: SqlCall) => Promise<unknown> | unknown,
): RepoDbHarness {
  return createRepoDb({
    onRun,
    onGetFirst: (call) => selectFromStore(store, call),
  });
}

function selectFromStore<T>(store: RowStore, call: SqlCall): T | null {
  const tableName = extractTableName(call.normalizedSql);
  if (!tableName) return null;

  const rows = store[tableName] ?? [];
  const params = call.params;

  if (call.normalizedSql.includes('where id = ?')) {
    return (rows.find((row) => row.id === params[0]) as T | undefined) ?? null;
  }

  if (tableName === 'daily_logs' && call.normalizedSql.includes('where mare_id = ?')) {
    return (
      rows.find((row) =>
        row.mare_id === params[0] &&
        row.date === params[1] &&
        (row.time ?? null) === (params[2] ?? null),
      ) as T | undefined
    ) ?? null;
  }

  if (tableName === 'uterine_flushes' && call.normalizedSql.includes('where daily_log_id = ?')) {
    return (rows.find((row) => row.daily_log_id === params[0]) as T | undefined) ?? null;
  }

  if (tableName === 'foals' && call.normalizedSql.includes('where foaling_record_id = ?')) {
    return (rows.find((row) => row.foaling_record_id === params[0]) as T | undefined) ?? null;
  }

  if (tableName === 'tasks' && call.normalizedSql.includes('where source_record_id = ?')) {
    return (
      rows.find((row) =>
        row.source_record_id === params[0] &&
        row.status === 'open' &&
        row.source_type === 'breedingRecord' &&
        row.source_reason === 'breedingPregnancyCheck',
      ) as T | undefined
    ) ?? null;
  }

  return null;
}

function extractTableName(sql: string): BackupTableName | null {
  const match = sql.match(/from ([a-z_]+)/);
  if (!match) return null;
  return match[1] as BackupTableName;
}

describe('importHorseTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSafetySnapshot).mockResolvedValue({
      fileName: 'snapshot.json',
      fileUri: 'file:///snapshot.json',
      createdAt: '2026-04-28T12:00:00.000Z',
      mareCount: 1,
      schemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    });
    vi.mocked(newId).mockReturnValue('generated-id');
  });

  it('creates a new mare with unused source IDs, creates a safety snapshot, and emits invalidation', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.safetySnapshotCreated).toBe(true);
    expect(result.summary.totalCounts.inserted).toBeGreaterThan(0);
    expect(result.summary.totalCounts.conflict).toBe(0);
    expect(createSafetySnapshot).toHaveBeenCalledTimes(1);
    expect(emitDataInvalidation).toHaveBeenCalledWith('all');
    expectInsertForTable(db, 'mares');
    expectInsertForTable(db, 'daily_logs');
    expectInsertForTable(db, 'foals');
  });

  it('remaps the root mare and child foreign keys when create-new collides with an existing mare ID', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      mares: [{ ...envelope.tables.mares[0], name: 'Existing Maple' } as RowRecord],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(newId).mockReturnValue('generated-mare-id');

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    const mareInsert = expectInsertForTable(db, 'mares').params;
    const dailyLogInsert = expectInsertForTable(db, 'daily_logs').params;
    const breedingInsert = expectInsertForTable(db, 'breeding_records').params;
    expect(mareInsert.id).toBe('generated-mare-id');
    expect(dailyLogInsert.mare_id).toBe('generated-mare-id');
    expect(breedingInsert.mare_id).toBe('generated-mare-id');
  });

  it('maps children to a confirmed existing mare without inserting the root mare', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      mares: [{ ...envelope.tables.mares[0], id: 'local-mare-id' } as RowRecord],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'confirmed_match', destinationHorseId: 'local-mare-id' },
    });

    expect(result.ok).toBe(true);
    expect(db.findRunCalls({ operation: 'insert', table: 'mares' })).toHaveLength(0);
    expect(expectInsertForTable(db, 'daily_logs').params.mare_id).toBe('local-mare-id');
    expect(result.ok && result.summary.tableCounts.mares.already_present).toBe(1);
  });

  it('rewrites a child ID collision under unrelated ownership and rewrites downstream FKs', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      daily_logs: [
        {
          ...envelope.tables.daily_logs[0],
          mare_id: 'other-mare-id',
        } as RowRecord,
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(newId).mockReturnValue('generated-log-id');

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    expect(expectInsertForTable(db, 'daily_logs').params.id).toBe('generated-log-id');
    expect(expectInsertForTable(db, 'uterine_fluid').params.daily_log_id).toBe('generated-log-id');
    expect(expectInsertForTable(db, 'uterine_flushes').params.daily_log_id).toBe('generated-log-id');
  });

  it('reports a natural daily-log conflict and cascades dependent rows', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      daily_logs: [
        {
          ...envelope.tables.daily_logs[0],
          id: 'local-log-id',
        } as RowRecord,
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);
    const dailyResult = result.summary.rowResults.find(
      (row) => row.table === 'daily_logs' && row.sourceId === 'log-1',
    );
    const fluidResult = result.summary.rowResults.find(
      (row) => row.table === 'uterine_fluid' && row.sourceId === 'fluid-1',
    );
    expect(dailyResult).toMatchObject({
      outcome: 'conflict',
      reason: 'natural_key_conflict',
      destinationId: 'local-log-id',
    });
    expect(fluidResult).toMatchObject({
      outcome: 'skipped',
      reason: 'cascade_parent_conflict',
    });
    expect(db.findRunCalls({ operation: 'insert', table: 'daily_logs' })).toHaveLength(0);
  });

  it('reports rich foal conflict details for foaling-record natural conflicts', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      foals: [
        {
          ...envelope.tables.foals[0],
          id: 'local-foal-id',
          milestones: '{}',
          igg_tests: '[]',
        } as RowRecord,
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);
    const foalResult = result.summary.rowResults.find(
      (row) => row.table === 'foals' && row.sourceId === 'foal-1',
    );
    expect(foalResult).toMatchObject({
      outcome: 'conflict',
      reason: 'natural_key_conflict',
      destinationId: 'local-foal-id',
      detail: {
        kind: 'foal_conflict',
        destinationPreserved: true,
        milestonesDiffer: true,
        iggTestsDiffer: true,
      },
    });
    expect(foalResult?.message).toContain('Destination foal was preserved');
  });

  it('is idempotent when importing into the same matched mare', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb(createStoreFromTables(envelope.tables));
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'confirmed_match', destinationHorseId: 'mare-1' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.summary.totalCounts.inserted).toBe(0);
    expect(result.summary.totalCounts.conflict).toBe(0);
    expect(result.summary.totalCounts.already_present).toBeGreaterThan(0);
    expect(db.runCalls).toHaveLength(0);
  });

  it('reports same-ID different effective data as a conflict', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      daily_logs: [
        {
          ...envelope.tables.daily_logs[0],
          notes: 'Different destination note',
        } as RowRecord,
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(
      result.summary.rowResults.find((row) => row.table === 'daily_logs' && row.sourceId === 'log-1'),
    ).toMatchObject({
      outcome: 'conflict',
      reason: 'different_effective_data',
    });
  });

  it('preserves breeding rows as custom stallion records when context stallion links are unsafe', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({
      stallions: [
        {
          ...envelope.tables.stallions[0],
          name: 'Different Stallion',
          registration_number: 'DIFFERENT',
        } as RowRecord,
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    const breedingInsert = expectInsertForTable(db, 'breeding_records').params;
    expect(breedingInsert.stallion_id).toBeNull();
    expect(breedingInsert.stallion_name).toBe('Atlas');
    expect(breedingInsert.collection_id).toBeNull();
    expect(result.ok && result.summary.tableCounts.stallions.conflict).toBe(1);
    expect(result.ok && result.summary.tableCounts.semen_collections.skipped).toBe(1);
  });

  it('does not create a safety snapshot when the confirmed match target is missing', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'confirmed_match', destinationHorseId: 'missing-mare-id' },
    });

    expect(result).toEqual({
      ok: false,
      safetySnapshotCreated: false,
      errorMessage: 'Confirmed destination horse was not found.',
    });
    expect(createSafetySnapshot).not.toHaveBeenCalled();
    expect(db.runCalls).toHaveLength(0);
  });

  it('imports a stallion package and remaps inventory foreign keys when IDs collide', async () => {
    const envelope = createStallionEnvelope();
    const db = createImportDb({
      stallions: [{ ...envelope.tables.stallions[0], name: 'Existing Atlas' } as RowRecord],
      semen_collections: [
        {
          ...envelope.tables.semen_collections[0],
          stallion_id: 'other-stallion-id',
        } as RowRecord,
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(newId)
      .mockReturnValueOnce('generated-stallion-id')
      .mockReturnValueOnce('generated-collection-id');

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);

    const stallionInsert = expectInsertForTable(db, 'stallions').params;
    const collectionInsert = expectInsertForTable(db, 'semen_collections').params;
    const frozenBatchInsert = expectInsertForTable(db, 'frozen_semen_batches').params;
    const doseEventInsert = expectInsertForTable(db, 'collection_dose_events').params;

    expect(stallionInsert.id).toBe('generated-stallion-id');
    expect(collectionInsert.id).toBe('generated-collection-id');
    expect(collectionInsert.stallion_id).toBe('generated-stallion-id');
    expect(frozenBatchInsert.stallion_id).toBe('generated-stallion-id');
    expect(frozenBatchInsert.collection_id).toBe('generated-collection-id');
    expect(doseEventInsert.collection_id).toBe('generated-collection-id');
    expect(doseEventInsert.breeding_record_id).toBeNull();
    expect(result.summary.tableCounts.stallions.inserted).toBe(1);
    expect(result.summary.tableCounts.semen_collections.inserted).toBe(1);
    expect(result.summary.tableCounts.frozen_semen_batches.inserted).toBe(1);
    expect(result.summary.tableCounts.collection_dose_events.inserted).toBe(1);
  });

  it('is idempotent when importing into the same matched stallion', async () => {
    const envelope = createStallionEnvelope();
    const db = createImportDb(createStoreFromTables(envelope.tables));
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'confirmed_match', destinationHorseId: 'stallion-1' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.summary.totalCounts.inserted).toBe(0);
    expect(result.summary.totalCounts.conflict).toBe(0);
    expect(result.summary.tableCounts.stallions.already_present).toBe(1);
    expect(result.summary.tableCounts.semen_collections.already_present).toBe(1);
    expect(result.summary.tableCounts.frozen_semen_batches.already_present).toBe(1);
    expect(result.summary.tableCounts.collection_dose_events.already_present).toBe(1);
    expect(db.runCalls).toHaveLength(0);
  });

  it('reports failed transactions with safety snapshot status', async () => {
    const envelope = createMareEnvelope();
    const db = createImportDb({}, (call) => {
      if (call.normalizedSql.startsWith('insert into daily_logs')) {
        throw new Error('insert failed');
      }
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await importHorseTransfer(envelope, {
      target: { kind: 'create_new' },
    });

    expect(result).toEqual({
      ok: false,
      safetySnapshotCreated: true,
      errorMessage: 'insert failed',
    });
    expect(createSafetySnapshot).toHaveBeenCalledTimes(1);
    expect(emitDataInvalidation).not.toHaveBeenCalled();
  });
});
