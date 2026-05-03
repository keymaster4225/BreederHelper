import {
  BREEDING_METHOD_VALUES,
  CERVICAL_FIRMNESS_VALUES,
  COLLECTION_TARGET_MODE_VALUES,
  DOSE_EVENT_TYPE_VALUES,
  FLUID_LOCATION_VALUES,
  FOLLICLE_STATE_VALUES,
  FOAL_COLOR_VALUES,
  FOAL_MILESTONE_KEYS as FOAL_MILESTONE_VALUE_KEYS,
  FOAL_SEX_VALUES,
  FOALING_OUTCOME_VALUES,
  FREEZING_EXTENDER_VALUES,
  MEDICATION_ROUTE_VALUES,
  OVARY_CONSISTENCY_VALUES,
  PHOTO_ATTACHMENT_ROLE_VALUES,
  PHOTO_OWNER_TYPE_VALUES,
  PHOTO_SOURCE_KIND_VALUES,
  PREGNANCY_RESULT_VALUES,
  STRAW_COLOR_VALUES,
  UTERINE_TONE_CATEGORY_VALUES,
} from '@/models/enums';
import {
  BACKUP_SCHEMA_VERSION_CURRENT,
  BACKUP_SCHEMA_VERSION_V1,
  BACKUP_SCHEMA_VERSION_V2,
  BACKUP_SCHEMA_VERSION_V3,
  BACKUP_SCHEMA_VERSION_V4,
  BACKUP_SCHEMA_VERSION_V5,
  BACKUP_SCHEMA_VERSION_V6,
  BACKUP_SCHEMA_VERSION_V7,
  BACKUP_SCHEMA_VERSION_V8,
  BACKUP_SCHEMA_VERSION_V9,
  BACKUP_SCHEMA_VERSION_V10,
  BACKUP_SCHEMA_VERSION_V11,
  BACKUP_SCHEMA_VERSION_V12,
  type BackupBreedingRecordRow,
  type BackupBreedingRecordRowLegacy,
  type BackupCollectionDoseEventRowV3,
  type BackupEnvelope,
  type BackupFoalingRecordRow,
  type BackupPreviewSummary,
  type BackupSemenCollectionRowV2,
  type BackupSemenCollectionRowV3,
  type BackupSettings,
  type ManagedBackupTableName,
  type BackupTablesV1,
  type BackupTablesV2,
  type BackupTablesV3,
  type BackupTablesV4,
  type BackupTablesV5,
  type BackupTablesV6,
  type BackupTablesV7,
  type BackupTablesV8,
  type BackupTablesV9,
  type BackupTablesV10,
  type BackupTablesV11,
  type BackupTablesV12,
  type ValidateBackupError,
  type ValidateBackupResult,
} from './types';
import { normalizeDailyLogTime } from '@/utils/dailyLogTime';
import { normalizeBreedingRecordTime } from '@/utils/breedingRecordTime';
import { normalizeClockPreference } from '@/utils/clockPreferences';

const BREEDING_METHODS = new Set(BREEDING_METHOD_VALUES);
const PREGNANCY_RESULTS = new Set(PREGNANCY_RESULT_VALUES);
const FOALING_OUTCOMES = new Set(FOALING_OUTCOME_VALUES);
const FOAL_SEXES = new Set(FOAL_SEX_VALUES);
const FOAL_COLORS = new Set(FOAL_COLOR_VALUES);
const FREEZING_EXTENDERS = new Set(FREEZING_EXTENDER_VALUES);
const MEDICATION_ROUTES = new Set(MEDICATION_ROUTE_VALUES);
const COLLECTION_EVENT_TYPES = new Set(DOSE_EVENT_TYPE_VALUES);
const COLLECTION_TARGET_MODES = new Set(COLLECTION_TARGET_MODE_VALUES);
const FOLLICLE_STATES = new Set(FOLLICLE_STATE_VALUES);
const OVARY_CONSISTENCIES = new Set(OVARY_CONSISTENCY_VALUES);
const STRAW_COLORS = new Set(STRAW_COLOR_VALUES);
const UTERINE_TONE_CATEGORIES = new Set(UTERINE_TONE_CATEGORY_VALUES);
const CERVICAL_FIRMNESSES = new Set(CERVICAL_FIRMNESS_VALUES);
const FLUID_LOCATIONS = new Set(FLUID_LOCATION_VALUES);
const FOAL_MILESTONE_KEYS: ReadonlySet<string> = new Set(FOAL_MILESTONE_VALUE_KEYS);
const TASK_TYPES = new Set(['dailyCheck', 'medication', 'breeding', 'pregnancyCheck', 'custom']);
const TASK_STATUSES = new Set(['open', 'completed']);
const TASK_SOURCE_TYPES = new Set([
  'manual',
  'dailyLog',
  'medicationLog',
  'breedingRecord',
  'pregnancyCheck',
]);
const TASK_COMPLETED_RECORD_TYPES = new Set([
  'dailyLog',
  'medicationLog',
  'breedingRecord',
  'pregnancyCheck',
]);
const TASK_SOURCE_REASONS = new Set(['manualFollowUp', 'breedingPregnancyCheck']);
const PHOTO_OWNER_TYPES = new Set(PHOTO_OWNER_TYPE_VALUES);
const PHOTO_ATTACHMENT_ROLES = new Set(PHOTO_ATTACHMENT_ROLE_VALUES);
const PHOTO_SOURCE_KINDS = new Set(PHOTO_SOURCE_KIND_VALUES);

type BackupTables =
  | BackupTablesV1
  | BackupTablesV2
  | BackupTablesV3
  | BackupTablesV4
  | BackupTablesV5
  | BackupTablesV6
  | BackupTablesV7
  | BackupTablesV8
  | BackupTablesV9
  | BackupTablesV10
  | BackupTablesV11
  | BackupTablesV12;

type ValidationIndexes = {
  readonly mareIds: ReadonlySet<string>;
  readonly dailyLogIds: ReadonlySet<string>;
  readonly uterineFlushIds: ReadonlySet<string>;
  readonly stallionIds: ReadonlySet<string>;
  readonly breedingById: ReadonlyMap<string, BackupBreedingRecordRow | BackupBreedingRecordRowLegacy>;
  readonly foalingById: ReadonlyMap<string, BackupFoalingRecordRow>;
  readonly collectionById: ReadonlyMap<
    string,
    BackupSemenCollectionRowV2 | BackupSemenCollectionRowV3
  >;
};

export function validateBackupJson(jsonText: string): ValidateBackupResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return validationFailure('invalid_json', 'Backup file is not valid JSON.');
  }

  return validateBackup(parsed);
}

export function validateBackup(input: unknown): ValidateBackupResult {
  if (!isRecord(input)) {
    return validationFailure('invalid_shape', 'Backup payload must be an object.');
  }

  const schemaVersion = input.schemaVersion;
  if (typeof schemaVersion !== 'number') {
    return validationFailure('missing_key', 'Backup is missing schemaVersion.');
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION_CURRENT) {
    return validationFailure(
      'unsupported_schema_version',
      'This backup was created with a newer version of BreedWise. Please update the app.',
    );
  }
  if (
    schemaVersion !== BACKUP_SCHEMA_VERSION_V1 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V2 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V3 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V4 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V5 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V6 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V7 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V8 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V9 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V10 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V11 &&
    schemaVersion !== BACKUP_SCHEMA_VERSION_V12
  ) {
    return validationFailure(
      'unsupported_schema_version',
      `Backup schemaVersion ${String(schemaVersion)} is not supported by this build.`,
    );
  }

  if (!isNonEmptyString(input.createdAt)) {
    return validationFailure('missing_key', 'Backup is missing createdAt.');
  }
  if (!isRecord(input.app)) {
    return validationFailure('missing_key', 'Backup is missing app metadata.');
  }
  if (input.app.name !== 'BreedWise' || !isNonEmptyString(input.app.version)) {
    return validationFailure('invalid_shape', 'Backup app metadata is invalid.');
  }

  if (!isRecord(input.settings)) {
    return validationFailure('missing_key', 'Backup is missing settings.');
  }
  const settingsError = validateSettings(input.settings, schemaVersion);
  if (settingsError) {
    return settingsError;
  }

  if (!isRecord(input.tables)) {
    return validationFailure('missing_key', 'Backup is missing tables.');
  }

  const tables = input.tables;
  const tableArrays = getTableArrays(tables, schemaVersion);
  if (!tableArrays.ok) {
    return tableArrays.error;
  }

  const baseEnvelopeFields = {
    createdAt: input.createdAt,
    app: {
      name: 'BreedWise' as const,
      version: input.app.version,
    },
    settings: input.settings as BackupSettings,
  };
  const backup: BackupEnvelope =
    schemaVersion === BACKUP_SCHEMA_VERSION_V1
      ? {
          schemaVersion: BACKUP_SCHEMA_VERSION_V1,
          ...baseEnvelopeFields,
          tables: tableArrays.tables as BackupTablesV1,
        }
      : schemaVersion === BACKUP_SCHEMA_VERSION_V2
        ? {
            schemaVersion: BACKUP_SCHEMA_VERSION_V2,
            ...baseEnvelopeFields,
            tables: tableArrays.tables as BackupTablesV2,
          }
        : schemaVersion === BACKUP_SCHEMA_VERSION_V3
          ? {
              schemaVersion: BACKUP_SCHEMA_VERSION_V3,
              ...baseEnvelopeFields,
              tables: tableArrays.tables as BackupTablesV3,
            }
          : schemaVersion === BACKUP_SCHEMA_VERSION_V4
            ? {
                schemaVersion: BACKUP_SCHEMA_VERSION_V4,
                ...baseEnvelopeFields,
                tables: tableArrays.tables as BackupTablesV4,
              }
            : schemaVersion === BACKUP_SCHEMA_VERSION_V5
              ? {
                  schemaVersion: BACKUP_SCHEMA_VERSION_V5,
                  ...baseEnvelopeFields,
                  tables: tableArrays.tables as BackupTablesV5,
                }
              : schemaVersion === BACKUP_SCHEMA_VERSION_V6
                ? {
                    schemaVersion: BACKUP_SCHEMA_VERSION_V6,
                    ...baseEnvelopeFields,
                    tables: tableArrays.tables as BackupTablesV6,
                  }
              : schemaVersion === BACKUP_SCHEMA_VERSION_V7
                ? {
                    schemaVersion: BACKUP_SCHEMA_VERSION_V7,
                    ...baseEnvelopeFields,
                    tables: tableArrays.tables as BackupTablesV7,
                  }
                : schemaVersion === BACKUP_SCHEMA_VERSION_V8
                  ? {
                      schemaVersion: BACKUP_SCHEMA_VERSION_V8,
                      ...baseEnvelopeFields,
                      tables: tableArrays.tables as BackupTablesV8,
                    }
                  : schemaVersion === BACKUP_SCHEMA_VERSION_V9
                    ? {
                        schemaVersion: BACKUP_SCHEMA_VERSION_V9,
                        ...baseEnvelopeFields,
                        tables: tableArrays.tables as BackupTablesV9,
                      }
                    : schemaVersion === BACKUP_SCHEMA_VERSION_V10
                      ? {
                          schemaVersion: BACKUP_SCHEMA_VERSION_V10,
                          ...baseEnvelopeFields,
                          tables: tableArrays.tables as BackupTablesV10,
                        }
                    : schemaVersion === BACKUP_SCHEMA_VERSION_V11
                      ? {
                          schemaVersion: BACKUP_SCHEMA_VERSION_V11,
                          ...baseEnvelopeFields,
                          tables: tableArrays.tables as BackupTablesV11,
                        }
                      : {
                          schemaVersion: BACKUP_SCHEMA_VERSION_V12,
                          ...baseEnvelopeFields,
                          tables: tableArrays.tables as BackupTablesV12,
                        };

  const rowError = validateRows(backup.tables, schemaVersion);
  if (rowError) {
    return rowError;
  }

  const indexes = buildIndexes(backup.tables);
  const crossTableError = validateCrossTableRules(backup.tables, indexes, schemaVersion);
  if (crossTableError) {
    return crossTableError;
  }

  return {
    ok: true,
    backup,
    preview: buildBackupPreview(backup),
  };
}

