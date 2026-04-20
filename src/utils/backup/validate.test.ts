import { describe, expect, it } from 'vitest';

import { cloneBackupFixture } from './testFixtures';
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

  it('rejects duplicate daily_logs by mare and date before restore time', () => {
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
      schemaVersion: 2,
    });

    const result = validateBackupJson(jsonText);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }

    expect(result.error.code).toBe('unsupported_schema_version');
  });
});
