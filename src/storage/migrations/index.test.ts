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
  breedingRecordsColumns?: string[];
  hasBreedingRecordsMareDateTimeIndex?: boolean;
  hasBreedingRecordsStallionDateTimeIndex?: boolean;
  hasBreedingRecordsMareDateIndex?: boolean;
  hasBreedingRecordsStallionDateIndex?: boolean;
  stallionsSql?: string;
  semenCollectionsSql?: string;
  hasSemenCollectionsOld?: boolean;
  hasSemenCollectionsShippedColumn?: boolean;
  semenCollectionsColumns?: string[];
  collectionDoseEventColumns?: string[];
  dailyLogsColumns?: string[];
  medicationLogsColumns?: string[];
  dailyLogsSql?: string;
  mareColumns?: string[];
  hasUterineFluidTable?: boolean;
  hasUterineFluidIndex?: boolean;
  hasUterineFlushesTable?: boolean;
  hasUterineFlushProductsTable?: boolean;
  hasMedicationSourceDailyLogIndex?: boolean;
  hasDailyLogsTimedUniqueIndex?: boolean;
  hasDailyLogsUntimedUniqueIndex?: boolean;
  hasFrozenSemenBatchesTable?: boolean;
  hasFrozenSemenBatchesStallionIndex?: boolean;
  hasFrozenSemenBatchesCollectionIndex?: boolean;
  hasTasksTable?: boolean;
  hasTasksOpenDueIndex?: boolean;
  hasTasksSourceIndex?: boolean;
  hasTasksOpenBreedingPregCheckUniqueIndex?: boolean;
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
  const latestDailyLogsColumns = [
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
    'notes',
    'created_at',
    'updated_at',
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
  ];
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
  let dailyLogsColumns = [...(options.dailyLogsColumns ?? latestDailyLogsColumns)];
  let dailyLogsSql = options.dailyLogsSql ?? `
    CREATE TABLE daily_logs (
      id TEXT PRIMARY KEY,
      mare_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT
    )
  `;
  let breedingRecordRows = new Map(
    (options.breedingRecordRows ?? []).map((row) => [row.id, { ...row }]),
  );
  let pendingBreedingRecordRows: Map<string, { id: string; straw_volume_ml: number | null }> | null = null;
  const breedingRecordsColumns = [...(options.breedingRecordsColumns ?? ['id', 'time'])];
  let pendingStallionsSql: string | null = null;
  let pendingSemenCollectionsSql: string | null = null;
  let pendingDailyLogsSql: string | null = null;
  let hasUterineFluidTable = options.hasUterineFluidTable ?? true;
  let hasUterineFluidIndex = options.hasUterineFluidIndex ?? true;
  let hasUterineFlushesTable = options.hasUterineFlushesTable ?? true;
  let hasUterineFlushProductsTable = options.hasUterineFlushProductsTable ?? true;
  let hasMedicationSourceDailyLogIndex = options.hasMedicationSourceDailyLogIndex ?? true;
  let hasDailyLogsTimedUniqueIndex = options.hasDailyLogsTimedUniqueIndex ?? true;
  let hasDailyLogsUntimedUniqueIndex = options.hasDailyLogsUntimedUniqueIndex ?? true;
  let hasFrozenSemenBatchesTable = options.hasFrozenSemenBatchesTable ?? false;
  let hasFrozenSemenBatchesStallionIndex = options.hasFrozenSemenBatchesStallionIndex ?? false;
  let hasFrozenSemenBatchesCollectionIndex = options.hasFrozenSemenBatchesCollectionIndex ?? false;
  let hasTasksTable = options.hasTasksTable ?? true;
  let hasTasksOpenDueIndex = options.hasTasksOpenDueIndex ?? true;
  let hasTasksSourceIndex = options.hasTasksSourceIndex ?? true;
  let hasTasksOpenBreedingPregCheckUniqueIndex =
    options.hasTasksOpenBreedingPregCheckUniqueIndex ?? true;
  let hasBreedingRecordsMareDateTimeIndex = options.hasBreedingRecordsMareDateTimeIndex ?? true;
  let hasBreedingRecordsStallionDateTimeIndex =
    options.hasBreedingRecordsStallionDateTimeIndex ?? true;
  let hasBreedingRecordsMareDateIndex = options.hasBreedingRecordsMareDateIndex ?? false;
  let hasBreedingRecordsStallionDateIndex = options.hasBreedingRecordsStallionDateIndex ?? false;

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

      if (trimmed.startsWith('CREATE TABLE daily_logs_new')) {
        pendingDailyLogsSql = trimmed.replace(/^CREATE TABLE daily_logs_new/i, 'CREATE TABLE daily_logs');
      }

      const addDailyLogColumnMatch = /^ALTER TABLE daily_logs\s+ADD COLUMN\s+([a-z_]+)/i.exec(trimmed);
      if (addDailyLogColumnMatch) {
        const [, columnName] = addDailyLogColumnMatch;
        if (!dailyLogsColumns.includes(columnName)) {
          dailyLogsColumns.push(columnName);
        }
      }

      const addBreedingRecordColumnMatch = /^ALTER TABLE breeding_records\s+ADD COLUMN\s+([a-z_]+)/i.exec(trimmed);
      if (addBreedingRecordColumnMatch) {
        const [, columnName] = addBreedingRecordColumnMatch;
        if (!breedingRecordsColumns.includes(columnName)) {
          breedingRecordsColumns.push(columnName);
        }
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

      if (trimmed === 'ALTER TABLE daily_logs_new RENAME TO daily_logs;' && pendingDailyLogsSql) {
        dailyLogsSql = pendingDailyLogsSql;
        pendingDailyLogsSql = null;
        dailyLogsColumns = [...latestDailyLogsColumns];
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

      if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS uterine_fluid')) {
        hasUterineFluidTable = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_uterine_fluid_daily_log_id')) {
        hasUterineFluidIndex = true;
      }

      if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS uterine_flushes')) {
        hasUterineFlushesTable = true;
      }

      if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS uterine_flush_products')) {
        hasUterineFlushProductsTable = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_medication_logs_source_daily_log_id')) {
        hasMedicationSourceDailyLogIndex = true;
      }

      if (trimmed.startsWith('CREATE TABLE frozen_semen_batches')) {
        hasFrozenSemenBatchesTable = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_frozen_semen_batches_stallion_id')) {
        hasFrozenSemenBatchesStallionIndex = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_frozen_semen_batches_collection_id')) {
        hasFrozenSemenBatchesCollectionIndex = true;
      }

      if (trimmed.startsWith('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_time_unique')) {
        hasDailyLogsTimedUniqueIndex = true;
      }

      if (trimmed.startsWith('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_untimed_unique')) {
        hasDailyLogsUntimedUniqueIndex = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date_time')) {
        hasBreedingRecordsMareDateTimeIndex = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date_time')) {
        hasBreedingRecordsStallionDateTimeIndex = true;
      }

      if (trimmed.startsWith('CREATE TABLE IF NOT EXISTS tasks')) {
        hasTasksTable = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_tasks_open_due')) {
        hasTasksOpenDueIndex = true;
      }

      if (trimmed.startsWith('CREATE INDEX IF NOT EXISTS idx_tasks_source')) {
        hasTasksSourceIndex = true;
      }

      if (trimmed.startsWith('CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_open_breeding_preg_check_unique')) {
        hasTasksOpenBreedingPregCheckUniqueIndex = true;
      }

      if (trimmed.startsWith('DROP INDEX IF EXISTS idx_breeding_records_mare_date')) {
        hasBreedingRecordsMareDateIndex = false;
      }

      if (trimmed.startsWith('DROP INDEX IF EXISTS idx_breeding_records_stallion_date')) {
        hasBreedingRecordsStallionDateIndex = false;
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
        if (tableName === 'daily_logs') {
          return { sql: dailyLogsSql } as T;
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
        if (tableName === 'uterine_fluid' && hasUterineFluidTable) {
          return { name: tableName } as T;
        }
        if (tableName === 'uterine_flushes' && hasUterineFlushesTable) {
          return { name: tableName } as T;
        }
        if (tableName === 'uterine_flush_products' && hasUterineFlushProductsTable) {
          return { name: tableName } as T;
        }
        if (tableName === 'frozen_semen_batches' && hasFrozenSemenBatchesTable) {
          return { name: tableName } as T;
        }
        if (tableName === 'tasks' && hasTasksTable) {
          return { name: tableName } as T;
        }
        return null;
      }

      if (trimmed === "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?;") {
        const [indexName] = params as [string];
        if (indexName === 'idx_uterine_fluid_daily_log_id' && hasUterineFluidIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_medication_logs_source_daily_log_id' && hasMedicationSourceDailyLogIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_daily_logs_mare_date_time_unique' && hasDailyLogsTimedUniqueIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_daily_logs_mare_date_untimed_unique' && hasDailyLogsUntimedUniqueIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_frozen_semen_batches_stallion_id' && hasFrozenSemenBatchesStallionIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_frozen_semen_batches_collection_id' && hasFrozenSemenBatchesCollectionIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_tasks_open_due' && hasTasksOpenDueIndex) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_tasks_source' && hasTasksSourceIndex) {
          return { name: indexName } as T;
        }
        if (
          indexName === 'idx_tasks_open_breeding_preg_check_unique' &&
          hasTasksOpenBreedingPregCheckUniqueIndex
        ) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_breeding_records_mare_date_time' && hasBreedingRecordsMareDateTimeIndex) {
          return { name: indexName } as T;
        }
        if (
          indexName === 'idx_breeding_records_stallion_date_time' &&
          hasBreedingRecordsStallionDateTimeIndex
        ) {
          return { name: indexName } as T;
        }
        if (indexName === 'idx_breeding_records_mare_date' && hasBreedingRecordsMareDateIndex) {
          return { name: indexName } as T;
        }
        if (
          indexName === 'idx_breeding_records_stallion_date' &&
          hasBreedingRecordsStallionDateIndex
        ) {
          return { name: indexName } as T;
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
      if (trimmed === 'PRAGMA table_info(mares);') {
        const columns = options.mareColumns ?? [
          'id',
          'name',
          'breed',
          'gestation_length_days',
          'date_of_birth',
          'registration_number',
          'notes',
          'created_at',
          'updated_at',
          'deleted_at',
          'is_recipient',
        ];
        return columns.map((name) => ({ name } as T));
      }
      if (trimmed === 'PRAGMA table_info(daily_logs);') {
        return dailyLogsColumns.map((name) => ({ name } as T));
      }
      if (trimmed === 'PRAGMA table_info(breeding_records);') {
        return breedingRecordsColumns.map((name) => ({ name } as T));
      }
      if (trimmed === 'PRAGMA table_info(medication_logs);') {
        const columns = options.medicationLogsColumns ?? [
          'id',
          'mare_id',
          'date',
          'medication_name',
          'dose',
          'route',
          'notes',
          'created_at',
          'updated_at',
          'source_daily_log_id',
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

  it('adds structured daily log columns and uterine_fluid table in migration021', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 20 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      dailyLogsColumns: [
        'id',
        'mare_id',
        'date',
        'teasing_score',
        'right_ovary',
        'left_ovary',
        'ovulation_detected',
        'edema',
        'uterine_tone',
        'uterine_cysts',
        'notes',
        'created_at',
        'updated_at',
      ],
      hasUterineFluidTable: false,
      hasUterineFluidIndex: false,
    });

    await applyMigrations(db as never);

    expect(
      execCalls.some((sql) =>
        sql.includes('ADD COLUMN right_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('ADD COLUMN uterine_tone_category TEXT')),
    ).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('ADD COLUMN discharge_observed INTEGER')),
    ).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS uterine_fluid'))).toBe(
      true,
    );
    expect(
      execCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_uterine_fluid_daily_log_id')),
    ).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 21)).toBe(true);
  });

  it('skips migration021 when daily-log structured columns and uterine_fluid artifacts already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 20 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      hasFrozenSemenBatchesTable: true,
      hasFrozenSemenBatchesStallionIndex: true,
      hasFrozenSemenBatchesCollectionIndex: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([21, 22, 23, 24, 25, 26, 27]);
  });

  it('applies migration022 when frozen_semen_batches artifacts are missing', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 21 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      hasFrozenSemenBatchesTable: false,
      hasFrozenSemenBatchesStallionIndex: false,
      hasFrozenSemenBatchesCollectionIndex: false,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('CREATE TABLE frozen_semen_batches'))).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE INDEX IF NOT EXISTS idx_frozen_semen_batches_stallion_id'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE INDEX IF NOT EXISTS idx_frozen_semen_batches_collection_id'),
      ),
    ).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 22)).toBe(true);
  });

  it('skips migration022 when frozen_semen_batches table and indexes already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 21 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      hasFrozenSemenBatchesTable: true,
      hasFrozenSemenBatchesStallionIndex: true,
      hasFrozenSemenBatchesCollectionIndex: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([22, 23, 24, 25, 26, 27]);
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
      hasFrozenSemenBatchesTable: true,
      hasFrozenSemenBatchesStallionIndex: true,
      hasFrozenSemenBatchesCollectionIndex: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([19, 20, 21, 22, 23, 24, 25, 26, 27]);
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
    expect(runCalls.map(({ params }) => params[0])).toEqual([12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
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
    expect(runCalls.map(({ params }) => params[0])).toEqual([15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
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
    expect(runCalls.map(({ params }) => params[0])).toEqual([16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]);
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

  it('adds is_recipient to mares in migration023 when the column is missing', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 22 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      mareColumns: [
        'id',
        'name',
        'breed',
        'gestation_length_days',
        'date_of_birth',
        'registration_number',
        'notes',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
    });

    await applyMigrations(db as never);

    expect(
      execCalls.some((sql) =>
        sql.includes('ADD COLUMN is_recipient INTEGER NOT NULL DEFAULT 0'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('CHECK (is_recipient IN (0, 1))')),
    ).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 23)).toBe(true);
  });

  it('rebuilds daily_logs with time and partial unique indexes in migration024', async () => {
    const { db, execCalls, queryCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 23 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      dailyLogsColumns: [
        'id',
        'mare_id',
        'date',
        'teasing_score',
        'right_ovary',
        'left_ovary',
        'ovulation_detected',
        'edema',
        'uterine_tone',
        'uterine_cysts',
        'notes',
        'created_at',
        'updated_at',
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
      ],
      hasDailyLogsTimedUniqueIndex: false,
      hasDailyLogsUntimedUniqueIndex: false,
    });

    await applyMigrations(db as never);

    expect(execCalls).toContain('PRAGMA foreign_keys = OFF;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(queryCalls).toContain('PRAGMA foreign_key_check;');
    const createTableSql = execCalls.find((sql) => sql.includes('CREATE TABLE daily_logs_new'));
    expect(createTableSql).toContain('time TEXT');
    expect(createTableSql).toContain("substr(time, 1, 2) BETWEEN '00' AND '23'");
    expect(createTableSql).toContain('ovulation_detected IS NULL OR ovulation_detected IN (0, 1)');
    const copySql = execCalls.find((sql) => sql.startsWith('INSERT INTO daily_logs_new'));
    expect(copySql).toContain("COALESCE(right_ovary_follicle_measurements_mm, '[]')");
    expect(copySql).toContain("COALESCE(left_ovary_structures, '[]')");
    expect(copySql).toContain('CASE WHEN ovulation_detected IN (0, 1) THEN ovulation_detected ELSE NULL END');
    expect(execCalls.some((sql) => sql.includes('DROP TABLE daily_logs;'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('ALTER TABLE daily_logs_new RENAME TO daily_logs;'))).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_time_unique'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_untimed_unique'),
      ),
    ).toBe(true);
    expect(runCalls.some(({ params }) => params[0] === 24)).toBe(true);
  });

  it('skips migration024 when time and both partial unique indexes already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 23 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      hasDailyLogsTimedUniqueIndex: true,
      hasDailyLogsUntimedUniqueIndex: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([24, 25, 26, 27]);
  });

  it('adds uterine flush tables and medication source linkage in migration025', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 24 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      hasUterineFlushesTable: false,
      hasUterineFlushProductsTable: false,
      hasMedicationSourceDailyLogIndex: false,
      medicationLogsColumns: [
        'id',
        'mare_id',
        'date',
        'medication_name',
        'dose',
        'route',
        'notes',
        'created_at',
        'updated_at',
      ],
    });

    await applyMigrations(db as never);

    expect(
      execCalls.some((sql) => sql.includes('ADD COLUMN source_daily_log_id TEXT')),
    ).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('REFERENCES daily_logs(id) ON UPDATE CASCADE ON DELETE RESTRICT')),
    ).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS uterine_flushes'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('daily_log_id TEXT NOT NULL UNIQUE'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS uterine_flush_products'))).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_medication_logs_source_daily_log_id')),
    ).toBe(true);
    expect(runCalls.map(({ params }) => params[0])).toEqual([25, 26, 27]);
  });

  it('skips migration025 when flush and medication linkage artifacts already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 24 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([25, 26, 27]);
  });

  it('completes partially present migration025 artifacts without re-adding the medication column', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 24 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY
        )
      `,
      hasUterineFlushesTable: true,
      hasUterineFlushProductsTable: false,
      hasMedicationSourceDailyLogIndex: false,
    });

    await applyMigrations(db as never);

    expect(execCalls.some((sql) => sql.includes('ADD COLUMN source_daily_log_id TEXT'))).toBe(false);
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS uterine_flushes'))).toBe(true);
    expect(execCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS uterine_flush_products'))).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_medication_logs_source_daily_log_id')),
    ).toBe(true);
    expect(runCalls.map(({ params }) => params[0])).toEqual([25, 26, 27]);
  });

  it('rebuilds breeding_records with time and date-time indexes in migration026', async () => {
    const { db, execCalls, queryCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 25 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          mare_id TEXT NOT NULL,
          stallion_id TEXT,
          collection_id TEXT,
          date TEXT NOT NULL,
          method TEXT NOT NULL,
          straw_volume_ml REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      breedingRecordsColumns: ['id'],
      hasBreedingRecordsMareDateTimeIndex: false,
      hasBreedingRecordsStallionDateTimeIndex: false,
      hasBreedingRecordsMareDateIndex: true,
      hasBreedingRecordsStallionDateIndex: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toContain('PRAGMA foreign_keys = OFF;');
    expect(execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(queryCalls).toContain('PRAGMA foreign_key_check;');
    expect(execCalls.some((sql) => sql.includes('ADD COLUMN time TEXT'))).toBe(true);
    expect(
      execCalls.some(
        (sql) =>
          sql.includes('CREATE TABLE breeding_records_new') &&
          sql.includes('time TEXT') &&
          sql.includes('length(time) = 5'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date_time'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date_time'),
      ),
    ).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('DROP INDEX IF EXISTS idx_breeding_records_mare_date')),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('DROP INDEX IF EXISTS idx_breeding_records_stallion_date'),
      ),
    ).toBe(true);
    expect(execCalls.some((sql) => sql.includes('DROP TABLE breeding_records'))).toBe(true);
    expect(runCalls.map(({ params }) => params[0])).toEqual([26, 27]);
  });

  it('skips migration026 when time and date-time index artifacts already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 25 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          time TEXT
        )
      `,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([26, 27]);
  });

  it('creates the tasks table in migration027', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 26 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          time TEXT
        )
      `,
      hasTasksTable: false,
      hasTasksOpenDueIndex: false,
      hasTasksSourceIndex: false,
      hasTasksOpenBreedingPregCheckUniqueIndex: false,
    });

    await applyMigrations(db as never);

    const createTableSql = execCalls.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS tasks'));
    expect(createTableSql).toContain('mare_id TEXT NOT NULL');
    expect(createTableSql).toContain('task_type TEXT NOT NULL');
    expect(createTableSql).toContain('due_time TEXT');
    expect(createTableSql).toContain('completed_record_type TEXT');
    expect(createTableSql).toContain('source_reason TEXT');
    expect(createTableSql).toContain('FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT');
    expect(runCalls.map(({ params }) => params[0])).toEqual([27]);
  });

  it('creates all task indexes in migration027', async () => {
    const { db, execCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 26 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          time TEXT
        )
      `,
      hasTasksTable: false,
      hasTasksOpenDueIndex: false,
      hasTasksSourceIndex: false,
      hasTasksOpenBreedingPregCheckUniqueIndex: false,
    });

    await applyMigrations(db as never);

    expect(
      execCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_tasks_open_due')),
    ).toBe(true);
    expect(
      execCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_tasks_source')),
    ).toBe(true);
    expect(
      execCalls.some((sql) =>
        sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_open_breeding_preg_check_unique'),
      ),
    ).toBe(true);
  });

  it('skips migration027 when the tasks table and indexes already exist', async () => {
    const { db, execCalls, runCalls } = createFakeDb({
      appliedMigrationIds: Array.from({ length: 26 }, (_, index) => index + 1),
      breedingRecordsSql: `
        CREATE TABLE breeding_records (
          id TEXT PRIMARY KEY,
          time TEXT
        )
      `,
      hasTasksTable: true,
      hasTasksOpenDueIndex: true,
      hasTasksSourceIndex: true,
      hasTasksOpenBreedingPregCheckUniqueIndex: true,
    });

    await applyMigrations(db as never);

    expect(execCalls).toHaveLength(1);
    expect(runCalls.map(({ params }) => params[0])).toEqual([27]);
  });
});
