import * as SQLite from 'expo-sqlite';

type Migration = {
  id: number;
  name: string;
  statements: string[];
  shouldSkip?: (db: SQLite.SQLiteDatabase) => Promise<boolean>;
};

const migration001 = `
CREATE TABLE IF NOT EXISTS mares (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  breed TEXT NOT NULL,
  date_of_birth TEXT,
  registration_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (date_of_birth IS NULL OR date_of_birth GLOB '????-??-??')
);

CREATE TABLE IF NOT EXISTS stallions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  breed TEXT,
  registration_number TEXT,
  sire TEXT,
  dam TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  date TEXT NOT NULL,
  teasing_score INTEGER,
  right_ovary TEXT,
  left_ovary TEXT,
  edema INTEGER,
  uterine_tone TEXT,
  uterine_cysts TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE (mare_id, date),
  CHECK (date GLOB '????-??-??'),
  CHECK (teasing_score IS NULL OR teasing_score BETWEEN 0 AND 5),
  CHECK (edema IS NULL OR edema BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS breeding_records (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  stallion_id TEXT NOT NULL,
  date TEXT NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  volume_ml REAL,
  concentration_m_per_ml REAL,
  motility_percent REAL,
  number_of_straws INTEGER,
  straw_volume_ml INTEGER,
  straw_details TEXT,
  collection_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (collection_date IS NULL OR collection_date GLOB '????-??-??'),
  CHECK (method IN ('liveCover', 'freshAI', 'shippedCooledAI', 'frozenAI')),
  CHECK (motility_percent IS NULL OR (motility_percent >= 0 AND motility_percent <= 100)),
  CHECK (number_of_straws IS NULL OR number_of_straws >= 1),
  CHECK (
    (method = 'frozenAI' AND number_of_straws IS NOT NULL)
    OR (method <> 'frozenAI')
  )
);

CREATE TABLE IF NOT EXISTS pregnancy_checks (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  breeding_record_id TEXT NOT NULL,
  date TEXT NOT NULL,
  result TEXT NOT NULL,
  heartbeat_detected INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (breeding_record_id) REFERENCES breeding_records(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (result IN ('positive', 'negative')),
  CHECK (heartbeat_detected IS NULL OR heartbeat_detected IN (0, 1)),
  CHECK (
    result = 'positive'
    OR heartbeat_detected IS NULL
    OR heartbeat_detected = 0
  )
);

CREATE TABLE IF NOT EXISTS foaling_records (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  breeding_record_id TEXT,
  date TEXT NOT NULL,
  outcome TEXT NOT NULL,
  foal_sex TEXT,
  complications TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (breeding_record_id) REFERENCES breeding_records(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (outcome IN ('liveFoal', 'stillbirth', 'aborted', 'unknown')),
  CHECK (foal_sex IS NULL OR foal_sex IN ('colt', 'filly', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_mare_date ON daily_logs (mare_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date ON breeding_records (mare_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date ON breeding_records (stallion_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_pregnancy_checks_mare_date ON pregnancy_checks (mare_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_pregnancy_checks_breeding_record ON pregnancy_checks (breeding_record_id);
CREATE INDEX IF NOT EXISTS idx_foaling_records_mare_date ON foaling_records (mare_id, date DESC);
`;

// migration002: column is INTEGER here; existing installs that ran the original
// REAL version retain that affinity (no structural migration is possible without
// disabling FK enforcement, which cannot be done inside a transaction).
const migration002 = `
ALTER TABLE breeding_records ADD COLUMN straw_volume_ml INTEGER;
`;

const migration003 = `
CREATE TABLE breeding_records_new (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  stallion_id TEXT,
  stallion_name TEXT,
  date TEXT NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  volume_ml REAL,
  concentration_m_per_ml REAL,
  motility_percent REAL,
  number_of_straws INTEGER,
  straw_volume_ml INTEGER,
  straw_details TEXT,
  collection_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (collection_date IS NULL OR collection_date GLOB '????-??-??'),
  CHECK (method IN ('liveCover', 'freshAI', 'shippedCooledAI', 'frozenAI')),
  CHECK (motility_percent IS NULL OR (motility_percent >= 0 AND motility_percent <= 100)),
  CHECK (number_of_straws IS NULL OR number_of_straws >= 1),
  CHECK (
    (method = 'frozenAI' AND number_of_straws IS NOT NULL)
    OR (method <> 'frozenAI')
  ),
  CHECK (stallion_id IS NOT NULL OR stallion_name IS NOT NULL)
);

INSERT INTO breeding_records_new
  SELECT id, mare_id, stallion_id, NULL, date, method, notes, volume_ml,
         concentration_m_per_ml, motility_percent, number_of_straws,
         straw_volume_ml, straw_details, collection_date, created_at, updated_at
  FROM breeding_records;

DROP TABLE breeding_records;

ALTER TABLE breeding_records_new RENAME TO breeding_records;

CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date ON breeding_records (mare_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date ON breeding_records (stallion_id, date DESC);
`;

