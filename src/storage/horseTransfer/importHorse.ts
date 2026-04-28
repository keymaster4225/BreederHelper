import { emitDataInvalidation } from '@/storage/dataInvalidation';
import { getDb } from '@/storage/db';
import { createSafetySnapshot } from '@/storage/backup/safetyBackups';
import { BACKUP_CURRENT_TABLE_FIELD_NAMES } from '@/storage/backup/tableSpecs';
import {
  BACKUP_TABLE_NAMES,
  type BackupTableName,
} from '@/storage/backup/types';
import { newId } from '@/utils/id';

import {
  createHorseTransferIdMap,
  remapHorseTransferRow,
  setMappedHorseTransferId,
  taskPointerTypeToTable,
  type MutableHorseTransferIdMap,
} from './remap';
import type {
  HorseTransferConflictReason,
  HorseTransferEnvelopeV1,
  HorseTransferImportSummary,
  HorseTransferImportTarget,
  HorseTransferImportTableCounts,
  HorseTransferOutcomeCounts,
  HorseTransferRowOutcome,
  HorseTransferRowResult,
  ImportHorseTransferOptions,
  ImportHorseTransferResult,
} from './types';

type ImportDb = {
  getFirstAsync<T>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  runAsync(sql: string, params?: readonly unknown[]): Promise<unknown>;
  withTransactionAsync<T>(callback: () => Promise<T>): Promise<T>;
};

type RowRecord = Record<string, unknown> & {
  readonly id: string;
};

type PlannedInsert = {
  readonly tableName: BackupTableName;
  readonly row: RowRecord;
};

type ImportPlan = {
  readonly plannedInserts: readonly PlannedInsert[];
  readonly summary: HorseTransferImportSummary;
};

type ImportPlanResult =
  | {
      readonly ok: true;
      readonly plan: ImportPlan;
    }
  | {
      readonly ok: false;
      readonly errorMessage: string;
    };

type RootPlanResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly errorMessage: string;
    };

type PlanState = {
  readonly envelope: HorseTransferEnvelopeV1;
  readonly idMap: MutableHorseTransferIdMap;
  readonly plannedInserts: PlannedInsert[];
  readonly rowResults: HorseTransferRowResult[];
  readonly outcomesBySource: Map<string, HorseTransferRowOutcome>;
  readonly unsafeContextStallionIds: Set<string>;
  readonly unsafeContextCollectionIds: Set<string>;
};

const IMPORT_TABLE_ORDER: readonly BackupTableName[] = [
  'mares',
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
  'tasks',
];

const OUTCOMES: readonly HorseTransferRowOutcome[] = [
  'inserted',
  'already_present',
  'skipped',
  'conflict',
];

const JSON_TEXT_FIELDS: Partial<Record<BackupTableName, ReadonlySet<string>>> = {
  daily_logs: new Set([
    'right_ovary_follicle_measurements_mm',
    'right_ovary_structures',
    'left_ovary_follicle_measurements_mm',
    'left_ovary_structures',
  ]),
  foals: new Set(['milestones', 'igg_tests']),
};

const EFFECTIVE_COMPARE_EXCLUDED_FIELDS = new Set(['created_at', 'updated_at']);

export async function importHorseTransfer(
  envelope: HorseTransferEnvelopeV1,
  options: ImportHorseTransferOptions,
): Promise<ImportHorseTransferResult> {
  const db = (await getDb()) as unknown as ImportDb;
  const planResult = await buildImportPlan(db, envelope, options.target);
  if (!planResult.ok) {
    return {
      ok: false,
      safetySnapshotCreated: false,
      errorMessage: planResult.errorMessage,
    };
  }

  let safetySnapshotCreated = false;

  try {
    if (!options.skipSafetySnapshot) {
      await createSafetySnapshot();
      safetySnapshotCreated = true;
    }

    await db.withTransactionAsync(async () => {
      for (const insert of planResult.plan.plannedInserts) {
        await insertCurrentTableRow(db, insert.tableName, insert.row);
      }
    });

    emitDataInvalidation('all');

    return {
      ok: true,
      safetySnapshotCreated,
      summary: planResult.plan.summary,
    };
  } catch (error) {
    return {
      ok: false,
      safetySnapshotCreated,
      errorMessage:
        error instanceof Error ? error.message : 'Horse import failed unexpectedly.',
    };
  }
}

