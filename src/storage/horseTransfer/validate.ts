import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  BACKUP_TABLE_NAMES,
  type BackupTableName,
} from '@/storage/backup/types';

import {
  HORSE_TRANSFER_ARTIFACT_TYPE,
  HORSE_TRANSFER_NEWER_SCHEMA_MESSAGE,
  HORSE_TRANSFER_OLDER_SCHEMA_MESSAGE,
  HORSE_TRANSFER_VERSION,
  type HorseTransferEnvelopeV1,
  type HorseTransferPreviewSummary,
  type HorseTransferSourceHorse,
  type HorseTransferTablesV1,
  type ValidateHorseTransferError,
  type ValidateHorseTransferResult,
} from './types';

const ENVELOPE_KEYS = [
  'artifactType',
  'transferVersion',
  'dataSchemaVersion',
  'createdAt',
  'app',
  'sourceHorse',
  'privacy',
  'tables',
] as const;

const APP_KEYS = ['name', 'version'] as const;
const SOURCE_HORSE_KEYS = [
  'type',
  'id',
  'name',
  'registrationNumber',
  'dateOfBirth',
] as const;
const PRIVACY_KEYS = [
  'redactedContextStallions',
  'redactedDoseRecipientAndShipping',
] as const;

const TABLE_FIELD_NAMES = {
  mares: [
    'id',
    'name',
    'breed',
    'gestation_length_days',
    'date_of_birth',
    'registration_number',
    'is_recipient',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  stallions: [
    'id',
    'name',
    'breed',
    'registration_number',
    'sire',
    'dam',
    'notes',
    'date_of_birth',
    'av_temperature_f',
    'av_type',
    'av_liner_type',
    'av_water_volume_ml',
    'av_notes',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  daily_logs: [
    'id',
    'mare_id',
    'date',
    'time',
    'teasing_score',
    'right_ovary',
    'left_ovary',
    'ovulation_detected',
    'edema',
    'uterine_tone',
    'uterine_cysts',
    'right_ovary_ovulation',
    'right_ovary_follicle_state',
    'right_ovary_follicle_measurements_mm',
    'right_ovary_consistency',
    'right_ovary_structures',
    'left_ovary_ovulation',
    'left_ovary_follicle_state',
    'left_ovary_follicle_measurements_mm',
    'left_ovary_consistency',
    'left_ovary_structures',
    'uterine_tone_category',
    'cervical_firmness',
    'discharge_observed',
    'discharge_notes',
    'notes',
    'created_at',
    'updated_at',
  ],
  uterine_fluid: ['id', 'daily_log_id', 'depth_mm', 'location', 'created_at', 'updated_at'],
  uterine_flushes: [
    'id',
    'daily_log_id',
    'base_solution',
    'total_volume_ml',
    'notes',
    'created_at',
    'updated_at',
  ],
  uterine_flush_products: [
    'id',
    'uterine_flush_id',
    'product_name',
    'dose',
    'notes',
    'created_at',
    'updated_at',
  ],
  breeding_records: [
    'id',
    'mare_id',
    'stallion_id',
    'stallion_name',
    'collection_id',
    'date',
    'time',
    'method',
    'notes',
    'volume_ml',
    'concentration_m_per_ml',
    'motility_percent',
    'number_of_straws',
    'straw_volume_ml',
    'straw_details',
    'collection_date',
    'created_at',
    'updated_at',
  ],
  pregnancy_checks: [
    'id',
    'mare_id',
    'breeding_record_id',
    'date',
    'result',
    'heartbeat_detected',
    'notes',
    'created_at',
    'updated_at',
  ],
  foaling_records: [
    'id',
    'mare_id',
    'breeding_record_id',
    'date',
    'outcome',
    'foal_sex',
    'complications',
    'notes',
    'created_at',
    'updated_at',
  ],
  foals: [
    'id',
    'foaling_record_id',
    'name',
    'sex',
    'color',
    'markings',
    'birth_weight_lbs',
    'milestones',
    'igg_tests',
    'notes',
    'created_at',
    'updated_at',
  ],
  medication_logs: [
    'id',
    'mare_id',
    'date',
    'medication_name',
    'dose',
    'route',
    'notes',
    'source_daily_log_id',
    'created_at',
    'updated_at',
  ],
  tasks: [
    'id',
    'mare_id',
    'task_type',
    'title',
    'due_date',
    'due_time',
    'notes',
    'status',
    'completed_at',
    'completed_record_type',
    'completed_record_id',
    'source_type',
    'source_record_id',
    'source_reason',
    'created_at',
    'updated_at',
  ],
  semen_collections: [
    'id',
    'stallion_id',
    'collection_date',
    'raw_volume_ml',
    'extender_type',
    'concentration_millions_per_ml',
    'progressive_motility_percent',
    'target_mode',
    'target_motile_sperm_millions_per_dose',
    'target_post_extension_concentration_millions_per_ml',
    'notes',
    'created_at',
    'updated_at',
  ],
  collection_dose_events: [
    'id',
    'collection_id',
    'event_type',
    'recipient',
    'recipient_phone',
    'recipient_street',
    'recipient_city',
    'recipient_state',
    'recipient_zip',
    'carrier_service',
    'container_type',
    'tracking_number',
    'breeding_record_id',
    'dose_semen_volume_ml',
    'dose_extender_volume_ml',
    'dose_count',
    'event_date',
    'notes',
    'created_at',
    'updated_at',
  ],
  frozen_semen_batches: [
    'id',
    'stallion_id',
    'collection_id',
    'freeze_date',
    'raw_semen_volume_used_ml',
    'extender',
    'extender_other',
    'was_centrifuged',
    'centrifuge_speed_rpm',
    'centrifuge_duration_min',
    'centrifuge_cushion_used',
    'centrifuge_cushion_type',
    'centrifuge_resuspension_vol_ml',
    'centrifuge_notes',
    'straw_count',
    'straws_remaining',
    'straw_volume_ml',
    'concentration_millions_per_ml',
    'straws_per_dose',
    'straw_color',
    'straw_color_other',
    'straw_label',
    'post_thaw_motility_percent',
    'longevity_hours',
    'storage_details',
    'notes',
    'created_at',
    'updated_at',
  ],
} as const satisfies Record<BackupTableName, readonly string[]>;

const STALLION_PACKAGE_EMPTY_TABLES: readonly BackupTableName[] = [
  'mares',
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
];

type SourceHorseValidationResult =
  | {
      readonly ok: true;
      readonly sourceHorse: HorseTransferSourceHorse;
    }
  | {
      readonly ok: false;
      readonly error: ValidateHorseTransferError;
    };

type TableValidationResult =
  | {
      readonly ok: true;
      readonly tables: HorseTransferTablesV1;
    }
  | {
      readonly ok: false;
      readonly error: ValidateHorseTransferError;
    };

export function validateHorseTransferJson(jsonText: string): ValidateHorseTransferResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return validationFailure('invalid_json', 'Horse package file is not valid JSON.');
  }

  return validateHorseTransfer(parsed);
}

