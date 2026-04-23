import {
  CERVICAL_FIRMNESS_VALUES,
  FOLLICLE_STATE_VALUES,
  OVARY_CONSISTENCY_VALUES,
  OVARY_STRUCTURE_VALUES,
  UTERINE_TONE_CATEGORY_VALUES,
} from '@/models/enums';
import type {
  CervicalFirmness,
  DailyLog,
  DailyLogDetail,
  DailyLogOvulationSource,
  FollicleState,
  OvaryConsistency,
  OvaryStructure,
  UterineToneCategory,
} from '@/models/types';
import { emitDataInvalidation } from '@/storage/dataInvalidation';

import {
  deleteByDailyLogId,
  listByDailyLogId,
  replaceByDailyLogId,
  type ReplaceUterineFluidPocketInput,
} from './uterineFluid';
import type { RepoDb } from './internal/dbTypes';
import { resolveDb } from './internal/resolveDb';

type DailyLogRow = {
  id: string;
  mare_id: string;
  date: string;
  teasing_score: number | null;
  right_ovary: string | null;
  left_ovary: string | null;
  ovulation_detected: number | null;
  edema: number | null;
  uterine_tone: string | null;
  uterine_cysts: string | null;
  right_ovary_ovulation: number | null;
  right_ovary_follicle_state: string | null;
  right_ovary_follicle_measurements_mm: string | null;
  right_ovary_consistency: string | null;
  right_ovary_structures: string | null;
  left_ovary_ovulation: number | null;
  left_ovary_follicle_state: string | null;
  left_ovary_follicle_measurements_mm: string | null;
  left_ovary_consistency: string | null;
  left_ovary_structures: string | null;
  uterine_tone_category: string | null;
  cervical_firmness: string | null;
  discharge_observed: number | null;
  discharge_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyLogWriteInput = {
  id: string;
  mareId: string;
  date: string;
  teasingScore?: number | null;
  rightOvary?: string | null;
  leftOvary?: string | null;
  ovulationDetected?: boolean | null;
  edema?: number | null;
  uterineTone?: string | null;
  uterineCysts?: string | null;
  rightOvaryOvulation?: boolean | null;
  rightOvaryFollicleState?: FollicleState | null;
  rightOvaryFollicleMeasurementsMm?: readonly number[] | null;
  rightOvaryConsistency?: OvaryConsistency | null;
  rightOvaryStructures?: readonly OvaryStructure[] | null;
  leftOvaryOvulation?: boolean | null;
  leftOvaryFollicleState?: FollicleState | null;
  leftOvaryFollicleMeasurementsMm?: readonly number[] | null;
  leftOvaryConsistency?: OvaryConsistency | null;
  leftOvaryStructures?: readonly OvaryStructure[] | null;
  uterineToneCategory?: UterineToneCategory | null;
  cervicalFirmness?: CervicalFirmness | null;
  dischargeObserved?: boolean | null;
  dischargeNotes?: string | null;
  notes?: string | null;
  ovulationSource?: DailyLogOvulationSource;
  uterineFluidPockets?: readonly ReplaceUterineFluidPocketInput[];
};

type DailyLogUpdateInput = Omit<DailyLogWriteInput, 'id' | 'mareId'>;

const FOLLICLE_STATE_SET = new Set<string>(FOLLICLE_STATE_VALUES);
const OVARY_CONSISTENCY_SET = new Set<string>(OVARY_CONSISTENCY_VALUES);
const OVARY_STRUCTURE_SET = new Set<string>(OVARY_STRUCTURE_VALUES);
const UTERINE_TONE_CATEGORY_SET = new Set<string>(UTERINE_TONE_CATEGORY_VALUES);
const CERVICAL_FIRMNESS_SET = new Set<string>(CERVICAL_FIRMNESS_VALUES);
const FOLLICLE_MEASUREMENT_INPUT_PATTERN = /^\d*\.?\d*$/;

const DAILY_LOG_SELECT_COLUMNS = `
  id,
  mare_id,
  date,
  teasing_score,
  right_ovary,
  left_ovary,
  ovulation_detected,
  edema,
  uterine_tone,
  uterine_cysts,
  right_ovary_ovulation,
  right_ovary_follicle_state,
  right_ovary_follicle_measurements_mm,
  right_ovary_consistency,
  right_ovary_structures,
  left_ovary_ovulation,
  left_ovary_follicle_state,
  left_ovary_follicle_measurements_mm,
  left_ovary_consistency,
  left_ovary_structures,
  uterine_tone_category,
  cervical_firmness,
  discharge_observed,
  discharge_notes,
  notes,
  created_at,
  updated_at
`;

function fromSqlNullableBoolean(value: number | null): boolean | null {
  return value === null ? null : Boolean(value);
}

function toSqlNullableBoolean(value: boolean | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return value ? 1 : 0;
}

function parseOptionalEnum<T extends string>(
  value: string | null,
  allowedValues: ReadonlySet<string>,
): T | null {
  if (value == null) {
    return null;
  }
  return allowedValues.has(value) ? (value as T) : null;
}

function hasAtMostOneDecimalPlace(value: number): boolean {
  const scaled = value * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function isValidMeasurementNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100 && hasAtMostOneDecimalPlace(value);
}

function normalizeMeasurementValue(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!isValidMeasurementNumber(value)) {
      return null;
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '.' || !FOLLICLE_MEASUREMENT_INPUT_PATTERN.test(trimmed)) {
      return null;
    }
    const parsed = Number(trimmed);
    if (!isValidMeasurementNumber(parsed)) {
      return null;
    }
    return parsed;
  }

  return null;
}