export function buildBackupPreview(backup: BackupEnvelope): BackupPreviewSummary {
  return {
    createdAt: backup.createdAt,
    mareCount: backup.tables.mares.length,
    stallionCount: backup.tables.stallions.length,
    dailyLogCount: backup.tables.daily_logs.length,
    onboardingComplete: backup.settings.onboardingComplete,
    schemaVersion: backup.schemaVersion,
  };
}

export function validateCurrentBackupTables(
  input: unknown,
  options: { readonly includePhotoTables?: boolean } = {},
): ValidateBackupError | null {
  if (!isRecord(input)) {
    return {
      code: 'invalid_shape',
      message: 'Backup tables must be an object.',
    };
  }

  const schemaVersion =
    options.includePhotoTables === false
      ? BACKUP_SCHEMA_VERSION_V11
      : BACKUP_SCHEMA_VERSION_CURRENT;
  const tableArrays = getTableArrays(input, schemaVersion);
  if (!tableArrays.ok) {
    return getValidationError(tableArrays.error);
  }

  const tables = tableArrays.tables as BackupTablesV11 | BackupTablesV12;
  const rowError = validateRows(tables, schemaVersion);
  if (rowError) {
    return getValidationError(rowError);
  }

  const indexes = buildIndexes(tables);
  const crossTableError = validateCrossTableRules(
    tables,
    indexes,
    schemaVersion,
  );
  if (crossTableError) {
    return getValidationError(crossTableError);
  }

  return null;
}

function validateSettings(settings: Record<string, unknown>, schemaVersion: number): ValidateBackupResult | null {
  if (typeof settings.onboardingComplete !== 'boolean') {
    return validationFailure(
      'invalid_shape',
      'Backup settings.onboardingComplete must be a boolean.',
    );
  }
  if (
    schemaVersion >= BACKUP_SCHEMA_VERSION_V9 &&
    normalizeClockPreference(settings.clockPreference) !== settings.clockPreference
  ) {
    return validationFailure(
      'invalid_shape',
      'Backup settings.clockPreference must be system, 12h, or 24h.',
    );
  }
  return null;
}

function getTableArrays(
  tables: Record<string, unknown>,
  schemaVersion: number,
):
  | { ok: true; tables: BackupTables }
  | { ok: false; error: ValidateBackupResult } {
  const requiredTables: ManagedBackupTableName[] = [
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
  ];
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V4) {
    requiredTables.push('uterine_fluid');
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V5) {
    requiredTables.push('frozen_semen_batches');
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V8) {
    requiredTables.push('uterine_flushes', 'uterine_flush_products');
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V11) {
    requiredTables.push('tasks');
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V12) {
    requiredTables.push('photo_assets', 'photo_attachments');
  }

  for (const tableName of requiredTables) {
    if (!Array.isArray(tables[tableName])) {
      return {
        ok: false,
        error: validationFailure('missing_key', `Backup tables.${tableName} must be an array.`),
      };
    }
  }

  return {
    ok: true,
    tables: tables as unknown as BackupTables,
  };
}

function validateRows(
  tables: BackupTables,
  schemaVersion: number,
): ValidateBackupResult | null {
  for (let index = 0; index < tables.mares.length; index += 1) {
    const error = validateMareRow(tables.mares[index], index, schemaVersion);
    if (error) return error;
  }
  for (let index = 0; index < tables.stallions.length; index += 1) {
    const error = validateStallionRow(tables.stallions[index], index);
    if (error) return error;
  }
  for (let index = 0; index < tables.daily_logs.length; index += 1) {
    const error = validateDailyLogRow(tables.daily_logs[index], index, schemaVersion);
    if (error) return error;
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V4) {
    const uterineFluidRows = (tables as BackupTablesV4).uterine_fluid;
    for (let index = 0; index < uterineFluidRows.length; index += 1) {
      const error = validateUterineFluidRow(uterineFluidRows[index], index);
      if (error) return error;
    }
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V8) {
    const flushRows = (tables as BackupTablesV8).uterine_flushes;
    for (let index = 0; index < flushRows.length; index += 1) {
      const error = validateUterineFlushRow(flushRows[index], index);
      if (error) return error;
    }

    const productRows = (tables as BackupTablesV8).uterine_flush_products;
    for (let index = 0; index < productRows.length; index += 1) {
      const error = validateUterineFlushProductRow(productRows[index], index);
      if (error) return error;
    }
  }
  for (let index = 0; index < tables.breeding_records.length; index += 1) {
    const error = validateBreedingRecordRow(tables.breeding_records[index], index, schemaVersion);
    if (error) return error;
  }
  for (let index = 0; index < tables.pregnancy_checks.length; index += 1) {
    const error = validatePregnancyCheckRow(tables.pregnancy_checks[index], index);
    if (error) return error;
  }
  for (let index = 0; index < tables.foaling_records.length; index += 1) {
    const error = validateFoalingRecordRow(tables.foaling_records[index], index);
    if (error) return error;
  }
  for (let index = 0; index < tables.foals.length; index += 1) {
    const error = validateFoalRow(tables.foals[index], index);
    if (error) return error;
  }
  for (let index = 0; index < tables.medication_logs.length; index += 1) {
    const error = validateMedicationLogRow(tables.medication_logs[index], index, schemaVersion);
    if (error) return error;
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V11) {
    const taskRows = (tables as BackupTablesV11).tasks;
    for (let index = 0; index < taskRows.length; index += 1) {
      const error = validateTaskRow(taskRows[index], index);
      if (error) return error;
    }
  }
  for (let index = 0; index < tables.semen_collections.length; index += 1) {
    const error = validateSemenCollectionRow(tables.semen_collections[index], index, schemaVersion);
    if (error) return error;
  }
  for (let index = 0; index < tables.collection_dose_events.length; index += 1) {
    const error = validateCollectionDoseEventRow(
      tables.collection_dose_events[index],
      index,
      schemaVersion,
    );
    if (error) return error;
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V5) {
    const frozenRows = (tables as BackupTablesV5).frozen_semen_batches;
    for (let index = 0; index < frozenRows.length; index += 1) {
      const error = validateFrozenSemenBatchRow(frozenRows[index], index);
      if (error) return error;
    }
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V12) {
    const photoTables = tables as BackupTablesV12;
    for (let index = 0; index < photoTables.photo_assets.length; index += 1) {
      const error = validatePhotoAssetRow(photoTables.photo_assets[index], index);
      if (error) return error;
    }
    for (let index = 0; index < photoTables.photo_attachments.length; index += 1) {
      const error = validatePhotoAttachmentRow(photoTables.photo_attachments[index], index);
      if (error) return error;
    }
  }

  return null;
}

function validatePhotoAssetRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('photo_assets', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('photo_assets', rowIndex, 'id', 'is required');
  if (!isSafePhotoAssetPath(row.master_relative_path, 'master')) {
    return rowFailure(
      'photo_assets',
      rowIndex,
      'master_relative_path',
      'must be photo-assets/<storageId>/master.jpg',
    );
  }
  if (!isSafePhotoAssetPath(row.thumbnail_relative_path, 'thumbnail')) {
    return rowFailure(
      'photo_assets',
      rowIndex,
      'thumbnail_relative_path',
      'must be photo-assets/<storageId>/thumbnail.jpg',
    );
  }
  if (photoStorageId(row.master_relative_path) !== photoStorageId(row.thumbnail_relative_path)) {
    return rowFailure(
      'photo_assets',
      rowIndex,
      'thumbnail_relative_path',
      'must use the same storage id as master_relative_path',
    );
  }
  if (row.master_mime_type !== 'image/jpeg' || row.thumbnail_mime_type !== 'image/jpeg') {
    return rowFailure('photo_assets', rowIndex, 'mime_type', 'must be image/jpeg');
  }
  if (!isPositiveInteger(row.width)) {
    return rowFailure('photo_assets', rowIndex, 'width', 'must be a positive integer');
  }
  if (!isPositiveInteger(row.height)) {
    return rowFailure('photo_assets', rowIndex, 'height', 'must be a positive integer');
  }
  if (!isPositiveInteger(row.file_size_bytes)) {
    return rowFailure('photo_assets', rowIndex, 'file_size_bytes', 'must be a positive integer');
  }
  if (!isStringEnum(row.source_kind, PHOTO_SOURCE_KINDS)) {
    return rowFailure('photo_assets', rowIndex, 'source_kind', 'must be a supported source kind');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('photo_assets', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validatePhotoAttachmentRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('photo_attachments', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('photo_attachments', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.photo_asset_id)) {
    return rowFailure('photo_attachments', rowIndex, 'photo_asset_id', 'is required');
  }
  if (!isStringEnum(row.owner_type, PHOTO_OWNER_TYPES)) {
    return rowFailure('photo_attachments', rowIndex, 'owner_type', 'must be a supported owner type');
  }
  if (!isNonEmptyString(row.owner_id)) {
    return rowFailure('photo_attachments', rowIndex, 'owner_id', 'is required');
  }
  if (!isStringEnum(row.role, PHOTO_ATTACHMENT_ROLES)) {
    return rowFailure('photo_attachments', rowIndex, 'role', 'must be profile or attachment');
  }
  if (!isPositiveOrZeroInteger(row.sort_order)) {
    return rowFailure('photo_attachments', rowIndex, 'sort_order', 'must be an integer >= 0');
  }
  if (!isNullableString(row.caption)) {
    return rowFailure('photo_attachments', rowIndex, 'caption', 'must be a string or null');
  }
  if (typeof row.caption === 'string' && row.caption.length > 500) {
    return rowFailure('photo_attachments', rowIndex, 'caption', 'must be 500 characters or fewer');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('photo_attachments', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateMareRow(
  row: unknown,
  rowIndex: number,
  schemaVersion: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('mares', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('mares', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.name)) return rowFailure('mares', rowIndex, 'name', 'is required');
  if (!isNonEmptyString(row.breed)) return rowFailure('mares', rowIndex, 'breed', 'is required');
  if (!isNullableLocalDate(row.date_of_birth)) {
    return rowFailure('mares', rowIndex, 'date_of_birth', 'must be a valid YYYY-MM-DD date or null');
  }
  if (!isNullableString(row.registration_number)) {
    return rowFailure('mares', rowIndex, 'registration_number', 'must be a string or null');
  }
  if (!isNullableString(row.notes)) {
    return rowFailure('mares', rowIndex, 'notes', 'must be a string or null');
  }
  if (
    schemaVersion >= BACKUP_SCHEMA_VERSION_V2 &&
    !(typeof row.gestation_length_days === 'number' &&
      Number.isInteger(row.gestation_length_days) &&
      row.gestation_length_days >= 300 &&
      row.gestation_length_days <= 420)
  ) {
    return rowFailure(
      'mares',
      rowIndex,
      'gestation_length_days',
      'must be an integer between 300 and 420',
    );
  }
  if (
    schemaVersion >= BACKUP_SCHEMA_VERSION_V6 &&
    !(row.is_recipient === 0 || row.is_recipient === 1)
  ) {
    return rowFailure('mares', rowIndex, 'is_recipient', 'must be 0 or 1');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('mares', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }
  if (!isNullableString(row.deleted_at)) {
    return rowFailure('mares', rowIndex, 'deleted_at', 'must be a string or null');
  }

  return null;
}

function validateStallionRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('stallions', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('stallions', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.name)) return rowFailure('stallions', rowIndex, 'name', 'is required');
  if (!isNullableString(row.breed)) return rowFailure('stallions', rowIndex, 'breed', 'must be a string or null');
  if (!isNullableString(row.registration_number)) {
    return rowFailure('stallions', rowIndex, 'registration_number', 'must be a string or null');
  }
  if (!isNullableString(row.sire)) return rowFailure('stallions', rowIndex, 'sire', 'must be a string or null');
  if (!isNullableString(row.dam)) return rowFailure('stallions', rowIndex, 'dam', 'must be a string or null');
  if (!isNullableString(row.notes)) return rowFailure('stallions', rowIndex, 'notes', 'must be a string or null');
  if (!isNullableLocalDate(row.date_of_birth)) {
    return rowFailure('stallions', rowIndex, 'date_of_birth', 'must be a valid YYYY-MM-DD date or null');
  }
  if (!isNullableFiniteNumber(row.av_temperature_f)) {
    return rowFailure('stallions', rowIndex, 'av_temperature_f', 'must be a number or null');
  }
  if (!isNullableString(row.av_type)) return rowFailure('stallions', rowIndex, 'av_type', 'must be a string or null');
  if (!isNullableString(row.av_liner_type)) {
    return rowFailure('stallions', rowIndex, 'av_liner_type', 'must be a string or null');
  }
  if (!isNullableInteger(row.av_water_volume_ml)) {
    return rowFailure('stallions', rowIndex, 'av_water_volume_ml', 'must be an integer or null');
  }
  if (!isNullableString(row.av_notes)) {
    return rowFailure('stallions', rowIndex, 'av_notes', 'must be a string or null');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('stallions', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }
  if (!isNullableString(row.deleted_at)) {
    return rowFailure('stallions', rowIndex, 'deleted_at', 'must be a string or null');
  }

  return null;
}

function validateDailyLogRow(
  row: unknown,
  rowIndex: number,
  schemaVersion: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('daily_logs', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('daily_logs', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.mare_id)) return rowFailure('daily_logs', rowIndex, 'mare_id', 'is required');
  if (!isLocalDate(row.date)) return rowFailure('daily_logs', rowIndex, 'date', 'must be a valid YYYY-MM-DD date');
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V7 && !isNullableDailyLogTime(row.time)) {
    return rowFailure('daily_logs', rowIndex, 'time', 'must be a valid HH:MM value or null');
  }
  if (!isNullableIntegerInRange(row.teasing_score, 0, 5)) {
    return rowFailure('daily_logs', rowIndex, 'teasing_score', 'must be an integer 0-5 or null');
  }
  if (!isNullableString(row.right_ovary)) return rowFailure('daily_logs', rowIndex, 'right_ovary', 'must be a string or null');
  if (!isNullableString(row.left_ovary)) return rowFailure('daily_logs', rowIndex, 'left_ovary', 'must be a string or null');
  if (!isNullableFlag(row.ovulation_detected)) {
    return rowFailure('daily_logs', rowIndex, 'ovulation_detected', 'must be 0, 1, or null');
  }
  if (!isNullableIntegerInRange(row.edema, 0, 5)) {
    return rowFailure('daily_logs', rowIndex, 'edema', 'must be an integer 0-5 or null');
  }
  if (!isNullableString(row.uterine_tone)) return rowFailure('daily_logs', rowIndex, 'uterine_tone', 'must be a string or null');
  if (!isNullableString(row.uterine_cysts)) return rowFailure('daily_logs', rowIndex, 'uterine_cysts', 'must be a string or null');
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V4) {
    if (!isNullableFlag(row.right_ovary_ovulation)) {
      return rowFailure('daily_logs', rowIndex, 'right_ovary_ovulation', 'must be 0, 1, or null');
    }
    if (!isNullableStringEnum(row.right_ovary_follicle_state, FOLLICLE_STATES)) {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'right_ovary_follicle_state',
        'must be a supported follicle state or null',
      );
    }
    if (typeof row.right_ovary_follicle_measurements_mm !== 'string') {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'right_ovary_follicle_measurements_mm',
        'must be a JSON-text string',
      );
    }
    if (!isNullableStringEnum(row.right_ovary_consistency, OVARY_CONSISTENCIES)) {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'right_ovary_consistency',
        'must be a supported ovary consistency or null',
      );
    }
    if (typeof row.right_ovary_structures !== 'string') {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'right_ovary_structures',
        'must be a JSON-text string',
      );
    }
    if (!isNullableFlag(row.left_ovary_ovulation)) {
      return rowFailure('daily_logs', rowIndex, 'left_ovary_ovulation', 'must be 0, 1, or null');
    }
    if (!isNullableStringEnum(row.left_ovary_follicle_state, FOLLICLE_STATES)) {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'left_ovary_follicle_state',
        'must be a supported follicle state or null',
      );
    }
    if (typeof row.left_ovary_follicle_measurements_mm !== 'string') {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'left_ovary_follicle_measurements_mm',
        'must be a JSON-text string',
      );
    }
    if (!isNullableStringEnum(row.left_ovary_consistency, OVARY_CONSISTENCIES)) {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'left_ovary_consistency',
        'must be a supported ovary consistency or null',
      );
    }
    if (typeof row.left_ovary_structures !== 'string') {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'left_ovary_structures',
        'must be a JSON-text string',
      );
    }
    if (!isNullableStringEnum(row.uterine_tone_category, UTERINE_TONE_CATEGORIES)) {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'uterine_tone_category',
        'must be a supported uterine tone category or null',
      );
    }
    if (!isNullableStringEnum(row.cervical_firmness, CERVICAL_FIRMNESSES)) {
      return rowFailure(
        'daily_logs',
        rowIndex,
        'cervical_firmness',
        'must be a supported cervical firmness value or null',
      );
    }
    if (!isNullableFlag(row.discharge_observed)) {
      return rowFailure('daily_logs', rowIndex, 'discharge_observed', 'must be 0, 1, or null');
    }
    if (!isNullableString(row.discharge_notes)) {
      return rowFailure('daily_logs', rowIndex, 'discharge_notes', 'must be a string or null');
    }
  }
  if (!isNullableString(row.notes)) return rowFailure('daily_logs', rowIndex, 'notes', 'must be a string or null');
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('daily_logs', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateUterineFluidRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('uterine_fluid', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('uterine_fluid', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.daily_log_id)) {
    return rowFailure('uterine_fluid', rowIndex, 'daily_log_id', 'is required');
  }
  if (!(typeof row.depth_mm === 'number' && Number.isInteger(row.depth_mm) && row.depth_mm > 0)) {
    return rowFailure('uterine_fluid', rowIndex, 'depth_mm', 'must be a positive integer');
  }
  if (!isStringEnum(row.location, FLUID_LOCATIONS)) {
    return rowFailure('uterine_fluid', rowIndex, 'location', 'must be a supported fluid location');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('uterine_fluid', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateUterineFlushRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('uterine_flushes', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('uterine_flushes', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.daily_log_id)) {
    return rowFailure('uterine_flushes', rowIndex, 'daily_log_id', 'is required');
  }
  if (!isNonEmptyString(row.base_solution) || row.base_solution.trim().length === 0) {
    return rowFailure('uterine_flushes', rowIndex, 'base_solution', 'is required');
  }
  if (
    !isFiniteNumber(row.total_volume_ml) ||
    row.total_volume_ml <= 0 ||
    !hasAtMostOneDecimalPlace(row.total_volume_ml)
  ) {
    return rowFailure(
      'uterine_flushes',
      rowIndex,
      'total_volume_ml',
      'must be > 0 with at most one decimal place',
    );
  }
  if (!isNullableString(row.notes)) {
    return rowFailure('uterine_flushes', rowIndex, 'notes', 'must be a string or null');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure(
      'uterine_flushes',
      rowIndex,
      'timestamps',
      'created_at and updated_at are required',
    );
  }

  return null;
}

function validateUterineFlushProductRow(
  row: unknown,
  rowIndex: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('uterine_flush_products', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) {
    return rowFailure('uterine_flush_products', rowIndex, 'id', 'is required');
  }
  if (!isNonEmptyString(row.uterine_flush_id)) {
    return rowFailure('uterine_flush_products', rowIndex, 'uterine_flush_id', 'is required');
  }
  if (!isNonEmptyString(row.product_name) || row.product_name.trim().length === 0) {
    return rowFailure('uterine_flush_products', rowIndex, 'product_name', 'is required');
  }
  if (!isNonEmptyString(row.dose) || row.dose.trim().length === 0) {
    return rowFailure('uterine_flush_products', rowIndex, 'dose', 'is required');
  }
  if (!isNullableString(row.notes)) {
    return rowFailure('uterine_flush_products', rowIndex, 'notes', 'must be a string or null');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure(
      'uterine_flush_products',
      rowIndex,
      'timestamps',
      'created_at and updated_at are required',
    );
  }

  return null;
}

function validateBreedingRecordRow(
  row: unknown,
  rowIndex: number,
  schemaVersion: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('breeding_records', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('breeding_records', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.mare_id)) return rowFailure('breeding_records', rowIndex, 'mare_id', 'is required');
  if (!isNullableString(row.stallion_id)) return rowFailure('breeding_records', rowIndex, 'stallion_id', 'must be a string or null');
  if (!isNullableString(row.stallion_name)) {
    return rowFailure('breeding_records', rowIndex, 'stallion_name', 'must be a string or null');
  }
  if (!isNullableString(row.collection_id)) {
    return rowFailure('breeding_records', rowIndex, 'collection_id', 'must be a string or null');
  }
  if (!isLocalDate(row.date)) return rowFailure('breeding_records', rowIndex, 'date', 'must be a valid YYYY-MM-DD date');
  if (
    schemaVersion >= BACKUP_SCHEMA_VERSION_V10 &&
    !(row.time === null || (typeof row.time === 'string' && normalizeBreedingRecordTime(row.time) === row.time))
  ) {
    return rowFailure('breeding_records', rowIndex, 'time', 'must be a valid HH:MM time or null');
  }
  if (!isStringEnum(row.method, BREEDING_METHODS)) {
    return rowFailure('breeding_records', rowIndex, 'method', 'must be a supported breeding method');
  }
  if (!isNullableString(row.notes)) return rowFailure('breeding_records', rowIndex, 'notes', 'must be a string or null');
  if (!isNullableFiniteNumber(row.volume_ml)) {
    return rowFailure('breeding_records', rowIndex, 'volume_ml', 'must be a number or null');
  }
  if (!isNullableFiniteNumber(row.concentration_m_per_ml)) {
    return rowFailure('breeding_records', rowIndex, 'concentration_m_per_ml', 'must be a number or null');
  }
  if (!isNullableFiniteNumberInRange(row.motility_percent, 0, 100)) {
    return rowFailure('breeding_records', rowIndex, 'motility_percent', 'must be between 0 and 100 or null');
  }
  if (!isNullableIntegerAtLeast(row.number_of_straws, 1)) {
    return rowFailure('breeding_records', rowIndex, 'number_of_straws', 'must be an integer >= 1 or null');
  }
  if (!isNullableFiniteNumber(row.straw_volume_ml)) {
    return rowFailure('breeding_records', rowIndex, 'straw_volume_ml', 'must be a number or null');
  }
  if (!isNullableString(row.straw_details)) {
    return rowFailure('breeding_records', rowIndex, 'straw_details', 'must be a string or null');
  }
  if (!isNullableLocalDate(row.collection_date)) {
    return rowFailure('breeding_records', rowIndex, 'collection_date', 'must be a valid YYYY-MM-DD date or null');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('breeding_records', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }
  if (row.method === 'frozenAI' && row.number_of_straws == null) {
    return rowFailure('breeding_records', rowIndex, 'number_of_straws', 'is required for frozenAI');
  }

  return null;
}

function validatePregnancyCheckRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('pregnancy_checks', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('pregnancy_checks', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.mare_id)) return rowFailure('pregnancy_checks', rowIndex, 'mare_id', 'is required');
  if (!isNonEmptyString(row.breeding_record_id)) {
    return rowFailure('pregnancy_checks', rowIndex, 'breeding_record_id', 'is required');
  }
  if (!isLocalDate(row.date)) return rowFailure('pregnancy_checks', rowIndex, 'date', 'must be a valid YYYY-MM-DD date');
  if (!isStringEnum(row.result, PREGNANCY_RESULTS)) {
    return rowFailure('pregnancy_checks', rowIndex, 'result', 'must be positive or negative');
  }
  if (!isNullableFlag(row.heartbeat_detected)) {
    return rowFailure('pregnancy_checks', rowIndex, 'heartbeat_detected', 'must be 0, 1, or null');
  }
  if (!isNullableString(row.notes)) return rowFailure('pregnancy_checks', rowIndex, 'notes', 'must be a string or null');
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('pregnancy_checks', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }
  if (row.result === 'negative' && row.heartbeat_detected === 1) {
    return rowFailure('pregnancy_checks', rowIndex, 'heartbeat_detected', 'cannot be 1 when result is negative');
  }

  return null;
}

function validateFoalingRecordRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('foaling_records', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('foaling_records', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.mare_id)) return rowFailure('foaling_records', rowIndex, 'mare_id', 'is required');
  if (!isNullableString(row.breeding_record_id)) {
    return rowFailure('foaling_records', rowIndex, 'breeding_record_id', 'must be a string or null');
  }
  if (!isLocalDate(row.date)) return rowFailure('foaling_records', rowIndex, 'date', 'must be a valid YYYY-MM-DD date');
  if (!isStringEnum(row.outcome, FOALING_OUTCOMES)) {
    return rowFailure('foaling_records', rowIndex, 'outcome', 'must be a supported foaling outcome');
  }
  if (!isNullableStringEnum(row.foal_sex, FOAL_SEXES)) {
    return rowFailure('foaling_records', rowIndex, 'foal_sex', 'must be colt, filly, unknown, or null');
  }
  if (!isNullableString(row.complications)) {
    return rowFailure('foaling_records', rowIndex, 'complications', 'must be a string or null');
  }
  if (!isNullableString(row.notes)) return rowFailure('foaling_records', rowIndex, 'notes', 'must be a string or null');
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('foaling_records', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateFoalRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('foals', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('foals', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.foaling_record_id)) {
    return rowFailure('foals', rowIndex, 'foaling_record_id', 'is required');
  }
  if (!isNullableString(row.name)) return rowFailure('foals', rowIndex, 'name', 'must be a string or null');
  if (!isNullableStringEnum(row.sex, FOAL_SEXES)) {
    return rowFailure('foals', rowIndex, 'sex', 'must be colt, filly, unknown, or null');
  }
  if (!isNullableStringEnum(row.color, FOAL_COLORS)) {
    return rowFailure('foals', rowIndex, 'color', 'must be a supported color or null');
  }
  if (!isNullableString(row.markings)) {
    return rowFailure('foals', rowIndex, 'markings', 'must be a string or null');
  }
  if (!isNullableFiniteNumberAtLeastExclusive(row.birth_weight_lbs, 0)) {
    return rowFailure('foals', rowIndex, 'birth_weight_lbs', 'must be > 0 or null');
  }
  if (!isNonEmptyString(row.milestones)) {
    return rowFailure('foals', rowIndex, 'milestones', 'must be JSON text');
  }
  if (!isNonEmptyString(row.igg_tests)) {
    return rowFailure('foals', rowIndex, 'igg_tests', 'must be JSON text');
  }
  const milestonesError = validateFoalMilestonesJson(row.milestones, rowIndex);
  if (milestonesError) return milestonesError;
  const iggTestsError = validateIggTestsJson(row.igg_tests, rowIndex);
  if (iggTestsError) return iggTestsError;
  if (!isNullableString(row.notes)) return rowFailure('foals', rowIndex, 'notes', 'must be a string or null');
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('foals', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateMedicationLogRow(
  row: unknown,
  rowIndex: number,
  schemaVersion: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('medication_logs', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('medication_logs', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.mare_id)) return rowFailure('medication_logs', rowIndex, 'mare_id', 'is required');
  if (!isLocalDate(row.date)) return rowFailure('medication_logs', rowIndex, 'date', 'must be a valid YYYY-MM-DD date');
  if (!isNonEmptyString(row.medication_name)) {
    return rowFailure('medication_logs', rowIndex, 'medication_name', 'is required');
  }
  if (!isNullableString(row.dose)) return rowFailure('medication_logs', rowIndex, 'dose', 'must be a string or null');
  if (!isNullableStringEnum(row.route, MEDICATION_ROUTES)) {
    return rowFailure('medication_logs', rowIndex, 'route', 'must be a supported route or null');
  }
  if (!isNullableString(row.notes)) return rowFailure('medication_logs', rowIndex, 'notes', 'must be a string or null');
  if (
    schemaVersion >= BACKUP_SCHEMA_VERSION_V8 &&
    !isNullableString(row.source_daily_log_id)
  ) {
    return rowFailure(
      'medication_logs',
      rowIndex,
      'source_daily_log_id',
      'must be a string or null',
    );
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('medication_logs', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateTaskRow(row: unknown, rowIndex: number): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('tasks', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('tasks', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.mare_id)) return rowFailure('tasks', rowIndex, 'mare_id', 'is required');
  if (!isStringEnum(row.task_type, TASK_TYPES)) {
    return rowFailure('tasks', rowIndex, 'task_type', 'must be a supported task type');
  }
  if (!isNonEmptyString(row.title) || row.title.trim().length === 0) {
    return rowFailure('tasks', rowIndex, 'title', 'is required');
  }
  if (!isLocalDate(row.due_date)) {
    return rowFailure('tasks', rowIndex, 'due_date', 'must be a valid YYYY-MM-DD date');
  }
  if (!isNullableTaskTime(row.due_time)) {
    return rowFailure('tasks', rowIndex, 'due_time', 'must be a valid HH:MM time or null');
  }
  if (!isNullableString(row.notes)) {
    return rowFailure('tasks', rowIndex, 'notes', 'must be a string or null');
  }
  if (!isStringEnum(row.status, TASK_STATUSES)) {
    return rowFailure('tasks', rowIndex, 'status', 'must be open or completed');
  }
  if (row.status === 'completed' && !isNonEmptyString(row.completed_at)) {
    return rowFailure('tasks', rowIndex, 'completed_at', 'is required when status is completed');
  }
  if (row.status === 'open' && row.completed_at !== null) {
    return rowFailure('tasks', rowIndex, 'completed_at', 'must be null when status is open');
  }
  if (!isNullableStringEnum(row.completed_record_type, TASK_COMPLETED_RECORD_TYPES)) {
    return rowFailure(
      'tasks',
      rowIndex,
      'completed_record_type',
      'must be a supported completed record type or null',
    );
  }
  if (!isNullableString(row.completed_record_id)) {
    return rowFailure('tasks', rowIndex, 'completed_record_id', 'must be a string or null');
  }
  if (
    (row.completed_record_type == null && row.completed_record_id != null) ||
    (row.completed_record_type != null && !isNonEmptyString(row.completed_record_id))
  ) {
    return rowFailure(
      'tasks',
      rowIndex,
      'completed_record_type/completed_record_id',
      'must both be null or both be present',
    );
  }
  if (!isStringEnum(row.source_type, TASK_SOURCE_TYPES)) {
    return rowFailure('tasks', rowIndex, 'source_type', 'must be a supported source type');
  }
  if (!isNullableString(row.source_record_id)) {
    return rowFailure('tasks', rowIndex, 'source_record_id', 'must be a string or null');
  }
  if (row.source_record_id === '') {
    return rowFailure('tasks', rowIndex, 'source_record_id', 'must be non-empty when present');
  }
  if (!isNullableStringEnum(row.source_reason, TASK_SOURCE_REASONS)) {
    return rowFailure('tasks', rowIndex, 'source_reason', 'must be a supported source reason or null');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('tasks', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateSemenCollectionRow(
  row: unknown,
  rowIndex: number,
  schemaVersion: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('semen_collections', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('semen_collections', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.stallion_id)) return rowFailure('semen_collections', rowIndex, 'stallion_id', 'is required');
  if (!isLocalDate(row.collection_date)) {
    return rowFailure('semen_collections', rowIndex, 'collection_date', 'must be a valid YYYY-MM-DD date');
  }
  if (!isNullableFiniteNumberAtLeast(row.raw_volume_ml, 0)) {
    return rowFailure('semen_collections', rowIndex, 'raw_volume_ml', 'must be >= 0 or null');
  }
  if (!isNullableString(row.extender_type)) {
    return rowFailure('semen_collections', rowIndex, 'extender_type', 'must be a string or null');
  }
  if (!isNullableFiniteNumberAtLeast(row.concentration_millions_per_ml, 0)) {
    return rowFailure('semen_collections', rowIndex, 'concentration_millions_per_ml', 'must be >= 0 or null');
  }
  if ('motility_percent' in row && !isNullableIntegerInRange(row.motility_percent, 0, 100)) {
    return rowFailure('semen_collections', rowIndex, 'motility_percent', 'must be 0-100 or null');
  }
  if (!isNullableIntegerInRange(row.progressive_motility_percent, 0, 100)) {
    return rowFailure('semen_collections', rowIndex, 'progressive_motility_percent', 'must be 0-100 or null');
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V3) {
    if (
      'target_mode' in row &&
      !isNullableStringEnum(row.target_mode, COLLECTION_TARGET_MODES)
    ) {
      return rowFailure(
        'semen_collections',
        rowIndex,
        'target_mode',
        'must be progressive, total, or null',
      );
    }
    if (!('target_motile_sperm_millions_per_dose' in row)) {
      return rowFailure(
        'semen_collections',
        rowIndex,
        'target_motile_sperm_millions_per_dose',
        'is required in schema v3 backups',
      );
    }
    if (!('target_post_extension_concentration_millions_per_ml' in row)) {
      return rowFailure(
        'semen_collections',
        rowIndex,
        'target_post_extension_concentration_millions_per_ml',
        'is required in schema v3 backups',
      );
    }
    if (!isNullableFiniteNumberAtLeast(row.target_motile_sperm_millions_per_dose, 0)) {
      return rowFailure(
        'semen_collections',
        rowIndex,
        'target_motile_sperm_millions_per_dose',
        'must be >= 0 or null',
      );
    }
    if (
      !isNullableFiniteNumberAtLeast(
        row.target_post_extension_concentration_millions_per_ml,
        0,
      )
    ) {
      return rowFailure(
        'semen_collections',
        rowIndex,
        'target_post_extension_concentration_millions_per_ml',
        'must be >= 0 or null',
      );
    }
  } else {
    if (!isNullableFiniteNumberAtLeast(row.extended_volume_ml, 0)) {
      return rowFailure('semen_collections', rowIndex, 'extended_volume_ml', 'must be >= 0 or null');
    }
    if (!(row.extender_volume_ml === undefined || isNullableFiniteNumberAtLeast(row.extender_volume_ml, 0))) {
      return rowFailure('semen_collections', rowIndex, 'extender_volume_ml', 'must be >= 0 or null');
    }
    if (!isNullableIntegerAtLeast(row.dose_count, 0)) {
      return rowFailure('semen_collections', rowIndex, 'dose_count', 'must be an integer >= 0 or null');
    }
    if (!isNullableFiniteNumberAtLeast(row.dose_size_millions, 0)) {
      return rowFailure('semen_collections', rowIndex, 'dose_size_millions', 'must be >= 0 or null');
    }
  }
  if (!isNullableString(row.notes)) return rowFailure('semen_collections', rowIndex, 'notes', 'must be a string or null');
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('semen_collections', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateCollectionDoseEventRow(
  row: unknown,
  rowIndex: number,
  schemaVersion: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('collection_dose_events', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) return rowFailure('collection_dose_events', rowIndex, 'id', 'is required');
  if (!isNonEmptyString(row.collection_id)) {
    return rowFailure('collection_dose_events', rowIndex, 'collection_id', 'is required');
  }
  if (!isStringEnum(row.event_type, COLLECTION_EVENT_TYPES)) {
    return rowFailure('collection_dose_events', rowIndex, 'event_type', 'must be shipped or usedOnSite');
  }
  if (!isNonEmptyString(row.recipient)) {
    return rowFailure('collection_dose_events', rowIndex, 'recipient', 'is required');
  }
  if (!isOptionalNullableString(row.recipient_phone)) {
    return rowFailure('collection_dose_events', rowIndex, 'recipient_phone', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.recipient_street)) {
    return rowFailure('collection_dose_events', rowIndex, 'recipient_street', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.recipient_city)) {
    return rowFailure('collection_dose_events', rowIndex, 'recipient_city', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.recipient_state)) {
    return rowFailure('collection_dose_events', rowIndex, 'recipient_state', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.recipient_zip)) {
    return rowFailure('collection_dose_events', rowIndex, 'recipient_zip', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.carrier_service)) {
    return rowFailure('collection_dose_events', rowIndex, 'carrier_service', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.container_type)) {
    return rowFailure('collection_dose_events', rowIndex, 'container_type', 'must be a string or null');
  }
  if (!isOptionalNullableString(row.tracking_number)) {
    return rowFailure('collection_dose_events', rowIndex, 'tracking_number', 'must be a string or null');
  }
  if (
    !(
      row.breeding_record_id === undefined ||
      row.breeding_record_id === null ||
      isNonEmptyString(row.breeding_record_id)
    )
  ) {
    return rowFailure(
      'collection_dose_events',
      rowIndex,
      'breeding_record_id',
      'must be a string or null',
    );
  }
  if (!isNullableIntegerAtLeast(row.dose_count, 1)) {
    return rowFailure('collection_dose_events', rowIndex, 'dose_count', 'must be an integer > 0 or null');
  }
  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V3) {
    if (!('dose_semen_volume_ml' in row)) {
      return rowFailure(
        'collection_dose_events',
        rowIndex,
        'dose_semen_volume_ml',
        'is required in schema v3 backups',
      );
    }
    if (!('dose_extender_volume_ml' in row)) {
      return rowFailure(
        'collection_dose_events',
        rowIndex,
        'dose_extender_volume_ml',
        'is required in schema v3 backups',
      );
    }
    if (
      !isNullableFiniteNumberAtLeast(row.dose_semen_volume_ml, 0)
    ) {
      return rowFailure(
        'collection_dose_events',
        rowIndex,
        'dose_semen_volume_ml',
        'must be >= 0 or null',
      );
    }
    if (
      !isNullableFiniteNumberAtLeast(row.dose_extender_volume_ml, 0)
    ) {
      return rowFailure(
        'collection_dose_events',
        rowIndex,
        'dose_extender_volume_ml',
        'must be >= 0 or null',
      );
    }

    if (row.event_type === 'usedOnSite') {
      if (row.dose_count !== 1) {
        return rowFailure(
          'collection_dose_events',
          rowIndex,
          'dose_count',
          'must be 1 for usedOnSite rows',
        );
      }
      if (row.dose_extender_volume_ml !== null) {
        return rowFailure(
          'collection_dose_events',
          rowIndex,
          'dose_extender_volume_ml',
          'must be null for usedOnSite rows',
        );
      }
    }
  }
  if (!isNullableLocalDate(row.event_date)) {
    return rowFailure('collection_dose_events', rowIndex, 'event_date', 'must be a valid YYYY-MM-DD date or null');
  }
  if (!isNullableString(row.notes)) return rowFailure('collection_dose_events', rowIndex, 'notes', 'must be a string or null');
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure('collection_dose_events', rowIndex, 'timestamps', 'created_at and updated_at are required');
  }

  return null;
}

function validateFrozenSemenBatchRow(
  row: unknown,
  rowIndex: number,
): ValidateBackupResult | null {
  if (!isRecord(row)) {
    return rowFailure('frozen_semen_batches', rowIndex, 'row', 'must be an object');
  }

  if (!isNonEmptyString(row.id)) {
    return rowFailure('frozen_semen_batches', rowIndex, 'id', 'is required');
  }
  if (!isNonEmptyString(row.stallion_id)) {
    return rowFailure('frozen_semen_batches', rowIndex, 'stallion_id', 'is required');
  }
  if (!isNullableString(row.collection_id)) {
    return rowFailure('frozen_semen_batches', rowIndex, 'collection_id', 'must be a string or null');
  }
  if (!isLocalDate(row.freeze_date)) {
    return rowFailure('frozen_semen_batches', rowIndex, 'freeze_date', 'must be a valid YYYY-MM-DD date');
  }
  if (!isNullableFiniteNumberAtLeastExclusive(row.raw_semen_volume_used_ml, 0)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'raw_semen_volume_used_ml',
      'must be > 0 or null',
    );
  }
  if (!isNullableStringEnum(row.extender, FREEZING_EXTENDERS)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'extender',
      'must be a supported freezing extender or null',
    );
  }
  if (!isNullableString(row.extender_other)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'extender_other',
      'must be a string or null',
    );
  }
  if (row.extender === 'Other' && !isNonEmptyString(row.extender_other)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'extender_other',
      'is required when extender is Other',
    );
  }
  if (row.extender !== 'Other' && row.extender_other != null) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'extender_other',
      'must be null unless extender is Other',
    );
  }
  if (!(row.was_centrifuged === 0 || row.was_centrifuged === 1)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'was_centrifuged',
      'must be 0 or 1',
    );
  }
  if (!isNullableIntegerAtLeast(row.centrifuge_speed_rpm, 1)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'centrifuge_speed_rpm',
      'must be an integer > 0 or null',
    );
  }
  if (!isNullableIntegerAtLeast(row.centrifuge_duration_min, 1)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'centrifuge_duration_min',
      'must be an integer > 0 or null',
    );
  }
  if (!isNullableFlag(row.centrifuge_cushion_used)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'centrifuge_cushion_used',
      'must be 0, 1, or null',
    );
  }
  if (!isNullableString(row.centrifuge_cushion_type)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'centrifuge_cushion_type',
      'must be a string or null',
    );
  }
  if (!isNullableFiniteNumberAtLeastExclusive(row.centrifuge_resuspension_vol_ml, 0)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'centrifuge_resuspension_vol_ml',
      'must be > 0 or null',
    );
  }
  if (!isNullableString(row.centrifuge_notes)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'centrifuge_notes',
      'must be a string or null',
    );
  }
  if (!(typeof row.straw_count === 'number' && Number.isInteger(row.straw_count) && row.straw_count >= 1)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straw_count',
      'must be an integer >= 1',
    );
  }
  if (
    !(
      typeof row.straws_remaining === 'number' &&
      Number.isInteger(row.straws_remaining) &&
      row.straws_remaining >= 0
    )
  ) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straws_remaining',
      'must be an integer >= 0',
    );
  }
  if (
    typeof row.straw_count === 'number' &&
    typeof row.straws_remaining === 'number' &&
    row.straws_remaining > row.straw_count
  ) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straws_remaining',
      'must be less than or equal to straw_count',
    );
  }
  if (!isFiniteNumber(row.straw_volume_ml) || row.straw_volume_ml <= 0) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straw_volume_ml',
      'must be a number > 0',
    );
  }
  if (!isNullableFiniteNumberAtLeastExclusive(row.concentration_millions_per_ml, 0)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'concentration_millions_per_ml',
      'must be > 0 or null',
    );
  }
  if (!isNullableIntegerAtLeast(row.straws_per_dose, 1)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straws_per_dose',
      'must be an integer >= 1 or null',
    );
  }
  if (!isNullableStringEnum(row.straw_color, STRAW_COLORS)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straw_color',
      'must be a supported straw color or null',
    );
  }
  if (!isNullableString(row.straw_color_other)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straw_color_other',
      'must be a string or null',
    );
  }
  if (!isNullableString(row.straw_label)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'straw_label',
      'must be a string or null',
    );
  }
  if (!isNullableFiniteNumberInRange(row.post_thaw_motility_percent, 0, 100)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'post_thaw_motility_percent',
      'must be between 0 and 100 or null',
    );
  }
  if (!isNullableFiniteNumberAtLeastExclusive(row.longevity_hours, 0)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'longevity_hours',
      'must be > 0 or null',
    );
  }
  if (!isNullableString(row.storage_details)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'storage_details',
      'must be a string or null',
    );
  }
  if (!isNullableString(row.notes)) {
    return rowFailure('frozen_semen_batches', rowIndex, 'notes', 'must be a string or null');
  }
  if (!isNonEmptyString(row.created_at) || !isNonEmptyString(row.updated_at)) {
    return rowFailure(
      'frozen_semen_batches',
      rowIndex,
      'timestamps',
      'created_at and updated_at are required',
    );
  }

  return null;
}

