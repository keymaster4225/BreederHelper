import { describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { cloneBackupFixture } from '@/storage/backup/testFixtures';
import { BACKUP_SCHEMA_VERSION_CURRENT, BACKUP_TABLE_NAMES, type BackupTableName } from '@/storage/backup/types';

import {
  HORSE_IMPORT_NON_OVERWRITE_MESSAGE,
  HORSE_IMPORT_SAFETY_SNAPSHOT_PROMISE_MESSAGE,
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_VERSION,
  type HorseTransferEnvelopeV1,
} from './types';
import { previewHorseImport } from './preview';

type FakeDb = {
  getAllAsync: ReturnType<typeof vi.fn>;
};

type ConflictMap = Partial<Record<BackupTableName, readonly string[]>>;

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractTableName(sql: string): BackupTableName {
  const normalized = normalizeSql(sql);
  const match = normalized.match(/from ([a-z_]+)/);
  if (!match) {
    throw new Error(`Unable to parse table from SQL: ${sql}`);
  }
  return match[1] as BackupTableName;
}

function createMareEnvelope(overrides: Partial<HorseTransferEnvelopeV1> = {}): HorseTransferEnvelopeV1 {
  const backup = cloneBackupFixture();
  const base: HorseTransferEnvelopeV1 = {
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
    tables: {
      ...backup.tables,
      collection_dose_events: [],
      frozen_semen_batches: [],
    },
  };

  return {
    ...base,
    ...overrides,
  };
}

function createStallionEnvelope(): HorseTransferEnvelopeV1 {
  const backup = cloneBackupFixture();
  return {
    artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
    transferVersion: HORSE_TRANSFER_VERSION,
    dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    createdAt: backup.createdAt,
    app: backup.app,
    sourceHorse: {
      type: 'stallion',
      id: 'stallion-new',
      name: 'Atlas Prime',
      registrationNumber: 'REG-S1',
      dateOfBirth: null,
    },
    privacy: {
      redactedContextStallions: false,
      redactedDoseRecipientAndShipping: true,
    },
    tables: {
      mares: [],
      stallions: [backup.tables.stallions[0]],
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
    },
  };
}

function createPreviewDb(input: {
  readonly mares?: readonly {
    readonly id: string;
    readonly name: string;
    readonly registration_number: string | null;
    readonly date_of_birth: string | null;
    readonly deleted_at: string | null;
  }[];
  readonly stallions?: readonly {
    readonly id: string;
    readonly name: string;
    readonly registration_number: string | null;
    readonly date_of_birth: string | null;
    readonly deleted_at: string | null;
  }[];
  readonly primaryKeyConflicts?: ConflictMap;
}): FakeDb {
  return {
    getAllAsync: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      const normalized = normalizeSql(sql);
      const tableName = extractTableName(sql);

      if (normalized.includes('order by name collate nocase')) {
        if (tableName === 'mares') {
          return input.mares ?? [];
        }
        if (tableName === 'stallions') {
          return input.stallions ?? [];
        }
      }

      if (normalized.includes('where id in')) {
        const ids = (params ?? []) as readonly string[];
        const conflicts = input.primaryKeyConflicts?.[tableName] ?? [];
        return conflicts
          .filter((id) => ids.includes(id))
          .map((id) => ({ id }));
      }

      throw new Error(`Unexpected query: ${sql}`);
    }),
  };
}

function computeTotalRows(envelope: HorseTransferEnvelopeV1): number {
  return BACKUP_TABLE_NAMES.reduce((total, tableName) => total + envelope.tables[tableName].length, 0);
}