export function validateHorseTransfer(input: unknown): ValidateHorseTransferResult {
  if (!isRecord(input)) {
    return validationFailure('invalid_shape', 'Horse package payload must be an object.');
  }

  const envelopeKeyError = validateExactKeys(input, ENVELOPE_KEYS, 'Horse package');
  if (envelopeKeyError) {
    return { ok: false, error: envelopeKeyError };
  }

  if (input.artifactType !== HORSE_TRANSFER_ARTIFACT_TYPE) {
    return validationFailure(
      'unsupported_artifact',
      'Horse package artifactType is invalid.',
    );
  }

  if (input.transferVersion !== HORSE_TRANSFER_VERSION) {
    return validationFailure(
      'unsupported_transfer_version',
      `Horse package transferVersion ${String(input.transferVersion)} is not supported by this build.`,
    );
  }

  if (typeof input.dataSchemaVersion !== 'number') {
    return validationFailure('missing_key', 'Horse package is missing dataSchemaVersion.');
  }
  if (input.dataSchemaVersion > BACKUP_SCHEMA_VERSION_CURRENT) {
    return validationFailure('unsupported_schema_version', HORSE_TRANSFER_NEWER_SCHEMA_MESSAGE);
  }
  if (input.dataSchemaVersion < BACKUP_SCHEMA_VERSION_CURRENT) {
    return validationFailure('unsupported_schema_version', HORSE_TRANSFER_OLDER_SCHEMA_MESSAGE);
  }

  if (!isNonEmptyString(input.createdAt)) {
    return validationFailure('missing_key', 'Horse package is missing createdAt.');
  }

  const appResult = validateApp(input.app);
  if (appResult) return { ok: false, error: appResult };

  const sourceHorseResult = validateSourceHorse(input.sourceHorse);
  if (!sourceHorseResult.ok) return sourceHorseResult;

  const privacyResult = validatePrivacy(input.privacy);
  if (privacyResult) return { ok: false, error: privacyResult };

  const tablesResult = validateTables(input.tables);
  if (!tablesResult.ok) return tablesResult;
  const app = input.app as { readonly version: string };
  const privacy = input.privacy as {
    readonly redactedContextStallions: boolean;
    readonly redactedDoseRecipientAndShipping: boolean;
  };

  const envelope: HorseTransferEnvelopeV1 = {
    artifactType: HORSE_TRANSFER_ARTIFACT_TYPE,
    transferVersion: HORSE_TRANSFER_VERSION,
    dataSchemaVersion: BACKUP_SCHEMA_VERSION_CURRENT,
    createdAt: input.createdAt,
    app: {
      name: 'BreedWise',
      version: app.version,
    },
    sourceHorse: sourceHorseResult.sourceHorse,
    privacy: {
      redactedContextStallions: privacy.redactedContextStallions,
      redactedDoseRecipientAndShipping: privacy.redactedDoseRecipientAndShipping,
    },
    tables: tablesResult.tables,
  };

  const scopeError = validateScope(envelope);
  if (scopeError) {
    return { ok: false, error: scopeError };
  }

  return {
    ok: true,
    envelope,
    preview: buildPreview(envelope),
  };
}