function validateFoalMilestonesJson(value: string, rowIndex: number): ValidateBackupResult | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return rowFailure('foals', rowIndex, 'milestones', 'must contain valid JSON');
  }

  if (!isRecord(parsed)) {
    return rowFailure('foals', rowIndex, 'milestones', 'must decode to an object');
  }

  for (const [key, entry] of Object.entries(parsed)) {
    if (!FOAL_MILESTONE_KEYS.has(key)) continue;
    if (!isRecord(entry) || typeof entry.done !== 'boolean') {
      return rowFailure('foals', rowIndex, 'milestones', `milestone "${key}" is invalid`);
    }
    if (!(entry.recordedAt == null || typeof entry.recordedAt === 'string')) {
      return rowFailure('foals', rowIndex, 'milestones', `milestone "${key}" recordedAt must be string or null`);
    }
  }

  return null;
}

function validateIggTestsJson(value: string, rowIndex: number): ValidateBackupResult | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return rowFailure('foals', rowIndex, 'igg_tests', 'must contain valid JSON');
  }

  if (!Array.isArray(parsed)) {
    return rowFailure('foals', rowIndex, 'igg_tests', 'must decode to an array');
  }

  for (const entry of parsed) {
    if (!isRecord(entry)) {
      return rowFailure('foals', rowIndex, 'igg_tests', 'contains an invalid test entry');
    }
    const hasCurrentFields = 'date' in entry || 'valueMgDl' in entry;
    const hasRecordedAt = 'recordedAt' in entry;
    const isFutureCompatibleOpaqueEntry =
      hasRecordedAt &&
      !hasCurrentFields &&
      isNonEmptyString(entry.recordedAt) &&
      Object.keys(entry).some((key) => key !== 'recordedAt');
    if (isFutureCompatibleOpaqueEntry) continue;
    if (!hasCurrentFields && !hasRecordedAt) {
      return rowFailure('foals', rowIndex, 'igg_tests', 'contains an invalid test entry');
    }
    if (!isLocalDate(entry.date)) {
      return rowFailure('foals', rowIndex, 'igg_tests', 'contains a test with invalid date');
    }
    if (!isFiniteNumber(entry.valueMgDl) || entry.valueMgDl <= 0) {
      return rowFailure('foals', rowIndex, 'igg_tests', 'contains a test with invalid valueMgDl');
    }
    if (!isNonEmptyString(entry.recordedAt)) {
      return rowFailure('foals', rowIndex, 'igg_tests', 'contains a test with invalid recordedAt');
    }
  }

  return null;
}

