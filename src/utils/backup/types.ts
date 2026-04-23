import type {
  BreedingMethod,
  CollectionTargetMode,
  DoseEventType,
  FreezingExtender,
  FoalColor,
  FoalSex,
  FoalingOutcome,
  MedicationRoute,
  PregnancyResult,
  StrawColor,
} from '@/models/types';

export const BACKUP_SCHEMA_VERSION_V1 = 1 as const;
export const BACKUP_SCHEMA_VERSION_V2 = 2 as const;
export const BACKUP_SCHEMA_VERSION_V3 = 3 as const;
export const BACKUP_SCHEMA_VERSION_V4 = 4 as const;
export const BACKUP_SCHEMA_VERSION_CURRENT = BACKUP_SCHEMA_VERSION_V4;

export const BACKUP_TABLE_NAMES = [
  'mares',
  'stallions',
  'daily_logs',
  'breeding_records',
  'pregnancy_checks',
  'foaling_records',
  'foals',
  'medication_logs',
  'semen_collections',
  'collection_dose_events',
  'frozen_semen_batches',
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

export const BACKUP_DELETE_ORDER: readonly BackupTableName[] = [
  'collection_dose_events',
  'frozen_semen_batches',
  'foals',
  'pregnancy_checks',
  'foaling_records',
  'medication_logs',
  'daily_logs',
  'breeding_records',
  'semen_collections',
  'mares',
  'stallions',
];

export const BACKUP_INSERT_ORDER: readonly BackupTableName[] = [
  'mares',
  'stallions',
  'semen_collections',
  'frozen_semen_batches',
  'breeding_records',
  'daily_logs',
  'medication_logs',
  'pregnancy_checks',
  'foaling_records',
  'foals',
  'collection_dose_events',
];

export type BackupIsoDateTime = string;
export type BackupLocalDate = string;

export type BackupAppMetadata = {
  readonly name: 'BreedWise';
  readonly version: string;
};

export type BackupSettings = {
  readonly onboardingComplete: boolean;
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

export type BackupMareRow = BackupMareRowV2;

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

export type BackupDailyLogRow = {
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

export type BackupBreedingRecordRow = {
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

export type BackupMedicationLogRow = {
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
  readonly daily_logs: readonly BackupDailyLogRow[];
  readonly breeding_records: readonly BackupBreedingRecordRow[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly semen_collections: readonly BackupSemenCollectionRowV2[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV2[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV2 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRow[];
  readonly breeding_records: readonly BackupBreedingRecordRow[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly semen_collections: readonly BackupSemenCollectionRowV2[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV2[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV3 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRow[];
  readonly breeding_records: readonly BackupBreedingRecordRow[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches?: readonly BackupFrozenSemenBatchRow[];
};

export type BackupTablesV4 = {
  readonly mares: readonly BackupMareRowV2[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRow[];
  readonly breeding_records: readonly BackupBreedingRecordRow[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly semen_collections: readonly BackupSemenCollectionRowV3[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRowV3[];
  readonly frozen_semen_batches: readonly BackupFrozenSemenBatchRow[];
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

export type BackupEnvelope = BackupEnvelopeV1 | BackupEnvelopeV2 | BackupEnvelopeV3 | BackupEnvelopeV4;

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
  readonly table?: BackupTableName;
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