async function buildImportPlan(
  db: ImportDb,
  envelope: HorseTransferEnvelopeV1,
  target: HorseTransferImportTarget,
): Promise<ImportPlanResult> {
  const state = createPlanState(envelope);
  const rootResult = await planRootHorse(db, state, target);
  if (!rootResult.ok) {
    return rootResult;
  }

  for (const tableName of IMPORT_TABLE_ORDER) {
    const rows = envelope.tables[tableName] as readonly RowRecord[];
    for (const row of rows) {
      if (isRootHorseRow(envelope, tableName, row)) {
        continue;
      }

      if (envelope.sourceHorse.type === 'mare' && tableName === 'stallions') {
        await planContextStallion(db, state, row);
        continue;
      }

      await planTableRow(db, state, tableName, row);
    }
  }

  return {
    ok: true,
    plan: {
      plannedInserts: state.plannedInserts,
      summary: buildImportSummary(state.rowResults),
    },
  };
}

function createPlanState(envelope: HorseTransferEnvelopeV1): PlanState {
  return {
    envelope,
    idMap: createHorseTransferIdMap(),
    plannedInserts: [],
    rowResults: [],
    outcomesBySource: new Map<string, HorseTransferRowOutcome>(),
    unsafeContextStallionIds: new Set<string>(),
    unsafeContextCollectionIds: new Set<string>(),
  };
}

async function planRootHorse(
  db: ImportDb,
  state: PlanState,
  target: HorseTransferImportTarget,
): Promise<RootPlanResult> {
  const tableName = rootTableName(state.envelope);
  const rootRow = state.envelope.tables[tableName][0] as unknown as RowRecord;

  if (target.kind === 'confirmed_match') {
    const existing = await selectCurrentRowById(db, tableName, target.destinationHorseId);
    if (!existing) {
      return {
        ok: false,
        errorMessage: 'Confirmed destination horse was not found.',
      };
    }

    setMappedHorseTransferId(state.idMap, tableName, rootRow.id, target.destinationHorseId);
    addRowResult(state, {
      table: tableName,
      sourceId: rootRow.id,
      destinationId: target.destinationHorseId,
      outcome: 'already_present',
      message: 'Destination horse was preserved.',
    });
    return { ok: true };
  }

  const sourceIdCollision = await selectCurrentRowById(db, tableName, rootRow.id);
  const destinationId = sourceIdCollision
    ? await generateUnusedDestinationId(db, state, tableName)
    : rootRow.id;

  setMappedHorseTransferId(state.idMap, tableName, rootRow.id, destinationId);
  const rewrittenRoot = remapHorseTransferRow(tableName, rootRow as never, state.idMap) as RowRecord;

  state.plannedInserts.push({ tableName, row: rewrittenRoot });
  addRowResult(state, {
    table: tableName,
    sourceId: rootRow.id,
    destinationId,
    outcome: 'inserted',
  });
  return { ok: true };
}

async function planContextStallion(
  db: ImportDb,
  state: PlanState,
  sourceRow: RowRecord,
): Promise<void> {
  const existing = await selectCurrentRowById(db, 'stallions', sourceRow.id);
  if (!existing) {
    setMappedHorseTransferId(state.idMap, 'stallions', sourceRow.id, sourceRow.id);
    state.plannedInserts.push({
      tableName: 'stallions',
      row: remapHorseTransferRow('stallions', sourceRow as never, state.idMap) as RowRecord,
    });
    addRowResult(state, {
      table: 'stallions',
      sourceId: sourceRow.id,
      destinationId: sourceRow.id,
      outcome: 'inserted',
    });
    return;
  }

  if (isSafeContextStallion(sourceRow, existing)) {
    setMappedHorseTransferId(state.idMap, 'stallions', sourceRow.id, sourceRow.id);
    addRowResult(state, {
      table: 'stallions',
      sourceId: sourceRow.id,
      destinationId: sourceRow.id,
      outcome: 'already_present',
      message: 'Destination context stallion was preserved.',
    });
    return;
  }

  state.unsafeContextStallionIds.add(sourceRow.id);
  addRowResult(state, {
    table: 'stallions',
    sourceId: sourceRow.id,
    destinationId: sourceRow.id,
    outcome: 'conflict',
    reason: 'unsafe_context_link',
    message: 'Context stallion ID collides with a different destination stallion.',
  });
}