const migration004 = `
ALTER TABLE daily_logs ADD COLUMN ovulation_detected INTEGER;
`;

const migration005 = `
CREATE TABLE IF NOT EXISTS foals (
  id TEXT PRIMARY KEY,
  foaling_record_id TEXT NOT NULL UNIQUE,
  name TEXT,
  sex TEXT CHECK (sex IS NULL OR sex IN ('colt', 'filly', 'unknown')),
  color TEXT CHECK (color IS NULL OR color IN (
    'bay', 'chestnut', 'black', 'gray', 'palomino', 'buckskin',
    'roan', 'pintoPaint', 'sorrel', 'dun', 'cremello', 'other'
  )),
  markings TEXT,
  birth_weight_lbs REAL CHECK (birth_weight_lbs IS NULL OR birth_weight_lbs > 0),
  milestones TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (foaling_record_id) REFERENCES foaling_records(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_foals_foaling_record_id
  ON foals (foaling_record_id);
`;

const migration006 = `
CREATE TABLE IF NOT EXISTS medication_logs (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  date TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (route IS NULL OR route IN ('oral', 'IM', 'IV', 'intrauterine', 'SQ'))
);

CREATE INDEX IF NOT EXISTS idx_medication_logs_mare_date
  ON medication_logs (mare_id, date DESC);
`;

const migration007 = `
ALTER TABLE foals ADD COLUMN igg_tests TEXT NOT NULL DEFAULT '[]';
`;

const migration008 = `
ALTER TABLE stallions ADD COLUMN date_of_birth TEXT;
ALTER TABLE stallions ADD COLUMN av_temperature_f REAL;
ALTER TABLE stallions ADD COLUMN av_type TEXT;
ALTER TABLE stallions ADD COLUMN av_liner_type TEXT;
ALTER TABLE stallions ADD COLUMN av_water_volume_ml INTEGER;
ALTER TABLE stallions ADD COLUMN av_notes TEXT;
`;

const migration009 = `
CREATE TABLE IF NOT EXISTS semen_collections (
  id TEXT PRIMARY KEY,
  stallion_id TEXT NOT NULL,
  collection_date TEXT NOT NULL,
  raw_volume_ml REAL,
  extended_volume_ml REAL,
  concentration_millions_per_ml REAL,
  progressive_motility_percent INTEGER,
  dose_count INTEGER,
  dose_size_millions REAL,
  shipped INTEGER,
  shipped_to TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (collection_date GLOB '????-??-??'),
  CHECK (raw_volume_ml IS NULL OR raw_volume_ml >= 0),
  CHECK (extended_volume_ml IS NULL OR extended_volume_ml >= 0),
  CHECK (concentration_millions_per_ml IS NULL OR concentration_millions_per_ml >= 0),
  CHECK (progressive_motility_percent IS NULL OR progressive_motility_percent BETWEEN 0 AND 100),
  CHECK (dose_count IS NULL OR dose_count >= 0),
  CHECK (dose_size_millions IS NULL OR dose_size_millions >= 0),
  CHECK (shipped IS NULL OR shipped IN (0, 1)),
  CHECK (
    (shipped = 1 AND shipped_to IS NOT NULL AND TRIM(shipped_to) <> '')
    OR (shipped IS NULL OR shipped = 0)
  )
);

CREATE INDEX idx_semen_collections_stallion_date
  ON semen_collections (stallion_id, collection_date DESC);
`;