function normalizeFollicleMeasurements(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const result: number[] = [];
  for (const value of values) {
    const normalized = normalizeMeasurementValue(value);
    if (normalized != null) {
      result.push(normalized);
    }
  }
  return result;
}

export function parseFollicleMeasurementsJson(value: string | null): number[] {
  if (value == null) {
    return [];
  }

  try {
    return normalizeFollicleMeasurements(JSON.parse(value));
  } catch {
    return [];
  }
}

function serializeFollicleMeasurements(
  measurements: readonly number[] | null | undefined,
  follicleState: FollicleState | null | undefined,
): string {
  if (follicleState !== 'measured') {
    return '[]';
  }

  return JSON.stringify(normalizeFollicleMeasurements(measurements ?? []));
}

function normalizeOvaryStructures(values: unknown): OvaryStructure[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const selected = new Set<OvaryStructure>();
  for (const value of values) {
    if (typeof value === 'string' && OVARY_STRUCTURE_SET.has(value)) {
      selected.add(value as OvaryStructure);
    }
  }

  return OVARY_STRUCTURE_VALUES.filter((value) => selected.has(value));
}

export function parseOvaryStructuresJson(value: string | null): OvaryStructure[] {
  if (value == null) {
    return [];
  }

  try {
    return normalizeOvaryStructures(JSON.parse(value));
  } catch {
    return [];
  }
}

function serializeOvaryStructures(
  values: readonly OvaryStructure[] | null | undefined,
): string {
  return JSON.stringify(normalizeOvaryStructures(values ?? []));
}