async function planTableRow(
  db: ImportDb,
  state: PlanState,
  tableName: BackupTableName,
  sourceRow: RowRecord,
): Promise<void> {
  const contextBlock = getContextLinkBlock(state, tableName, sourceRow);
  if (contextBlock) {
    addRowResult(state, {
      table: tableName,
      sourceId: sourceRow.id,
      outcome: 'skipped',
      reason: contextBlock,
      message: 'Row depends on an unsafe context link.',
    });
    return;
  }

  const parentBlock = getRequiredParentBlock(state, tableName, sourceRow);
  if (parentBlock) {
    addRowResult(state, {
      table: tableName,
      sourceId: sourceRow.id,
      outcome: 'skipped',
      reason: 'cascade_parent_conflict',
      message: `Skipped because parent ${parentBlock.table}.${parentBlock.sourceId} was not imported.`,
    });
    return;
  }

  let row = rewriteRowForImport(state, tableName, sourceRow);
  const existingById = await selectCurrentRowById(db, tableName, row.id);

  if (existingById) {
    if (hasSameOwnershipChain(tableName, row, existingById)) {
      if (rowsHaveSameEffectiveData(tableName, row, existingById)) {
        addRowResult(state, {
          table: tableName,
          sourceId: sourceRow.id,
          destinationId: row.id,
          outcome: 'already_present',
        });
        return;
      }

      addEffectiveDataConflict(state, tableName, sourceRow, row, existingById);
      return;
    }

    if (shouldTreatContextCollectionCollisionAsUnsafe(state, tableName)) {
      state.unsafeContextCollectionIds.add(sourceRow.id);
      addRowResult(state, {
        table: tableName,
        sourceId: sourceRow.id,
        destinationId: row.id,
        outcome: 'conflict',
        reason: 'unsafe_context_link',
        message: 'Context semen collection ID collides with a different destination collection.',
      });
      return;
    }

    const destinationId = await generateUnusedDestinationId(db, state, tableName);
    setMappedHorseTransferId(state.idMap, tableName, sourceRow.id, destinationId);
    row = rewriteRowForImport(state, tableName, sourceRow);
  } else {
    setMappedHorseTransferId(state.idMap, tableName, sourceRow.id, row.id);
  }

  const naturalConflict = await selectNaturalConflictRow(db, tableName, row);
  if (naturalConflict && naturalConflict.id !== row.id) {
    addNaturalKeyConflict(state, tableName, sourceRow, row, naturalConflict);
    return;
  }

  state.plannedInserts.push({ tableName, row });
  addRowResult(state, {
    table: tableName,
    sourceId: sourceRow.id,
    destinationId: row.id,
    outcome: 'inserted',
  });
}

function rewriteRowForImport(
  state: PlanState,
  tableName: BackupTableName,
  sourceRow: RowRecord,
): RowRecord {
  const remapped = remapHorseTransferRow(tableName, sourceRow as never, state.idMap) as RowRecord;
  return applyOptionalLinkFallbacks(state, tableName, sourceRow, remapped);
}

