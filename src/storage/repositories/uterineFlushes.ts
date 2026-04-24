import type { UterineFlush, UterineFlushProduct } from '@/models/types';
import { newId } from '@/utils/id';

import type { RepoDb } from './internal/dbTypes';

type UterineFlushRow = {
  id: string;
  daily_log_id: string;
  base_solution: string;
  total_volume_ml: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type UterineFlushProductRow = {
  id: string;
  uterine_flush_id: string;
  product_name: string;
  dose: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReplaceUterineFlushProductInput = {
  id?: string | null;
  productName: string;
  dose: string;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ReplaceUterineFlushInput = {
  id?: string | null;
  baseSolution: string;
  totalVolumeMl: number;
  notes?: string | null;
  products: readonly ReplaceUterineFlushProductInput[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

function hasAtMostOneDecimalPlace(value: number): boolean {
  const scaled = value * 10;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function normalizeFlushInput(
  dailyLogId: string,
  input: ReplaceUterineFlushInput,
  now: string,
): UterineFlushRow {
  if (
    !Number.isFinite(input.totalVolumeMl) ||
    input.totalVolumeMl <= 0 ||
    !hasAtMostOneDecimalPlace(input.totalVolumeMl)
  ) {
    throw new Error('Flush total volume must be greater than 0 with at most one decimal place.');
  }

  const flushId = input.id?.trim() ?? '';
  return {
    id: flushId.length > 0 ? flushId : newId(),
    daily_log_id: dailyLogId,
    base_solution: normalizeRequiredText(input.baseSolution, 'Flush base solution'),
    total_volume_ml: input.totalVolumeMl,
    notes: normalizeOptionalText(input.notes),
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
  };
}

function normalizeProductInput(
  uterineFlushId: string,
  input: ReplaceUterineFlushProductInput,
  now: string,
): UterineFlushProductRow {
  const productId = input.id?.trim() ?? '';
  return {
    id: productId.length > 0 ? productId : newId(),
    uterine_flush_id: uterineFlushId,
    product_name: normalizeRequiredText(input.productName, 'Flush product name'),
    dose: normalizeRequiredText(input.dose, 'Flush product dose'),
    notes: normalizeOptionalText(input.notes),
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
  };
}

function mapProductRow(row: UterineFlushProductRow): UterineFlushProduct {
  return {
    id: row.id,
    uterineFlushId: row.uterine_flush_id,
    productName: row.product_name,
    dose: row.dose,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFlushRow(
  row: UterineFlushRow,
  products: readonly UterineFlushProduct[],
): UterineFlush {
  return {
    id: row.id,
    dailyLogId: row.daily_log_id,
    baseSolution: row.base_solution,
    totalVolumeMl: row.total_volume_ml,
    notes: row.notes,
    products,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getByDailyLogId(
  db: RepoDb,
  dailyLogId: string,
): Promise<UterineFlush | null> {
  const flushRow = await db.getFirstAsync<UterineFlushRow>(
    `
    SELECT id, daily_log_id, base_solution, total_volume_ml, notes, created_at, updated_at
    FROM uterine_flushes
    WHERE daily_log_id = ?;
    `,
    [dailyLogId],
  );

  if (!flushRow) {
    return null;
  }

  const productRows = await db.getAllAsync<UterineFlushProductRow>(
    `
    SELECT id, uterine_flush_id, product_name, dose, notes, created_at, updated_at
    FROM uterine_flush_products
    WHERE uterine_flush_id = ?
    ORDER BY created_at ASC, id ASC;
    `,
    [flushRow.id],
  );

  return mapFlushRow(flushRow, productRows.map(mapProductRow));
}

export async function deleteByDailyLogId(db: RepoDb, dailyLogId: string): Promise<void> {
  const flush = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM uterine_flushes WHERE daily_log_id = ?;',
    [dailyLogId],
  );

  if (!flush) {
    return;
  }

  await db.runAsync('DELETE FROM uterine_flush_products WHERE uterine_flush_id = ?;', [flush.id]);
  await db.runAsync('DELETE FROM uterine_flushes WHERE id = ?;', [flush.id]);
}

export async function replaceByDailyLogId(
  db: RepoDb,
  dailyLogId: string,
  input: ReplaceUterineFlushInput,
  now = new Date().toISOString(),
): Promise<UterineFlush> {
  if (input.products.length === 0) {
    throw new Error('At least one flush product is required.');
  }

  await deleteByDailyLogId(db, dailyLogId);

  const flushRow = normalizeFlushInput(dailyLogId, input, now);
  await db.runAsync(
    `
    INSERT INTO uterine_flushes (
      id,
      daily_log_id,
      base_solution,
      total_volume_ml,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `,
    [
      flushRow.id,
      flushRow.daily_log_id,
      flushRow.base_solution,
      flushRow.total_volume_ml,
      flushRow.notes,
      flushRow.created_at,
      flushRow.updated_at,
    ],
  );

  const productRows = input.products.map((product) =>
    normalizeProductInput(flushRow.id, product, now),
  );

  for (const productRow of productRows) {
    await db.runAsync(
      `
      INSERT INTO uterine_flush_products (
        id,
        uterine_flush_id,
        product_name,
        dose,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [
        productRow.id,
        productRow.uterine_flush_id,
        productRow.product_name,
        productRow.dose,
        productRow.notes,
        productRow.created_at,
        productRow.updated_at,
      ],
    );
  }

  return mapFlushRow(flushRow, productRows.map(mapProductRow));
}
