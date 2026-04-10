import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({}));

import { applyMigrations } from './index';

function createFakeDb(options: {
  appliedMigrationIds: number[];
  breedingRecordsSql: string;
  hasSemenCollectionsOld?: boolean;
  hasSemenCollectionsShippedColumn?: boolean;
}) {
  const execCalls: string[] = [];
  const runCalls: Array<{ sql: string; params: unknown[] }> = [];

  const db = {
    async execAsync(sql: string): Promise<void> {
      execCalls.push(sql.trim());
    },
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      runCalls.push({ sql: sql.trim(), params });
    },
    async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const trimmed = sql.trim();

      if (trimmed === 'SELECT id FROM schema_migrations WHERE id = ?;') {
        const [id] = params as [number];
        return options.appliedMigrationIds.includes(id) ? ({ id } as T) : null;
      }

      if (trimmed === "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?;") {
        const [tableName] = params as [string];
        if (tableName === 'breeding_records') {
          return { sql: options.breedingRecordsSql } as T;
        }
        return null;
      }

      if (trimmed === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;") {
        const [tableName] = params as [string];
        if (tableName === 'semen_collections_old' && options.hasSemenCollectionsOld) {
          return { name: tableName } as T;
        }
        return null;
      }

      return null;
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      const trimmed = sql.trim();
      if (trimmed === 'PRAGMA table_info(semen_collections);' && options.hasSemenCollectionsShippedColumn) {
        return [{ name: 'shipped' } as T];
      }
      return [];
    },
  };

  return { db, execCalls, runCalls };
}

describe('applyMigrations', () => {
  it('filters invalid legacy shipped rows when creating collection dose events', async () => {
    const { db, execCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 10 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
      hasSemenCollectionsShippedColumn: true,
    });

    await applyMigrations(db as never);

    const migrationInsert = execCalls.find((sql) => sql.includes('INSERT INTO collection_dose_events'));
    expect(migrationInsert).toBeDefined();
    expect(migrationInsert).toContain('TRIM(shipped_to)');
    expect(migrationInsert).toContain('WHERE shipped = 1');
    expect(migrationInsert).toContain('AND shipped_to IS NOT NULL');
    expect(migrationInsert).toContain("AND TRIM(shipped_to) <> ''");
  });

  it('repairs breeding_records foreign keys that still reference semen_collections_old', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 11 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          FOREIGN KEY (collection_id) REFERENCES "semen_collections_old"(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
      hasSemenCollectionsOld: true,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('CREATE TABLE breeding_records_new'))).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('FOREIGN KEY (collection_id) REFERENCES semen_collections(id)')),
    ).toBe(true);
    expect(execCalls.some((sql) => sql.includes('DROP TABLE breeding_records;'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('ALTER TABLE breeding_records_new RENAME TO breeding_records;'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('DROP TABLE IF EXISTS semen_collections_old;'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 12)).toBe(true);
  });

  it('skips the repair migration when breeding_records already references semen_collections', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 11 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls).toHaveLength(1);
    expect(runCalls[0]?.params[0]).toBe(12);
  });

  it('runs the repair migration when the legacy table still exists even if breeding_records already looks correct', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 11 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
      hasSemenCollectionsOld: true,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('DROP TABLE IF EXISTS semen_collections_old;'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 12)).toBe(true);
  });
});