function applyOptionalLinkFallbacks(
  state: PlanState,
  tableName: BackupTableName,
  sourceRow: RowRecord,
  row: RowRecord,
): RowRecord {
  if (tableName === 'breeding_records') {
    const next = { ...row };
    const sourceStallionId = sourceRow.stallion_id as string | null;
    if (sourceStallionId && state.unsafeContextStallionIds.has(sourceStallionId)) {
      next.stallion_id = null;
      next.stallion_name = findExportedStallionName(state.envelope, sourceStallionId);
      next.collection_id = null;
      return next;
    }

    const sourceCollectionId = sourceRow.collection_id as string | null;
    if (
      sourceCollectionId &&
      (!isSourceRowAvailable(state, 'semen_collections', sourceCollectionId) ||
        state.unsafeContextCollectionIds.has(sourceCollectionId))
    ) {
      next.collection_id = null;
    }
    return next;
  }

  if (tableName === 'foaling_records') {
    const sourceBreedingId = sourceRow.breeding_record_id as string | null;
    if (sourceBreedingId && !isSourceRowAvailable(state, 'breeding_records', sourceBreedingId)) {
      return {
        ...row,
        breeding_record_id: null,
      };
    }
  }

  if (tableName === 'medication_logs') {
    const sourceDailyLogId = sourceRow.source_daily_log_id as string | null;
    if (sourceDailyLogId && !isSourceRowAvailable(state, 'daily_logs', sourceDailyLogId)) {
      return {
        ...row,
        source_daily_log_id: null,
      };
    }
  }

  if (tableName === 'collection_dose_events') {
    const sourceBreedingId = sourceRow.breeding_record_id as string | null;
    if (sourceBreedingId && !isSourceRowAvailable(state, 'breeding_records', sourceBreedingId)) {
      return {
        ...row,
        breeding_record_id: null,
      };
    }
  }

  if (tableName === 'frozen_semen_batches') {
    const sourceCollectionId = sourceRow.collection_id as string | null;
    if (sourceCollectionId && !isSourceRowAvailable(state, 'semen_collections', sourceCollectionId)) {
      return {
        ...row,
        collection_id: null,
      };
    }
  }

  return row;
}

function getContextLinkBlock(
  state: PlanState,
  tableName: BackupTableName,
  sourceRow: RowRecord,
): HorseTransferConflictReason | null {
  if (state.envelope.sourceHorse.type !== 'mare' || tableName !== 'semen_collections') {
    return null;
  }

  const sourceStallionId = sourceRow.stallion_id as string;
  return state.unsafeContextStallionIds.has(sourceStallionId)
    ? 'unsafe_context_link'
    : null;
}

function getRequiredParentBlock(
  state: PlanState,
  tableName: BackupTableName,
  row: RowRecord,
): { readonly table: BackupTableName; readonly sourceId: string } | null {
  const parents = getRequiredParentRefs(row, tableName);
  return parents.find((parent) => isSourceRowUnavailable(state, parent.table, parent.sourceId)) ?? null;
}

function getRequiredParentRefs(
  row: RowRecord,
  tableName: BackupTableName,
): readonly { readonly table: BackupTableName; readonly sourceId: string }[] {
  switch (tableName) {
    case 'daily_logs':
      return [{ table: 'mares', sourceId: row.mare_id as string }];
    case 'uterine_fluid':
    case 'uterine_flushes':
      return [{ table: 'daily_logs', sourceId: row.daily_log_id as string }];
    case 'uterine_flush_products':
      return [{ table: 'uterine_flushes', sourceId: row.uterine_flush_id as string }];
    case 'breeding_records':
      return [{ table: 'mares', sourceId: row.mare_id as string }];
    case 'pregnancy_checks':
      return [
        { table: 'mares', sourceId: row.mare_id as string },
        { table: 'breeding_records', sourceId: row.breeding_record_id as string },
      ];
    case 'foaling_records':
      return [{ table: 'mares', sourceId: row.mare_id as string }];
    case 'foals':
      return [{ table: 'foaling_records', sourceId: row.foaling_record_id as string }];
    case 'medication_logs':
      return [{ table: 'mares', sourceId: row.mare_id as string }];
    case 'tasks':
      return getTaskParentRefs(row);
    case 'semen_collections':
      return [{ table: 'stallions', sourceId: row.stallion_id as string }];
    case 'collection_dose_events':
      return [{ table: 'semen_collections', sourceId: row.collection_id as string }];
    case 'frozen_semen_batches':
      return [{ table: 'stallions', sourceId: row.stallion_id as string }];
    case 'mares':
    case 'stallions':
      return [];
  }
}