export function isHorseTransferArtifactPayload(input: unknown): boolean {
  return isRecord(input) && input.artifactType === HORSE_TRANSFER_ARTIFACT_TYPE;
}

function validateApp(input: unknown): ValidateHorseTransferError | null {
  if (!isRecord(input)) {
    return createError('missing_key', 'Horse package is missing app metadata.');
  }

  const keyError = validateExactKeys(input, APP_KEYS, 'Horse package app metadata');
  if (keyError) return keyError;

  if (input.name !== 'BreedWise' || !isNonEmptyString(input.version)) {
    return createError('invalid_shape', 'Horse package app metadata is invalid.');
  }

  return null;
}

function validateSourceHorse(
  input: unknown,
): SourceHorseValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: createError('missing_key', 'Horse package is missing sourceHorse.'),
    };
  }

  const keyError = validateExactKeys(input, SOURCE_HORSE_KEYS, 'Horse package sourceHorse');
  if (keyError) return { ok: false, error: keyError };

  if (input.type !== 'mare' && input.type !== 'stallion') {
    return {
      ok: false,
      error: createError('invalid_shape', 'Horse package sourceHorse.type is invalid.'),
    };
  }
  if (!isNonEmptyString(input.id) || !isNonEmptyString(input.name)) {
    return {
      ok: false,
      error: createError('invalid_shape', 'Horse package sourceHorse id and name are required.'),
    };
  }
  if (!isNullableString(input.registrationNumber) || !isNullableString(input.dateOfBirth)) {
    return {
      ok: false,
      error: createError(
        'invalid_shape',
        'Horse package sourceHorse registrationNumber and dateOfBirth must be strings or null.',
      ),
    };
  }

  return {
    ok: true,
    sourceHorse: {
      type: input.type,
      id: input.id,
      name: input.name,
      registrationNumber: input.registrationNumber,
      dateOfBirth: input.dateOfBirth,
    },
  };
}

function validatePrivacy(input: unknown): ValidateHorseTransferError | null {
  if (!isRecord(input)) {
    return createError('missing_key', 'Horse package is missing privacy metadata.');
  }

  const keyError = validateExactKeys(input, PRIVACY_KEYS, 'Horse package privacy metadata');
  if (keyError) return keyError;

  if (
    typeof input.redactedContextStallions !== 'boolean' ||
    typeof input.redactedDoseRecipientAndShipping !== 'boolean'
  ) {
    return createError('invalid_shape', 'Horse package privacy metadata is invalid.');
  }

  return null;
}

function validateTables(
  input: unknown,
): TableValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: createError('missing_key', 'Horse package is missing tables.'),
    };
  }

  const tableKeyError = validateExactKeys(input, BACKUP_TABLE_NAMES, 'Horse package tables');
  if (tableKeyError) {
    return { ok: false, error: tableKeyError };
  }

  for (const tableName of BACKUP_TABLE_NAMES) {
    const rows = input[tableName];
    if (!Array.isArray(rows)) {
      return {
        ok: false,
        error: createError(
          'missing_key',
          `Horse package tables.${tableName} must be an array.`,
        ),
      };
    }

    const rowKeys = TABLE_FIELD_NAMES[tableName];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!isRecord(row)) {
        return {
          ok: false,
          error: createError(
            'invalid_row',
            `${tableName}[${rowIndex}] must be an object.`,
            {
              table: tableName,
              rowIndex,
              field: 'row',
            },
          ),
        };
      }

      const rowKeyError = validateExactKeys(
        row,
        rowKeys,
        `Horse package tables.${tableName}[${rowIndex}]`,
        tableName,
        rowIndex,
      );
      if (rowKeyError) {
        return { ok: false, error: rowKeyError };
      }
    }
  }

  return {
    ok: true,
    tables: input as unknown as HorseTransferTablesV1,
  };
}