const migration010 = `
CREATE TABLE breeding_records_new (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  stallion_id TEXT,
  stallion_name TEXT,
  collection_id TEXT,
  date TEXT NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  volume_ml REAL,
  concentration_m_per_ml REAL,
  motility_percent REAL,
  number_of_straws INTEGER,
  straw_volume_ml INTEGER,
  straw_details TEXT,
  collection_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (collection_date IS NULL OR collection_date GLOB '????-??-??'),
  CHECK (method IN ('liveCover', 'freshAI', 'shippedCooledAI', 'frozenAI')),
  CHECK (motility_percent IS NULL OR (motility_percent >= 0 AND motility_percent <= 100)),
  CHECK (number_of_straws IS NULL OR number_of_straws >= 1),
  CHECK (
    (method = 'frozenAI' AND number_of_straws IS NOT NULL)
    OR (method <> 'frozenAI')
  ),
  CHECK (stallion_id IS NOT NULL OR stallion_name IS NOT NULL),
  CHECK (collection_id IS NULL OR stallion_id IS NOT NULL)
);

INSERT INTO breeding_records_new
  SELECT id, mare_id, stallion_id, stallion_name, NULL, date, method, notes,
         volume_ml, concentration_m_per_ml, motility_percent, number_of_straws,
         straw_volume_ml, straw_details, collection_date, created_at, updated_at
  FROM breeding_records;

DROP TABLE breeding_records;

ALTER TABLE breeding_records_new RENAME TO breeding_records;

CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date ON breeding_records (mare_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date ON breeding_records (stallion_id, date DESC);
`;

const migration011 = `
ALTER TABLE semen_collections RENAME TO semen_collections_old;

CREATE TABLE semen_collections_new (
  id TEXT PRIMARY KEY,
  stallion_id TEXT NOT NULL,
  collection_date TEXT NOT NULL,
  raw_volume_ml REAL,
  extended_volume_ml REAL,
  concentration_millions_per_ml REAL,
  progressive_motility_percent INTEGER,
  dose_count INTEGER,
  dose_size_millions REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (collection_date GLOB '????-??-??'),
  CHECK (raw_volume_ml IS NULL OR raw_volume_ml >= 0),
  CHECK (extended_volume_ml IS NULL OR extended_volume_ml >= 0),
  CHECK (concentration_millions_per_ml IS NULL OR concentration_millions_per_ml >= 0),
  CHECK (progressive_motility_percent IS NULL OR progressive_motility_percent BETWEEN 0 AND 100),
  CHECK (dose_count IS NULL OR dose_count >= 0),
  CHECK (dose_size_millions IS NULL OR dose_size_millions >= 0)
);

INSERT INTO semen_collections_new
  SELECT
    id, stallion_id, collection_date, raw_volume_ml, extended_volume_ml,
    concentration_millions_per_ml, progressive_motility_percent,
    dose_count, dose_size_millions, notes, created_at, updated_at
  FROM semen_collections_old;

ALTER TABLE semen_collections_new RENAME TO semen_collections;

CREATE INDEX IF NOT EXISTS idx_semen_collections_stallion_date
  ON semen_collections (stallion_id, collection_date DESC);

CREATE TABLE collection_dose_events (
  id TEXT PRIMARY KEY NOT NULL,
  collection_id TEXT NOT NULL REFERENCES semen_collections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('shipped', 'usedOnSite')),
  recipient TEXT NOT NULL,
  dose_count INTEGER CHECK (dose_count IS NULL OR dose_count > 0),
  event_date TEXT CHECK (event_date IS NULL OR event_date GLOB '????-??-??'),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_collection_dose_events_collection_id
  ON collection_dose_events(collection_id, created_at DESC);

INSERT INTO collection_dose_events (
  id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at
)
SELECT
  'migrated-dose-event-' || id,
  id,
  'shipped',
  shipped_to,
  dose_count,
  collection_date,
  NULL,
  created_at,
  updated_at
FROM semen_collections_old;

DROP TABLE semen_collections_old;
`;