function getTaskParentRefs(
  row: RowRecord,
): readonly { readonly table: BackupTableName; readonly sourceId: string }[] {
  const parents: { table: BackupTableName; sourceId: string }[] = [
    { table: 'mares', sourceId: row.mare_id as string },
  ];

  const completedRecordId = row.completed_record_id as string | null;
  const completedRecordType = row.completed_record_type as string | null;
  if (completedRecordId && completedRecordType) {
    const table = taskPointerTypeToTable(completedRecordType);
    if (table) parents.push({ table, sourceId: completedRecordId });
  }

  const sourceRecordId = row.source_record_id as string | null;
  const sourceType = row.source_type as string;
  if (sourceRecordId && sourceType !== 'manual') {
    const table = taskPointerTypeToTable(sourceType);
    if (table) parents.push({ table, sourceId: sourceRecordId });
  }

  return parents;
}

function shouldTreatContextCollectionCollisionAsUnsafe(
  state: PlanState,
  tableName: BackupTableName,
): boolean {
  return state.envelope.sourceHorse.type === 'mare' && tableName === 'semen_collections';
}

function addEffectiveDataConflict(
  state: PlanState,
  tableName: BackupTableName,
  sourceRow: RowRecord,
  destinationRow: RowRecord,
  existingRow: RowRecord,
): void {
  const foalDetail = tableName === 'foals'
    ? createFoalConflictDetail(destinationRow, existingRow)
    : undefined;

  addRowResult(state, {
    table: tableName,
    sourceId: sourceRow.id,
    destinationId: destinationRow.id,
    outcome: 'conflict',
    reason: 'different_effective_data',
    message: foalDetail ? createFoalConflictMessage(foalDetail) : 'Destination row was preserved.',
    detail: foalDetail,
  });
}

function addNaturalKeyConflict(
  state: PlanState,
  tableName: BackupTableName,
  sourceRow: RowRecord,
  destinationRow: RowRecord,
  existingRow: RowRecord,
): void {
  const foalDetail = tableName === 'foals'
    ? createFoalConflictDetail(destinationRow, existingRow)
    : undefined;

  addRowResult(state, {
    table: tableName,
    sourceId: sourceRow.id,
    destinationId: existingRow.id,
    outcome: 'conflict',
    reason: 'natural_key_conflict',
    message: foalDetail ? createFoalConflictMessage(foalDetail) : 'Destination row was preserved.',
    detail: foalDetail,
  });
}

function addRowResult(state: PlanState, result: HorseTransferRowResult): void {
  state.rowResults.push(result);
  state.outcomesBySource.set(sourceKey(result.table, result.sourceId), result.outcome);
}

function isSourceRowAvailable(
  state: PlanState,
  tableName: BackupTableName,
  sourceId: string,
): boolean {
  const outcome = state.outcomesBySource.get(sourceKey(tableName, sourceId));
  return outcome === 'inserted' || outcome === 'already_present';
}

function isSourceRowUnavailable(
  state: PlanState,
  tableName: BackupTableName,
  sourceId: string,
): boolean {
  const outcome = state.outcomesBySource.get(sourceKey(tableName, sourceId));
  return outcome === 'skipped' || outcome === 'conflict';
}

function sourceKey(tableName: BackupTableName, sourceId: string): string {
  return `${tableName}:${sourceId}`;
}

function rootTableName(envelope: HorseTransferEnvelopeV1): 'mares' | 'stallions' {
  return envelope.sourceHorse.type === 'mare' ? 'mares' : 'stallions';
}

function isRootHorseRow(
  envelope: HorseTransferEnvelopeV1,
  tableName: BackupTableName,
  row: RowRecord,
): boolean {
  return tableName === rootTableName(envelope) && row.id === envelope.sourceHorse.id;
}