function buildIndexes(
  tables: BackupTables,
): ValidationIndexes {
  return {
    mareIds: new Set(tables.mares.map((row) => row.id)),
    dailyLogIds: new Set(tables.daily_logs.map((row) => row.id)),
    uterineFlushIds:
      'uterine_flushes' in tables
        ? new Set(tables.uterine_flushes.map((row) => row.id))
        : new Set(),
    stallionIds: new Set(tables.stallions.map((row) => row.id)),
    breedingById: new Map(tables.breeding_records.map((row) => [row.id, row])),
    foalingById: new Map(tables.foaling_records.map((row) => [row.id, row])),
    collectionById: new Map(tables.semen_collections.map((row) => [row.id, row])),
  };
}

function validateCrossTableRules(
  tables: BackupTables,
  indexes: ValidationIndexes,
  schemaVersion: number,
): ValidateBackupResult | null {
  const idError =
    ensureUniqueIds('mares', tables.mares.map((row) => row.id)) ??
    ensureUniqueIds('stallions', tables.stallions.map((row) => row.id)) ??
    ensureUniqueIds('daily_logs', tables.daily_logs.map((row) => row.id)) ??
    ensureUniqueIds('breeding_records', tables.breeding_records.map((row) => row.id)) ??
    ensureUniqueIds('pregnancy_checks', tables.pregnancy_checks.map((row) => row.id)) ??
    ensureUniqueIds('foaling_records', tables.foaling_records.map((row) => row.id)) ??
    ensureUniqueIds('foals', tables.foals.map((row) => row.id)) ??
    ensureUniqueIds('medication_logs', tables.medication_logs.map((row) => row.id)) ??
    (schemaVersion >= BACKUP_SCHEMA_VERSION_V11
      ? ensureUniqueIds(
          'tasks',
          (tables as BackupTablesV11).tasks.map((row) => row.id),
        )
      : null) ??
    ensureUniqueIds('semen_collections', tables.semen_collections.map((row) => row.id)) ??
    ensureUniqueIds('collection_dose_events', tables.collection_dose_events.map((row) => row.id)) ??
    (schemaVersion >= BACKUP_SCHEMA_VERSION_V4
      ? ensureUniqueIds(
          'uterine_fluid',
          (tables as BackupTablesV4).uterine_fluid.map((row) => row.id),
        )
      : null) ??
    (schemaVersion >= BACKUP_SCHEMA_VERSION_V8
      ? ensureUniqueIds(
          'uterine_flushes',
          (tables as BackupTablesV8).uterine_flushes.map((row) => row.id),
        ) ??
        ensureUniqueIds(
          'uterine_flush_products',
          (tables as BackupTablesV8).uterine_flush_products.map((row) => row.id),
        )
      : null) ??
    (schemaVersion >= BACKUP_SCHEMA_VERSION_V5
      ? ensureUniqueIds(
          'frozen_semen_batches',
          (tables as BackupTablesV5).frozen_semen_batches.map((row) => row.id),
        )
      : null) ??
    (schemaVersion >= BACKUP_SCHEMA_VERSION_V12
      ? ensureUniqueIds(
          'photo_assets',
          (tables as BackupTablesV12).photo_assets.map((row) => row.id),
        ) ??
        ensureUniqueIds(
          'photo_attachments',
          (tables as BackupTablesV12).photo_attachments.map((row) => row.id),
        )
      : null);
  if (idError) return idError;

  const dailyLogPairSet = new Set<string>();
  const timedDailyLogSet = new Set<string>();
  const untimedDailyLogSet = new Set<string>();
  for (let index = 0; index < tables.daily_logs.length; index += 1) {
    const row = tables.daily_logs[index];
    const dateKey = `${row.mare_id}::${row.date}`;
    if (schemaVersion >= BACKUP_SCHEMA_VERSION_V7) {
      const time = 'time' in row ? row.time ?? null : null;
      if (time === null) {
        if (untimedDailyLogSet.has(dateKey)) {
          return rowFailure(
            'daily_logs',
            index,
            'mare_id,date,time',
            'duplicate untimed (mare_id, date) pair',
          );
        }
        untimedDailyLogSet.add(dateKey);
      } else {
        const timedKey = `${dateKey}::${time}`;
        if (timedDailyLogSet.has(timedKey)) {
          return rowFailure(
            'daily_logs',
            index,
            'mare_id,date,time',
            'duplicate (mare_id, date, time) key',
          );
        }
        timedDailyLogSet.add(timedKey);
      }
    } else if (dailyLogPairSet.has(dateKey)) {
      return rowFailure('daily_logs', index, 'mare_id,date', 'duplicate (mare_id, date) pair');
    }
    dailyLogPairSet.add(dateKey);
    if (!indexes.mareIds.has(row.mare_id)) {
      return rowFailure('daily_logs', index, 'mare_id', 'references missing mare');
    }
  }

  for (let index = 0; index < tables.breeding_records.length; index += 1) {
    const row = tables.breeding_records[index];
    if (!indexes.mareIds.has(row.mare_id)) {
      return rowFailure('breeding_records', index, 'mare_id', 'references missing mare');
    }
    if (row.stallion_id != null && !indexes.stallionIds.has(row.stallion_id)) {
      return rowFailure('breeding_records', index, 'stallion_id', 'references missing stallion');
    }
    if (row.stallion_id == null && !isNonEmptyString(row.stallion_name)) {
      return rowFailure('breeding_records', index, 'stallion_id/stallion_name', 'one of stallion_id or stallion_name is required');
    }
    if (row.collection_id != null) {
      const collection = indexes.collectionById.get(row.collection_id);
      if (!collection) {
        return rowFailure('breeding_records', index, 'collection_id', 'references missing semen collection');
      }
      if (row.stallion_id == null) {
        return rowFailure('breeding_records', index, 'collection_id', 'requires stallion_id when collection_id is present');
      }
      if (collection.stallion_id !== row.stallion_id) {
        return rowFailure('breeding_records', index, 'collection_id', 'belongs to a different stallion');
      }
    }
  }

  for (let index = 0; index < tables.medication_logs.length; index += 1) {
    const row = tables.medication_logs[index];
    if (!indexes.mareIds.has(row.mare_id)) {
      return rowFailure('medication_logs', index, 'mare_id', 'references missing mare');
    }
    if (
      schemaVersion >= BACKUP_SCHEMA_VERSION_V8 &&
      'source_daily_log_id' in row &&
      row.source_daily_log_id != null &&
      !indexes.dailyLogIds.has(row.source_daily_log_id)
    ) {
      return rowFailure(
        'medication_logs',
        index,
        'source_daily_log_id',
        'references missing daily log',
      );
    }
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V11) {
    const taskRows = (tables as BackupTablesV11).tasks;
    for (let index = 0; index < taskRows.length; index += 1) {
      const row = taskRows[index];
      if (!indexes.mareIds.has(row.mare_id)) {
        return rowFailure('tasks', index, 'mare_id', 'references missing mare');
      }
    }
  }

  for (let index = 0; index < tables.pregnancy_checks.length; index += 1) {
    const row = tables.pregnancy_checks[index];
    if (!indexes.mareIds.has(row.mare_id)) {
      return rowFailure('pregnancy_checks', index, 'mare_id', 'references missing mare');
    }
    const breedingRecord = indexes.breedingById.get(row.breeding_record_id);
    if (!breedingRecord) {
      return rowFailure('pregnancy_checks', index, 'breeding_record_id', 'references missing breeding record');
    }
    if (breedingRecord.mare_id !== row.mare_id) {
      return rowFailure('pregnancy_checks', index, 'mare_id', 'must match referenced breeding record mare_id');
    }
  }

  for (let index = 0; index < tables.foaling_records.length; index += 1) {
    const row = tables.foaling_records[index];
    if (!indexes.mareIds.has(row.mare_id)) {
      return rowFailure('foaling_records', index, 'mare_id', 'references missing mare');
    }
    if (row.breeding_record_id != null) {
      const breedingRecord = indexes.breedingById.get(row.breeding_record_id);
      if (!breedingRecord) {
        return rowFailure('foaling_records', index, 'breeding_record_id', 'references missing breeding record');
      }
      if (breedingRecord.mare_id !== row.mare_id) {
        return rowFailure('foaling_records', index, 'mare_id', 'must match referenced breeding record mare_id');
      }
    }
  }

  const foalByFoalingRecord = new Set<string>();
  for (let index = 0; index < tables.foals.length; index += 1) {
    const row = tables.foals[index];
    if (!indexes.foalingById.has(row.foaling_record_id)) {
      return rowFailure('foals', index, 'foaling_record_id', 'references missing foaling record');
    }
    if (foalByFoalingRecord.has(row.foaling_record_id)) {
      return rowFailure('foals', index, 'foaling_record_id', 'duplicate foaling_record_id');
    }
    foalByFoalingRecord.add(row.foaling_record_id);
  }

  for (let index = 0; index < tables.semen_collections.length; index += 1) {
    const row = tables.semen_collections[index];
    if (!indexes.stallionIds.has(row.stallion_id)) {
      return rowFailure('semen_collections', index, 'stallion_id', 'references missing stallion');
    }
  }

  for (let index = 0; index < tables.collection_dose_events.length; index += 1) {
    const row = tables.collection_dose_events[index];
    if (!indexes.collectionById.has(row.collection_id)) {
      return rowFailure('collection_dose_events', index, 'collection_id', 'references missing semen collection');
    }
    if (row.breeding_record_id != null && !indexes.breedingById.has(row.breeding_record_id)) {
      return rowFailure(
        'collection_dose_events',
        index,
        'breeding_record_id',
        'references missing breeding record',
      );
    }
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V4) {
    const uterineFluidRows = (tables as BackupTablesV4).uterine_fluid;
    for (let index = 0; index < uterineFluidRows.length; index += 1) {
      const row = uterineFluidRows[index];
      if (!indexes.dailyLogIds.has(row.daily_log_id)) {
        return rowFailure('uterine_fluid', index, 'daily_log_id', 'references missing daily log');
      }
    }
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V8) {
    const flushRows = (tables as BackupTablesV8).uterine_flushes;
    const flushDailyLogIds = new Set<string>();
    for (let index = 0; index < flushRows.length; index += 1) {
      const row = flushRows[index];
      if (!indexes.dailyLogIds.has(row.daily_log_id)) {
        return rowFailure('uterine_flushes', index, 'daily_log_id', 'references missing daily log');
      }
      if (flushDailyLogIds.has(row.daily_log_id)) {
        return rowFailure('uterine_flushes', index, 'daily_log_id', 'duplicate daily_log_id');
      }
      flushDailyLogIds.add(row.daily_log_id);
    }

    const productRows = (tables as BackupTablesV8).uterine_flush_products;
    for (let index = 0; index < productRows.length; index += 1) {
      const row = productRows[index];
      if (!indexes.uterineFlushIds.has(row.uterine_flush_id)) {
        return rowFailure(
          'uterine_flush_products',
          index,
          'uterine_flush_id',
          'references missing uterine flush',
        );
      }
    }
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V5) {
    const frozenRows = (tables as BackupTablesV5).frozen_semen_batches;
    for (let index = 0; index < frozenRows.length; index += 1) {
      const row = frozenRows[index];
      if (!indexes.stallionIds.has(row.stallion_id)) {
        return rowFailure(
          'frozen_semen_batches',
          index,
          'stallion_id',
          'references missing stallion',
        );
      }
      if (row.collection_id != null) {
        const collection = indexes.collectionById.get(row.collection_id);
        if (!collection) {
          return rowFailure(
            'frozen_semen_batches',
            index,
            'collection_id',
            'references missing semen collection',
          );
        }
        if (collection.stallion_id !== row.stallion_id) {
          return rowFailure(
            'frozen_semen_batches',
            index,
            'collection_id',
            'belongs to a different stallion',
          );
        }
      }
    }
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V12) {
    const photoTables = tables as BackupTablesV12;
    const photoAssetIds = new Set(photoTables.photo_assets.map((row) => row.id));
    const profileOwners = new Set<string>();
    const pregnancyCheckIds = new Set(tables.pregnancy_checks.map((row) => row.id));
    const foalingRecordIds = new Set(tables.foaling_records.map((row) => row.id));

    for (let index = 0; index < photoTables.photo_attachments.length; index += 1) {
      const row = photoTables.photo_attachments[index];
      if (!photoAssetIds.has(row.photo_asset_id)) {
        return rowFailure('photo_attachments', index, 'photo_asset_id', 'references missing photo asset');
      }

      if (row.role === 'profile') {
        if (row.owner_type !== 'mare' && row.owner_type !== 'stallion') {
          return rowFailure('photo_attachments', index, 'role', 'profile is only valid for mares and stallions');
        }
        const ownerKey = `${row.owner_type}:${row.owner_id}`;
        if (profileOwners.has(ownerKey)) {
          return rowFailure('photo_attachments', index, 'owner_id', 'duplicate profile photo owner');
        }
        profileOwners.add(ownerKey);
      }

      if (row.role === 'attachment' && (row.owner_type === 'mare' || row.owner_type === 'stallion')) {
        return rowFailure('photo_attachments', index, 'role', 'mare and stallion photos must use profile role');
      }

      const ownerExists =
        row.owner_type === 'mare'
          ? indexes.mareIds.has(row.owner_id)
          : row.owner_type === 'stallion'
            ? indexes.stallionIds.has(row.owner_id)
            : row.owner_type === 'dailyLog'
              ? indexes.dailyLogIds.has(row.owner_id)
              : row.owner_type === 'pregnancyCheck'
                ? pregnancyCheckIds.has(row.owner_id)
                : foalingRecordIds.has(row.owner_id);

      if (!ownerExists) {
        return rowFailure('photo_attachments', index, 'owner_id', 'references missing owner');
      }
    }
  }

  if (schemaVersion >= BACKUP_SCHEMA_VERSION_V3) {
    const collectionAllocatedSemenMl = new Map<string, number>();
    for (const row of tables.collection_dose_events as readonly BackupCollectionDoseEventRowV3[]) {
      if (row.dose_semen_volume_ml == null) {
        continue;
      }

      collectionAllocatedSemenMl.set(
        row.collection_id,
        (collectionAllocatedSemenMl.get(row.collection_id) ?? 0) +
          row.dose_semen_volume_ml * (row.dose_count ?? 0),
      );
    }

    for (let index = 0; index < tables.semen_collections.length; index += 1) {
      const row = tables.semen_collections[index] as BackupSemenCollectionRowV3;
      if (row.raw_volume_ml == null) {
        continue;
      }

      const allocatedSemenMl = collectionAllocatedSemenMl.get(row.id) ?? 0;
      if (allocatedSemenMl > row.raw_volume_ml) {
        return rowFailure(
          'semen_collections',
          index,
          'raw_volume_ml',
          `must be at least the linked allocated semen volume (${allocatedSemenMl})`,
        );
      }
    }
  }

  return null;
}

