import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/storage/dataInvalidation', () => ({
  emitDataInvalidation: vi.fn(),
}));

vi.mock('@/utils/onboarding', () => ({
  setOnboardingCompleteValue: vi.fn(),
}));

vi.mock('./safetyBackups', () => ({
  createSafetySnapshot: vi.fn(),
}));

vi.mock('./validate', () => ({
  validateBackup: vi.fn(),
  validateBackupJson: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { setOnboardingCompleteValue } from '@/utils/onboarding';

import { createSafetySnapshot } from './safetyBackups';
import { cloneBackupFixture, createBackupFixtureV2 } from './testFixtures';
import { restoreBackup } from './restore';
import { validateBackup, validateBackupJson } from './validate';
import type { BackupEnvelope } from './types';

describe('restoreBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes and inserts tables in order, then updates onboarding and emits one invalidation', async () => {
    const backup = cloneBackupFixture();
    const steps: string[] = [];
    const sqlCalls: string[] = [];
    const db = {
      runAsync: vi.fn(async (sql: string) => {
        sqlCalls.push(sql.replace(/\s+/g, ' ').trim());
      }),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackupJson).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 3,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(createSafetySnapshot).mockResolvedValue({
      fileName: 'snapshot.json',
      fileUri: 'file:///snapshot.json',
      createdAt: backup.createdAt,
      mareCount: 1,
      schemaVersion: 1,
    });

    const result = await restoreBackup(JSON.stringify(backup), {
      onStepChange: (step) => steps.push(step),
    });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: true,
    });
    expect(steps).toEqual([
      'Validating backup...',
      'Creating safety snapshot...',
      'Restoring data...',
      'Updating app settings...',
    ]);
    expect(sqlCalls.slice(0, 10)).toEqual([
      'DELETE FROM collection_dose_events;',
      'DELETE FROM foals;',
      'DELETE FROM pregnancy_checks;',
      'DELETE FROM foaling_records;',
      'DELETE FROM medication_logs;',
      'DELETE FROM daily_logs;',
      'DELETE FROM breeding_records;',
      'DELETE FROM semen_collections;',
      'DELETE FROM mares;',
      'DELETE FROM stallions;',
    ]);
    expect(sqlCalls[10]).toContain('INSERT INTO mares');
    const mareInsertCall = db.runAsync.mock.calls[10] as unknown[] | undefined;
    const mareInsertParams = (mareInsertCall?.[1] ?? []) as unknown[];
    expect(mareInsertParams[3]).toBe(345);
    expect(sqlCalls[11]).toContain('INSERT INTO stallions');
    expect(sqlCalls[12]).toContain('INSERT INTO semen_collections');
    const semenCollectionInsertCall = db.runAsync.mock.calls[12] as unknown[] | undefined;
    const semenCollectionInsertParams = (semenCollectionInsertCall?.[1] ?? []) as unknown[];
    expect(semenCollectionInsertParams[7]).toBe('progressive');
    expect(sqlCalls[13]).toContain('INSERT INTO breeding_records');
    const breedingInsertCall = db.runAsync.mock.calls[13] as unknown[] | undefined;
    const breedingInsertParams = (breedingInsertCall?.[1] ?? []) as unknown[];
    expect(breedingInsertParams[12]).toBe(0.5);
    expect(sqlCalls[14]).toContain('INSERT INTO daily_logs');
    expect(sqlCalls[15]).toContain('INSERT INTO medication_logs');
    expect(sqlCalls[16]).toContain('INSERT INTO pregnancy_checks');
    expect(sqlCalls[17]).toContain('INSERT INTO foaling_records');
    expect(sqlCalls[18]).toContain('INSERT INTO foals');
    expect(sqlCalls[19]).toContain('INSERT INTO collection_dose_events');
    const collectionInsertCall = db.runAsync.mock.calls[19] as unknown[] | undefined;
    const collectionInsertParams = (collectionInsertCall?.[1] ?? []) as unknown[];
    expect(collectionInsertParams[4]).toBeNull();
    expect(collectionInsertParams[12]).toBe('breed-1');
    expect(collectionInsertParams[13]).toBe(50);
    expect(collectionInsertParams[14]).toBeNull();
    expect(setOnboardingCompleteValue).toHaveBeenCalledWith(true);
    expect(emitDataInvalidation).toHaveBeenCalledTimes(1);
    expect(emitDataInvalidation).toHaveBeenCalledWith('all');
  });

  it('skips safety snapshot creation when restoring from a safety snapshot', async () => {
    const backup = cloneBackupFixture();
    const db = {
      runAsync: vi.fn(async () => undefined),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 3,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });
    expect(createSafetySnapshot).not.toHaveBeenCalled();
  });

  it('returns a warning when onboarding persistence fails after the transaction commits', async () => {
    const backup = cloneBackupFixture();
    const db = {
      runAsync: vi.fn(async () => undefined),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 3,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockRejectedValue(new Error('storage unavailable'));

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected restore success');
    }
    expect(result.warningMessage).toContain('onboarding state could not be updated');
    expect(emitDataInvalidation).toHaveBeenCalledWith('all');
  });

  it('returns a failure and does not emit invalidation when the transaction fails', async () => {
    const backup = cloneBackupFixture();
    const db = {
      runAsync: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO foaling_records')) {
          throw new Error('insert failure');
        }
      }),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 3,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: false,
      errorMessage: 'insert failure',
    });
    expect(setOnboardingCompleteValue).not.toHaveBeenCalled();
    expect(emitDataInvalidation).not.toHaveBeenCalled();
  });

  it('returns validation errors without touching storage', async () => {
    vi.mocked(validateBackupJson).mockReturnValue({
      ok: false,
      error: {
        code: 'invalid_json',
        message: 'Backup file is not valid JSON.',
      },
    });

    const result = await restoreBackup('{bad json');

    expect(result).toEqual({
      ok: false,
      errorMessage: 'Backup file is not valid JSON.',
    });
    expect(getDb).not.toHaveBeenCalled();
    expect(createSafetySnapshot).not.toHaveBeenCalled();
  });

  it('defaults missing mare gestation length when restoring a v1 backup', async () => {
    const backup = createBackupFixtureV2();
    const legacyBackup = {
      ...backup,
      schemaVersion: 1 as const,
      tables: {
        ...backup.tables,
        mares: backup.tables.mares.map(({ gestation_length_days: _gestationLengthDays, ...row }) => row),
      },
    } as BackupEnvelope;
    const db = {
      runAsync: vi.fn(async () => undefined),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup: legacyBackup,
      preview: {
        createdAt: legacyBackup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 1,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(legacyBackup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });
    const runCalls = db.runAsync.mock.calls as unknown as Array<[string, unknown[]?]>;
    const mareInsertCall = runCalls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO mares'),
    );
    expect((mareInsertCall?.[1] as unknown[] | undefined)?.[3]).toBe(340);
  });

  it('defaults missing collection dose-event backup fields when restoring an older v2 backup', async () => {
    const backup = createBackupFixtureV2();
    const legacyBackup = {
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
          return legacyRow as typeof row;
        }),
      },
    };
    const db = {
      runAsync: vi.fn(async () => undefined),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup: legacyBackup,
      preview: {
        createdAt: legacyBackup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 2,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(legacyBackup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });
    const runCalls = db.runAsync.mock.calls as unknown as Array<[string, unknown[]?]>;
    const collectionInsertCall = runCalls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO collection_dose_events'),
    );
    expect((collectionInsertCall?.[1] as unknown[] | undefined)?.slice(4, 13)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect((collectionInsertCall?.[1] as unknown[] | undefined)?.[13]).toBeNull();
    expect((collectionInsertCall?.[1] as unknown[] | undefined)?.[14]).toBeNull();
    expect((collectionInsertCall?.[1] as unknown[] | undefined)?.[15]).toBe(1);
  });

  it('canonicalizes v2 usedOnSite rows with dose_count > 1 and appends the collapse note', async () => {
    const backup = createBackupFixtureV2();
    const legacyBackup = {
      ...backup,
      tables: {
        ...backup.tables,
        collection_dose_events: backup.tables.collection_dose_events.map((row, index) =>
          index === 0 ? { ...row, dose_count: 3, notes: 'Legacy note' } : row,
        ),
      },
    };
    const db = {
      runAsync: vi.fn(async () => undefined),
      withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
    };

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup: legacyBackup,
      preview: {
        createdAt: legacyBackup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 2,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(legacyBackup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });

    const runCalls = db.runAsync.mock.calls as unknown as Array<[string, unknown[]?]>;
    const collectionInsertCall = runCalls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO collection_dose_events'),
    );
    const collectionInsertParams = (collectionInsertCall?.[1] as unknown[] | undefined) ?? [];
    expect(collectionInsertParams[13]).toBeNull();
    expect(collectionInsertParams[14]).toBeNull();
    expect(collectionInsertParams[15]).toBe(1);
    expect(String(collectionInsertParams[17] ?? '')).toContain(
      'Legacy migration: collapsed used-on-site dose count to 1 during collection volume rework.',
    );
  });
});
