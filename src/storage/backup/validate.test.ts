import { describe, expect, it } from 'vitest';

import {
  cloneBackupFixture,
  createBackupFixtureV2,
  createBackupFixtureV4,
  createBackupFixtureV5,
  createBackupFixtureV6,
} from './testFixtures';
import { validateBackup, validateBackupJson } from './validate';

describe('validateBackup', () => {
  it('accepts a valid backup and builds a preview summary', () => {
    const backup = cloneBackupFixture();

    const result = validateBackup(backup);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected backup to validate');
    }

    expect(result.preview.mareCount).toBe(1);
    expect(result.preview.dailyLogCount).toBe(1);
    expect(result.preview.onboardingComplete).toBe(true);
    expect(result.preview.schemaVersion).toBe(13);
  });

  it('requires tasks in v11 backups', () => {
    const backup = cloneBackupFixture();
    const tablesWithoutTasks = { ...backup.tables };
    delete (tablesWithoutTasks as { tasks?: unknown }).tasks;
    const result = validateBackup({
      ...backup,
      tables: tablesWithoutTasks,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('missing_key');
    expect(result.error.message).toContain('tables.tasks');
  });

  it('accepts v10 backups without tasks', () => {
    const backup = cloneBackupFixture();
    const tablesWithoutTasks = { ...backup.tables };
    delete (tablesWithoutTasks as { tasks?: unknown }).tasks;
    const result = validateBackup({
      ...backup,
      schemaVersion: 10,
      tables: tablesWithoutTasks,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected backup to validate');
    }
    expect(result.preview.schemaVersion).toBe(10);
  });

  it('validates task row fields in v11 backups', () => {
    const backup = cloneBackupFixture();
    const invalidDueTime = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        tasks: backup.tables.tasks.map((row, index) =>
          index === 0 ? { ...row, due_time: '8:00' } : row,
        ),
      },
    });

    expect(invalidDueTime.ok).toBe(false);
    if (invalidDueTime.ok) {
      throw new Error('Expected validation failure');
    }
    expect(invalidDueTime.error.table).toBe('tasks');
    expect(invalidDueTime.error.field).toBe('due_time');

    const missingCompletedAt = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        tasks: backup.tables.tasks.map((row, index) =>
          index === 1 ? { ...row, completed_at: null } : row,
        ),
      },
    });

    expect(missingCompletedAt.ok).toBe(false);
    if (missingCompletedAt.ok) {
      throw new Error('Expected validation failure');
    }
    expect(missingCompletedAt.error.table).toBe('tasks');
    expect(missingCompletedAt.error.field).toBe('completed_at');
  });

  it('requires v11 tasks to reference existing mares', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        tasks: backup.tables.tasks.map((row, index) =>
          index === 0 ? { ...row, mare_id: 'missing-mare' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('tasks');
    expect(result.error.field).toBe('mare_id');
    expect(result.error.message).toContain('references missing mare');
  });

  it('requires a valid clock preference in current backup settings', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      settings: {
        ...backup.settings,
        clockPreference: 'bad-value',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('invalid_shape');
    expect(result.error.message).toContain('clockPreference');
  });

  it('rejects malformed breeding record times in current backups', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        breeding_records: backup.tables.breeding_records.map((row) => ({
          ...row,
          time: '8:00',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('breeding_records');
    expect(result.error.field).toBe('time');
    expect(result.error.code).toBe('invalid_row');
  });

  it('rejects malformed medication log times in current backups', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        medication_logs: backup.tables.medication_logs.map((row) => ({
          ...row,
          time: '09:30:00',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('medication_logs');
    expect(result.error.field).toBe('time');
    expect(result.error.code).toBe('invalid_row');
  });

  it('accepts v1 backups without gestation length on mare rows', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      schemaVersion: 1,
      tables: {
        ...backup.tables,
        mares: backup.tables.mares.map(({ gestation_length_days: _gestationLengthDays, ...row }) => row),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected backup to validate');
    }

    expect(result.preview.schemaVersion).toBe(1);
  });

  it('accepts v5 backups without is_recipient on mare rows', () => {
    const backup = createBackupFixtureV5();

    const result = validateBackup(backup);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected backup to validate');
    }

    expect(result.preview.schemaVersion).toBe(5);
  });

  it('accepts v4 backups without frozen semen batches', () => {
    const backup = createBackupFixtureV4();

    const result = validateBackup(backup);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected backup to validate');
    }

    expect(result.preview.schemaVersion).toBe(4);
  });

  it('requires frozen semen batches in v5 backups', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        frozen_semen_batches: undefined,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('missing_key');
    expect(result.error.message).toContain('tables.frozen_semen_batches');
  });

  it('rejects impossible calendar dates', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        daily_logs: backup.tables.daily_logs.map((row, index) =>
          index === 0 ? { ...row, date: '2026-13-45' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('daily_logs');
    expect(result.error.field).toBe('date');
    expect(result.error.message).toContain('valid YYYY-MM-DD date');
  });

  it('rejects duplicate v7 daily_logs when mare, date, and time all match', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        daily_logs: [
          ...backup.tables.daily_logs,
          {
            ...backup.tables.daily_logs[0]!,
            id: 'log-2',
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('daily_logs');
    expect(result.error.field).toBe('mare_id,date,time');
    expect(result.error.message).toContain('duplicate (mare_id, date, time) key');
  });

  it('accepts two v7 daily_logs on the same date when time differs', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        daily_logs: [
          ...backup.tables.daily_logs,
          {
            ...backup.tables.daily_logs[0]!,
            id: 'log-2',
            time: '16:45',
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
  });

  it('rejects duplicate v6 daily_logs by mare and date before restore canonicalization', () => {
    const backup = createBackupFixtureV6();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        daily_logs: [
          ...backup.tables.daily_logs,
          {
            ...backup.tables.daily_logs[0]!,
            id: 'log-2',
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('daily_logs');
    expect(result.error.field).toBe('mare_id,date');
    expect(result.error.message).toContain('duplicate (mare_id, date) pair');
  });

  it('accepts historical unknown foaling outcomes and integer straw volumes', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        foaling_records: backup.tables.foaling_records.map((row, index) =>
          index === 0 ? { ...row, outcome: 'unknown' } : row,
        ),
        breeding_records: backup.tables.breeding_records.map((row, index) =>
          index === 0 ? { ...row, straw_volume_ml: 5 } : row,
        ),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('accepts forward-compatible foal milestone keys and extra igg test properties', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        foals: backup.tables.foals.map((row, index) =>
          index === 0
            ? {
                ...row,
                milestones: JSON.stringify({
                  stood: { done: true, recordedAt: '2026-04-16T12:00:00.000Z' },
                  futureMilestone: { done: true, windowHours: 6 },
                }),
                igg_tests: JSON.stringify([
                  {
                    date: '2027-03-11',
                    valueMgDl: 900,
                    recordedAt: '2027-03-11T08:00:00.000Z',
                    lab: 'North Lab',
                  },
                ]),
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('accepts v2 collection dose events without the new optional shipping fields', () => {
    const backup = createBackupFixtureV2();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        collection_dose_events: backup.tables.collection_dose_events.map((row) => {
          const legacyRow = { ...row } as Record<string, unknown>;
          delete legacyRow.recipient_phone;
          delete legacyRow.recipient_street;
          delete legacyRow.recipient_city;
          delete legacyRow.recipient_state;
          delete legacyRow.recipient_zip;
          delete legacyRow.carrier_service;
          delete legacyRow.container_type;
          delete legacyRow.tracking_number;
          delete legacyRow.breeding_record_id;
          return legacyRow;
        }),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('rejects invalid v4 daily log follicle-state enums', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        daily_logs: backup.tables.daily_logs.map((row, index) =>
          index === 0 ? { ...row, right_ovary_follicle_state: 'huge' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('daily_logs');
    expect(result.error.field).toBe('right_ovary_follicle_state');
  });

  it('rejects v4 daily log JSON-text fields when stored as arrays', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        daily_logs: backup.tables.daily_logs.map((row, index) =>
          index === 0
            ? {
                ...row,
                right_ovary_follicle_measurements_mm: [35],
                left_ovary_structures: ['corpusLuteum'],
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('daily_logs');
    expect(['right_ovary_follicle_measurements_mm', 'left_ovary_structures']).toContain(
      result.error.field,
    );
  });

  it('rejects uterine fluid rows with invalid depth or location', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        uterine_fluid: backup.tables.uterine_fluid.map((row, index) =>
          index === 0 ? { ...row, depth_mm: 0, location: 'upperHorn' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('uterine_fluid');
    expect(['depth_mm', 'location']).toContain(result.error.field);
  });

  it('requires uterine fluid rows to reference existing daily logs', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        uterine_fluid: backup.tables.uterine_fluid.map((row, index) =>
          index === 0 ? { ...row, daily_log_id: 'missing-log' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('uterine_fluid');
    expect(result.error.field).toBe('daily_log_id');
    expect(result.error.message).toContain('references missing daily log');
  });

  it('rejects invalid uterine flush fields in v8 backups', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        uterine_flushes: backup.tables.uterine_flushes.map((row) => ({
          ...row,
          base_solution: ' ',
          total_volume_ml: 0,
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('uterine_flushes');
    expect(result.error.field).toBe('base_solution');
  });

  it('rejects invalid uterine flush product fields in v8 backups', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        uterine_flush_products: backup.tables.uterine_flush_products.map((row) => ({
          ...row,
          dose: '',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('uterine_flush_products');
    expect(result.error.field).toBe('dose');
  });

  it('requires v8 uterine flush and linked medication rows to reference existing daily logs', () => {
    const backup = cloneBackupFixture();
    const missingFlushDailyLog = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        uterine_flushes: backup.tables.uterine_flushes.map((row) => ({
          ...row,
          daily_log_id: 'missing-log',
        })),
      },
    });
    expect(missingFlushDailyLog.ok).toBe(false);
    if (missingFlushDailyLog.ok) {
      throw new Error('Expected validation failure');
    }
    expect(missingFlushDailyLog.error.table).toBe('uterine_flushes');
    expect(missingFlushDailyLog.error.field).toBe('daily_log_id');

    const missingMedicationDailyLog = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        medication_logs: backup.tables.medication_logs.map((row) => ({
          ...row,
          source_daily_log_id: 'missing-log',
        })),
      },
    });
    expect(missingMedicationDailyLog.ok).toBe(false);
    if (missingMedicationDailyLog.ok) {
      throw new Error('Expected validation failure');
    }
    expect(missingMedicationDailyLog.error.table).toBe('medication_logs');
    expect(missingMedicationDailyLog.error.field).toBe('source_daily_log_id');
  });

  it('requires v8 uterine flush product rows to reference existing flush rows', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        uterine_flush_products: backup.tables.uterine_flush_products.map((row) => ({
          ...row,
          uterine_flush_id: 'missing-flush',
        })),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('uterine_flush_products');
    expect(result.error.field).toBe('uterine_flush_id');
  });

  it('requires collection dose events to reference an existing breeding record when provided', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        collection_dose_events: backup.tables.collection_dose_events.map((row, index) =>
          index === 0 ? { ...row, breeding_record_id: 'missing-breed' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('collection_dose_events');
    expect(result.error.field).toBe('breeding_record_id');
    expect(result.error.message).toContain('references missing breeding record');
  });

  it('rejects collection allocations that exceed collection raw volume using semen-volume math', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        semen_collections: backup.tables.semen_collections.map((row, index) =>
          index === 0 ? { ...row, raw_volume_ml: 75 } : row,
        ),
        collection_dose_events: [
          ...backup.tables.collection_dose_events,
          {
            ...backup.tables.collection_dose_events[0]!,
            id: 'event-2',
            event_type: 'shipped',
            recipient: 'Farm ABC',
            dose_semen_volume_ml: 30,
            dose_extender_volume_ml: 10,
            dose_count: 1,
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('semen_collections');
    expect(result.error.field).toBe('raw_volume_ml');
    expect(result.error.message).toContain('linked allocated semen volume');
  });

  it('rejects v3 usedOnSite rows when dose_count is not 1', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        collection_dose_events: backup.tables.collection_dose_events.map((row, index) =>
          index === 0 ? { ...row, dose_count: 2 } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('collection_dose_events');
    expect(result.error.field).toBe('dose_count');
    expect(result.error.message).toContain('must be 1 for usedOnSite rows');
  });

  it('rejects v3 usedOnSite rows when extender volume is present', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        collection_dose_events: backup.tables.collection_dose_events.map((row, index) =>
          index === 0 ? { ...row, dose_extender_volume_ml: 1 } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('collection_dose_events');
    expect(result.error.field).toBe('dose_extender_volume_ml');
    expect(result.error.message).toContain('must be null for usedOnSite rows');
  });

  it('accepts v2 usedOnSite rows with legacy dose_count values for restore canonicalization', () => {
    const backup = createBackupFixtureV2();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        collection_dose_events: backup.tables.collection_dose_events.map((row, index) =>
          index === 0 ? { ...row, dose_count: 3 } : row,
        ),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('accepts preserved future-format foal igg entries that do not match the current schema', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        foals: backup.tables.foals.map((row, index) =>
          index === 0
            ? {
                ...row,
                igg_tests: JSON.stringify([
                  {
                    date: '2027-03-11',
                    valueMgDl: 900,
                    recordedAt: '2027-03-11T08:00:00.000Z',
                    lab: 'North Lab',
                  },
                  {
                    recordedAt: '2027-03-11T08:15:00.000Z',
                    panel: 'future-format',
                    externalId: 'lab-7',
                  },
                ]),
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(true);
  });

  it('still rejects invalid known foal milestone fields', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        foals: backup.tables.foals.map((row, index) =>
          index === 0
            ? {
                ...row,
                milestones: JSON.stringify({
                  stood: { done: 'yes', recordedAt: '2026-04-16T12:00:00.000Z' },
                  futureMilestone: { done: true, windowHours: 6 },
                }),
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('foals');
    expect(result.error.field).toBe('milestones');
    expect(result.error.message).toContain('milestone "stood" is invalid');
  });

  it('rejects malformed foal igg test JSON with row-specific detail', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        foals: backup.tables.foals.map((row, index) =>
          index === 0
            ? {
                ...row,
                igg_tests:
                  '[{"date":"bad-date","valueMgDl":900,"recordedAt":"2027-03-11T08:00:00.000Z"}]',
              }
            : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('foals');
    expect(result.error.rowIndex).toBe(0);
    expect(result.error.field).toBe('igg_tests');
    expect(result.error.message).toContain('contains a test with invalid date');
  });

  it('parses JSON text input and rejects newer schema versions', () => {
    const backup = cloneBackupFixture();
    const jsonText = JSON.stringify({
      ...backup,
      schemaVersion: 14,
    });

    const result = validateBackupJson(jsonText);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('unsupported_schema_version');
  });

  it('requires is_recipient on current mare rows', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        mares: backup.tables.mares.map(({ is_recipient: _isRecipient, ...row }) => row),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('mares');
    expect(result.error.field).toBe('is_recipient');
  });

  it('rejects frozen rows with invalid extender Other pairing', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        frozen_semen_batches: backup.tables.frozen_semen_batches.map((row, index) =>
          index === 0 ? { ...row, extender: 'Other', extender_other: null } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('frozen_semen_batches');
    expect(result.error.field).toBe('extender_other');
  });

  it('rejects frozen rows that reference missing collections', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        frozen_semen_batches: backup.tables.frozen_semen_batches.map((row, index) =>
          index === 0 ? { ...row, collection_id: 'missing-collection' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('frozen_semen_batches');
    expect(result.error.field).toBe('collection_id');
    expect(result.error.message).toContain('references missing semen collection');
  });

  it('rejects frozen rows that reference missing stallions', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        frozen_semen_batches: backup.tables.frozen_semen_batches.map((row, index) =>
          index === 0 ? { ...row, stallion_id: 'missing-stallion' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('frozen_semen_batches');
    expect(result.error.field).toBe('stallion_id');
    expect(result.error.message).toContain('references missing stallion');
  });

  it('rejects frozen rows whose collection belongs to a different stallion', () => {
    const backup = cloneBackupFixture();
    const result = validateBackup({
      ...backup,
      tables: {
        ...backup.tables,
        stallions: [
          ...backup.tables.stallions,
          {
            ...backup.tables.stallions[0]!,
            id: 'stallion-2',
            name: 'Bolt',
          },
        ],
        frozen_semen_batches: backup.tables.frozen_semen_batches.map((row, index) =>
          index === 0 ? { ...row, stallion_id: 'stallion-2' } : row,
        ),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.table).toBe('frozen_semen_batches');
    expect(result.error.field).toBe('collection_id');
    expect(result.error.message).toContain('belongs to a different stallion');
  });
});
