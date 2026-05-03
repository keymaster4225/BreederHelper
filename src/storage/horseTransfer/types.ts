import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  type BackupAppMetadata,
  type BackupBreedingRecordRowV10,
  type BackupCollectionDoseEventRowV3,
  type BackupDailyLogRowV7,
  type BackupFoalingRecordRow,
  type BackupFoalRow,
  type BackupFrozenSemenBatchRow,
  type BackupIsoDateTime,
  type BackupLocalDate,
  type BackupMareRowV6,
  type BackupMedicationLogRow,
  type BackupPregnancyCheckRow,
  type BackupSemenCollectionRowV3,
  type BackupStallionRow,
  type BackupTaskRow,
  type BackupUterineFluidRow,
  type BackupUterineFlushProductRow,
  type BackupUterineFlushRow,
} from '@/storage/backup/types';

export const HORSE_TRANSFER_ARTIFACT_TYPE = 'breedwise.horseTransfer' as const;
export const HORSE_TRANSFER_VERSION = 1 as const;

export const HORSE_TRANSFER_RESTORE_ERROR_MESSAGE =
  'This file is a horse package. Use Settings > Backup & Restore > Import Horse.';

export const HORSE_TRANSFER_NEWER_SCHEMA_MESSAGE =
  'This horse package was created by a newer version of BreedWise. Update BreedWise and try again.';

export const HORSE_TRANSFER_OLDER_SCHEMA_MESSAGE =
  'This horse package uses an older BreedWise data format that cannot be imported by this version. Ask the sender to export it again from an updated app.';

export type HorseTransferSourceHorse = {
  readonly type: 'mare' | 'stallion';
  readonly id: string;
  readonly name: string;
  readonly registrationNumber: string | null;
  readonly dateOfBirth: BackupLocalDate | null;
};

export type HorseTransferPrivacy = {
  readonly redactedContextStallions: boolean;
  readonly redactedDoseRecipientAndShipping: boolean;
};

export type HorseTransferTablesV1 = {
  readonly mares: readonly BackupMareRowV6[];
  readonly tasks: readonly BackupTaskRow[];
  readonly stallions: readonly BackupStallionRow[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
  readonly breeding_records: readonly BackupBreedingRecordRowV10[];
  readonly daily_logs: readonly BackupDailyLogRowV7[];
  readonly uterine_fluid: readonly BackupUterineFluidRow[];
  readonly uterine_flushes: readonly BackupUterineFlushRow[];
  readonly uterine_flush_products: readonly BackupUterineFlushProductRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
};

export type HorseTransferTableName = keyof HorseTransferTablesV1 & string;

export type HorseTransferEnvelopeV1 = {
  readonly artifactType: typeof HORSE_TRANSFER_ARTIFACT_TYPE;
  readonly transferVersion: typeof HORSE_TRANSFER_VERSION;
  readonly dataSchemaVersion: typeof BACKUP_SCHEMA_VERSION_CURRENT;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly sourceHorse: HorseTransferSourceHorse;
  readonly privacy: HorseTransferPrivacy;
  readonly tables: HorseTransferTablesV1;
};

export type HorseTransferTableCounts = Record<HorseTransferTableName, number>;

export type HorseTransferPreviewSummary = {
  readonly createdAt: BackupIsoDateTime;
  readonly appVersion: string;
  readonly dataSchemaVersion: typeof BACKUP_SCHEMA_VERSION_CURRENT;
  readonly sourceHorse: HorseTransferSourceHorse;
  readonly privacy: HorseTransferPrivacy;
  readonly tableCounts: HorseTransferTableCounts;
};

export type HorseTransferRedactionNoticeCode =
  | 'context_stallions_redacted'
  | 'dose_recipient_shipping_redacted';

export type HorseTransferRedactionNotice = {
  readonly code: HorseTransferRedactionNoticeCode;
};

export type HorseImportPreviewTargetState = 'matched' | 'ambiguous' | 'create_new';
export type HorseImportSafetySnapshotPolicy = 'before_import';

export type HorseImportPreview = HorseTransferPreviewSummary & {
  readonly totalRowCount: number;
  readonly estimatedConflictCounts: HorseTransferTableCounts;
  readonly estimatedConflictTotal: number;
  readonly targetState: HorseImportPreviewTargetState;
  readonly redactionNotices: readonly HorseTransferRedactionNotice[];
  readonly nonOverwritePolicy: true;
  readonly safetySnapshotPolicy: HorseImportSafetySnapshotPolicy;
};

export type HorseTransferConflictReason =
  | 'primary_key_conflict'
  | 'natural_key_conflict'
  | 'different_effective_data'
  | 'cascade_parent_conflict'
  | 'unsafe_context_link';

export type HorseTransferRowOutcome = 'inserted' | 'already_present' | 'skipped' | 'conflict';

export type HorseTransferFoalConflictDetail = {
  readonly kind: 'foal_conflict';
  readonly destinationPreserved: true;
  readonly milestonesDiffer: boolean;
  readonly iggTestsDiffer: boolean;
};

export type HorseTransferRowResultDetail = HorseTransferFoalConflictDetail;

export type HorseTransferRowResult = {
  readonly table: HorseTransferTableName;
  readonly sourceId: string;
  readonly destinationId?: string;
  readonly outcome: HorseTransferRowOutcome;
  readonly reason?: HorseTransferConflictReason;
  readonly message?: string;
  readonly detail?: HorseTransferRowResultDetail;
};

export type HorseTransferOutcomeCounts = Record<HorseTransferRowOutcome, number>;

export type HorseTransferImportTableCounts = Record<
  HorseTransferTableName,
  HorseTransferOutcomeCounts
>;

export type HorseTransferImportSummary = {
  readonly tableCounts: HorseTransferImportTableCounts;
  readonly totalCounts: HorseTransferOutcomeCounts;
  readonly rowResults: readonly HorseTransferRowResult[];
};

export type HorseTransferImportTarget =
  | {
      readonly kind: 'create_new';
    }
  | {
      readonly kind: 'confirmed_match';
      readonly destinationHorseId: string;
    };

export type ImportHorseTransferOptions = {
  readonly target: HorseTransferImportTarget;
};

export type ImportHorseTransferResult =
  | {
      readonly ok: true;
      readonly safetySnapshotCreated: boolean;
      readonly summary: HorseTransferImportSummary;
    }
  | {
      readonly ok: false;
      readonly safetySnapshotCreated: boolean;
      readonly errorMessage: string;
    };

export type ValidateHorseTransferError = {
  readonly code:
    | 'invalid_json'
    | 'invalid_shape'
    | 'unsupported_artifact'
    | 'unsupported_transfer_version'
    | 'unsupported_schema_version'
    | 'missing_key'
    | 'invalid_row'
    | 'constraint_violation';
  readonly message: string;
  readonly table?: HorseTransferTableName;
  readonly rowIndex?: number;
  readonly field?: string;
};

export type ValidateHorseTransferResult =
  | {
      readonly ok: true;
      readonly envelope: HorseTransferEnvelopeV1;
      readonly preview: HorseTransferPreviewSummary;
    }
  | {
      readonly ok: false;
      readonly error: ValidateHorseTransferError;
    };
