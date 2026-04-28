import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  type BackupAppMetadata,
  type BackupIsoDateTime,
  type BackupLocalDate,
  type BackupTableName,
  type BackupTablesV11,
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

export type HorseTransferTablesV1 = BackupTablesV11;

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

export type HorseTransferTableCounts = Record<BackupTableName, number>;

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

export type HorseTransferRowResult = {
  readonly table: BackupTableName;
  readonly sourceId: string;
  readonly destinationId?: string;
  readonly outcome: HorseTransferRowOutcome;
  readonly reason?: HorseTransferConflictReason;
  readonly message?: string;
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
  readonly table?: BackupTableName;
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
