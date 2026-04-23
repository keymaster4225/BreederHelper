import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { getDb } from '@/storage/db';
import { DEFAULT_GESTATION_LENGTH_DAYS } from '@/models/types';
import { setOnboardingCompleteValue } from '@/utils/onboarding';

import { createSafetySnapshot } from './safetyBackups';
import { BACKUP_SCHEMA_VERSION_V4 } from './types';
import type {
  BackupCollectionDoseEventRowV2,
  BackupCollectionDoseEventRowV3,
  BackupBreedingRecordRow,
  BackupDailyLogRow,
  BackupEnvelope,
  BackupFoalingRecordRow,
  BackupFoalRow,
  BackupFrozenSemenBatchRow,
  BackupMareRowV1,
  BackupMareRowV2,
  BackupMedicationLogRow,
  BackupPregnancyCheckRow,
  BackupSemenCollectionRowV2,
  BackupSemenCollectionRowV3,
  BackupStallionRow,
  RestoreBackupResult,
} from './types';
import { validateBackup, validateBackupJson } from './validate';

type RestoreOptions = {
  readonly skipSafetySnapshot?: boolean;
  readonly onStepChange?: (stepLabel: string) => void;
};

const LEGACY_USED_ON_SITE_COLLAPSE_NOTE =
  'Legacy migration: collapsed used-on-site dose count to 1 during collection volume rework.';

type NormalizedBackupForRestore = {
  readonly settings: {
    readonly onboardingComplete: boolean;
  };
  readonly tables: {
    readonly mares: readonly (BackupMareRowV1 | BackupMareRowV2)[];
    readonly stallions: readonly BackupStallionRow[];
    readonly semen_collections: readonly BackupSemenCollectionRowV3[];
    readonly breeding_records: readonly BackupBreedingRecordRow[];
    readonly daily_logs: readonly BackupDailyLogRow[];
    readonly medication_logs: readonly BackupMedicationLogRow[];
    readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
    readonly foaling_records: readonly BackupFoalingRecordRow[];
    readonly foals: readonly BackupFoalRow[];
    readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
    readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
  };
};

export async function restoreBackup(
  candidate: string | BackupEnvelope | unknown,
  options: RestoreOptions = {},
): Promise<RestoreBackupResult> {
  options.onStepChange?.('Validating backup...');

  const validation =
    typeof candidate === 'string' ? validateBackupJson(candidate) : validateBackup(candidate);

  if (!validation.ok) {
    return {
      ok: false,
      errorMessage: validation.error.message,
    };
  }

  const backupForRestore = normalizeBackupForRestore(validation.backup);

  try {
    if (!options.skipSafetySnapshot) {
      options.onStepChange?.('Creating safety snapshot...');
      await createSafetySnapshot();
    }

    const db = await getDb();
    options.onStepChange?.('Restoring data...');
    await db.withTransactionAsync(async () => {
      await deleteManagedTables(db);
      await insertManagedTables(db, backupForRestore);
    });

    let warningMessage: string | undefined;

    try {
      options.onStepChange?.('Updating app settings...');
      await setOnboardingCompleteValue(backupForRestore.settings.onboardingComplete);
    } catch {
      warningMessage =
        'Breeding data was restored, but onboarding state could not be updated. Close and reopen the app if the home screen looks incorrect.';
    }

    emitDataInvalidation('all');

    return {
      ok: true,
      warningMessage,
      safetySnapshotCreated: !options.skipSafetySnapshot,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage:
        error instanceof Error ? error.message : 'Restore failed unexpectedly.',
    };
  }
}

async function deleteManagedTables(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await db.runAsync('DELETE FROM collection_dose_events;');
  await db.runAsync('DELETE FROM frozen_semen_batches;');
  await db.runAsync('DELETE FROM foals;');
  await db.runAsync('DELETE FROM pregnancy_checks;');
  await db.runAsync('DELETE FROM foaling_records;');
  await db.runAsync('DELETE FROM medication_logs;');
  await db.runAsync('DELETE FROM daily_logs;');
  await db.runAsync('DELETE FROM breeding_records;');
  await db.runAsync('DELETE FROM semen_collections;');
  await db.runAsync('DELETE FROM mares;');
  await db.runAsync('DELETE FROM stallions;');
}

