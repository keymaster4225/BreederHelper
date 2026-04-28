import { getDb } from '@/storage/db';
import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  type BackupBreedingRecordRow,
  type BackupCollectionDoseEventRowV3,
  type BackupDailyLogRow,
  type BackupFoalingRecordRow,
  type BackupFoalRow,
  type BackupFrozenSemenBatchRow,
  type BackupMareRow,
  type BackupMedicationLogRow,
  type BackupPregnancyCheckRow,
  type BackupSemenCollectionRowV3,
  type BackupStallionRow,
  type BackupTaskRow,
  type BackupUterineFluidRow,
  type BackupUterineFlushProductRow,
  type BackupUterineFlushRow,
} from '@/storage/backup/types';

import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_VERSION,
  type HorseTransferEnvelopeV1,
} from './types';

type AppJsonShape = {
  expo?: {
    version?: string;
  };
};

type HorseTransferDb = {
  getFirstAsync<T>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  withTransactionAsync(callback: () => Promise<void>): Promise<void>;
};

const appJson = require('../../../app.json') as AppJsonShape;

export class MareNotFoundError extends Error {
  constructor(mareId: string) {
    super(`Mare ${mareId} was not found.`);
    this.name = 'MareNotFoundError';
  }
}

export async function exportMareTransfer(mareId: string): Promise<HorseTransferEnvelopeV1> {
  const db = (await getDb()) as unknown as HorseTransferDb;
  let envelope: HorseTransferEnvelopeV1 | null = null;

  await db.withTransactionAsync(async () => {
    const mare = await db.getFirstAsync<BackupMareRow>(
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
      WHERE id = ? AND deleted_at IS NULL;
      `,
      [mareId],
    );

    if (!mare) {
      throw new MareNotFoundError(mareId);
    }

    const [
      tasks,
      breedingRecords,
      dailyLogs,
      uterineFluid,
      uterineFlushes,
      uterineFlushProducts,
      medicationLogs,
      pregnancyChecks,
      foalingRecords,
      foals,
      contextStallions,
      semenCollections,
    ] = await Promise.all([
      db.getAllAsync<BackupTaskRow>(
        `
        SELECT
          id,
          mare_id,
          task_type,
          title,
          due_date,
          due_time,
          notes,
          status,
          completed_at,
          completed_record_type,
          completed_record_id,
          source_type,
          source_record_id,
          source_reason,
          created_at,
          updated_at
        FROM tasks
        WHERE mare_id = ?
        ORDER BY created_at ASC, id ASC;
        `,
        [mareId],
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
          time,
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
        WHERE mare_id = ?
        ORDER BY date DESC, time DESC, created_at DESC, id DESC;
        `,
        [mareId],
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
        WHERE mare_id = ?
        ORDER BY
          date DESC,
          CASE WHEN time IS NULL THEN 1 ELSE 0 END ASC,
          time DESC,
          created_at DESC,
          id DESC;
        `,
        [mareId],
      ),
      db.getAllAsync<BackupUterineFluidRow>(
        `
        SELECT
          uf.id,
          uf.daily_log_id,
          uf.depth_mm,
          uf.location,
          uf.created_at,
          uf.updated_at
        FROM uterine_fluid uf
        INNER JOIN daily_logs dl ON dl.id = uf.daily_log_id
        WHERE dl.mare_id = ?
        ORDER BY uf.created_at DESC, uf.id ASC;
        `,
        [mareId],
      ),
      db.getAllAsync<BackupUterineFlushRow>(
        `
        SELECT
          ufl.id,
          ufl.daily_log_id,
          ufl.base_solution,
          ufl.total_volume_ml,
          ufl.notes,
          ufl.created_at,
          ufl.updated_at
        FROM uterine_flushes ufl
        INNER JOIN daily_logs dl ON dl.id = ufl.daily_log_id
        WHERE dl.mare_id = ?
        ORDER BY ufl.created_at DESC, ufl.id ASC;
        `,
        [mareId],
      ),
      db.getAllAsync<BackupUterineFlushProductRow>(
        `
        SELECT
          ufp.id,
          ufp.uterine_flush_id,
          ufp.product_name,
          ufp.dose,
          ufp.notes,
          ufp.created_at,
          ufp.updated_at
        FROM uterine_flush_products ufp
        INNER JOIN uterine_flushes ufl ON ufl.id = ufp.uterine_flush_id
        INNER JOIN daily_logs dl ON dl.id = ufl.daily_log_id
        WHERE dl.mare_id = ?
        ORDER BY ufp.created_at ASC, ufp.id ASC;
        `,
        [mareId],
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
          source_daily_log_id,
          created_at,
          updated_at
        FROM medication_logs
        WHERE mare_id = ?
        ORDER BY date DESC, id ASC;
        `,
        [mareId],
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
        WHERE mare_id = ?
        ORDER BY date DESC, id ASC;
        `,
        [mareId],
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
        WHERE mare_id = ?
        ORDER BY date DESC, id ASC;
        `,
        [mareId],
      ),
      db.getAllAsync<BackupFoalRow>(
        `
        SELECT
          f.id,
          f.foaling_record_id,
          f.name,
          f.sex,
          f.color,
          f.markings,
          f.birth_weight_lbs,
          f.milestones,
          f.igg_tests,
          f.notes,
          f.created_at,
          f.updated_at
        FROM foals f
        INNER JOIN foaling_records fr ON fr.id = f.foaling_record_id
        WHERE fr.mare_id = ?
        ORDER BY f.foaling_record_id ASC, f.id ASC;
        `,
        [mareId],
      ),
      db.getAllAsync<BackupStallionRow>(
        `
        SELECT
          id,
          name,
          breed,
          registration_number,
          NULL AS sire,
          NULL AS dam,
          NULL AS notes,
          date_of_birth,
          NULL AS av_temperature_f,
          NULL AS av_type,
          NULL AS av_liner_type,
          NULL AS av_water_volume_ml,
          NULL AS av_notes,
          created_at,
          updated_at,
          deleted_at
        FROM stallions
        WHERE id IN (
          SELECT DISTINCT stallion_id
          FROM breeding_records
          WHERE mare_id = ? AND stallion_id IS NOT NULL
        )
        ORDER BY name COLLATE NOCASE ASC, id ASC;
        `,
        [mareId],
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
        WHERE id IN (
          SELECT DISTINCT collection_id
          FROM breeding_records
          WHERE mare_id = ? AND collection_id IS NOT NULL
        )
        ORDER BY collection_date DESC, id ASC;
        `,
        [mareId],
      ),
    ]);

    envelope = {
      artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
      transferVersion: HORSE_TRANSFER_VERSION,
      dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
      createdAt: new Date().toISOString(),
      app: {
        name: 'BreedWise',
        version: getAppVersion(),
      },
      sourceHorse: {
        type: 'mare',
        id: mare.id,
        name: mare.name,
        registrationNumber: mare.registration_number,
        dateOfBirth: mare.date_of_birth,
      },
      privacy: {
        redactedContextStallions: true,
        redactedDoseRecipientAndShipping: false,
      },
      tables: {
        mares: [mare],
        stallions: contextStallions,
        daily_logs: dailyLogs,
        uterine_fluid: uterineFluid,
        uterine_flushes: uterineFlushes,
        uterine_flush_products: uterineFlushProducts,
        breeding_records: breedingRecords,
        pregnancy_checks: pregnancyChecks,
        foaling_records: foalingRecords,
        foals,
        medication_logs: medicationLogs,
        tasks,
        semen_collections: semenCollections,
        collection_dose_events: [] satisfies BackupCollectionDoseEventRowV3[],
        frozen_semen_batches: [] satisfies BackupFrozenSemenBatchRow[],
      },
    };
  });

  if (!envelope) {
    throw new Error('Mare export failed to produce a horse package.');
  }

  return envelope;
}

function getAppVersion(): string {
  return appJson.expo?.version ?? 'unknown';
}