function normalizeDischargeNotes(
  dischargeObserved: boolean | null | undefined,
  dischargeNotes: string | null | undefined,
): string | null {
  if (dischargeObserved !== true) {
    return null;
  }

  const trimmed = dischargeNotes?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function deriveGlobalOvulationDetected(
  rightOvaryOvulation: boolean | null,
  leftOvaryOvulation: boolean | null,
): boolean | null {
  if (rightOvaryOvulation === true || leftOvaryOvulation === true) {
    return true;
  }

  if (rightOvaryOvulation === false && leftOvaryOvulation === false) {
    return false;
  }

  return null;
}

function mapDailyLogRow(row: DailyLogRow): DailyLog {
  return {
    id: row.id,
    mareId: row.mare_id,
    date: row.date,
    teasingScore: row.teasing_score,
    rightOvary: row.right_ovary,
    leftOvary: row.left_ovary,
    rightOvaryOvulation: fromSqlNullableBoolean(row.right_ovary_ovulation),
    rightOvaryFollicleState: parseOptionalEnum<FollicleState>(
      row.right_ovary_follicle_state,
      FOLLICLE_STATE_SET,
    ),
    rightOvaryFollicleMeasurementsMm: parseFollicleMeasurementsJson(
      row.right_ovary_follicle_measurements_mm,
    ),
    rightOvaryConsistency: parseOptionalEnum<OvaryConsistency>(
      row.right_ovary_consistency,
      OVARY_CONSISTENCY_SET,
    ),
    rightOvaryStructures: parseOvaryStructuresJson(row.right_ovary_structures),
    leftOvaryOvulation: fromSqlNullableBoolean(row.left_ovary_ovulation),
    leftOvaryFollicleState: parseOptionalEnum<FollicleState>(
      row.left_ovary_follicle_state,
      FOLLICLE_STATE_SET,
    ),
    leftOvaryFollicleMeasurementsMm: parseFollicleMeasurementsJson(
      row.left_ovary_follicle_measurements_mm,
    ),
    leftOvaryConsistency: parseOptionalEnum<OvaryConsistency>(
      row.left_ovary_consistency,
      OVARY_CONSISTENCY_SET,
    ),
    leftOvaryStructures: parseOvaryStructuresJson(row.left_ovary_structures),
    ovulationDetected: fromSqlNullableBoolean(row.ovulation_detected),
    edema: row.edema,
    uterineTone: row.uterine_tone,
    uterineToneCategory: parseOptionalEnum<UterineToneCategory>(
      row.uterine_tone_category,
      UTERINE_TONE_CATEGORY_SET,
    ),
    cervicalFirmness: parseOptionalEnum<CervicalFirmness>(
      row.cervical_firmness,
      CERVICAL_FIRMNESS_SET,
    ),
    dischargeObserved: fromSqlNullableBoolean(row.discharge_observed),
    dischargeNotes: row.discharge_notes,
    uterineCysts: row.uterine_cysts,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ResolvedOvulationValues = {
  rightOvaryOvulation: boolean | null;
  leftOvaryOvulation: boolean | null;
  ovulationDetected: boolean | null;
};

function resolveOvulationValues(
  input: Pick<
    DailyLogWriteInput,
    'leftOvaryOvulation' | 'ovulationDetected' | 'ovulationSource' | 'rightOvaryOvulation'
  >,
  existing: DailyLogRow | null,
): ResolvedOvulationValues {
  const rightOvaryOvulation =
    input.rightOvaryOvulation === undefined
      ? fromSqlNullableBoolean(existing?.right_ovary_ovulation ?? null)
      : input.rightOvaryOvulation;

  const leftOvaryOvulation =
    input.leftOvaryOvulation === undefined
      ? fromSqlNullableBoolean(existing?.left_ovary_ovulation ?? null)
      : input.leftOvaryOvulation;

  const shouldDeriveFromStructured =
    input.ovulationSource === 'structured' ||
    input.rightOvaryOvulation !== undefined ||
    input.leftOvaryOvulation !== undefined;

  if (shouldDeriveFromStructured) {
    return {
      rightOvaryOvulation,
      leftOvaryOvulation,
      ovulationDetected: deriveGlobalOvulationDetected(rightOvaryOvulation, leftOvaryOvulation),
    };
  }

  const ovulationDetected =
    input.ovulationDetected !== undefined
      ? input.ovulationDetected ?? null
      : fromSqlNullableBoolean(existing?.ovulation_detected ?? null);

  return {
    rightOvaryOvulation,
    leftOvaryOvulation,
    ovulationDetected,
  };
}

export async function createDailyLog(input: DailyLogWriteInput, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  const now = new Date().toISOString();
  const ovulation = resolveOvulationValues(input, null);

  await handle.withTransactionAsync(async () => {
    await handle.runAsync(
      `
      INSERT INTO daily_logs (
        id,
        mare_id,
        date,
        teasing_score,
        right_ovary,
        left_ovary,
        ovulation_detected,
        edema,
        uterine_tone,
        uterine_cysts,
        right_ovary_ovulation,
        right_ovary_follicle_state,
        right_ovary_follicle_measurements_mm,
        right_ovary_consistency,
        right_ovary_structures,
        left_ovary_ovulation,
        left_ovary_follicle_state,
        left_ovary_follicle_measurements_mm,
        left_ovary_consistency,
        left_ovary_structures,
        uterine_tone_category,
        cervical_firmness,
        discharge_observed,
        discharge_notes,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        input.id,
        input.mareId,
        input.date,
        input.teasingScore ?? null,
        input.rightOvary ?? null,
        input.leftOvary ?? null,
        toSqlNullableBoolean(ovulation.ovulationDetected),
        input.edema ?? null,
        input.uterineTone ?? null,
        input.uterineCysts ?? null,
        toSqlNullableBoolean(ovulation.rightOvaryOvulation),
        input.rightOvaryFollicleState ?? null,
        serializeFollicleMeasurements(
          input.rightOvaryFollicleMeasurementsMm,
          input.rightOvaryFollicleState,
        ),
        input.rightOvaryConsistency ?? null,
        serializeOvaryStructures(input.rightOvaryStructures),
        toSqlNullableBoolean(ovulation.leftOvaryOvulation),
        input.leftOvaryFollicleState ?? null,
        serializeFollicleMeasurements(
          input.leftOvaryFollicleMeasurementsMm,
          input.leftOvaryFollicleState,
        ),
        input.leftOvaryConsistency ?? null,
        serializeOvaryStructures(input.leftOvaryStructures),
        input.uterineToneCategory ?? null,
        input.cervicalFirmness ?? null,
        toSqlNullableBoolean(input.dischargeObserved),
        normalizeDischargeNotes(input.dischargeObserved, input.dischargeNotes),
        input.notes ?? null,
        now,
        now,
      ],
    );

    if (input.uterineFluidPockets && input.uterineFluidPockets.length > 0) {
      await replaceByDailyLogId(handle, input.id, input.uterineFluidPockets, now);
    }
  });

  emitDataInvalidation('dailyLogs');
}

export async function updateDailyLog(
  id: string,
  input: DailyLogUpdateInput,
  db?: RepoDb,
): Promise<void> {
  const handle = await resolveDb(db);
  const existing = await handle.getFirstAsync<DailyLogRow>(
    `
    SELECT ${DAILY_LOG_SELECT_COLUMNS}
    FROM daily_logs
    WHERE id = ?;
    `,
    [id],
  );

  const ovulation = resolveOvulationValues(input, existing);
  const now = new Date().toISOString();

  const rightOvary = input.rightOvary === undefined ? existing?.right_ovary ?? null : input.rightOvary ?? null;
  const leftOvary = input.leftOvary === undefined ? existing?.left_ovary ?? null : input.leftOvary ?? null;
  const uterineTone =
    input.uterineTone === undefined ? existing?.uterine_tone ?? null : input.uterineTone ?? null;

  await handle.withTransactionAsync(async () => {
    await handle.runAsync(
      `
      UPDATE daily_logs
      SET
        date = ?,
        teasing_score = ?,
        right_ovary = ?,
        left_ovary = ?,
        ovulation_detected = ?,
        edema = ?,
        uterine_tone = ?,
        uterine_cysts = ?,
        right_ovary_ovulation = ?,
        right_ovary_follicle_state = ?,
        right_ovary_follicle_measurements_mm = ?,
        right_ovary_consistency = ?,
        right_ovary_structures = ?,
        left_ovary_ovulation = ?,
        left_ovary_follicle_state = ?,
        left_ovary_follicle_measurements_mm = ?,
        left_ovary_consistency = ?,
        left_ovary_structures = ?,
        uterine_tone_category = ?,
        cervical_firmness = ?,
        discharge_observed = ?,
        discharge_notes = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?;
      `,
      [
        input.date,
        input.teasingScore ?? null,
        rightOvary,
        leftOvary,
        toSqlNullableBoolean(ovulation.ovulationDetected),
        input.edema ?? null,
        uterineTone,
        input.uterineCysts ?? null,
        toSqlNullableBoolean(ovulation.rightOvaryOvulation),
        input.rightOvaryFollicleState ?? null,
        serializeFollicleMeasurements(
          input.rightOvaryFollicleMeasurementsMm,
          input.rightOvaryFollicleState,
        ),
        input.rightOvaryConsistency ?? null,
        serializeOvaryStructures(input.rightOvaryStructures),
        toSqlNullableBoolean(ovulation.leftOvaryOvulation),
        input.leftOvaryFollicleState ?? null,
        serializeFollicleMeasurements(
          input.leftOvaryFollicleMeasurementsMm,
          input.leftOvaryFollicleState,
        ),
        input.leftOvaryConsistency ?? null,
        serializeOvaryStructures(input.leftOvaryStructures),
        input.uterineToneCategory ?? null,
        input.cervicalFirmness ?? null,
        toSqlNullableBoolean(input.dischargeObserved),
        normalizeDischargeNotes(input.dischargeObserved, input.dischargeNotes),
        input.notes ?? null,
        now,
        id,
      ],
    );

    if (input.uterineFluidPockets !== undefined) {
      await replaceByDailyLogId(handle, id, input.uterineFluidPockets, now);
    }
  });

  emitDataInvalidation('dailyLogs');
}

export async function getDailyLogById(id: string, db?: RepoDb): Promise<DailyLogDetail | null> {
  const handle = await resolveDb(db);
  const row = await handle.getFirstAsync<DailyLogRow>(
    `
    SELECT ${DAILY_LOG_SELECT_COLUMNS}
    FROM daily_logs
    WHERE id = ?;
    `,
    [id],
  );

  if (!row) {
    return null;
  }

  const uterineFluidPockets = await listByDailyLogId(handle, id);
  return {
    ...mapDailyLogRow(row),
    uterineFluidPockets,
  };
}

export async function deleteDailyLog(id: string, db?: RepoDb): Promise<void> {
  const handle = await resolveDb(db);
  await handle.withTransactionAsync(async () => {
    await deleteByDailyLogId(handle, id);
    await handle.runAsync('DELETE FROM daily_logs WHERE id = ?;', [id]);
  });
  emitDataInvalidation('dailyLogs');
}

export async function listAllDailyLogs(db?: RepoDb): Promise<DailyLog[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<DailyLogRow>(
    `
    SELECT ${DAILY_LOG_SELECT_COLUMNS}
    FROM daily_logs
    ORDER BY date DESC;
    `,
  );

  return rows.map(mapDailyLogRow);
}

export async function listDailyLogsByMare(mareId: string, db?: RepoDb): Promise<DailyLog[]> {
  const handle = await resolveDb(db);
  const rows = await handle.getAllAsync<DailyLogRow>(
    `
    SELECT ${DAILY_LOG_SELECT_COLUMNS}
    FROM daily_logs
    WHERE mare_id = ?
    ORDER BY date DESC;
    `,
    [mareId],
  );

  return rows.map(mapDailyLogRow);
}
