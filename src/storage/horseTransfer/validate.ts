import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  BACKUP_TABLE_NAMES,
  type BackupTableName,
  type ValidateBackupError,
} from '@/storage/backup/types';
import { BACKUP_CURRENT_TABLE_FIELD_NAMES } from '@/storage/backup/tableSpecs';
import { validateCurrentBackupTables } from '@/storage/backup/validate';

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

  const backupTablesError = validateCurrentBackupTables(tablesResult.tables);
  if (backupTablesError) {
    return { ok: false, error: mapBackupValidationError(backupTablesError) };
  }

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

    const rowKeys = BACKUP_CURRENT_TABLE_FIELD_NAMES[tableName];
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
  return envelope.sourceHorse.type === 'mare'
    ? validateMareScope(envelope)
    : validateStallionScope(envelope);
}

function validateMareScope(envelope: HorseTransferEnvelopeV1): ValidateHorseTransferError | null {
  const sourceMareId = envelope.sourceHorse.id;

  if (envelope.tables.mares.length !== 1) {
    return createError('constraint_violation', 'Mare horse packages must contain exactly one mare row.', {
      table: 'mares',
    });
  }

  const mare = envelope.tables.mares[0];
  if (mare.id !== sourceMareId) {
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

  const mareOwnedError =
    validateMareOwnedRows('daily_logs', envelope.tables.daily_logs, sourceMareId) ??
    validateMareOwnedRows('breeding_records', envelope.tables.breeding_records, sourceMareId) ??
    validateMareOwnedRows('pregnancy_checks', envelope.tables.pregnancy_checks, sourceMareId) ??
    validateMareOwnedRows('foaling_records', envelope.tables.foaling_records, sourceMareId) ??
    validateMareOwnedRows('medication_logs', envelope.tables.medication_logs, sourceMareId) ??
    validateMareOwnedRows('tasks', envelope.tables.tasks, sourceMareId);
  if (mareOwnedError) return mareOwnedError;

  const foalError = validateMareFoalScope(envelope, sourceMareId);
  if (foalError) return foalError;

  const uterineError = validateMareUterineScope(envelope, sourceMareId);
  if (uterineError) return uterineError;

  if (envelope.tables.collection_dose_events.length > 0) {
    return createError(
      'constraint_violation',
      'Mare horse packages cannot include collection dose events.',
      { table: 'collection_dose_events' },
    );
  }
  if (envelope.tables.frozen_semen_batches.length > 0) {
    return createError(
      'constraint_violation',
      'Mare horse packages cannot include frozen semen batches.',
      { table: 'frozen_semen_batches' },
    );
  }

  const contextStallionError = validateMareContextStallionScope(envelope);
  if (contextStallionError) return contextStallionError;

  const collectionError = validateMareSemenCollectionScope(envelope);
  if (collectionError) return collectionError;

  return validateMareTaskPointers(envelope);
}

function validateStallionScope(envelope: HorseTransferEnvelopeV1): ValidateHorseTransferError | null {
  const sourceStallionId = envelope.sourceHorse.id;

  if (envelope.tables.stallions.length !== 1) {
    return createError('constraint_violation', 'Stallion horse packages must contain exactly one stallion row.', {
      table: 'stallions',
    });
  }

  const stallion = envelope.tables.stallions[0];
  if (stallion.id !== sourceStallionId) {
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

  const collectionIds = new Set<string>();
  for (let rowIndex = 0; rowIndex < envelope.tables.semen_collections.length; rowIndex += 1) {
    const row = envelope.tables.semen_collections[rowIndex];
    collectionIds.add(row.id);
    if (row.stallion_id !== sourceStallionId) {
      return createError(
        'constraint_violation',
        'Stallion horse package semen collections must point to sourceHorse.id.',
        {
          table: 'semen_collections',
          rowIndex,
          field: 'stallion_id',
        },
      );
    }
  }

  for (let rowIndex = 0; rowIndex < envelope.tables.frozen_semen_batches.length; rowIndex += 1) {
    const row = envelope.tables.frozen_semen_batches[rowIndex];
    if (row.stallion_id !== sourceStallionId) {
      return createError(
        'constraint_violation',
        'Stallion horse package frozen semen batches must point to sourceHorse.id.',
        {
          table: 'frozen_semen_batches',
          rowIndex,
          field: 'stallion_id',
        },
      );
    }
    if (row.collection_id !== null && !collectionIds.has(row.collection_id)) {
      return createError(
        'constraint_violation',
        'Stallion horse package frozen semen batches must reference included collections.',
        {
          table: 'frozen_semen_batches',
          rowIndex,
          field: 'collection_id',
        },
      );
    }
  }

  for (let rowIndex = 0; rowIndex < envelope.tables.collection_dose_events.length; rowIndex += 1) {
    const row = envelope.tables.collection_dose_events[rowIndex];
    if (!collectionIds.has(row.collection_id)) {
      return createError(
        'constraint_violation',
        'Stallion horse package dose events must reference included collections.',
        {
          table: 'collection_dose_events',
          rowIndex,
          field: 'collection_id',
        },
      );
    }
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

function validateMareOwnedRows(
  table: BackupTableName,
  rows: readonly { readonly mare_id: string }[],
  sourceMareId: string,
): ValidateHorseTransferError | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (rows[rowIndex].mare_id !== sourceMareId) {
      return createError(
        'constraint_violation',
        `Mare horse package ${table} rows must point to sourceHorse.id.`,
        {
          table,
          rowIndex,
          field: 'mare_id',
        },
      );
    }
  }

  return null;
}

function validateMareFoalScope(
  envelope: HorseTransferEnvelopeV1,
  sourceMareId: string,
): ValidateHorseTransferError | null {
  const foalingById = new Map(envelope.tables.foaling_records.map((row) => [row.id, row]));

  for (let rowIndex = 0; rowIndex < envelope.tables.foals.length; rowIndex += 1) {
    const row = envelope.tables.foals[rowIndex];
    const foaling = foalingById.get(row.foaling_record_id);
    if (!foaling || foaling.mare_id !== sourceMareId) {
      return createError(
        'constraint_violation',
        'Mare horse package foals must resolve to sourceHorse.id through included foaling records.',
        {
          table: 'foals',
          rowIndex,
          field: 'foaling_record_id',
        },
      );
    }
  }

  return null;
}

function validateMareUterineScope(
  envelope: HorseTransferEnvelopeV1,
  sourceMareId: string,
): ValidateHorseTransferError | null {
  const dailyLogById = new Map(envelope.tables.daily_logs.map((row) => [row.id, row]));
  const flushById = new Map(envelope.tables.uterine_flushes.map((row) => [row.id, row]));

  for (let rowIndex = 0; rowIndex < envelope.tables.uterine_fluid.length; rowIndex += 1) {
    const row = envelope.tables.uterine_fluid[rowIndex];
    const dailyLog = dailyLogById.get(row.daily_log_id);
    if (!dailyLog || dailyLog.mare_id !== sourceMareId) {
      return createError(
        'constraint_violation',
        'Mare horse package uterine fluid rows must resolve to sourceHorse.id.',
        {
          table: 'uterine_fluid',
          rowIndex,
          field: 'daily_log_id',
        },
      );
    }
  }

  for (let rowIndex = 0; rowIndex < envelope.tables.uterine_flushes.length; rowIndex += 1) {
    const row = envelope.tables.uterine_flushes[rowIndex];
    const dailyLog = dailyLogById.get(row.daily_log_id);
    if (!dailyLog || dailyLog.mare_id !== sourceMareId) {
      return createError(
        'constraint_violation',
        'Mare horse package uterine flush rows must resolve to sourceHorse.id.',
        {
          table: 'uterine_flushes',
          rowIndex,
          field: 'daily_log_id',
        },
      );
    }
  }

  for (
    let rowIndex = 0;
    rowIndex < envelope.tables.uterine_flush_products.length;
    rowIndex += 1
  ) {
    const row = envelope.tables.uterine_flush_products[rowIndex];
    const flush = flushById.get(row.uterine_flush_id);
    const dailyLog = flush ? dailyLogById.get(flush.daily_log_id) : undefined;
    if (!dailyLog || dailyLog.mare_id !== sourceMareId) {
      return createError(
        'constraint_violation',
        'Mare horse package uterine flush products must resolve to sourceHorse.id.',
        {
          table: 'uterine_flush_products',
          rowIndex,
          field: 'uterine_flush_id',
        },
      );
    }
  }

  return null;
}

function validateMareContextStallionScope(
  envelope: HorseTransferEnvelopeV1,
): ValidateHorseTransferError | null {
  const referencedStallionIds = new Set(
    envelope.tables.breeding_records
      .map((row) => row.stallion_id)
      .filter((id): id is string => id !== null),
  );
  const includedStallionIds = new Set(envelope.tables.stallions.map((row) => row.id));

  for (let rowIndex = 0; rowIndex < envelope.tables.stallions.length; rowIndex += 1) {
    const row = envelope.tables.stallions[rowIndex];
    if (!referencedStallionIds.has(row.id)) {
      return createError(
        'constraint_violation',
        'Mare horse packages cannot include unreferenced context stallions.',
        {
          table: 'stallions',
          rowIndex,
          field: 'id',
        },
      );
    }
  }

  for (let rowIndex = 0; rowIndex < envelope.tables.breeding_records.length; rowIndex += 1) {
    const row = envelope.tables.breeding_records[rowIndex];
    if (row.stallion_id !== null && !includedStallionIds.has(row.stallion_id)) {
      return createError(
        'constraint_violation',
        'Mare horse packages must include each referenced context stallion.',
        {
          table: 'breeding_records',
          rowIndex,
          field: 'stallion_id',
        },
      );
    }
  }

  return null;
}

function validateMareSemenCollectionScope(
  envelope: HorseTransferEnvelopeV1,
): ValidateHorseTransferError | null {
  const referencedCollectionIds = new Set(
    envelope.tables.breeding_records
      .map((row) => row.collection_id)
      .filter((id): id is string => id !== null),
  );
  const collectionById = new Map(envelope.tables.semen_collections.map((row) => [row.id, row]));

  for (let rowIndex = 0; rowIndex < envelope.tables.semen_collections.length; rowIndex += 1) {
    const row = envelope.tables.semen_collections[rowIndex];
    if (!referencedCollectionIds.has(row.id)) {
      return createError(
        'constraint_violation',
        'Mare horse packages cannot include unreferenced semen collections.',
        {
          table: 'semen_collections',
          rowIndex,
          field: 'id',
        },
      );
    }
  }

  for (let rowIndex = 0; rowIndex < envelope.tables.breeding_records.length; rowIndex += 1) {
    const row = envelope.tables.breeding_records[rowIndex];
    if (row.collection_id === null) {
      continue;
    }

    const collection = collectionById.get(row.collection_id);
    if (!collection) {
      return createError(
        'constraint_violation',
        'Mare horse packages must include each referenced semen collection.',
        {
          table: 'breeding_records',
          rowIndex,
          field: 'collection_id',
        },
      );
    }
    if (collection.stallion_id !== row.stallion_id) {
      return createError(
        'constraint_violation',
        'Mare horse package semen collections must belong to the breeding stallion.',
        {
          table: 'breeding_records',
          rowIndex,
          field: 'collection_id',
        },
      );
    }
  }

  return null;
}

function validateMareTaskPointers(
  envelope: HorseTransferEnvelopeV1,
): ValidateHorseTransferError | null {
  for (let rowIndex = 0; rowIndex < envelope.tables.tasks.length; rowIndex += 1) {
    const row = envelope.tables.tasks[rowIndex];
    if (
      row.completed_record_type !== null &&
      row.completed_record_id !== null &&
      !hasTaskPointerTarget(envelope, row.completed_record_type, row.completed_record_id)
    ) {
      return createError(
        'constraint_violation',
        'Mare horse package completed task pointers must resolve to included rows.',
        {
          table: 'tasks',
          rowIndex,
          field: 'completed_record_id',
        },
      );
    }

    if (row.source_type !== 'manual') {
      if (
        row.source_record_id === null ||
        !hasTaskPointerTarget(envelope, row.source_type, row.source_record_id)
      ) {
        return createError(
          'constraint_violation',
          'Mare horse package task source pointers must resolve to included rows.',
          {
            table: 'tasks',
            rowIndex,
            field: 'source_record_id',
          },
        );
      }
    }
  }

  return null;
}

function hasTaskPointerTarget(
  envelope: HorseTransferEnvelopeV1,
  recordType: 'dailyLog' | 'medicationLog' | 'breedingRecord' | 'pregnancyCheck',
  recordId: string,
): boolean {
  switch (recordType) {
    case 'dailyLog':
      return envelope.tables.daily_logs.some((row) => row.id === recordId);
    case 'medicationLog':
      return envelope.tables.medication_logs.some((row) => row.id === recordId);
    case 'breedingRecord':
      return envelope.tables.breeding_records.some((row) => row.id === recordId);
    case 'pregnancyCheck':
      return envelope.tables.pregnancy_checks.some((row) => row.id === recordId);
  }

  return false;
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

function mapBackupValidationError(error: ValidateBackupError): ValidateHorseTransferError {
  return {
    code: error.code,
    message: error.message,
    table: error.table,
    rowIndex: error.rowIndex,
    field: error.field,
  };
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
