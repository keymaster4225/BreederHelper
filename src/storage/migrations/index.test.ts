import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({}));

import { applyMigrations } from './index';

function createFakeDb(options: {
  appliedMigrationIds: number[];
  breedingRecordsSql: string;
  breedingRecordRows?: Array<{
    id: string;
    straw_volume_ml: number | null;
  }>;
  stallionsSql?: string;
  semenCollectionsSql?: string;
  hasSemenCollectionsOld?: boolean;
  hasSemenCollectionsShippedColumn?: boolean;
  semenCollectionsColumns?: string[];
  collectionDoseEventColumns?: string[];
  failDropBreedingRecordsWhenForeignKeysEnabled?: boolean;
  invalidStallionDateOfBirthId?: string;
  invalidExtenderVolumeCollectionId?: string;
  foreignKeyCheckRows?: Array<{
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }>;
}) {
  const execCalls: string[] = [];
  const queryCalls: string[] = [];
  const runCalls: Array<{ sql: string; params: unknown[] }> = [];
  let foreignKeysEnabled = true;
  let breedingRecordsSql = options.breedingRecordsSql;
  let stallionsSql = options.stallionsSql ?? `
    CREATE TABLE stallions (
      id TEXT PRIMARY KEY,
      date_of_birth TEXT,
      av_temperature_f REAL,
      av_type TEXT,
      av_liner_type TEXT,
      av_water_volume_ml INTEGER,
      av_notes TEXT,
      CHECK (date_of_birth IS NULL OR date_of_birth GLOB '????-??-??'),
      CHECK (av_temperature_f IS NULL OR typeof(av_temperature_f) IN ('integer', 'real')),
      CHECK (av_type IS NULL OR typeof(av_type) = 'text'),
      CHECK (av_liner_type IS NULL OR typeof(av_liner_type) = 'text'),
      CHECK (av_water_volume_ml IS NULL OR (typeof(av_water_volume_ml) = 'integer' AND av_water_volume_ml >= 0)),
      CHECK (av_notes IS NULL OR typeof(av_notes) = 'text')
    )
  `;
  let semenCollectionsSql = options.semenCollectionsSql ?? `
    CREATE TABLE semen_collections (
      id TEXT PRIMARY KEY,
      extender_volume_ml REAL,
      extender_type TEXT,
      stallion_id TEXT,
      FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      CHECK (extender_volume_ml IS NULL OR extender_volume_ml >= 0),
      CHECK (extender_type IS NULL OR typeof(extender_type) = 'text')
    )
  `;
  let pendingBreedingRecordsSql: string | null = null;
  let breedingRecordRows = new Map(
    (options.breedingRecordRows ?? []).map((row) => [row.id, { ...row }]),
  );
  let pendingBreedingRecordRows: Map<string, { id: string; straw_volume_ml: number | null }> | null = null;
  let pendingStallionsSql: string | null = null;
  let pendingSemenCollectionsSql: string | null = null;

  const db = {
    async execAsync(sql: string): Promise<void> {
      const trimmed = sql.trim();
      execCalls.push(trimmed);

      if (trimmed.startsWith('CREATE TABLE breeding_records_new')) {
        pendingBreedingRecordsSql = trimmed.replace(
          /^CREATE TABLE breeding_records_new/i,
          'CREATE TABLE breeding_records',
        );
        pendingBreedingRecordRows = new Map();
      }

      if (trimmed.startsWith('CREATE TABLE stallions_new')) {
        pendingStallionsSql = trimmed.replace(
          /^CREATE TABLE stallions_new/i,
          'CREATE TABLE stallions',
        );
      }

      if (trimmed.startsWith('CREATE TABLE semen_collections_new')) {
        pendingSemenCollectionsSql = trimmed.replace(
          /^CREATE TABLE semen_collections_new/i,
          'CREATE TABLE semen_collections',
        );
      }

      if (trimmed === 'ALTER TABLE breeding_records_new RENAME TO breeding_records;' && pendingBreedingRecordsSql) {
        breedingRecordsSql = pendingBreedingRecordsSql;
        pendingBreedingRecordsSql = null;
        if (pendingBreedingRecordRows) {
          breedingRecordRows = pendingBreedingRecordRows;
          pendingBreedingRecordRows = null;
        }
      }

      if (trimmed.startsWith('INSERT INTO breeding_records_new') && pendingBreedingRecordRows) {
        pendingBreedingRecordRows = new Map(
          Array.from(breedingRecordRows.entries()).map(([id, row]) => [id, { ...row }]),
        );
      }

      if (trimmed === 'ALTER TABLE stallions_new RENAME TO stallions;' && pendingStallionsSql) {
        stallionsSql = pendingStallionsSql;
        pendingStallionsSql = null;
      }

      if (trimmed === 'ALTER TABLE semen_collections_new RENAME TO semen_collections;' && pendingSemenCollectionsSql) {
        semenCollectionsSql = pendingSemenCollectionsSql;
        pendingSemenCollectionsSql = null;
      }

      if (trimmed === 'PRAGMA foreign_keys = OFF;') {
        foreignKeysEnabled = false;
      }

      if (trimmed === 'PRAGMA foreign_keys = ON;') {
        foreignKeysEnabled = true;
      }

      if (
        trimmed === 'DROP TABLE breeding_records;' &&
        options.failDropBreedingRecordsWhenForeignKeysEnabled &&
        foreignKeysEnabled
      ) {
        throw new Error('FOREIGN KEY constraint failed');
      }
    },
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      runCalls.push({ sql: sql.trim(), params });
    },
    async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const trimmed = sql.trim();
      queryCalls.push(trimmed);

      if (trimmed === 'SELECT id FROM schema_migrations WHERE id = ?;') {
        const [id] = params as [number];
        return options.appliedMigrationIds.includes(id) ? ({ id } as T) : null;
      }

      if (trimmed === "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?;") {
        const [tableName] = params as [string];
        if (tableName === 'breeding_records') {
          return { sql: breedingRecordsSql } as T;
        }
        if (tableName === 'stallions') {
          return { sql: stallionsSql } as T;
        }
        if (tableName === 'semen_collections') {
          return { sql: semenCollectionsSql } as T;
        }
        return null;
      }

      if (trimmed === 'SELECT straw_volume_ml FROM breeding_records WHERE id = ?;') {
        const [id] = params as [string];
        const row = breedingRecordRows.get(id);
        return row ? ({ straw_volume_ml: row.straw_volume_ml } as T) : null;
      }

      if (
        trimmed === "SELECT id FROM stallions WHERE date_of_birth IS NOT NULL AND date_of_birth NOT GLOB '????-??-??' LIMIT 1;"
      ) {
        return options.invalidStallionDateOfBirthId
          ? ({ id: options.invalidStallionDateOfBirthId } as T)
          : null;
      }

      if (
        trimmed === "SELECT id FROM semen_collections WHERE extender_volume_ml IS NOT NULL AND (typeof(extender_volume_ml) NOT IN ('integer', 'real') OR extender_volume_ml < 0) LIMIT 1;"
      ) {
        return options.invalidExtenderVolumeCollectionId
          ? ({ id: options.invalidExtenderVolumeCollectionId } as T)
          : null;
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
      queryCalls.push(trimmed);
      if (trimmed === 'PRAGMA table_info(semen_collections);') {
        const columns = options.semenCollectionsColumns ??
          (options.hasSemenCollectionsShippedColumn
            ? ['shipped']
            : [
                'id',
                'stallion_id',
                'collection_date',
                'raw_volume_ml',
                'extended_volume_ml',
                'extender_volume_ml',
                'extender_type',
                'concentration_millions_per_ml',
                'progressive_motility_percent',
                'dose_count',
                'dose_size_millions',
                'notes',
                'created_at',
                'updated_at',
              ]);
        return columns.map((name) => ({ name } as T));
      }
      if (trimmed === 'PRAGMA table_info(collection_dose_events);') {
        const columns = options.collectionDoseEventColumns ?? [
          'id',
          'collection_id',
          'event_type',
          'recipient',
          'dose_count',
          'event_date',
          'notes',
          'created_at',
          'updated_at',
        ];
        return columns.map((name) => ({ name } as T));
      }
      if (trimmed === 'PRAGMA foreign_key_check;') {
        return (options.foreignKeyCheckRows ?? []) as T[];
      }
      return [];
    },
  };

  return { db, execCalls, queryCalls, runCalls };
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
    const { db, execCalls, queryCalls, runCalls } = createFakeDb({
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

    expect(execCalls).toContain('PRAGMA foreign_keys = OFF;');
    expect(execCalls).toContain('BEGIN;');
    expect(execCalls).toContain('COMMIT;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(queryCalls).toContain('PRAGMA foreign_key_check;');
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE breeding_records_new'))).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('FOREIGN KEY (collection_id) REFERENCES semen_collections(id)')),
    ).toBe(true);
    expect(execCalls.some((sql) => sql.includes('DROP TABLE breeding_records;'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('ALTER TABLE breeding_records_new RENAME TO breeding_records;'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('DROP TABLE IF EXISTS semen_collections_old;'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 12)).toBe(true);
  });

  it('disables foreign keys while rebuilding breeding_records in migration010', async () => {
    const { db, execCalls, queryCalls, runCalls } = createFakeDb({
      appliedMigrationIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      failDropBreedingRecordsWhenForeignKeysEnabled: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toContain('PRAGMA foreign_keys = OFF;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(queryCalls).toContain('PRAGMA foreign_key_check;');
    expect(execCalls.some((sql) => sql.includes('DROP TABLE breeding_records;'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 10)).toBe(true);
  });

  it('rolls back foreign-keys-off migrations when foreign_key_check finds violations', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      foreignKeyCheckRows: [
        {
          table: 'pregnancy_checks',
          rowid: 1,
          parent: 'breeding_records',
          fkid: 0,
        },
      ],
    });

    await expect(applyMigrations(db as never)).rejects.toThrow(
      'Foreign key check failed after migration 010_breeding_records_collection_id',
    );

    expect(execCalls).toContain('ROLLBACK;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(runCalls.some(({ params }) => params[0] === 10)).toBe(false);
  });

  it('adds collection dose event shipping detail columns and breeding_record_id foreign key in migration018', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 17 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
    });

    await applyMigrations(db as never);

    const createTableStatement = execCalls.find((sql) => sql.includes('CREATE TABLE collection_dose_events_new'));
    expect(createTableStatement).toBeDefined();
    expect(createTableStatement).toContain('recipient_phone TEXT');
    expect(createTableStatement).toContain('recipient_street TEXT');
    expect(createTableStatement).toContain('recipient_city TEXT');
    expect(createTableStatement).toContain('recipient_state TEXT');
    expect(createTableStatement).toContain('recipient_zip TEXT');
    expect(createTableStatement).toContain('carrier_service TEXT');
    expect(createTableStatement).toContain('container_type TEXT');
    expect(createTableStatement).toContain('tracking_number TEXT');
    expect(createTableStatement).toContain('breeding_record_id TEXT REFERENCES breeding_records(id) ON DELETE CASCADE');
    expect(execCalls.some((sql) => sql.includes('ALTER TABLE collection_dose_events_new RENAME TO collection_dose_events;'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_collection_dose_events_breeding_record_id'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 18)).toBe(true);
  });

  it('adds collection targets and per-dose volume columns in migration019', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 18 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
    });

    await applyMigrations(db as never);

    const createCollectionTable = execCalls.find((sql) => sql.includes('CREATE TABLE semen_collections_new'));
    expect(createCollectionTable).toBeDefined();
    expect(createCollectionTable).toContain('target_motile_sperm_millions_per_dose REAL');
    expect(createCollectionTable).toContain(
      'target_post_extension_concentration_millions_per_ml REAL',
    );
    expect(createCollectionTable).not.toContain('extended_volume_ml');
    expect(createCollectionTable).not.toContain('extender_volume_ml');
    expect(createCollectionTable).not.toContain('dose_count INTEGER');
    expect(createCollectionTable).not.toContain('dose_size_millions');

    expect(
      execCalls.some((sql) =>
        sql.includes(
          'ADD COLUMN dose_semen_volume_ml REAL CHECK (dose_semen_volume_ml IS NULL OR dose_semen_volume_ml >= 0)',
        ),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes(
          'ADD COLUMN dose_extender_volume_ml REAL CHECK (dose_extender_volume_ml IS NULL OR dose_extender_volume_ml >= 0)',
        ),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('Legacy migration: collapsed used-on-site dose count to 1 during collection volume rework.'),
      ),
    ).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 19)).toBe(true);
  });

  it('adds target_mode and backfills legacy collection targets to progressive in migration020', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 19 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      semenCollectionsColumns: [
        'id',
        'stallion_id',
        'collection_date',
        'raw_volume_ml',
        'extender_type',
        'concentration_millions_per_ml',
        'progressive_motility_percent',
        'target_motile_sperm_millions_per_dose',
        'target_post_extension_concentration_millions_per_ml',
        'notes',
        'created_at',
        'updated_at',
      ],
    });

    await applyMigrations(db as never);

    expect(
      execCalls.some((sql) =>
        /ALTER TABLE semen_collections\s+ADD COLUMN target_mode TEXT\s+CHECK \(target_mode IS NULL OR target_mode IN \('progressive', 'total'\)\)/.test(
          sql,
        ),
      ),
    ).toBe(true);
    const backfillSql = execCalls.find((sql) => sql.startsWith('UPDATE semen_collections'));
    expect(backfillSql).toContain('WHEN target_motile_sperm_millions_per_dose IS NOT NULL');
    expect(backfillSql).toContain('OR target_post_extension_concentration_millions_per_ml IS NOT NULL');
    expect(backfillSql).toContain("THEN 'progressive'");
    expect(backfillSql).toContain('ELSE NULL');
    expect(runCalls.some(({ params }) => params[0] === 20)).toBe(true);
  });

  it('skips migration019 when target and dose volume columns already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 18 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      semenCollectionsColumns: [
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
      collectionDoseEventColumns: [
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
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([19, 20]);
  });

  it('skips the repair migration when breeding_records already references semen_collections', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: [...Array.from({ length: 11 }, (_, index) => index + 1), 17],
      collectionDoseEventColumns: [
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
        'dose_count',
        'event_date',
        'notes',
        'created_at',
        'updated_at',
      ],
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          straw_volume_ml REAL,
          FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('CREATE TABLE breeding_records_new'))).toBe(false);
    expect(runCalls.map(({ params }) => params[0])).toEqual([12, 13, 14, 15, 16, 18, 19, 20]);
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

  it('adds extender columns to semen_collections for existing installs', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 12 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          straw_volume_ml REAL
        )
      `,
      semenCollectionsColumns: [
        'id',
        'stallion_id',
        'collection_date',
        'raw_volume_ml',
        'extended_volume_ml',
        'concentration_millions_per_ml',
        'progressive_motility_percent',
        'dose_count',
        'dose_size_millions',
        'notes',
        'created_at',
        'updated_at',
      ],
    });

    await applyMigrations(db as never);

    expect(execCalls).toContain('ALTER TABLE semen_collections ADD COLUMN extender_volume_ml REAL;');
    expect(execCalls).toContain('ALTER TABLE semen_collections ADD COLUMN extender_type TEXT;');
    expect(runCalls.some(({ params }) => params[0] === 13)).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 14)).toBe(true);
  });

  it('repairs breeding_records straw volume affinity to REAL for legacy INTEGER schemas', async () => {
    const { db, execCalls, queryCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 14 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          straw_volume_ml INTEGER,
          FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls).toContain('PRAGMA foreign_keys = OFF;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(queryCalls).toContain('PRAGMA foreign_key_check;');
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE breeding_records_new'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('straw_volume_ml REAL'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 15)).toBe(true);
  });

  it('preserves fractional straw volume values when repairing legacy INTEGER schemas', async () => {
    const { db } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 14 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          straw_volume_ml INTEGER
        )
      `,
      breedingRecordRows: [
        {
          id: 'breed-fractional',
          straw_volume_ml: 0.5,
        },
      ],
    });

    await applyMigrations(db as never);

    const row = await db.getFirstAsync<{ straw_volume_ml: number | null }>(
      'SELECT straw_volume_ml FROM breeding_records WHERE id = ?;',
      ['breed-fractional'],
    );

    expect(row?.straw_volume_ml).toBe(0.5);
  });

  it('skips straw volume affinity repair when breeding_records already uses REAL', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: [...Array.from({ length: 14 }, (_, index) => index + 1), 17],
      collectionDoseEventColumns: [
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
        'dose_count',
        'event_date',
        'notes',
        'created_at',
        'updated_at',
      ],
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          collection_id TEXT,
          straw_volume_ml REAL,
          FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('CREATE TABLE breeding_records_new'))).toBe(false);
    expect(runCalls.map(({ params }) => params[0])).toEqual([15, 16, 18, 19, 20]);
  });

  it('rebuilds stallions and semen_collections when canonical constraint checks are missing', async () => {
    const { db, execCalls, queryCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 15 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          straw_volume_ml REAL
        )
      `,
      stallionsSql: `
        CREATE TABLE stallions (
          id TEXT PRIMARY KEY,
          date_of_birth TEXT,
          av_temperature_f REAL,
          av_water_volume_ml INTEGER
        )
      `,
      semenCollectionsSql: `
        CREATE TABLE semen_collections (
          id TEXT PRIMARY KEY,
          extender_volume_ml REAL
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls).toContain('PRAGMA foreign_keys = OFF;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(queryCalls).toContain('PRAGMA foreign_key_check;');
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE stallions_new'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes("CHECK (date_of_birth IS NULL OR date_of_birth GLOB '????-??-??')"))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE semen_collections_new'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CHECK (extender_volume_ml IS NULL OR extender_volume_ml >= 0)'))).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 16)).toBe(true);
  });

  it('skips canonical stallion and collection repair when both tables already include the required checks', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: [...Array.from({ length: 15 }, (_, index) => index + 1), 17],
      collectionDoseEventColumns: [
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
        'dose_count',
        'event_date',
        'notes',
        'created_at',
        'updated_at',
      ],
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          straw_volume_ml REAL
        )
      `,
      stallionsSql: `
        CREATE TABLE stallions (
          id TEXT PRIMARY KEY,
          date_of_birth TEXT,
          av_temperature_f REAL,
          av_type TEXT,
          av_liner_type TEXT,
          av_water_volume_ml INTEGER,
          av_notes TEXT,
          CHECK (date_of_birth IS NULL OR date_of_birth GLOB '????-??-??'),
          CHECK (av_temperature_f IS NULL OR typeof(av_temperature_f) IN ('integer', 'real')),
          CHECK (av_type IS NULL OR typeof(av_type) = 'text'),
          CHECK (av_liner_type IS NULL OR typeof(av_liner_type) = 'text'),
          CHECK (av_water_volume_ml IS NULL OR (typeof(av_water_volume_ml) = 'integer' AND av_water_volume_ml >= 0)),
          CHECK (av_notes IS NULL OR typeof(av_notes) = 'text')
        )
      `,
      semenCollectionsSql: `
        CREATE TABLE semen_collections (
          id TEXT PRIMARY KEY,
          extender_volume_ml REAL,
          extender_type TEXT,
          stallion_id TEXT,
          FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          CHECK (extender_volume_ml IS NULL OR extender_volume_ml >= 0),
          CHECK (extender_type IS NULL OR typeof(extender_type) = 'text')
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('CREATE TABLE stallions_new'))).toBe(false);
    expect(runCalls.map(({ params }) => params[0])).toEqual([16, 18, 19, 20]);
  });

  it('fails the canonical repair migration with a targeted error when legacy stallion rows are invalid', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 15 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          straw_volume_ml REAL
        )
      `,
      stallionsSql: `
        CREATE TABLE stallions (
          id TEXT PRIMARY KEY,
          date_of_birth TEXT
        )
      `,
      semenCollectionsSql: `
        CREATE TABLE semen_collections (
          id TEXT PRIMARY KEY,
          extender_volume_ml REAL
        )
      `,
      invalidStallionDateOfBirthId: 'stallion-bad-date',
    });

    await expect(applyMigrations(db as never)).rejects.toThrow(
      'Cannot apply migration 016_canonicalize_stallions_and_semen_collections: stallions.date_of_birth is invalid for stallion stallion-bad-date.',
    );

    expect(execCalls).toHaveLength(1);
    expect(runCalls.some(({ params }) => params[0] === 16)).toBe(false);
  });
});