function validateScope(envelope: HorseTransferEnvelopeV1): ValidateHorseTransferError | null {
  if (envelope.sourceHorse.type === 'mare') {
    if (envelope.tables.mares.length !== 1) {
      return createError('constraint_violation', 'Mare horse packages must contain exactly one mare row.', {
        table: 'mares',
      });
    }

    const mare = envelope.tables.mares[0];
    if (mare.id !== envelope.sourceHorse.id) {
      return createError('constraint_violation', 'Mare row must match sourceHorse.id.', {
        table: 'mares',
        rowIndex: 0,
        field: 'id',
      });
    }
    if (mare.deleted_at !== null) {
      return createError('constraint_violation', 'Mare horse package root mare cannot be deleted.', {
        table: 'mares',
        rowIndex: 0,
        field: 'deleted_at',
      });
    }
    if (
      envelope.tables.collection_dose_events.length > 0 ||
      envelope.tables.frozen_semen_batches.length > 0
    ) {
      return createError(
        'constraint_violation',
        'Mare horse packages cannot include stallion inventory tables.',
      );
    }
    return null;
  }

  if (envelope.tables.stallions.length !== 1) {
    return createError('constraint_violation', 'Stallion horse packages must contain exactly one stallion row.', {
      table: 'stallions',
    });
  }

  const stallion = envelope.tables.stallions[0];
  if (stallion.id !== envelope.sourceHorse.id) {
    return createError('constraint_violation', 'Stallion row must match sourceHorse.id.', {
      table: 'stallions',
      rowIndex: 0,
      field: 'id',
    });
  }
  if (stallion.deleted_at !== null) {
    return createError(
      'constraint_violation',
      'Stallion horse package root stallion cannot be deleted.',
      {
        table: 'stallions',
        rowIndex: 0,
        field: 'deleted_at',
      },
    );
  }

  for (const tableName of STALLION_PACKAGE_EMPTY_TABLES) {
    if (envelope.tables[tableName].length > 0) {
      return createError(
        'constraint_violation',
        `Stallion horse packages cannot include ${tableName} rows.`,
        { table: tableName },
      );
    }
  }

  for (let rowIndex = 0; rowIndex < envelope.tables.collection_dose_events.length; rowIndex += 1) {
    const row = envelope.tables.collection_dose_events[rowIndex];
    if (row.breeding_record_id !== null) {
      return createError(
        'constraint_violation',
        'Stallion horse package dose events must have breeding_record_id set to null.',
        {
          table: 'collection_dose_events',
          rowIndex,
          field: 'breeding_record_id',
        },
      );
    }
  }

  return null;
}

function buildPreview(envelope: HorseTransferEnvelopeV1): HorseTransferPreviewSummary {
  return {
    createdAt: envelope.createdAt,
    appVersion: envelope.app.version,
    dataSchemaVersion: envelope.dataSchemaVersion,
    sourceHorse: envelope.sourceHorse,
    privacy: envelope.privacy,
    tableCounts: Object.fromEntries(
      BACKUP_TABLE_NAMES.map((tableName) => [tableName, envelope.tables[tableName].length]),
    ) as Record<BackupTableName, number>,
  };
}

function validateExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
  table?: BackupTableName,
  rowIndex?: number,
): ValidateHorseTransferError | null {
  const expected = new Set(expectedKeys);

  for (const key of expectedKeys) {
    if (!(key in value)) {
      return createError('missing_key', `${label} is missing ${key}.`, {
        table,
        rowIndex,
        field: key,
      });
    }
  }

  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      return createError('invalid_shape', `${label} has unknown field ${key}.`, {
        table,
        rowIndex,
        field: key,
      });
    }
  }

  return null;
}

function validationFailure(
  code: ValidateHorseTransferError['code'],
  message: string,
  details: Pick<ValidateHorseTransferError, 'table' | 'rowIndex' | 'field'> = {},
): ValidateHorseTransferResult {
  return {
    ok: false,
    error: createError(code, message, details),
  };
}

function createError(
  code: ValidateHorseTransferError['code'],
  message: string,
  details: Pick<ValidateHorseTransferError, 'table' | 'rowIndex' | 'field'> = {},
): ValidateHorseTransferError {
  return {
    code,
    message,
    ...details,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
