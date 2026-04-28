import { describe, expect, it } from 'vitest';

import { cloneBackupFixture } from '@/storage/backup/testFixtures';
import { BACKUP_CURRENT_TABLE_FIELD_NAMES } from '@/storage/backup/tableSpecs';
import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  BACKUP_TABLE_NAMES,
  type BackupTableName,
} from '@/storage/backup/types';

import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_NEWER_SCHEMA_MESSAGE,
  HORSE_TRANSFER_OLDER_SCHEMA_MESSAGE,
  HORSE_TRANSFER_VERSION,
  type HorseTransferEnvelopeV1,
} from './types';
import { validateHorseTransfer, validateHorseTransferJson } from './validate';

function createMareEnvelope(): HorseTransferEnvelopeV1 {
  const backup = cloneBackupFixture();

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
      redactedDoseRecipientAndShipping: true,
    },
    tables: {
      ...backup.tables,
      collection_dose_events: [],
      frozen_semen_batches: [],
    },
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
      id: 'stallion-1',
      name: 'Atlas',
      registrationNumber: null,
      dateOfBirth: '2016-03-03',
    },
    privacy: {
      redactedContextStallions: true,
      redactedDoseRecipientAndShipping: true,
    },
    tables: {
      ...backup.tables,
      mares: [],
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
      collection_dose_events: backup.tables.collection_dose_events.map((row) => ({
        ...row,
        breeding_record_id: null,
      })),
    },
  };
}

