import type {
  BreedingMethod,
  CervicalFirmness,
  CollectionTargetMode,
  DoseEventType,
  FluidLocation,
  FollicleState,
  FreezingExtender,
  FoalColor,
  FoalSex,
  FoalingOutcome,
  MedicationRoute,
  OvaryConsistency,
  PhotoAttachmentRole,
  PhotoOwnerType,
  PhotoSourceKind,
  PregnancyResult,
  StrawColor,
  TaskSourceReason,
  TaskSourceType,
  TaskStatus,
  TaskType,
  UterineToneCategory,
} from '@/models/types';
import type { ClockPreference } from '@/utils/clockPreferences';

export const BACKUP_SCHEMA_VERSION_V1 = 1 as const;
export const BACKUP_SCHEMA_VERSION_V2 = 2 as const;
export const BACKUP_SCHEMA_VERSION_V3 = 3 as const;
export const BACKUP_SCHEMA_VERSION_V4 = 4 as const;
export const BACKUP_SCHEMA_VERSION_V5 = 5 as const;
export const BACKUP_SCHEMA_VERSION_V6 = 6 as const;
export const BACKUP_SCHEMA_VERSION_V7 = 7 as const;
export const BACKUP_SCHEMA_VERSION_V8 = 8 as const;
export const BACKUP_SCHEMA_VERSION_V9 = 9 as const;
export const BACKUP_SCHEMA_VERSION_V10 = 10 as const;
export const BACKUP_SCHEMA_VERSION_V11 = 11 as const;
export const BACKUP_SCHEMA_VERSION_V12 = 12 as const;
export const BACKUP_SCHEMA_VERSION_CURRENT = BACKUP_SCHEMA_VERSION_V12;

export const BACKUP_TABLE_NAMES = [
  'mares',
  'stallions',
  'daily_logs',
  'uterine_fluid',
  'uterine_flushes',
  'uterine_flush_products',
  'breeding_records',
  'pregnancy_checks',
  'foaling_records',
  'foals',
  'medication_logs',
  'tasks',
  'semen_collections',
  'collection_dose_events',
  'frozen_semen_batches',
] as const;

export type PhotoBackupTableName = 'photo_assets' | 'photo_attachments';
export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];
export type ManagedBackupTableName = BackupTableName | PhotoBackupTableName;

export const BACKUP_DELETE_ORDER: readonly ManagedBackupTableName[] = [
  'photo_attachments',
  'photo_assets',
  'collection_dose_events',
  'frozen_semen_batches',
  'foals',
  'pregnancy_checks',
  'uterine_fluid',
  'uterine_flush_products',
  'uterine_flushes',
  'foaling_records',
  'medication_logs',
  'daily_logs',
  'breeding_records',
  'semen_collections',
  'tasks',
  'mares',
  'stallions',
];

export const BACKUP_INSERT_ORDER: readonly ManagedBackupTableName[] = [
  'mares',
  'tasks',
  'stallions',
  'semen_collections',
  'frozen_semen_batches',
  'breeding_records',
  'daily_logs',
  'uterine_fluid',
  'uterine_flushes',
  'uterine_flush_products',
  'medication_logs',
  'pregnancy_checks',
  'foaling_records',
  'foals',
  'collection_dose_events',
  'photo_assets',
  'photo_attachments',
];

export type BackupIsoDateTime = string;
export type BackupLocalDate = string;

export type BackupAppMetadata = {
  readonly name: 'BreedWise';
  readonly version: string;
};

export type BackupSettings = {
  readonly onboardingComplete: boolean;
  readonly clockPreference?: ClockPreference;
};

export type BackupMareRowV1 = {
  readonly id: string;
  readonly name: string;
  readonly breed: string;
  readonly date_of_birth: BackupLocalDate | null;
  readonly registration_number: string | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
  readonly deleted_at: BackupIsoDateTime | null;
};

export type BackupMareRowV2 = BackupMareRowV1 & {
  readonly gestation_length_days: number;
};

export type BackupMareRowV6 = BackupMareRowV2 & {
  readonly is_recipient: 0 | 1;
};

export type BackupMareRow = BackupMareRowV6;

export type BackupStallionRow = {
  readonly id: string;
  readonly name: string;
  readonly breed: string | null;
  readonly registration_number: string | null;
  readonly sire: string | null;
  readonly dam: string | null;
  readonly notes: string | null;
  readonly date_of_birth: BackupLocalDate | null;
  readonly av_temperature_f: number | null;
  readonly av_type: string | null;
  readonly av_liner_type: string | null;
  readonly av_water_volume_ml: number | null;
  readonly av_notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
  readonly deleted_at: BackupIsoDateTime | null;
};

