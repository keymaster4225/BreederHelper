import { getDb } from '@/storage/db';
import { getOnboardingComplete } from '@/utils/onboarding';

import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  type BackupBreedingRecordRow,
  type BackupCollectionDoseEventRowV3,
  type BackupDailyLogRow,
  type BackupEnvelopeV7,
  type BackupFoalingRecordRow,
  type BackupFoalRow,
  type BackupFrozenSemenBatchRow,
  type BackupMareRow,
  type BackupMedicationLogRow,
  type BackupPregnancyCheckRow,
  type BackupSemenCollectionRowV3,
  type BackupStallionRow,
  type BackupUterineFluidRow,
} from './types';

type AppJsonShape = {
  expo?: {
    version?: string;
  };
};

const appJson = require('../../../app.json') as AppJsonShape;

function getAppVersion(): string {
  return appJson.expo?.version ?? 'unknown';
}

export async function serializeBackup(): Promise<BackupEnvelopeV7> {
  const db = await getDb();

  const [
    mares,
    stallions,
    dailyLogs,
    uterineFluid,
    breedingRecords,
    pregnancyChecks,
    foalingRecords,
    foals,
    medicationLogs,
    semenCollections,
    collectionDoseEvents,
    frozenSemenBatches,
    onboardingComplete,
  ] = await Promise.all([
    db.getAllAsync<BackupMareRow>(
      `
      SELECT
        id,
        name,
        breed,
        gestation_length_days,
        date_of_birth,
        registration_number,
        is_recipient,
        notes,
        created_at,
        updated_at,
        deleted_at
      FROM mares
      ORDER BY name COLLATE NOCASE ASC, id ASC;
      `,
    ),
    db.getAllAsync<BackupStallionRow>(
      `
      SELECT
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
      FROM stallions
      ORDER BY name COLLATE NOCASE ASC, id ASC;
      `,
    ),
    db.getAllAsync<BackupDailyLogRow>(
      `
      SELECT
        id,
        mare_id,
        date,
        time,
        teasing_score,
        right_ovary,
        left_ovary,
        ovulation_detected,
        edema,
        uterine_tone,
        uterine_cysts,
        right_ovary_ovulation,
        right_ovary_follicle_state,
        right_ovary_follicle_measurements_mm,
        right_ovary_consistency,
        right_ovary_structures,
        left_ovary_ovulation,
        left_ovary_follicle_state,
        left_ovary_follicle_measurements_mm,
        left_ovary_consistency,
        left_ovary_structures,
        uterine_tone_category,
        cervical_firmness,
        discharge_observed,
        discharge_notes,
        notes,
        created_at,
        updated_at
      FROM daily_logs
      ORDER BY
        date DESC,
        CASE WHEN time IS NULL THEN 1 ELSE 0 END ASC,
        time DESC,
        created_at DESC,
        id DESC;
      `,
    ),
    db.getAllAsync<BackupUterineFluidRow>(
      `
      SELECT
        id,
        daily_log_id,
        depth_mm,
        location,
        created_at,
        updated_at
      FROM uterine_fluid
      ORDER BY created_at DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupBreedingRecordRow>(
      `
      SELECT
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
      FROM breeding_records
      ORDER BY date DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupPregnancyCheckRow>(
      `
      SELECT
        id,
        mare_id,
        breeding_record_id,
        date,
        result,
        heartbeat_detected,
        notes,
        created_at,
        updated_at
      FROM pregnancy_checks
      ORDER BY date DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupFoalingRecordRow>(
      `
      SELECT
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
      FROM foaling_records
      ORDER BY date DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupFoalRow>(
      `
      SELECT
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
      FROM foals
      ORDER BY foaling_record_id ASC, id ASC;
      `,
    ),
    db.getAllAsync<BackupMedicationLogRow>(
      `
      SELECT
        id,
        mare_id,
        date,
        medication_name,
        dose,
        route,
        notes,
        created_at,
        updated_at
      FROM medication_logs
      ORDER BY date DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupSemenCollectionRowV3>(
      `
      SELECT
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
      FROM semen_collections
      ORDER BY collection_date DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupCollectionDoseEventRowV3>(
      `
      SELECT
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
      FROM collection_dose_events
      ORDER BY created_at DESC, id ASC;
      `,
    ),
    db.getAllAsync<BackupFrozenSemenBatchRow>(
      `
      SELECT
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
      FROM frozen_semen_batches
      ORDER BY freeze_date DESC, id ASC;
      `,
    ),
    getOnboardingComplete(),
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    createdAt: new Date().toISOString(),
    app: {
      name: 'BreedWise',
      version: getAppVersion(),
    },
    settings: {
      onboardingComplete,
    },
    tables: {
      mares,
      stallions,
      daily_logs: dailyLogs,
      uterine_fluid: uterineFluid,
      breeding_records: breedingRecords,
      pregnancy_checks: pregnancyChecks,
      foaling_records: foalingRecords,
      foals,
      medication_logs: medicationLogs,
      semen_collections: semenCollections,
      collection_dose_events: collectionDoseEvents,
      frozen_semen_batches: frozenSemenBatches,
    },
  };
}
