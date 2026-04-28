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

vi.mock('@/utils/clockPreferences', () => ({
  normalizeClockPreference: (value: unknown) =>
    value === 'system' || value === '12h' || value === '24h' ? value : 'system',
  setClockPreference: vi.fn(),
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
import { setClockPreference } from '@/utils/clockPreferences';
import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
} from '@/storage/horseTransfer';
import {
  createRepoDb,
  expectInsertForTable,
  expectManagedTableDeleteOrder,
  type RepoDbHarness,
} from '@/test/repoDb';

import { createSafetySnapshot } from './safetyBackups';
import {
  cloneBackupFixture,
  createBackupFixtureV2,
  createBackupFixtureV3,
  createBackupFixtureV4,
  createBackupFixtureV5,
  createBackupFixtureV6,
} from './testFixtures';
import { restoreBackup } from './restore';
import { validateBackup, validateBackupJson } from './validate';
import type { BackupEnvelope } from './types';

const MANAGED_TABLE_DELETE_ORDER = [
  'collection_dose_events',
  'frozen_semen_batches',
  'foals',
  'pregnancy_checks',
  'uterine_fluid',
  'medication_logs',
  'uterine_flush_products',
  'uterine_flushes',
  'foaling_records',
  'daily_logs',
  'breeding_records',
  'semen_collections',
  'tasks',
  'mares',
  'stallions',
] as const;

function createRestoreDb(onRun?: (call: RepoDbHarness['runCalls'][number]) => void): RepoDbHarness {
  return createRepoDb({ onRun });
}

describe('restoreBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes and inserts tables in order, then updates onboarding and emits one invalidation', async () => {
    const backup = cloneBackupFixture();
    const steps: string[] = [];
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 11,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(createSafetySnapshot).mockResolvedValue({
      fileName: 'snapshot.json',
      fileUri: 'file:///snapshot.json',
      createdAt: backup.createdAt,
        mareCount: 1,
        schemaVersion: 11,
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
    expectManagedTableDeleteOrder(db, MANAGED_TABLE_DELETE_ORDER);

    const mareInsertParams = expectInsertForTable(db, 'mares').params;
    expect(mareInsertParams.gestation_length_days).toBe(345);
    expect(mareInsertParams.is_recipient).toBe(1);
    expectInsertForTable(db, 'stallions');

    const semenCollectionInsertParams = expectInsertForTable(db, 'semen_collections').params;
    expect(semenCollectionInsertParams.target_mode).toBe('progressive');

    const frozenBatchInsertParams = expectInsertForTable(db, 'frozen_semen_batches').params;
    expect(frozenBatchInsertParams.stallion_id).toBe('stallion-1');
    expect(frozenBatchInsertParams.collection_id).toBe('collection-1');
    expect(frozenBatchInsertParams.extender).toBe('BotuCrio');

    const breedingInsertParams = expectInsertForTable(db, 'breeding_records').params;
    expect(breedingInsertParams.time).toBe('09:30');
    expect(breedingInsertParams.straw_volume_ml).toBe(0.5);

    const dailyLogInsertParams = expectInsertForTable(db, 'daily_logs').params;
    expect(dailyLogInsertParams.time).toBe('08:30');
    expectInsertForTable(db, 'uterine_fluid');
    expectInsertForTable(db, 'uterine_flushes');
    expectInsertForTable(db, 'uterine_flush_products');

    const medicationInsertParams = expectInsertForTable(db, 'medication_logs').params;
    expect(medicationInsertParams.source_daily_log_id).toBeNull();
    const taskInsertParams = expectInsertForTable(db, 'tasks').params;
    expect(taskInsertParams.mare_id).toBe('mare-1');
    expect(taskInsertParams.status).toBe('open');
    expect(taskInsertParams.source_reason).toBe('manualFollowUp');
    expectInsertForTable(db, 'pregnancy_checks');
    expectInsertForTable(db, 'foaling_records');
    expectInsertForTable(db, 'foals');

    const collectionInsertParams = expectInsertForTable(db, 'collection_dose_events').params;
    expect(collectionInsertParams.recipient_phone).toBeNull();
    expect(collectionInsertParams.breeding_record_id).toBe('breed-1');
    expect(collectionInsertParams.dose_semen_volume_ml).toBe(50);
    expect(collectionInsertParams.dose_extender_volume_ml).toBeNull();
    expect(setOnboardingCompleteValue).toHaveBeenCalledWith(true);
    expect(setClockPreference).toHaveBeenCalledWith('system');
    expect(emitDataInvalidation).toHaveBeenCalledTimes(1);
    expect(emitDataInvalidation).toHaveBeenCalledWith('all');
  });

  it('restores the clock preference from current backups', async () => {
    const backup = {
      ...cloneBackupFixture(),
      settings: {
        onboardingComplete: true,
        clockPreference: '24h' as const,
      },
    };
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 9,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result.ok).toBe(true);
    expect(setClockPreference).toHaveBeenCalledWith('24h');
  });

  it('skips safety snapshot creation when restoring from a safety snapshot', async () => {
    const backup = cloneBackupFixture();
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 7,
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

  it('rejects horse-transfer JSON strings before backup validation', async () => {
    const result = await restoreBackup(
      JSON.stringify({
        artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
        transferVersion: 1,
      }),
    );

    expect(result).toEqual({
      ok: false,
      errorMessage: HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
    });
    expect(validateBackup).not.toHaveBeenCalled();
    expect(validateBackupJson).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
    expect(createSafetySnapshot).not.toHaveBeenCalled();
  });

  it('rejects horse-transfer object candidates before backup validation', async () => {
    const result = await restoreBackup({
      artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
      transferVersion: 1,
    });

    expect(result).toEqual({
      ok: false,
      errorMessage: HORSE_TRANSFER_RESTORE_ERROR_MESSAGE,
    });
    expect(validateBackup).not.toHaveBeenCalled();
    expect(validateBackupJson).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
    expect(createSafetySnapshot).not.toHaveBeenCalled();
  });

  it('canonicalizes missing v3 collection target mode to progressive when target values exist', async () => {
    const backup = cloneBackupFixture();
    const legacyCollectionRow = { ...backup.tables.semen_collections[0] };
    delete (legacyCollectionRow as { target_mode?: unknown }).target_mode;
    const legacyBackup = {
      ...backup,
      tables: {
        ...backup.tables,
        semen_collections: [legacyCollectionRow],
      },
    };
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup: legacyBackup,
      preview: {
        createdAt: legacyBackup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 7,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(legacyBackup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });
    expect(expectInsertForTable(db, 'semen_collections').params.target_mode).toBe(
      'progressive',
    );
  });

  it('returns a warning when onboarding persistence fails after the transaction commits', async () => {
    const backup = cloneBackupFixture();
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 7,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockRejectedValue(new Error('storage unavailable'));

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected restore success');
    }
    expect(result.warningMessage).toContain('app settings could not be updated');
    expect(emitDataInvalidation).toHaveBeenCalledWith('all');
  });

  it('returns a failure and does not emit invalidation when the transaction fails', async () => {
    const backup = cloneBackupFixture();
    const db = createRestoreDb((call) => {
      if (call.normalizedSql.startsWith('insert into foaling_records')) {
        throw new Error('insert failure');
      }
    });

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 7,
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
    const db = createRestoreDb();

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
    const mareInsertParams = expectInsertForTable(db, 'mares').params;
    expect(mareInsertParams.gestation_length_days).toBe(340);
    expect(mareInsertParams.is_recipient).toBe(0);
  });

  it('defaults missing mare is_recipient to 0 when restoring a v5 backup', async () => {
    const backup = createBackupFixtureV5();
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 5,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });
    expect(expectInsertForTable(db, 'mares').params.is_recipient).toBe(0);
  });

  it('defaults daily_log time to null when restoring a v6 backup', async () => {
    const backup = createBackupFixtureV6();
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 6,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });
    expect(expectInsertForTable(db, 'daily_logs').params.time).toBeNull();
  });

  it('normalizes frozen semen batches to empty when restoring a v4 backup', async () => {
    const backup = createBackupFixtureV4();
    const db = createRestoreDb();

    vi.mocked(validateBackup).mockReturnValue({
      ok: true,
      backup,
      preview: {
        createdAt: backup.createdAt,
        mareCount: 1,
        stallionCount: 1,
        dailyLogCount: 1,
        onboardingComplete: true,
        schemaVersion: 4,
      },
    });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

    const result = await restoreBackup(backup, { skipSafetySnapshot: true });

    expect(result).toEqual({
      ok: true,
      safetySnapshotCreated: false,
    });

    expect(db.findRunCall({ operation: 'insert', table: 'frozen_semen_batches' })).toBeUndefined();
    expectInsertForTable(db, 'uterine_fluid');
  });

  it('normalizes tasks to empty when restoring v1-v10 backups into the v11 schema', async () => {
    const currentBackup = cloneBackupFixture();
    const tablesWithoutTasks = { ...currentBackup.tables };
    delete (tablesWithoutTasks as { tasks?: unknown }).tasks;
    const legacyBackups: BackupEnvelope[] = [
      { ...createBackupFixtureV2(), schemaVersion: 1 } as BackupEnvelope,
      createBackupFixtureV2() as BackupEnvelope,
      createBackupFixtureV3() as BackupEnvelope,
      createBackupFixtureV4() as BackupEnvelope,
      createBackupFixtureV5() as BackupEnvelope,
      createBackupFixtureV6() as BackupEnvelope,
      { ...currentBackup, schemaVersion: 7, tables: tablesWithoutTasks } as BackupEnvelope,
      { ...currentBackup, schemaVersion: 8, tables: tablesWithoutTasks } as BackupEnvelope,
      { ...currentBackup, schemaVersion: 9, tables: tablesWithoutTasks } as BackupEnvelope,
      { ...currentBackup, schemaVersion: 10, tables: tablesWithoutTasks } as BackupEnvelope,
    ];

    for (const backup of legacyBackups) {
      const db = createRestoreDb();

      vi.mocked(validateBackup).mockReturnValue({
        ok: true,
        backup,
        preview: {
          createdAt: backup.createdAt,
          mareCount: 1,
          stallionCount: 1,
          dailyLogCount: 1,
          onboardingComplete: true,
          schemaVersion: backup.schemaVersion,
        },
      });
      vi.mocked(getDb).mockResolvedValue(db as never);
      vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

      const result = await restoreBackup(backup, { skipSafetySnapshot: true });

      expect(result).toEqual({
        ok: true,
        safetySnapshotCreated: false,
      });
      expect(db.findRunCall({ operation: 'insert', table: 'tasks' })).toBeUndefined();
    }
  });

  it('defaults new daily-log fields for v1-v3 backups and skips uterine fluid rows', async () => {
    const legacyBackups: BackupEnvelope[] = [
      {
        ...createBackupFixtureV2(),
        schemaVersion: 1,
      } as BackupEnvelope,
      createBackupFixtureV2() as BackupEnvelope,
      createBackupFixtureV3() as BackupEnvelope,
    ];

    for (const legacyBackup of legacyBackups) {
      const db = createRestoreDb();

      vi.mocked(validateBackup).mockReturnValue({
        ok: true,
        backup: legacyBackup,
        preview: {
          createdAt: legacyBackup.createdAt,
          mareCount: 1,
          stallionCount: 1,
          dailyLogCount: 1,
          onboardingComplete: true,
          schemaVersion: legacyBackup.schemaVersion,
        },
      });
      vi.mocked(getDb).mockResolvedValue(db as never);
      vi.mocked(setOnboardingCompleteValue).mockResolvedValue(undefined);

      const result = await restoreBackup(legacyBackup, { skipSafetySnapshot: true });

      expect(result).toEqual({
        ok: true,
        safetySnapshotCreated: false,
      });

      const dailyLogInsertParams = expectInsertForTable(db, 'daily_logs').params;

      expect(dailyLogInsertParams.time).toBeNull();
      expect(dailyLogInsertParams.right_ovary_ovulation).toBeNull();
      expect(dailyLogInsertParams.right_ovary_follicle_state).toBeNull();
      expect(dailyLogInsertParams.right_ovary_follicle_measurements_mm).toBe('[]');
      expect(dailyLogInsertParams.right_ovary_consistency).toBeNull();
      expect(dailyLogInsertParams.right_ovary_structures).toBe('[]');
      expect(dailyLogInsertParams.left_ovary_ovulation).toBeNull();
      expect(dailyLogInsertParams.left_ovary_follicle_state).toBeNull();
      expect(dailyLogInsertParams.left_ovary_follicle_measurements_mm).toBe('[]');
      expect(dailyLogInsertParams.left_ovary_consistency).toBeNull();
      expect(dailyLogInsertParams.left_ovary_structures).toBe('[]');
      expect(dailyLogInsertParams.uterine_tone_category).toBeNull();
      expect(dailyLogInsertParams.cervical_firmness).toBeNull();
      expect(dailyLogInsertParams.discharge_observed).toBeNull();
      expect(dailyLogInsertParams.discharge_notes).toBeNull();

      expect(db.findRunCall({ operation: 'insert', table: 'uterine_fluid' })).toBeUndefined();
    }
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
    const db = createRestoreDb();

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
    const collectionInsertParams = expectInsertForTable(db, 'collection_dose_events').params;
    expect(collectionInsertParams.recipient_phone).toBeNull();
    expect(collectionInsertParams.recipient_street).toBeNull();
    expect(collectionInsertParams.recipient_city).toBeNull();
    expect(collectionInsertParams.recipient_state).toBeNull();
    expect(collectionInsertParams.recipient_zip).toBeNull();
    expect(collectionInsertParams.carrier_service).toBeNull();
    expect(collectionInsertParams.container_type).toBeNull();
    expect(collectionInsertParams.tracking_number).toBeNull();
    expect(collectionInsertParams.breeding_record_id).toBeNull();
    expect(collectionInsertParams.dose_semen_volume_ml).toBeNull();
    expect(collectionInsertParams.dose_extender_volume_ml).toBeNull();
    expect(collectionInsertParams.dose_count).toBe(1);
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
    const db = createRestoreDb();

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

    const collectionInsertParams = expectInsertForTable(db, 'collection_dose_events').params;
    expect(collectionInsertParams.dose_semen_volume_ml).toBeNull();
    expect(collectionInsertParams.dose_extender_volume_ml).toBeNull();
    expect(collectionInsertParams.dose_count).toBe(1);
    expect(String(collectionInsertParams.notes ?? '')).toContain(
      'Legacy migration: collapsed used-on-site dose count to 1 during collection volume rework.',
    );
  });
});