export type BackupDailyLogRowLegacy = {
  readonly id: string;
  readonly mare_id: string;
  readonly date: BackupLocalDate;
  readonly teasing_score: number | null;
  readonly right_ovary: string | null;
  readonly left_ovary: string | null;
  readonly ovulation_detected: 0 | 1 | null;
  readonly edema: number | null;
  readonly uterine_tone: string | null;
  readonly uterine_cysts: string | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupDailyLogRowV4 = BackupDailyLogRowLegacy & {
  readonly right_ovary_ovulation: 0 | 1 | null;
  readonly right_ovary_follicle_state: FollicleState | null;
  readonly right_ovary_follicle_measurements_mm: string;
  readonly right_ovary_consistency: OvaryConsistency | null;
  readonly right_ovary_structures: string;
  readonly left_ovary_ovulation: 0 | 1 | null;
  readonly left_ovary_follicle_state: FollicleState | null;
  readonly left_ovary_follicle_measurements_mm: string;
  readonly left_ovary_consistency: OvaryConsistency | null;
  readonly left_ovary_structures: string;
  readonly uterine_tone_category: UterineToneCategory | null;
  readonly cervical_firmness: CervicalFirmness | null;
  readonly discharge_observed: 0 | 1 | null;
  readonly discharge_notes: string | null;
};

export type BackupDailyLogRowV7 = BackupDailyLogRowV4 & {
  readonly time: string | null;
};

export type BackupDailyLogRow = BackupDailyLogRowV7;

export type BackupUterineFluidRow = {
  readonly id: string;
  readonly daily_log_id: string;
  readonly depth_mm: number;
  readonly location: FluidLocation;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupUterineFlushRow = {
  readonly id: string;
  readonly daily_log_id: string;
  readonly base_solution: string;
  readonly total_volume_ml: number;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupUterineFlushProductRow = {
  readonly id: string;
  readonly uterine_flush_id: string;
  readonly product_name: string;
  readonly dose: string;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupBreedingRecordRowLegacy = {
  readonly id: string;
  readonly mare_id: string;
  readonly stallion_id: string | null;
  readonly stallion_name: string | null;
  readonly collection_id: string | null;
  readonly date: BackupLocalDate;
  readonly method: BreedingMethod;
  readonly notes: string | null;
  readonly volume_ml: number | null;
  readonly concentration_m_per_ml: number | null;
  readonly motility_percent: number | null;
  readonly number_of_straws: number | null;
  readonly straw_volume_ml: number | null;
  readonly straw_details: string | null;
  readonly collection_date: BackupLocalDate | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupBreedingRecordRowV10 = BackupBreedingRecordRowLegacy & {
  readonly time: string | null;
};

export type BackupBreedingRecordRow = BackupBreedingRecordRowV10;

export type BackupPregnancyCheckRow = {
  readonly id: string;
  readonly mare_id: string;
  readonly breeding_record_id: string;
  readonly date: BackupLocalDate;
  readonly result: PregnancyResult;
  readonly heartbeat_detected: 0 | 1 | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupFoalingRecordRow = {
  readonly id: string;
  readonly mare_id: string;
  readonly breeding_record_id: string | null;
  readonly date: BackupLocalDate;
  readonly outcome: FoalingOutcome;
  readonly foal_sex: FoalSex | null;
  readonly complications: string | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupFoalRow = {
  readonly id: string;
  readonly foaling_record_id: string;
  readonly name: string | null;
  readonly sex: FoalSex | null;
  readonly color: FoalColor | null;
  readonly markings: string | null;
  readonly birth_weight_lbs: number | null;
  readonly milestones: string;
  readonly igg_tests: string;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupMedicationLogRowV7 = {
  readonly id: string;
  readonly mare_id: string;
  readonly date: BackupLocalDate;
  readonly medication_name: string;
  readonly dose: string | null;
  readonly route: MedicationRoute | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupMedicationLogRow = BackupMedicationLogRowV7 & {
  readonly source_daily_log_id: string | null;
};

export type BackupTaskRow = {
  readonly id: string;
  readonly mare_id: string;
  readonly task_type: TaskType;
  readonly title: string;
  readonly due_date: BackupLocalDate;
  readonly due_time: string | null;
  readonly notes: string | null;
  readonly status: TaskStatus;
  readonly completed_at: BackupIsoDateTime | null;
  readonly completed_record_type: Exclude<TaskSourceType, 'manual'> | null;
  readonly completed_record_id: string | null;
  readonly source_type: TaskSourceType;
  readonly source_record_id: string | null;
  readonly source_reason: TaskSourceReason | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupPhotoAssetRow = {
  readonly id: string;
  readonly master_relative_path: string;
  readonly thumbnail_relative_path: string;
  readonly master_mime_type: 'image/jpeg';
  readonly thumbnail_mime_type: 'image/jpeg';
  readonly width: number;
  readonly height: number;
  readonly file_size_bytes: number;
  readonly source_kind: PhotoSourceKind;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupPhotoAttachmentRow = {
  readonly id: string;
  readonly photo_asset_id: string;
  readonly owner_type: PhotoOwnerType;
  readonly owner_id: string;
  readonly role: PhotoAttachmentRole;
  readonly sort_order: number;
  readonly caption: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupSemenCollectionRowV2 = {
  readonly id: string;
  readonly stallion_id: string;
  readonly collection_date: BackupLocalDate;
  readonly raw_volume_ml: number | null;
  readonly extended_volume_ml: number | null;
  readonly extender_volume_ml?: number | null;
  readonly extender_type?: string | null;
  readonly concentration_millions_per_ml: number | null;
  readonly progressive_motility_percent: number | null;
  readonly dose_count: number | null;
  readonly dose_size_millions: number | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupSemenCollectionRowV3 = {
  readonly id: string;
  readonly stallion_id: string;
  readonly collection_date: BackupLocalDate;
  readonly raw_volume_ml: number | null;
  readonly extender_type: string | null;
  readonly concentration_millions_per_ml: number | null;
  readonly motility_percent?: number | null;
  readonly progressive_motility_percent: number | null;
  readonly target_mode?: CollectionTargetMode | null;
  readonly target_motile_sperm_millions_per_dose: number | null;
  readonly target_post_extension_concentration_millions_per_ml: number | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupSemenCollectionRow = BackupSemenCollectionRowV2 | BackupSemenCollectionRowV3;

export type BackupCollectionDoseEventRowV2 = {
  readonly id: string;
  readonly collection_id: string;
  readonly event_type: DoseEventType;
  readonly recipient: string;
  readonly recipient_phone?: string | null;
  readonly recipient_street?: string | null;
  readonly recipient_city?: string | null;
  readonly recipient_state?: string | null;
  readonly recipient_zip?: string | null;
  readonly carrier_service?: string | null;
  readonly container_type?: string | null;
  readonly tracking_number?: string | null;
  readonly breeding_record_id?: string | null;
  readonly dose_count: number | null;
  readonly event_date: BackupLocalDate | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupCollectionDoseEventRowV3 = {
  readonly id: string;
  readonly collection_id: string;
  readonly event_type: DoseEventType;
  readonly recipient: string;
  readonly recipient_phone: string | null;
  readonly recipient_street: string | null;
  readonly recipient_city: string | null;
  readonly recipient_state: string | null;
  readonly recipient_zip: string | null;
  readonly carrier_service: string | null;
  readonly container_type: string | null;
  readonly tracking_number: string | null;
  readonly breeding_record_id: string | null;
  readonly dose_semen_volume_ml: number | null;
  readonly dose_extender_volume_ml: number | null;
  readonly dose_count: number | null;
  readonly event_date: BackupLocalDate | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupCollectionDoseEventRow =
  | BackupCollectionDoseEventRowV2
  | BackupCollectionDoseEventRowV3;

export type BackupFrozenSemenBatchRow = {
  readonly id: string;
  readonly stallion_id: string;
  readonly collection_id: string | null;
  readonly freeze_date: BackupLocalDate;
  readonly raw_semen_volume_used_ml: number | null;
  readonly extender: FreezingExtender | null;
  readonly extender_other: string | null;
  readonly was_centrifuged: 0 | 1;
  readonly centrifuge_speed_rpm: number | null;
  readonly centrifuge_duration_min: number | null;
  readonly centrifuge_cushion_used: 0 | 1 | null;
  readonly centrifuge_cushion_type: string | null;
  readonly centrifuge_resuspension_vol_ml: number | null;
  readonly centrifuge_notes: string | null;
  readonly straw_count: number;
  readonly straws_remaining: number;
  readonly straw_volume_ml: number;
  readonly concentration_millions_per_ml: number | null;
  readonly straws_per_dose: number | null;
  readonly straw_color: StrawColor | null;
  readonly straw_color_other: string | null;
  readonly straw_label: string | null;
  readonly post_thaw_motility_percent: number | null;
  readonly longevity_hours: number | null;
  readonly storage_details: string | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupTablesV1 = {
  readonly mares: readonly BackupMareRowV1[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowLegacy[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV2[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV2[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV2 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowLegacy[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV2[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV2[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV3 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowLegacy[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV4 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowV4[];
  readonly uterine_fluid: readonly BackupUterineFluidRow[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV5 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowV4[];
  readonly uterine_fluid: readonly BackupUterineFluidRow[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV6 = {
  readonly mares: readonly BackupMareRowV6[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowV4[];
  readonly uterine_fluid: readonly BackupUterineFluidRow[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV7 = {
  readonly mares: readonly BackupMareRowV6[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowV7[];
  readonly uterine_fluid: readonly BackupUterineFluidRow[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRowV7[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV8 = {
  readonly mares: readonly BackupMareRowV6[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRowV7[];
  readonly uterine_fluid: readonly BackupUterineFluidRow[];
  readonly uterine_flushes: readonly BackupUterineFlushRow[];
  readonly uterine_flush_products: readonly BackupUterineFlushProductRow[];
  readonly breeding_records: readonly BackupBreedingRecordRowLegacy[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV9 = BackupTablesV8;

export type BackupTablesV10 = Omit<BackupTablesV9, 'breeding_records'> & {
  readonly breeding_records: readonly BackupBreedingRecordRowV10[];
};

export type BackupTablesV11 = BackupTablesV10 & {
  readonly tasks: readonly BackupTaskRow[];
};

export type BackupTablesV12 = BackupTablesV11 & {
  readonly photo_assets: readonly BackupPhotoAssetRow[];
  readonly photo_attachments: readonly BackupPhotoAttachmentRow[];
};

export type BackupEnvelopeV1 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V1;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV1;
};

export type BackupEnvelopeV2 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V2;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV2;
};

export type BackupEnvelopeV3 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V3;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV3;
};

export type BackupEnvelopeV4 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V4;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV4;
};

export type BackupEnvelopeV5 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V5;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV5;
};

export type BackupEnvelopeV6 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V6;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV6;
};

export type BackupEnvelopeV7 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V7;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV7;
};

export type BackupEnvelopeV8 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V8;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV8;
};

export type BackupEnvelopeV9 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V9;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV9;
};

export type BackupEnvelopeV10 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V10;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV10;
};

export type BackupEnvelopeV11 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V11;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV11;
};

export type BackupEnvelopeV12 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V12;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV12;
};

export type BackupEnvelope =
  | BackupEnvelopeV1
  | BackupEnvelopeV2
  | BackupEnvelopeV3
  | BackupEnvelopeV4
  | BackupEnvelopeV5
  | BackupEnvelopeV6
  | BackupEnvelopeV7
  | BackupEnvelopeV8
  | BackupEnvelopeV9
  | BackupEnvelopeV10
  | BackupEnvelopeV11
  | BackupEnvelopeV12;

export type BackupPreviewSummary = {
  readonly createdAt: BackupIsoDateTime;
  readonly mareCount: number;
  readonly stallionCount: number;
  readonly dailyLogCount: number;
  readonly onboardingComplete: boolean;
  readonly schemaVersion: number;
};

export type ValidateBackupError = {
  readonly code:
    | 'invalid_json'
    | 'invalid_shape'
    | 'unsupported_schema_version'
    | 'missing_key'
    | 'invalid_row'
    | 'constraint_violation';
  readonly message: string;
  readonly table?: ManagedBackupTableName;
  readonly rowIndex?: number;
  readonly field?: string;
};

export type ValidateBackupResult =
  | {
      readonly ok: true;
      readonly backup: BackupEnvelope;
      readonly preview: BackupPreviewSummary;
    }
  | {
      readonly ok: false;
      readonly error: ValidateBackupError;
    };

export type RestoreBackupResult =
  | {
      readonly ok: true;
      readonly warningMessage?: string;
      readonly safetySnapshotCreated: boolean;
    }
  | {
      readonly ok: false;
      readonly errorMessage: string;
    };

export type SafetySnapshotSummary = {
  readonly fileName: string;
  readonly fileUri: string;
  readonly createdAt: BackupIsoDateTime;
  readonly mareCount: number;
  readonly schemaVersion: number;
};