describe('previewHorseImport', () => {
  it('builds mare preview with counts, conflict estimates, redaction notice, and exact ID match', async () => {
    const envelope = createMareEnvelope();
    const db = createPreviewDb({
      mares: [
        {
          id: 'mare-1',
          name: 'Maple',
          registration_number: null,
          date_of_birth: '2018-02-02',
          deleted_at: null,
        },
      ],
      primaryKeyConflicts: {
        mares: ['mare-1'],
        tasks: ['task-open-1'],
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await previewHorseImport(envelope);

    expect(result.match.state).toBe('matched');
    if (result.match.state !== 'matched') {
      throw new Error('Expected matched state');
    }
    expect(result.match.matchedBy).toBe('id');
    expect(result.preview.targetState).toBe('matched');
    expect(result.preview.tableCounts.mares).toBe(1);
    expect(result.preview.tableCounts.tasks).toBe(2);
    expect(result.preview.totalRowCount).toBe(computeTotalRows(envelope));
    expect(result.preview.estimatedConflictCounts.mares).toBe(1);
    expect(result.preview.estimatedConflictCounts.tasks).toBe(1);
    expect(result.preview.estimatedConflictTotal).toBe(2);
    expect(result.preview.redactionNotices.map((notice) => notice.code)).toEqual([
      'context_stallions_redacted',
    ]);
    expect(result.preview.nonOverwriteMessage).toBe(HORSE_IMPORT_NON_OVERWRITE_MESSAGE);
    expect(result.preview.safetySnapshotMessage).toBe(HORSE_IMPORT_SAFETY_SNAPSHOT_PROMISE_MESSAGE);
  });

  it('returns create-new target state with fuzzy suggestions when no exact match exists', async () => {
    const envelope = createMareEnvelope({
      sourceHorse: {
        type: 'mare',
        id: 'new-mare-id',
        name: 'Maple Farms',
        registrationNumber: null,
        dateOfBirth: null,
      },
    });
    const db = createPreviewDb({
      mares: [
        {
          id: 'mare-maple',
          name: 'Maple Ranch',
          registration_number: null,
          date_of_birth: null,
          deleted_at: null,
        },
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await previewHorseImport(envelope);

    expect(result.match.state).toBe('create_new');
    expect(result.preview.targetState).toBe('create_new');
    expect(result.match.fuzzySuggestions.map((entry) => entry.horse.id)).toEqual(['mare-maple']);
  });

  it('loads destination stallions for stallion packages and emits dose-redaction notice', async () => {
    const envelope = createStallionEnvelope();
    const db = createPreviewDb({
      stallions: [
        {
          id: 'stallion-local',
          name: 'Atlas Prime',
          registration_number: 'reg-s1',
          date_of_birth: null,
          deleted_at: null,
        },
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await previewHorseImport(envelope);

    expect(result.match.state).toBe('matched');
    if (result.match.state !== 'matched') {
      throw new Error('Expected matched state');
    }
    expect(result.match.matchedBy).toBe('registration');
    expect(result.preview.targetState).toBe('matched');
    expect(result.preview.redactionNotices.map((notice) => notice.code)).toEqual([
      'dose_recipient_shipping_redacted',
    ]);
  });

  it('returns ambiguous target state when exact signals conflict', async () => {
    const envelope = createMareEnvelope({
      sourceHorse: {
        type: 'mare',
        id: 'mare-1',
        name: 'Maple',
        registrationNumber: 'REG-2',
        dateOfBirth: '2018-02-02',
      },
    });
    const db = createPreviewDb({
      mares: [
        {
          id: 'mare-1',
          name: 'Maple',
          registration_number: 'REG-1',
          date_of_birth: '2018-02-02',
          deleted_at: null,
        },
        {
          id: 'mare-2',
          name: 'Willow',
          registration_number: 'REG-2',
          date_of_birth: '2019-01-01',
          deleted_at: null,
        },
      ],
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await previewHorseImport(envelope);

    expect(result.match.state).toBe('ambiguous');
    if (result.match.state !== 'ambiguous') {
      throw new Error('Expected ambiguous state');
    }
    expect(result.match.reasons).toContain('conflicting_exact_matches');
    expect(result.preview.targetState).toBe('ambiguous');
  });
});
