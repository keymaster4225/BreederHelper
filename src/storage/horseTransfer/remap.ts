import { BACKUP_TABLE_NAMES, type BackupTableName } from '@/storage/backup/types';

import type { HorseTransferTablesV1 } from './types';

export type MutableHorseTransferIdMap = Record<BackupTableName, Map<string, string>>;
export type HorseTransferIdMap = Record<BackupTableName, ReadonlyMap<string, string>>;

type RowRecord = Record<string, unknown> & {
  id: string;
};

export function createHorseTransferIdMap(): MutableHorseTransferIdMap {
  const idMap = {} as MutableHorseTransferIdMap;
  for (const tableName of BACKUP_TABLE_NAMES) {
    idMap[tableName] = new Map<string, string>();
  }
  return idMap;
}

export function setMappedHorseTransferId(
  idMap: MutableHorseTransferIdMap,
  tableName: BackupTableName,
  sourceId: string,
  destinationId: string,
): void {
  idMap[tableName].set(sourceId, destinationId);
}

export function getMappedHorseTransferId(
  idMap: HorseTransferIdMap,
  tableName: BackupTableName,
  sourceId: string,
): string | null {
  return idMap[tableName].get(sourceId) ?? null;
}

export function mapHorseTransferId(
  idMap: HorseTransferIdMap,
  tableName: BackupTableName,
  sourceId: string,
): string {
  return getMappedHorseTransferId(idMap, tableName, sourceId) ?? sourceId;
}

export function mapNullableHorseTransferId(
  idMap: HorseTransferIdMap,
  tableName: BackupTableName,
  sourceId: string | null,
): string | null {
  return sourceId === null ? null : mapHorseTransferId(idMap, tableName, sourceId);
}

export function remapHorseTransferRow<TTable extends BackupTableName>(
  tableName: TTable,
  row: HorseTransferTablesV1[TTable][number],
  idMap: HorseTransferIdMap,
): HorseTransferTablesV1[TTable][number] {
  const source = row as unknown as RowRecord;
  const base: RowRecord = {
    ...source,
    id: mapHorseTransferId(idMap, tableName, source.id),
  };

  switch (tableName) {
    case 'daily_logs':
      return {
        ...base,
        mare_id: mapHorseTransferId(idMap, 'mares', base.mare_id as string),
      } as HorseTransferTablesV1[TTable][number];
    case 'uterine_fluid':
      return {
        ...base,
        daily_log_id: mapHorseTransferId(idMap, 'daily_logs', base.daily_log_id as string),
      } as HorseTransferTablesV1[TTable][number];
    case 'uterine_flushes':
      return {
        ...base,
        daily_log_id: mapHorseTransferId(idMap, 'daily_logs', base.daily_log_id as string),
      } as HorseTransferTablesV1[TTable][number];
    case 'uterine_flush_products':
      return {
        ...base,
        uterine_flush_id: mapHorseTransferId(
          idMap,
          'uterine_flushes',
          base.uterine_flush_id as string,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'breeding_records':
      return {
        ...base,
        mare_id: mapHorseTransferId(idMap, 'mares', base.mare_id as string),
        stallion_id: mapNullableHorseTransferId(
          idMap,
          'stallions',
          base.stallion_id as string | null,
        ),
        collection_id: mapNullableHorseTransferId(
          idMap,
          'semen_collections',
          base.collection_id as string | null,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'pregnancy_checks':
      return {
        ...base,
        mare_id: mapHorseTransferId(idMap, 'mares', base.mare_id as string),
        breeding_record_id: mapHorseTransferId(
          idMap,
          'breeding_records',
          base.breeding_record_id as string,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'foaling_records':
      return {
        ...base,
        mare_id: mapHorseTransferId(idMap, 'mares', base.mare_id as string),
        breeding_record_id: mapNullableHorseTransferId(
          idMap,
          'breeding_records',
          base.breeding_record_id as string | null,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'foals':
      return {
        ...base,
        foaling_record_id: mapHorseTransferId(
          idMap,
          'foaling_records',
          base.foaling_record_id as string,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'medication_logs':
      return {
        ...base,
        mare_id: mapHorseTransferId(idMap, 'mares', base.mare_id as string),
        source_daily_log_id: mapNullableHorseTransferId(
          idMap,
          'daily_logs',
          base.source_daily_log_id as string | null,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'tasks':
      return {
        ...base,
        mare_id: mapHorseTransferId(idMap, 'mares', base.mare_id as string),
        completed_record_id: mapTaskPointerId(
          idMap,
          base.completed_record_type as string | null,
          base.completed_record_id as string | null,
        ),
        source_record_id: mapTaskPointerId(
          idMap,
          base.source_type as string,
          base.source_record_id as string | null,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'semen_collections':
      return {
        ...base,
        stallion_id: mapHorseTransferId(idMap, 'stallions', base.stallion_id as string),
      } as HorseTransferTablesV1[TTable][number];
    case 'collection_dose_events':
      return {
        ...base,
        collection_id: mapHorseTransferId(
          idMap,
          'semen_collections',
          base.collection_id as string,
        ),
        breeding_record_id: mapNullableHorseTransferId(
          idMap,
          'breeding_records',
          base.breeding_record_id as string | null,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'frozen_semen_batches':
      return {
        ...base,
        stallion_id: mapHorseTransferId(idMap, 'stallions', base.stallion_id as string),
        collection_id: mapNullableHorseTransferId(
          idMap,
          'semen_collections',
          base.collection_id as string | null,
        ),
      } as HorseTransferTablesV1[TTable][number];
    case 'mares':
    case 'stallions':
      return base as HorseTransferTablesV1[TTable][number];
  }
}

function mapTaskPointerId(
  idMap: HorseTransferIdMap,
  pointerType: string | null,
  pointerId: string | null,
): string | null {
  if (pointerId === null || pointerType === null || pointerType === 'manual') {
    return pointerId;
  }

  const tableName = taskPointerTypeToTable(pointerType);
  return tableName === null ? pointerId : mapHorseTransferId(idMap, tableName, pointerId);
}

export function taskPointerTypeToTable(pointerType: string): BackupTableName | null {
  switch (pointerType) {
    case 'dailyLog':
      return 'daily_logs';
    case 'medicationLog':
      return 'medication_logs';
    case 'breedingRecord':
      return 'breeding_records';
    case 'pregnancyCheck':
      return 'pregnancy_checks';
    default:
      return null;
  }
}
