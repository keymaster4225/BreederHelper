import { FLUID_LOCATION_VALUES } from '@/models/enums';
import type { FluidLocation, UterineFluidPocket } from '@/models/types';
import { newId } from '@/utils/id';

import type { RepoDb } from './internal/dbTypes';

type UterineFluidRow = {
  id: string;
  daily_log_id: string;
  depth_mm: number;
  location: string;
  created_at: string;
  updated_at: string;
};

const FLUID_LOCATION_SET = new Set<string>(FLUID_LOCATION_VALUES);

function isFluidLocation(value: string): value is FluidLocation {
  return FLUID_LOCATION_SET.has(value);
}

function mapUterineFluidRow(row: UterineFluidRow): UterineFluidPocket | null {
  if (!Number.isInteger(row.depth_mm) || row.depth_mm <= 0) {
    return null;
  }

  if (!isFluidLocation(row.location)) {
    return null;
  }

  return {
    id: row.id,
    dailyLogId: row.daily_log_id,
    depthMm: row.depth_mm,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ReplaceUterineFluidPocketInput = {
  id?: string | null;
  depthMm: number;
  location: FluidLocation;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function normalizePocketInput(
  dailyLogId: string,
  pocket: ReplaceUterineFluidPocketInput,
  now: string,
): UterineFluidRow {
  const depth = pocket.depthMm;
  if (!Number.isInteger(depth) || depth <= 0) {
    throw new Error('Uterine fluid depth must be a whole number greater than 0.');
  }

  if (!isFluidLocation(pocket.location)) {
    throw new Error('Uterine fluid location is invalid.');
  }

  const pocketId = pocket.id?.trim() ?? '';
  return {
    id: pocketId.length > 0 ? pocketId : newId(),
    daily_log_id: dailyLogId,
    depth_mm: depth,
    location: pocket.location,
    created_at: pocket.createdAt ?? now,
    updated_at: pocket.updatedAt ?? now,
  };
}

export async function listByDailyLogId(
  db: RepoDb,
  dailyLogId: string,
): Promise<UterineFluidPocket[]> {
  const rows = await db.getAllAsync<UterineFluidRow>(
    `
    SELECT id, daily_log_id, depth_mm, location, created_at, updated_at
    FROM uterine_fluid
    WHERE daily_log_id = ?
    ORDER BY created_at ASC, id ASC;
    `,
    [dailyLogId],
  );

  return rows.map(mapUterineFluidRow).filter((row): row is UterineFluidPocket => row != null);
}

export async function deleteByDailyLogId(
  db: RepoDb,
  dailyLogId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM uterine_fluid WHERE daily_log_id = ?;', [dailyLogId]);
}

export async function replaceByDailyLogId(
  db: RepoDb,
  dailyLogId: string,
  pockets: readonly ReplaceUterineFluidPocketInput[],
  now = new Date().toISOString(),
): Promise<void> {
  await deleteByDailyLogId(db, dailyLogId);

  for (const pocket of pockets) {
    const row = normalizePocketInput(dailyLogId, pocket, now);
    await db.runAsync(
      `
      INSERT INTO uterine_fluid (
        id,
        daily_log_id,
        depth_mm,
        location,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?);
      `,
      [row.id, row.daily_log_id, row.depth_mm, row.location, row.created_at, row.updated_at],
    );
  }
}