async function insertManagedTables(
  db: Awaited<ReturnType<typeof getDb>>,
  backup: NormalizedBackupForRestore,
): Promise<void> {
  for (const row of backup.tables.mares) {
    await insertMare(db, row);
  }
  for (const row of backup.tables.stallions) {
    await insertStallion(db, row);
  }
  for (const row of backup.tables.semen_collections) {
    await insertSemenCollection(db, row);
  }
  for (const row of backup.tables.frozen_semen_batches) {
    await insertFrozenSemenBatch(db, row);
  }
  for (const row of backup.tables.breeding_records) {
    await insertBreedingRecord(db, row);
  }
  for (const row of backup.tables.daily_logs) {
    await insertDailyLog(db, row);
  }
  for (const row of backup.tables.medication_logs) {
    await insertMedicationLog(db, row);
  }
  for (const row of backup.tables.pregnancy_checks) {
    await insertPregnancyCheck(db, row);
  }
  for (const row of backup.tables.foaling_records) {
    await insertFoalingRecord(db, row);
  }
  for (const row of backup.tables.foals) {
    await insertFoal(db, row);
  }
  for (const row of backup.tables.collection_dose_events) {
    await insertCollectionDoseEvent(db, row);
  }
}

async function insertMare(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupMareRowV1 | BackupMareRowV2,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO mares (
      id,
      name,
      breed,
      gestation_length_days,
      date_of_birth,
      registration_number,
      notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.name,
      row.breed,
      'gestation_length_days' in row
        ? row.gestation_length_days
        : DEFAULT_GESTATION_LENGTH_DAYS,
      row.date_of_birth,
      row.registration_number,
      row.notes,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    ],
  );
}

async function insertStallion(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupStallionRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO stallions (
      id,
      name,
      breed,
      registration_number,
      sire,
      dam,
      notes,
      date_of_birth,
      av_temperature_f,
      av_type,
      av_liner_type,
      av_water_volume_ml,
      av_notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.name,
      row.breed,
      row.registration_number,
      row.sire,
      row.dam,
      row.notes,
      row.date_of_birth,
      row.av_temperature_f,
      row.av_type,
      row.av_liner_type,
      row.av_water_volume_ml,
      row.av_notes,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    ],
  );
}