function hasSameOwnershipChain(
  tableName: BackupTableName,
  importedRow: RowRecord,
  existingRow: RowRecord,
): boolean {
  const columns = ownershipColumns(tableName);
  return columns.every((column) => importedRow[column] === existingRow[column]);
}

function ownershipColumns(tableName: BackupTableName): readonly string[] {
  switch (tableName) {
    case 'daily_logs':
    case 'breeding_records':
    case 'foaling_records':
    case 'medication_logs':
    case 'tasks':
      return ['mare_id'];
    case 'pregnancy_checks':
      return ['mare_id', 'breeding_record_id'];
    case 'uterine_fluid':
    case 'uterine_flushes':
      return ['daily_log_id'];
    case 'uterine_flush_products':
      return ['uterine_flush_id'];
    case 'foals':
      return ['foaling_record_id'];
    case 'semen_collections':
    case 'frozen_semen_batches':
      return ['stallion_id'];
    case 'collection_dose_events':
      return ['collection_id'];
    case 'mares':
    case 'stallions':
      return ['id'];
  }
}

async function selectCurrentRowById(
  db: ImportDb,
  tableName: BackupTableName,
  id: string,
): Promise<RowRecord | null> {
  return db.getFirstAsync<RowRecord>(
    `
    SELECT ${selectColumnList(tableName)}
    FROM ${tableName}
    WHERE id = ?
    LIMIT 1;
    `,
    [id],
  );
}

async function selectNaturalConflictRow(
  db: ImportDb,
  tableName: BackupTableName,
  row: RowRecord,
): Promise<RowRecord | null> {
  switch (tableName) {
    case 'daily_logs':
      return db.getFirstAsync<RowRecord>(
        `
        SELECT ${selectColumnList('daily_logs')}
        FROM daily_logs
        WHERE mare_id = ?
          AND date = ?
          AND ((time IS NULL AND ? IS NULL) OR time = ?)
        LIMIT 1;
        `,
        [row.mare_id, row.date, row.time, row.time],
      );
    case 'uterine_flushes':
      return db.getFirstAsync<RowRecord>(
        `
        SELECT ${selectColumnList('uterine_flushes')}
        FROM uterine_flushes
        WHERE daily_log_id = ?
        LIMIT 1;
        `,
        [row.daily_log_id],
      );
    case 'foals':
      return db.getFirstAsync<RowRecord>(
        `
        SELECT ${selectColumnList('foals')}
        FROM foals
        WHERE foaling_record_id = ?
        LIMIT 1;
        `,
        [row.foaling_record_id],
      );
    case 'tasks':
      if (
        row.status !== 'open' ||
        row.source_type !== 'breedingRecord' ||
        row.source_reason !== 'breedingPregnancyCheck' ||
        typeof row.source_record_id !== 'string'
      ) {
        return null;
      }

      return db.getFirstAsync<RowRecord>(
        `
        SELECT ${selectColumnList('tasks')}
        FROM tasks
        WHERE source_record_id = ?
          AND status = 'open'
          AND source_type = 'breedingRecord'
          AND source_reason = 'breedingPregnancyCheck'
        LIMIT 1;
        `,
        [row.source_record_id],
      );
    default:
      return null;
  }
}