// SQLite rewrites dependent foreign keys during table rename, so migration011
// leaves breeding_records.collection_id pointing at semen_collections_old.
// Rebuild breeding_records to restore the FK target for both fresh installs and
// already-upgraded local databases.
const migration012 = `
CREATE TABLE breeding_records_new (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  stallion_id TEXT,
  stallion_name TEXT,
  collection_id TEXT,
  date TEXT NOT NULL,
  method TEXT NOT NULL,
  notes TEXT,
  volume_ml REAL,
  concentration_m_per_ml REAL,
  motility_percent REAL,
  number_of_straws INTEGER,
  straw_volume_ml INTEGER,
  straw_details TEXT,
  collection_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (collection_date IS NULL OR collection_date GLOB '????-??-??'),
  CHECK (method IN ('liveCover', 'freshAI', 'shippedCooledAI', 'frozenAI')),
  CHECK (motility_percent IS NULL OR (motility_percent >= 0 AND motility_percent <= 100)),
  CHECK (number_of_straws IS NULL OR number_of_straws >= 1),
  CHECK (
    (method = 'frozenAI' AND number_of_straws IS NOT NULL)
    OR (method <> 'frozenAI')
  ),
  CHECK (stallion_id IS NOT NULL OR stallion_name IS NOT NULL),
  CHECK (collection_id IS NULL OR stallion_id IS NOT NULL)
);

INSERT INTO breeding_records_new
  SELECT
    id, mare_id, stallion_id, stallion_name, collection_id,
    date, method, notes, volume_ml, concentration_m_per_ml,
    motility_percent, number_of_straws, straw_volume_ml,
    straw_details, collection_date, created_at, updated_at
  FROM breeding_records;

DROP TABLE breeding_records;

ALTER TABLE breeding_records_new RENAME TO breeding_records;

CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date
  ON breeding_records (mare_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date
  ON breeding_records (stallion_id, date DESC);
`;

const migrations: Migration[] = [
  {
    id: 1,
    name: '001_initial_schema',
    statements: splitStatements(migration001),
  },
  {
    id: 2,
    name: '002_add_straw_volume_ml',
    statements: splitStatements(migration002),
    shouldSkip: async (db) => hasColumn(db, 'breeding_records', 'straw_volume_ml'),
  },
  {
    id: 3,
    name: '003_breeding_stallion_name',
    statements: splitStatements(migration003),
  },
  {
    id: 4,
    name: '004_add_ovulation_detected',
    statements: splitStatements(migration004),
    shouldSkip: async (db) => hasColumn(db, 'daily_logs', 'ovulation_detected'),
  },
  {
    id: 5,
    name: '005_create_foals',
    statements: splitStatements(migration005),
  },
  {
    id: 6,
    name: '006_create_medication_logs',
    statements: splitStatements(migration006),
  },
  {
    id: 7,
    name: '007_add_foal_igg_tests',
    statements: splitStatements(migration007),
    shouldSkip: async (db) => hasColumn(db, 'foals', 'igg_tests'),
  },
  {
    id: 8,
    name: '008_stallion_dob_av_prefs',
    statements: splitStatements(migration008),
    shouldSkip: async (db) => hasColumn(db, 'stallions', 'date_of_birth'),
  },
  {
    id: 9,
    name: '009_create_semen_collections',
    statements: splitStatements(migration009),
  },
  {
    id: 10,
    name: '010_breeding_records_collection_id',
    statements: splitStatements(migration010),
  },
  {
    id: 11,
    name: '011_collection_dose_events',
    statements: splitStatements(migration011),
    shouldSkip: async (db) => !(await hasColumn(db, 'semen_collections', 'shipped')),
  },
  {
    id: 12,
    name: '012_repair_breeding_records_collection_fk',
    statements: splitStatements(migration012),
    shouldSkip: async (db) =>
      !(await tableDefinitionReferences(db, 'breeding_records', 'semen_collections_old')),
  },
];

export async function applyMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of migrations) {
    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM schema_migrations WHERE id = ?;',
      [migration.id]
    );

    if (row) {
      continue;
    }

    if (migration.shouldSkip && (await migration.shouldSkip(db))) {
      await db.runAsync(
        'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?);',
        [migration.id, migration.name, new Date().toISOString()]
      );
      continue;
    }

    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }

      await db.runAsync(
        'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?);',
        [migration.id, migration.name, new Date().toISOString()]
      );
    });
  }
}

async function hasColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return rows.some((row) => row.name === columnName);
}

async function tableDefinitionReferences(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  referencedTable: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?;",
    [tableName],
  );

  const sql = row?.sql;
  if (!sql) {
    return false;
  }

  const escapedTable = referencedTable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quotedPattern = new RegExp(`REFERENCES\\s+"${escapedTable}"\\s*\\(`, 'i');
  const unquotedPattern = new RegExp(`REFERENCES\\s+${escapedTable}\\s*\\(`, 'i');
  return quotedPattern.test(sql) || unquotedPattern.test(sql);
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part};`);
}