async function insertSemenCollection(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupSemenCollectionRowV3,
): Promise<void> {
  const hasTargetValues =
    row.target_motile_sperm_millions_per_dose != null ||
    row.target_post_extension_concentration_millions_per_ml != null;
  const normalizedTargetMode =
    row.target_mode ?? (hasTargetValues ? 'progressive' : null);

  await db.runAsync(
    `
    INSERT INTO semen_collections (
      id,
      stallion_id,
      collection_date,
      raw_volume_ml,
      extender_type,
      concentration_millions_per_ml,
      progressive_motility_percent,
      target_mode,
      target_motile_sperm_millions_per_dose,
      target_post_extension_concentration_millions_per_ml,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.stallion_id,
      row.collection_date,
      row.raw_volume_ml,
      row.extender_type,
      row.concentration_millions_per_ml,
      row.progressive_motility_percent,
      normalizedTargetMode,
      row.target_motile_sperm_millions_per_dose,
      row.target_post_extension_concentration_millions_per_ml,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertFrozenSemenBatch(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupFrozenSemenBatchRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO frozen_semen_batches (
      id,
      stallion_id,
      collection_id,
      freeze_date,
      raw_semen_volume_used_ml,
      extender,
      extender_other,
      was_centrifuged,
      centrifuge_speed_rpm,
      centrifuge_duration_min,
      centrifuge_cushion_used,
      centrifuge_cushion_type,
      centrifuge_resuspension_vol_ml,
      centrifuge_notes,
      straw_count,
      straws_remaining,
      straw_volume_ml,
      concentration_millions_per_ml,
      straws_per_dose,
      straw_color,
      straw_color_other,
      straw_label,
      post_thaw_motility_percent,
      longevity_hours,
      storage_details,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.stallion_id,
      row.collection_id,
      row.freeze_date,
      row.raw_semen_volume_used_ml,
      row.extender,
      row.extender_other,
      row.was_centrifuged,
      row.centrifuge_speed_rpm,
      row.centrifuge_duration_min,
      row.centrifuge_cushion_used,
      row.centrifuge_cushion_type,
      row.centrifuge_resuspension_vol_ml,
      row.centrifuge_notes,
      row.straw_count,
      row.straws_remaining,
      row.straw_volume_ml,
      row.concentration_millions_per_ml,
      row.straws_per_dose,
      row.straw_color,
      row.straw_color_other,
      row.straw_label,
      row.post_thaw_motility_percent,
      row.longevity_hours,
      row.storage_details,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertBreedingRecord(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupBreedingRecordRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO breeding_records (
      id,
      mare_id,
      stallion_id,
      stallion_name,
      collection_id,
      date,
      method,
      notes,
      volume_ml,
      concentration_m_per_ml,
      motility_percent,
      number_of_straws,
      straw_volume_ml,
      straw_details,
      collection_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.mare_id,
      row.stallion_id,
      row.stallion_name,
      row.collection_id,
      row.date,
      row.method,
      row.notes,
      row.volume_ml,
      row.concentration_m_per_ml,
      row.motility_percent,
      row.number_of_straws,
      row.straw_volume_ml,
      row.straw_details,
      row.collection_date,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertDailyLog(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupDailyLogRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO daily_logs (
      id,
      mare_id,
      date,
      teasing_score,
      right_ovary,
      left_ovary,
      ovulation_detected,
      edema,
      uterine_tone,
      uterine_cysts,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.mare_id,
      row.date,
      row.teasing_score,
      row.right_ovary,
      row.left_ovary,
      row.ovulation_detected,
      row.edema,
      row.uterine_tone,
      row.uterine_cysts,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertMedicationLog(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupMedicationLogRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO medication_logs (
      id,
      mare_id,
      date,
      medication_name,
      dose,
      route,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.mare_id,
      row.date,
      row.medication_name,
      row.dose,
      row.route,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertPregnancyCheck(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupPregnancyCheckRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO pregnancy_checks (
      id,
      mare_id,
      breeding_record_id,
      date,
      result,
      heartbeat_detected,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.mare_id,
      row.breeding_record_id,
      row.date,
      row.result,
      row.heartbeat_detected,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertFoalingRecord(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupFoalingRecordRow,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO foaling_records (
      id,
      mare_id,
      breeding_record_id,
      date,
      outcome,
      foal_sex,
      complications,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.mare_id,
      row.breeding_record_id,
      row.date,
      row.outcome,
      row.foal_sex,
      row.complications,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertFoal(db: Awaited<ReturnType<typeof getDb>>, row: BackupFoalRow): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO foals (
      id,
      foaling_record_id,
      name,
      sex,
      color,
      markings,
      birth_weight_lbs,
      milestones,
      igg_tests,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.foaling_record_id,
      row.name,
      row.sex,
      row.color,
      row.markings,
      row.birth_weight_lbs,
      row.milestones,
      row.igg_tests,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

async function insertCollectionDoseEvent(
  db: Awaited<ReturnType<typeof getDb>>,
  row: BackupCollectionDoseEventRowV3,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO collection_dose_events (
      id,
      collection_id,
      event_type,
      recipient,
      recipient_phone,
      recipient_street,
      recipient_city,
      recipient_state,
      recipient_zip,
      carrier_service,
      container_type,
      tracking_number,
      breeding_record_id,
      dose_semen_volume_ml,
      dose_extender_volume_ml,
      dose_count,
      event_date,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      row.id,
      row.collection_id,
      row.event_type,
      row.recipient,
      row.recipient_phone ?? null,
      row.recipient_street ?? null,
      row.recipient_city ?? null,
      row.recipient_state ?? null,
      row.recipient_zip ?? null,
      row.carrier_service ?? null,
      row.container_type ?? null,
      row.tracking_number ?? null,
      row.breeding_record_id ?? null,
      row.dose_semen_volume_ml,
      row.dose_extender_volume_ml,
      row.dose_count,
      row.event_date,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );
}

function normalizeBackupForRestore(backup: BackupEnvelope): NormalizedBackupForRestore {
  if (backup.schemaVersion === BACKUP_SCHEMA_VERSION_V4) {
    return {
      settings: backup.settings,
      tables: {
        ...backup.tables,
        frozen_semen_batches: backup.tables.frozen_semen_batches ?? [],
      },
    };
  }

  return {
    settings: backup.settings,
    tables: {
      mares: backup.tables.mares,
      stallions: backup.tables.stallions,
      semen_collections: backup.tables.semen_collections.map((row) =>
        normalizeLegacySemenCollectionRow(row as BackupSemenCollectionRowV2),
      ),
      breeding_records: backup.tables.breeding_records,
      daily_logs: backup.tables.daily_logs,
      medication_logs: backup.tables.medication_logs,
      pregnancy_checks: backup.tables.pregnancy_checks,
      foaling_records: backup.tables.foaling_records,
      foals: backup.tables.foals,
      collection_dose_events: backup.tables.collection_dose_events.map((row) =>
        normalizeLegacyCollectionDoseEventRow(row as BackupCollectionDoseEventRowV2),
      ),
      frozen_semen_batches: backup.tables.frozen_semen_batches ?? [],
    },
  };
}

function normalizeLegacySemenCollectionRow(
  row: BackupSemenCollectionRowV2,
): BackupSemenCollectionRowV3 {
  return {
    id: row.id,
    stallion_id: row.stallion_id,
    collection_date: row.collection_date,
    raw_volume_ml: row.raw_volume_ml,
    extender_type: row.extender_type ?? null,
    concentration_millions_per_ml: row.concentration_millions_per_ml,
    progressive_motility_percent: row.progressive_motility_percent,
    target_mode: null,
    target_motile_sperm_millions_per_dose: null,
    target_post_extension_concentration_millions_per_ml: null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeLegacyCollectionDoseEventRow(
  row: BackupCollectionDoseEventRowV2,
): BackupCollectionDoseEventRowV3 {
  const shouldCollapseUsedOnSite = row.event_type === 'usedOnSite';
  const shouldAppendLegacyNote = shouldCollapseUsedOnSite && (row.dose_count ?? 0) > 1;

  return {
    id: row.id,
    collection_id: row.collection_id,
    event_type: row.event_type,
    recipient: row.recipient,
    recipient_phone: row.recipient_phone ?? null,
    recipient_street: row.recipient_street ?? null,
    recipient_city: row.recipient_city ?? null,
    recipient_state: row.recipient_state ?? null,
    recipient_zip: row.recipient_zip ?? null,
    carrier_service: row.carrier_service ?? null,
    container_type: row.container_type ?? null,
    tracking_number: row.tracking_number ?? null,
    breeding_record_id: row.breeding_record_id ?? null,
    dose_semen_volume_ml: null,
    dose_extender_volume_ml: null,
    dose_count: shouldCollapseUsedOnSite ? 1 : row.dose_count,
    event_date: row.event_date,
    notes: shouldAppendLegacyNote
      ? appendLegacyUsedOnSiteCollapseNote(row.notes)
      : row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function appendLegacyUsedOnSiteCollapseNote(existing: string | null): string {
  const trimmed = existing?.trim() ?? '';
  if (!trimmed) {
    return LEGACY_USED_ON_SITE_COLLAPSE_NOTE;
  }
  if (trimmed.includes(LEGACY_USED_ON_SITE_COLLAPSE_NOTE)) {
    return trimmed;
  }
  return `${trimmed}\n${LEGACY_USED_ON_SITE_COLLAPSE_NOTE}`;
}