describe('validateHorseTransfer', () => {
  it('accepts a valid mare horse package and builds a preview', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransferJson(JSON.stringify(envelope));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected horse package to validate');
    }

    expect(result.preview.sourceHorse).toEqual(envelope.sourceHorse);
    expect(result.preview.tableCounts.mares).toBe(1);
    expect(result.preview.tableCounts.collection_dose_events).toBe(0);
  });

  it('accepts a valid stallion horse package', () => {
    const result = validateHorseTransfer(createStallionEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected horse package to validate');
    }

    expect(result.preview.sourceHorse.type).toBe('stallion');
    expect(result.preview.tableCounts.collection_dose_events).toBe(1);
  });

  it('rejects non-horse JSON', () => {
    const result = validateHorseTransferJson(JSON.stringify(cloneBackupFixture()));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('missing_key');
    expect(result.error.message).toContain('artifactType');
  });

  it('rejects unsupported transfer versions', () => {
    const result = validateHorseTransfer({
      ...createMareEnvelope(),
      transferVersion: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('unsupported_transfer_version');
    expect(result.error.message).toContain('transferVersion 2');
  });

  it('uses exact schema mismatch copy for newer and older packages', () => {
    const newer = validateHorseTransfer({
      ...createMareEnvelope(),
      dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT + 1,
    });
    const older = validateHorseTransfer({
      ...createMareEnvelope(),
      dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT - 1,
    });

    expect(newer.ok).toBe(false);
    if (newer.ok) {
      throw new Error('Expected validation failure');
    }
    expect(newer.error.message).toBe(HORSE_TRANSFER_NEWER_SCHEMA_MESSAGE);

    expect(older.ok).toBe(false);
    if (older.ok) {
      throw new Error('Expected validation failure');
    }
    expect(older.error.message).toBe(HORSE_TRANSFER_OLDER_SCHEMA_MESSAGE);
  });

  it('rejects unknown top-level envelope keys', () => {
    const result = validateHorseTransfer({
      ...createMareEnvelope(),
      exportScope: { type: 'mare' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_shape');
    expect(result.error.field).toBe('exportScope');
  });

  it('rejects missing table keys', () => {
    const envelope = createMareEnvelope();
    const tables = { ...envelope.tables };
    delete (tables as Partial<Record<BackupTableName, unknown>>).tasks;

    const result = validateHorseTransfer({
      ...envelope,
      tables,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('missing_key');
    expect(result.error.message).toContain('tasks');
  });

  it('rejects unknown table keys', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        photos: [],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_shape');
    expect(result.error.field).toBe('photos');
  });

  it('rejects missing row fields', () => {
    const envelope = createMareEnvelope();
    const mareRow = { ...envelope.tables.mares[0] };
    delete (mareRow as { name?: unknown }).name;

    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        mares: [mareRow],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('missing_key');
    expect(result.error.table).toBe('mares');
    expect(result.error.field).toBe('name');
  });

  it('rejects unknown row fields', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        mares: [
          {
            ...envelope.tables.mares[0],
            nickname: 'May',
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_shape');
    expect(result.error.table).toBe('mares');
    expect(result.error.field).toBe('nickname');
  });

  it('keeps horse-transfer row field specs aligned with current backup fixture rows', () => {
    const backup = cloneBackupFixture();

    for (const tableName of BACKUP_TABLE_NAMES) {
      expect(new Set(Object.keys(backup.tables[tableName][0]!))).toEqual(
        new Set(BACKUP_CURRENT_TABLE_FIELD_NAMES[tableName]),
      );
    }
  });

  it('reuses backup row validation for invalid enum values', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        breeding_records: envelope.tables.breeding_records.map((row) => ({
          ...row,
          method: 'unsupportedMethod',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_row');
    expect(result.error.table).toBe('breeding_records');
    expect(result.error.field).toBe('method');
  });

  it('reuses backup cross-table validation for duplicate IDs', () => {
    const envelope = createMareEnvelope();
    const duplicateLog = {
      ...envelope.tables.daily_logs[0]!,
      date: '2026-04-11',
      time: '09:15',
    };

    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        daily_logs: [...envelope.tables.daily_logs, duplicateLog],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_row');
    expect(result.error.table).toBe('daily_logs');
    expect(result.error.field).toBe('id');
  });

  it('reuses backup cross-table validation for orphan foreign keys', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        pregnancy_checks: envelope.tables.pregnancy_checks.map((row) => ({
          ...row,
          breeding_record_id: 'missing-breeding-record',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_row');
    expect(result.error.table).toBe('pregnancy_checks');
    expect(result.error.field).toBe('breeding_record_id');
  });

  it('reuses backup cross-table validation for impossible semen inventory', () => {
    const envelope = createStallionEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        collection_dose_events: envelope.tables.collection_dose_events.map((row) => ({
          ...row,
          dose_semen_volume_ml: 150,
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_row');
    expect(result.error.table).toBe('semen_collections');
    expect(result.error.field).toBe('raw_volume_ml');
  });

  it('rejects unreferenced mare-package context stallions', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        stallions: [
          ...envelope.tables.stallions,
          {
            ...envelope.tables.stallions[0]!,
            id: 'stallion-extra',
            name: 'Unreferenced',
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('constraint_violation');
    expect(result.error.table).toBe('stallions');
    expect(result.error.field).toBe('id');
  });

  it('rejects unreferenced mare-package semen collections', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        semen_collections: [
          ...envelope.tables.semen_collections,
          {
            ...envelope.tables.semen_collections[0]!,
            id: 'collection-extra',
            collection_date: '2026-04-05',
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('constraint_violation');
    expect(result.error.table).toBe('semen_collections');
    expect(result.error.field).toBe('id');
  });

  it('rejects mare-package task source pointers outside the package', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        tasks: envelope.tables.tasks.map((row, index) =>
          index === 0
            ? {
                ...row,
                source_type: 'dailyLog',
                source_record_id: 'missing-daily-log',
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('constraint_violation');
    expect(result.error.table).toBe('tasks');
    expect(result.error.field).toBe('source_record_id');
  });

  it('rejects mare-package completed task pointers outside the package', () => {
    const envelope = createMareEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        tasks: envelope.tables.tasks.map((row, index) =>
          index === 1
            ? {
                ...row,
                completed_record_id: 'missing-pregnancy-check',
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('constraint_violation');
    expect(result.error.table).toBe('tasks');
    expect(result.error.field).toBe('completed_record_id');
  });

  it('rejects stallion packages that include mare-owned tables', () => {
    const backup = cloneBackupFixture();
    const envelope = createStallionEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        mares: backup.tables.mares,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('constraint_violation');
    expect(result.error.table).toBe('mares');
  });

  it('rejects stallion packages with dose events still linked to breeding records', () => {
    const envelope = createStallionEnvelope();
    const result = validateHorseTransfer({
      ...envelope,
      tables: {
        ...envelope.tables,
        collection_dose_events: envelope.tables.collection_dose_events.map((row) => ({
          ...row,
          breeding_record_id: 'breed-1',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_row');
    expect(result.error.table).toBe('collection_dose_events');
    expect(result.error.field).toBe('breeding_record_id');
  });
});
