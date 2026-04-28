import { getDb } from '@/storage/db';
import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  type BackupCollectionDoseEventRowV3,
  type BackupFrozenSemenBatchRow,
  type BackupSemenCollectionRowV3,
  type BackupStallionRow,
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

export class StallionNotFoundError extends Error {
  constructor(stallionId: string) {
    super(`Stallion ${stallionId} was not found.`);
    this.name = 'StallionNotFoundError';
  }
}

export async function exportStallionTransfer(
  stallionId: string,
): Promise<HorseTransferEnvelopeV1> {
  const db = (await getDb()) as unknown as HorseTransferDb;
  let envelope: HorseTransferEnvelopeV1 | null = null;

  await db.withTransactionAsync(async () => {
    const stallion = await db.getFirstAsync<BackupStallionRow>(
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
      WHERE id = ? AND deleted_at IS NULL;
      `,
      [stallionId],
    );

    if (!stallion) {
      throw new StallionNotFoundError(stallionId);
    }

    const [semenCollections, frozenSemenBatches, collectionDoseEvents] = await Promise.all([
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
        WHERE stallion_id = ?
        ORDER BY collection_date DESC, id ASC;
        `,
        [stallionId],
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
        WHERE stallion_id = ?
        ORDER BY freeze_date DESC, id ASC;
        `,
        [stallionId],
      ),
      db.getAllAsync<BackupCollectionDoseEventRowV3>(
        `
        SELECT
          cde.id,
          cde.collection_id,
          cde.event_type,
          'Redacted' AS recipient,
          NULL AS recipient_phone,
          NULL AS recipient_street,
          NULL AS recipient_city,
          NULL AS recipient_state,
          NULL AS recipient_zip,
          NULL AS carrier_service,
          NULL AS container_type,
          NULL AS tracking_number,
          NULL AS breeding_record_id,
          cde.dose_semen_volume_ml,
          cde.dose_extender_volume_ml,
          cde.dose_count,
          cde.event_date,
          NULL AS notes,
          cde.created_at,
          cde.updated_at
        FROM collection_dose_events cde
        INNER JOIN semen_collections sc ON sc.id = cde.collection_id
        WHERE sc.stallion_id = ?
        ORDER BY cde.created_at DESC, cde.id ASC;
        `,
        [stallionId],
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
        type: 'stallion',
        id: stallion.id,
        name: stallion.name,
        registrationNumber: stallion.registration_number,
        dateOfBirth: stallion.date_of_birth,
      },
      privacy: {
        redactedContextStallions: false,
        redactedDoseRecipientAndShipping: true,
      },
      tables: {
        mares: [],
        stallions: [stallion],
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
        semen_collections: semenCollections,
        collection_dose_events: collectionDoseEvents,
        frozen_semen_batches: frozenSemenBatches,
      },
    };
  });

  if (!envelope) {
    throw new Error('Stallion export failed to produce a horse package.');
  }

  return envelope;
}

function getAppVersion(): string {
  return appJson.expo?.version ?? 'unknown';
}