function ensureUniqueIds(
  table: ManagedBackupTableName,
  ids: readonly string[],
): ValidateBackupResult | null {
  const seen = new Set<string>();

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    if (seen.has(id)) {
      return rowFailure(table, index, 'id', 'duplicate id');
    }
    seen.add(id);
  }

  return null;
}

function validationFailure(
  code: ValidateBackupError['code'],
  message: string,
): ValidateBackupResult {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function getValidationError(result: ValidateBackupResult): ValidateBackupError {
  if (!result.ok) {
    return result.error;
  }

  return {
    code: 'invalid_shape',
    message: 'Unexpected valid backup validation result.',
  };
}

function rowFailure(
  table: ManagedBackupTableName,
  rowIndex: number,
  field: string,
  message: string,
): ValidateBackupResult {
  return {
    ok: false,
    error: {
      code: 'invalid_row',
      table,
      rowIndex,
      field,
      message: `${table}[${rowIndex}].${field}: ${message}`,
    },
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value == null || typeof value === 'string';
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function isStringEnum(value: unknown, validValues: ReadonlySet<string>): value is string {
  return typeof value === 'string' && validValues.has(value);
}

function isNullableStringEnum(
  value: unknown,
  validValues: ReadonlySet<string>,
): value is string | null {
  return value == null || isStringEnum(value, validValues);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isPositiveOrZeroInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function hasAtMostOneDecimalPlace(value: number): boolean {
  const scaled = value * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value == null || isFiniteNumber(value);
}

function isNullableFiniteNumberAtLeast(value: unknown, min: number): boolean {
  return value == null || (isFiniteNumber(value) && value >= min);
}

function isNullableFiniteNumberAtLeastExclusive(value: unknown, minExclusive: number): boolean {
  return value == null || (isFiniteNumber(value) && value > minExclusive);
}

function isNullableFiniteNumberInRange(
  value: unknown,
  min: number,
  max: number,
): boolean {
  return value == null || (isFiniteNumber(value) && value >= min && value <= max);
}

function isNullableInteger(value: unknown): value is number | null {
  return value == null || (typeof value === 'number' && Number.isInteger(value));
}

function isNullableIntegerAtLeast(value: unknown, min: number): boolean {
  return value == null || (typeof value === 'number' && Number.isInteger(value) && value >= min);
}

function isNullableIntegerInRange(value: unknown, min: number, max: number): boolean {
  return value == null || (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max);
}

function isNullableFlag(value: unknown): value is 0 | 1 | null {
  return value == null || value === 0 || value === 1;
}

function isSafePhotoAssetPath(value: unknown, variant: 'master' | 'thumbnail'): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  if (value.startsWith('/') || value.includes('://') || value.includes('\\')) {
    return false;
  }
  if (value.split('/').includes('..')) {
    return false;
  }

  return new RegExp(`^photo-assets/[^/]+/${variant}\\.jpg$`).test(value);
}

function photoStorageId(value: unknown): string | null {
  return typeof value === 'string' ? value.split('/')[1] ?? null : null;
}

function isNullableDailyLogTime(value: unknown): value is string | null {
  return value == null || (typeof value === 'string' && normalizeDailyLogTime(value) === value);
}

function isNullableTaskTime(value: unknown): value is string | null {
  return value == null || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function isNullableLocalDate(value: unknown): value is string | null {
  return value == null || isLocalDate(value);
}