async function generateUnusedDestinationId(
  db: ImportDb,
  state: PlanState,
  tableName: BackupTableName,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = newId();
    const existing = await selectCurrentRowById(db, tableName, candidate);
    if (!existing && !isDestinationIdAlreadyPlanned(state, tableName, candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not generate an unused ID for ${tableName}.`);
}

function isDestinationIdAlreadyPlanned(
  state: PlanState,
  tableName: BackupTableName,
  destinationId: string,
): boolean {
  return Array.from(state.idMap[tableName].values()).includes(destinationId);
}

async function insertCurrentTableRow(
  db: ImportDb,
  tableName: BackupTableName,
  row: RowRecord,
): Promise<void> {
  const columns = BACKUP_CURRENT_TABLE_FIELD_NAMES[tableName];
  const placeholders = columns.map(() => '?').join(', ');
  await db.runAsync(
    `
    INSERT INTO ${tableName} (
      ${columns.join(',\n      ')}
    ) VALUES (${placeholders});
    `,
    columns.map((column) => row[column] ?? null),
  );
}

function selectColumnList(tableName: BackupTableName): string {
  return BACKUP_CURRENT_TABLE_FIELD_NAMES[tableName].join(', ');
}

function rowsHaveSameEffectiveData(
  tableName: BackupTableName,
  left: RowRecord,
  right: RowRecord,
): boolean {
  for (const column of BACKUP_CURRENT_TABLE_FIELD_NAMES[tableName]) {
    if (EFFECTIVE_COMPARE_EXCLUDED_FIELDS.has(column)) {
      continue;
    }

    if (
      normalizeEffectiveValue(tableName, column, left[column]) !==
      normalizeEffectiveValue(tableName, column, right[column])
    ) {
      return false;
    }
  }

  return true;
}

function normalizeEffectiveValue(
  tableName: BackupTableName,
  column: string,
  value: unknown,
): unknown {
  if (!JSON_TEXT_FIELDS[tableName]?.has(column) || typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.stringify(sortJsonValue(JSON.parse(value)));
  } catch {
    return value;
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonValue(record[key]);
        return acc;
      }, {});
  }

  return value;
}

function createFoalConflictDetail(importedRow: RowRecord, existingRow: RowRecord) {
  return {
    kind: 'foal_conflict' as const,
    destinationPreserved: true as const,
    milestonesDiffer:
      normalizeEffectiveValue('foals', 'milestones', importedRow.milestones) !==
      normalizeEffectiveValue('foals', 'milestones', existingRow.milestones),
    iggTestsDiffer:
      normalizeEffectiveValue('foals', 'igg_tests', importedRow.igg_tests) !==
      normalizeEffectiveValue('foals', 'igg_tests', existingRow.igg_tests),
  };
}

function createFoalConflictMessage(detail: ReturnType<typeof createFoalConflictDetail>): string {
  const milestonesText = detail.milestonesDiffer ? 'differ' : 'match';
  const iggText = detail.iggTestsDiffer ? 'differ' : 'match';
  return `Destination foal was preserved. Imported milestones ${milestonesText}; imported IgG history ${iggText}.`;
}

function buildImportSummary(
  rowResults: readonly HorseTransferRowResult[],
): HorseTransferImportSummary {
  const tableCounts = {} as HorseTransferImportTableCounts;
  for (const tableName of BACKUP_TABLE_NAMES) {
    tableCounts[tableName] = createZeroOutcomeCounts();
  }

  const totalCounts = createZeroOutcomeCounts();
  for (const result of rowResults) {
    tableCounts[result.table][result.outcome] += 1;
    totalCounts[result.outcome] += 1;
  }

  return {
    tableCounts,
    totalCounts,
    rowResults,
  };
}

function createZeroOutcomeCounts(): HorseTransferOutcomeCounts {
  return OUTCOMES.reduce((counts, outcome) => {
    counts[outcome] = 0;
    return counts;
  }, {} as HorseTransferOutcomeCounts);
}

function findExportedStallionName(
  envelope: HorseTransferEnvelopeV1,
  stallionId: string,
): string | null {
  return envelope.tables.stallions.find((row) => row.id === stallionId)?.name ?? null;
}

function isSafeContextStallion(sourceRow: RowRecord, existingRow: RowRecord): boolean {
  const sourceRegistration = normalizeIdentityText(sourceRow.registration_number);
  const existingRegistration = normalizeIdentityText(existingRow.registration_number);
  if (sourceRegistration && existingRegistration) {
    return sourceRegistration === existingRegistration;
  }

  const sourceDob = sourceRow.date_of_birth as string | null;
  const existingDob = existingRow.date_of_birth as string | null;
  if (sourceDob && existingDob && sourceDob !== existingDob) {
    return false;
  }

  return normalizeIdentityText(sourceRow.name) === normalizeIdentityText(existingRow.name);
}

function normalizeIdentityText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}
