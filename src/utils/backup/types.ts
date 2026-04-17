export const BACKUP_SCHEMA_VERSION_V1 = 1 as const;

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
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

export const BACKUP_DELETE_ORDER: readonly BackupTableName[] = [
  'collection_dose_events',
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

export type BackupMareRow = {
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
  readonly method: 'liveCover' | 'freshAI' | 'shippedCooledAI' | 'frozenAI';
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
  readonly result: 'positive' | 'negative';
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
  readonly outcome: 'liveFoal' | 'stillbirth' | 'aborted' | 'unknown';
  readonly foal_sex: 'colt' | 'filly' | 'unknown' | null;
  readonly complications: string | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupFoalRow = {
  readonly id: string;
  readonly foaling_record_id: string;
  readonly name: string | null;
  readonly sex: 'colt' | 'filly' | 'unknown' | null;
  readonly color:
    | 'bay'
    | 'chestnut'
    | 'black'
    | 'gray'
    | 'palomino'
    | 'buckskin'
    | 'roan'
    | 'pintoPaint'
    | 'sorrel'
    | 'dun'
    | 'cremello'
    | 'other'
    | null;
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
  readonly route: 'oral' | 'IM' | 'IV' | 'intrauterine' | 'SQ' | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupSemenCollectionRow = {
  readonly id: string;
  readonly stallion_id: string;
  readonly collection_date: BackupLocalDate;
  readonly raw_volume_ml: number | null;
  readonly extended_volume_ml: number | null;
  readonly concentration_millions_per_ml: number | null;
  readonly progressive_motility_percent: number | null;
  readonly dose_count: number | null;
  readonly dose_size_millions: number | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupCollectionDoseEventRow = {
  readonly id: string;
  readonly collection_id: string;
  readonly event_type: 'shipped' | 'usedOnSite';
  readonly recipient: string;
  readonly dose_count: number | null;
  readonly event_date: BackupLocalDate | null;
  readonly notes: string | null;
  readonly created_at: BackupIsoDateTime;
  readonly updated_at: BackupIsoDateTime;
};

export type BackupTablesV1 = {
  readonly mares: readonly BackupMareRow[];
  readonly stallions: readonly BackupStallionRow[];
  readonly daily_logs: readonly BackupDailyLogRow[];
  readonly breeding_records: readonly BackupBreedingRecordRow[];
  readonly pregnancy_checks: readonly BackupPregnancyCheckRow[];
  readonly foaling_records: readonly BackupFoalingRecordRow[];
  readonly foals: readonly BackupFoalRow[];
  readonly medication_logs: readonly BackupMedicationLogRow[];
  readonly semen_collections: readonly BackupSemenCollectionRow[];
  readonly collection_dose_events: readonly BackupCollectionDoseEventRow[];
};

export type BackupEnvelopeV1 = {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION_V1;
  readonly createdAt: BackupIsoDateTime;
  readonly app: BackupAppMetadata;
  readonly settings: BackupSettings;
  readonly tables: BackupTablesV1;
};

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
      readonly backup: BackupEnvelopeV1;
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
