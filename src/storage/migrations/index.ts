import * as SQLite from 'expo-sqlite';

type Migration = {
  id: number;
  name: string;
  statements: string[];
  beforeApply?: (db: SQLite.SQLiteDatabase) => Promise<void>;
  shouldSkip?: (db: SQLite.SQLiteDatabase) => Promise<boolean>;
  requiresForeignKeysOff?: boolean;
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
  straw_volume_ml REAL,
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

// Existing installs that already applied migration002 keep their previous
// affinity until migration015 repairs breeding_records to the canonical REAL
// schema with foreign keys disabled.
const migration002 = `
ALTER TABLE breeding_records ADD COLUMN straw_volume_ml REAL;
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
  straw_volume_ml REAL,
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
  straw_volume_ml REAL,
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
  extender_volume_ml REAL,
  extender_type TEXT,
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
  CHECK (extender_volume_ml IS NULL OR extender_volume_ml >= 0),
  CHECK (concentration_millions_per_ml IS NULL OR concentration_millions_per_ml >= 0),
  CHECK (progressive_motility_percent IS NULL OR progressive_motility_percent BETWEEN 0 AND 100),
  CHECK (dose_count IS NULL OR dose_count >= 0),
  CHECK (dose_size_millions IS NULL OR dose_size_millions >= 0)
);

INSERT INTO semen_collections_new
  SELECT
    id, stallion_id, collection_date, raw_volume_ml, extended_volume_ml,
    NULL, NULL,
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
  TRIM(shipped_to),
  CASE
    WHEN dose_count IS NOT NULL AND dose_count > 0 THEN dose_count
    ELSE NULL
  END,
  collection_date,
  NULL,
  created_at,
  updated_at
FROM semen_collections_old
WHERE shipped = 1
  AND shipped_to IS NOT NULL
  AND TRIM(shipped_to) <> '';
`;

// SQLite rewrites dependent foreign keys during table rename, so migration011
// leaves breeding_records.collection_id pointing at semen_collections_old.
// Keep the old table in place until breeding_records has been rebuilt, otherwise
// upgrades with linked breeding records can fail when SQLite blocks the drop.
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
  straw_volume_ml REAL,
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

DROP TABLE IF EXISTS semen_collections_old;
`;

const migration013 = `
ALTER TABLE semen_collections ADD COLUMN extender_volume_ml REAL;
`;

const migration014 = `
ALTER TABLE semen_collections ADD COLUMN extender_type TEXT;
`;

const migration015 = `
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
  straw_volume_ml REAL,
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

const migration016 = `
CREATE TABLE stallions_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  breed TEXT,
  registration_number TEXT,
  sire TEXT,
  dam TEXT,
  notes TEXT,
  date_of_birth TEXT,
  av_temperature_f REAL,
  av_type TEXT,
  av_liner_type TEXT,
  av_water_volume_ml INTEGER,
  av_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (date_of_birth IS NULL OR date_of_birth GLOB '????-??-??'),
  CHECK (av_temperature_f IS NULL OR typeof(av_temperature_f) IN ('integer', 'real')),
  CHECK (av_type IS NULL OR typeof(av_type) = 'text'),
  CHECK (av_liner_type IS NULL OR typeof(av_liner_type) = 'text'),
  CHECK (av_water_volume_ml IS NULL OR (typeof(av_water_volume_ml) = 'integer' AND av_water_volume_ml >= 0)),
  CHECK (av_notes IS NULL OR typeof(av_notes) = 'text')
);

INSERT INTO stallions_new
  SELECT
    id, name, breed, registration_number, sire, dam, notes,
    date_of_birth, av_temperature_f, av_type, av_liner_type,
    av_water_volume_ml, av_notes, created_at, updated_at, deleted_at
  FROM stallions;

DROP TABLE stallions;

ALTER TABLE stallions_new RENAME TO stallions;

CREATE TABLE semen_collections_new (
  id TEXT PRIMARY KEY,
  stallion_id TEXT NOT NULL,
  collection_date TEXT NOT NULL,
  raw_volume_ml REAL,
  extended_volume_ml REAL,
  extender_volume_ml REAL,
  extender_type TEXT,
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
  CHECK (extender_volume_ml IS NULL OR extender_volume_ml >= 0),
  CHECK (extender_type IS NULL OR typeof(extender_type) = 'text'),
  CHECK (concentration_millions_per_ml IS NULL OR concentration_millions_per_ml >= 0),
  CHECK (progressive_motility_percent IS NULL OR progressive_motility_percent BETWEEN 0 AND 100),
  CHECK (dose_count IS NULL OR dose_count >= 0),
  CHECK (dose_size_millions IS NULL OR dose_size_millions >= 0)
);

INSERT INTO semen_collections_new
  SELECT
    id, stallion_id, collection_date, raw_volume_ml, extended_volume_ml,
    extender_volume_ml, extender_type, concentration_millions_per_ml,
    progressive_motility_percent, dose_count, dose_size_millions,
    notes, created_at, updated_at
  FROM semen_collections;

DROP TABLE semen_collections;

ALTER TABLE semen_collections_new RENAME TO semen_collections;

CREATE INDEX IF NOT EXISTS idx_semen_collections_stallion_date
  ON semen_collections (stallion_id, collection_date DESC);
`;

const migration017 = `
ALTER TABLE mares
ADD COLUMN gestation_length_days INTEGER NOT NULL DEFAULT 340
CHECK (gestation_length_days BETWEEN 300 AND 420);
`;

const migration018 = `
CREATE TABLE collection_dose_events_new (
  id TEXT PRIMARY KEY NOT NULL,
  collection_id TEXT NOT NULL REFERENCES semen_collections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('shipped', 'usedOnSite')),
  recipient TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_street TEXT,
  recipient_city TEXT,
  recipient_state TEXT,
  recipient_zip TEXT,
  carrier_service TEXT,
  container_type TEXT,
  tracking_number TEXT,
  breeding_record_id TEXT REFERENCES breeding_records(id) ON DELETE CASCADE,
  dose_count INTEGER CHECK (dose_count IS NULL OR dose_count > 0),
  event_date TEXT CHECK (event_date IS NULL OR event_date GLOB '????-??-??'),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO collection_dose_events_new (
  id,
  collection_id,
  event_type,
  recipient,
  recipient_phone,
  recipient_street,
  recipient_city,
  recipient_state,
  recipient_zip,
  carrier_service,
  container_type,
  tracking_number,
  breeding_record_id,
  dose_count,
  event_date,
  notes,
  created_at,
  updated_at
)
SELECT
  id,
  collection_id,
  event_type,
  recipient,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  dose_count,
  event_date,
  notes,
  created_at,
  updated_at
FROM collection_dose_events;

DROP TABLE collection_dose_events;

ALTER TABLE collection_dose_events_new RENAME TO collection_dose_events;

CREATE INDEX IF NOT EXISTS idx_collection_dose_events_collection_id
  ON collection_dose_events(collection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_dose_events_breeding_record_id
  ON collection_dose_events(breeding_record_id);
`;

const migration019 = `
CREATE TABLE semen_collections_new (
  id TEXT PRIMARY KEY,
  stallion_id TEXT NOT NULL,
  collection_date TEXT NOT NULL,
  raw_volume_ml REAL,
  extender_type TEXT,
  concentration_millions_per_ml REAL,
  progressive_motility_percent INTEGER,
  target_motile_sperm_millions_per_dose REAL,
  target_post_extension_concentration_millions_per_ml REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (collection_date GLOB '????-??-??'),
  CHECK (raw_volume_ml IS NULL OR raw_volume_ml >= 0),
  CHECK (extender_type IS NULL OR typeof(extender_type) = 'text'),
  CHECK (concentration_millions_per_ml IS NULL OR concentration_millions_per_ml >= 0),
  CHECK (progressive_motility_percent IS NULL OR progressive_motility_percent BETWEEN 0 AND 100),
  CHECK (target_motile_sperm_millions_per_dose IS NULL OR target_motile_sperm_millions_per_dose >= 0),
  CHECK (
    target_post_extension_concentration_millions_per_ml IS NULL
    OR target_post_extension_concentration_millions_per_ml >= 0
  )
);

INSERT INTO semen_collections_new (
  id,
  stallion_id,
  collection_date,
  raw_volume_ml,
  extender_type,
  concentration_millions_per_ml,
  progressive_motility_percent,
  target_motile_sperm_millions_per_dose,
  target_post_extension_concentration_millions_per_ml,
  notes,
  created_at,
  updated_at
)
SELECT
  id,
  stallion_id,
  collection_date,
  raw_volume_ml,
  extender_type,
  concentration_millions_per_ml,
  progressive_motility_percent,
  NULL,
  NULL,
  notes,
  created_at,
  updated_at
FROM semen_collections;

DROP TABLE semen_collections;

ALTER TABLE semen_collections_new RENAME TO semen_collections;

CREATE INDEX IF NOT EXISTS idx_semen_collections_stallion_date
  ON semen_collections (stallion_id, collection_date DESC);

ALTER TABLE collection_dose_events
  ADD COLUMN dose_semen_volume_ml REAL CHECK (dose_semen_volume_ml IS NULL OR dose_semen_volume_ml >= 0);

ALTER TABLE collection_dose_events
  ADD COLUMN dose_extender_volume_ml REAL CHECK (dose_extender_volume_ml IS NULL OR dose_extender_volume_ml >= 0);

UPDATE collection_dose_events
SET
  notes = CASE
    WHEN dose_count > 1 THEN
      CASE
        WHEN notes IS NULL OR TRIM(notes) = '' THEN
          'Legacy migration: collapsed used-on-site dose count to 1 during collection volume rework.'
        ELSE
          notes || '\nLegacy migration: collapsed used-on-site dose count to 1 during collection volume rework.'
      END
    ELSE notes
  END,
  dose_count = 1,
  dose_semen_volume_ml = NULL,
  dose_extender_volume_ml = NULL
WHERE event_type = 'usedOnSite';
`;

const migration020 = `
ALTER TABLE semen_collections
  ADD COLUMN target_mode TEXT
  CHECK (target_mode IS NULL OR target_mode IN ('progressive', 'total'));

UPDATE semen_collections
SET target_mode = CASE
  WHEN target_motile_sperm_millions_per_dose IS NOT NULL
    OR target_post_extension_concentration_millions_per_ml IS NOT NULL
  THEN 'progressive'
  ELSE NULL
END
WHERE target_mode IS NULL;
`;

const migration021 = `
ALTER TABLE daily_logs
  ADD COLUMN right_ovary_ovulation INTEGER
  CHECK (right_ovary_ovulation IS NULL OR right_ovary_ovulation IN (0, 1));

ALTER TABLE daily_logs
  ADD COLUMN right_ovary_follicle_state TEXT
  CHECK (
    right_ovary_follicle_state IS NULL
    OR right_ovary_follicle_state IN (
      'notVisualized',
      'small',
      'medium',
      'large',
      'measured',
      'postOvulatory'
    )
  );

ALTER TABLE daily_logs
  ADD COLUMN right_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT '[]';

ALTER TABLE daily_logs
  ADD COLUMN right_ovary_consistency TEXT
  CHECK (
    right_ovary_consistency IS NULL
    OR right_ovary_consistency IN ('soft', 'moderate', 'firm', 'veryFirm')
  );

ALTER TABLE daily_logs
  ADD COLUMN right_ovary_structures TEXT NOT NULL DEFAULT '[]';

ALTER TABLE daily_logs
  ADD COLUMN left_ovary_ovulation INTEGER
  CHECK (left_ovary_ovulation IS NULL OR left_ovary_ovulation IN (0, 1));

ALTER TABLE daily_logs
  ADD COLUMN left_ovary_follicle_state TEXT
  CHECK (
    left_ovary_follicle_state IS NULL
    OR left_ovary_follicle_state IN (
      'notVisualized',
      'small',
      'medium',
      'large',
      'measured',
      'postOvulatory'
    )
  );

ALTER TABLE daily_logs
  ADD COLUMN left_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT '[]';

ALTER TABLE daily_logs
  ADD COLUMN left_ovary_consistency TEXT
  CHECK (
    left_ovary_consistency IS NULL
    OR left_ovary_consistency IN ('soft', 'moderate', 'firm', 'veryFirm')
  );

ALTER TABLE daily_logs
  ADD COLUMN left_ovary_structures TEXT NOT NULL DEFAULT '[]';

ALTER TABLE daily_logs
  ADD COLUMN uterine_tone_category TEXT
  CHECK (
    uterine_tone_category IS NULL
    OR uterine_tone_category IN ('flaccid', 'moderate', 'tight')
  );

ALTER TABLE daily_logs
  ADD COLUMN cervical_firmness TEXT
  CHECK (
    cervical_firmness IS NULL
    OR cervical_firmness IN ('soft', 'moderate', 'firm', 'closed')
  );

ALTER TABLE daily_logs
  ADD COLUMN discharge_observed INTEGER
  CHECK (discharge_observed IS NULL OR discharge_observed IN (0, 1));

ALTER TABLE daily_logs
  ADD COLUMN discharge_notes TEXT;

CREATE TABLE IF NOT EXISTS uterine_fluid (
  id TEXT PRIMARY KEY,
  daily_log_id TEXT NOT NULL REFERENCES daily_logs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  depth_mm INTEGER NOT NULL CHECK (depth_mm > 0),
  location TEXT NOT NULL
    CHECK (location IN ('leftHorn', 'rightHorn', 'bothHorns', 'uterineBody', 'bifurcation')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uterine_fluid_daily_log_id
  ON uterine_fluid (daily_log_id, created_at DESC);
`;

const migration022 = `
CREATE TABLE frozen_semen_batches (
  id TEXT PRIMARY KEY,
  stallion_id TEXT NOT NULL,
  collection_id TEXT,
  freeze_date TEXT NOT NULL,
  raw_semen_volume_used_ml REAL,
  extender TEXT,
  extender_other TEXT,
  was_centrifuged INTEGER NOT NULL DEFAULT 0,
  centrifuge_speed_rpm INTEGER,
  centrifuge_duration_min INTEGER,
  centrifuge_cushion_used INTEGER,
  centrifuge_cushion_type TEXT,
  centrifuge_resuspension_vol_ml REAL,
  centrifuge_notes TEXT,
  straw_count INTEGER NOT NULL,
  straws_remaining INTEGER NOT NULL,
  straw_volume_ml REAL NOT NULL,
  concentration_millions_per_ml REAL,
  straws_per_dose INTEGER,
  straw_color TEXT,
  straw_color_other TEXT,
  straw_label TEXT,
  post_thaw_motility_percent REAL,
  longevity_hours REAL,
  storage_details TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  -- Frozen inventory should not disappear automatically if a source collection is deleted.
  FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (freeze_date GLOB '????-??-??'),
  CHECK (raw_semen_volume_used_ml IS NULL OR raw_semen_volume_used_ml > 0),
  CHECK (extender IS NULL OR extender IN (
    'BotuCrio',
    'INRA Freeze',
    'Gent',
    'HF-20',
    'Equex STM',
    'Lactose-EDTA-egg-yolk',
    'Skim milk-glycerol',
    'Other'
  )),
  CHECK (extender_other IS NULL OR typeof(extender_other) = 'text'),
  CHECK (was_centrifuged IN (0, 1)),
  CHECK (centrifuge_speed_rpm IS NULL OR centrifuge_speed_rpm > 0),
  CHECK (centrifuge_duration_min IS NULL OR centrifuge_duration_min > 0),
  CHECK (centrifuge_cushion_used IS NULL OR centrifuge_cushion_used IN (0, 1)),
  CHECK (centrifuge_cushion_type IS NULL OR typeof(centrifuge_cushion_type) = 'text'),
  CHECK (centrifuge_resuspension_vol_ml IS NULL OR centrifuge_resuspension_vol_ml > 0),
  CHECK (centrifuge_notes IS NULL OR typeof(centrifuge_notes) = 'text'),
  CHECK (straw_count >= 1),
  CHECK (straws_remaining >= 0 AND straws_remaining <= straw_count),
  CHECK (straw_volume_ml > 0),
  CHECK (concentration_millions_per_ml IS NULL OR concentration_millions_per_ml > 0),
  CHECK (straws_per_dose IS NULL OR straws_per_dose >= 1),
  CHECK (straw_color IS NULL OR straw_color IN (
    'Yellow',
    'Pink',
    'Blue',
    'Green',
    'Red',
    'Orange',
    'Purple',
    'White',
    'Black',
    'Clear',
    'Other'
  )),
  CHECK (straw_color_other IS NULL OR typeof(straw_color_other) = 'text'),
  CHECK (straw_label IS NULL OR typeof(straw_label) = 'text'),
  CHECK (post_thaw_motility_percent IS NULL OR post_thaw_motility_percent BETWEEN 0 AND 100),
  CHECK (longevity_hours IS NULL OR longevity_hours > 0),
  CHECK (storage_details IS NULL OR typeof(storage_details) = 'text'),
  CHECK (notes IS NULL OR typeof(notes) = 'text')
);

CREATE INDEX IF NOT EXISTS idx_frozen_semen_batches_stallion_id
  ON frozen_semen_batches (stallion_id);

CREATE INDEX IF NOT EXISTS idx_frozen_semen_batches_collection_id
  ON frozen_semen_batches (collection_id);
`;

const migration023 = `
ALTER TABLE mares
  ADD COLUMN is_recipient INTEGER NOT NULL DEFAULT 0
  CHECK (is_recipient IN (0, 1));
`;

const migration024 = `
CREATE TABLE daily_logs_new (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  teasing_score INTEGER,
  right_ovary TEXT,
  left_ovary TEXT,
  ovulation_detected INTEGER,
  edema INTEGER,
  uterine_tone TEXT,
  uterine_cysts TEXT,
  right_ovary_ovulation INTEGER,
  right_ovary_follicle_state TEXT,
  right_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT '[]',
  right_ovary_consistency TEXT,
  right_ovary_structures TEXT NOT NULL DEFAULT '[]',
  left_ovary_ovulation INTEGER,
  left_ovary_follicle_state TEXT,
  left_ovary_follicle_measurements_mm TEXT NOT NULL DEFAULT '[]',
  left_ovary_consistency TEXT,
  left_ovary_structures TEXT NOT NULL DEFAULT '[]',
  uterine_tone_category TEXT,
  cervical_firmness TEXT,
  discharge_observed INTEGER,
  discharge_notes TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (
    time IS NULL OR (
      length(time) = 5
      AND substr(time, 3, 1) = ':'
      AND substr(time, 1, 2) BETWEEN '00' AND '23'
      AND substr(time, 4, 2) BETWEEN '00' AND '59'
    )
  ),
  CHECK (teasing_score IS NULL OR teasing_score BETWEEN 0 AND 5),
  CHECK (ovulation_detected IS NULL OR ovulation_detected IN (0, 1)),
  CHECK (edema IS NULL OR edema BETWEEN 0 AND 5),
  CHECK (right_ovary_ovulation IS NULL OR right_ovary_ovulation IN (0, 1)),
  CHECK (
    right_ovary_follicle_state IS NULL
    OR right_ovary_follicle_state IN (
      'notVisualized',
      'small',
      'medium',
      'large',
      'measured',
      'postOvulatory'
    )
  ),
  CHECK (
    right_ovary_consistency IS NULL
    OR right_ovary_consistency IN ('soft', 'moderate', 'firm', 'veryFirm')
  ),
  CHECK (left_ovary_ovulation IS NULL OR left_ovary_ovulation IN (0, 1)),
  CHECK (
    left_ovary_follicle_state IS NULL
    OR left_ovary_follicle_state IN (
      'notVisualized',
      'small',
      'medium',
      'large',
      'measured',
      'postOvulatory'
    )
  ),
  CHECK (
    left_ovary_consistency IS NULL
    OR left_ovary_consistency IN ('soft', 'moderate', 'firm', 'veryFirm')
  ),
  CHECK (
    uterine_tone_category IS NULL
    OR uterine_tone_category IN ('flaccid', 'moderate', 'tight')
  ),
  CHECK (
    cervical_firmness IS NULL
    OR cervical_firmness IN ('soft', 'moderate', 'firm', 'closed')
  ),
  CHECK (discharge_observed IS NULL OR discharge_observed IN (0, 1))
);

INSERT INTO daily_logs_new (
  id,
  mare_id,
  date,
  time,
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
)
SELECT
  id,
  mare_id,
  date,
  NULL,
  teasing_score,
  right_ovary,
  left_ovary,
  CASE WHEN ovulation_detected IN (0, 1) THEN ovulation_detected ELSE NULL END,
  edema,
  uterine_tone,
  uterine_cysts,
  CASE WHEN right_ovary_ovulation IN (0, 1) THEN right_ovary_ovulation ELSE NULL END,
  right_ovary_follicle_state,
  COALESCE(right_ovary_follicle_measurements_mm, '[]'),
  right_ovary_consistency,
  COALESCE(right_ovary_structures, '[]'),
  CASE WHEN left_ovary_ovulation IN (0, 1) THEN left_ovary_ovulation ELSE NULL END,
  left_ovary_follicle_state,
  COALESCE(left_ovary_follicle_measurements_mm, '[]'),
  left_ovary_consistency,
  COALESCE(left_ovary_structures, '[]'),
  uterine_tone_category,
  cervical_firmness,
  CASE WHEN discharge_observed IN (0, 1) THEN discharge_observed ELSE NULL END,
  discharge_notes,
  notes,
  created_at,
  updated_at
FROM daily_logs;

DROP TABLE daily_logs;

ALTER TABLE daily_logs_new RENAME TO daily_logs;

CREATE INDEX IF NOT EXISTS idx_daily_logs_mare_date
  ON daily_logs (mare_id, date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_time_unique
  ON daily_logs (mare_id, date, time)
  WHERE time IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_mare_date_untimed_unique
  ON daily_logs (mare_id, date)
  WHERE time IS NULL;
`;

const migration025 = `
CREATE TABLE IF NOT EXISTS uterine_flushes (
  id TEXT PRIMARY KEY,
  daily_log_id TEXT NOT NULL UNIQUE,
  base_solution TEXT NOT NULL,
  total_volume_ml REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (TRIM(base_solution) <> ''),
  CHECK (
    total_volume_ml > 0
    AND ABS(total_volume_ml * 10 - ROUND(total_volume_ml * 10)) < 0.0000001
  )
);

CREATE TABLE IF NOT EXISTS uterine_flush_products (
  id TEXT PRIMARY KEY,
  uterine_flush_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  dose TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (uterine_flush_id) REFERENCES uterine_flushes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (TRIM(product_name) <> ''),
  CHECK (TRIM(dose) <> '')
);

CREATE INDEX IF NOT EXISTS idx_uterine_flush_products_flush_id
  ON uterine_flush_products (uterine_flush_id);

CREATE INDEX IF NOT EXISTS idx_medication_logs_source_daily_log_id
  ON medication_logs (source_daily_log_id);
`;

const migration026 = `
DROP INDEX IF EXISTS idx_breeding_records_mare_date;
DROP INDEX IF EXISTS idx_breeding_records_stallion_date;

CREATE TABLE breeding_records_new (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  stallion_id TEXT,
  stallion_name TEXT,
  collection_id TEXT,
  date TEXT NOT NULL,
  time TEXT,
  method TEXT NOT NULL,
  notes TEXT,
  volume_ml REAL,
  concentration_m_per_ml REAL,
  motility_percent REAL,
  number_of_straws INTEGER,
  straw_volume_ml REAL,
  straw_details TEXT,
  collection_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (stallion_id) REFERENCES stallions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (collection_id) REFERENCES semen_collections(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (
    time IS NULL OR (
      length(time) = 5
      AND substr(time, 3, 1) = ':'
      AND substr(time, 1, 2) BETWEEN '00' AND '23'
      AND substr(time, 4, 2) BETWEEN '00' AND '59'
    )
  ),
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

INSERT INTO breeding_records_new (
  id,
  mare_id,
  stallion_id,
  stallion_name,
  collection_id,
  date,
  time,
  method,
  notes,
  volume_ml,
  concentration_m_per_ml,
  motility_percent,
  number_of_straws,
  straw_volume_ml,
  straw_details,
  collection_date,
  created_at,
  updated_at
)
SELECT
  id,
  mare_id,
  stallion_id,
  stallion_name,
  collection_id,
  date,
  time,
  method,
  notes,
  volume_ml,
  concentration_m_per_ml,
  motility_percent,
  number_of_straws,
  straw_volume_ml,
  straw_details,
  collection_date,
  created_at,
  updated_at
FROM breeding_records;

DROP TABLE breeding_records;

ALTER TABLE breeding_records_new RENAME TO breeding_records;

CREATE INDEX IF NOT EXISTS idx_breeding_records_mare_date_time
  ON breeding_records (mare_id, date DESC, time DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_breeding_records_stallion_date_time
  ON breeding_records (stallion_id, date DESC, time DESC, created_at DESC, id DESC);
`;

const migration027 = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TEXT,
  completed_record_type TEXT,
  completed_record_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_record_id TEXT,
  source_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (task_type IN ('dailyCheck', 'medication', 'breeding', 'pregnancyCheck', 'custom')),
  CHECK (due_date GLOB '????-??-??'),
  CHECK (
    due_time IS NULL OR (
      length(due_time) = 5
      AND substr(due_time, 3, 1) = ':'
      AND substr(due_time, 1, 2) BETWEEN '00' AND '23'
      AND substr(due_time, 4, 2) BETWEEN '00' AND '59'
    )
  ),
  CHECK (TRIM(title) <> ''),
  CHECK (status IN ('open', 'completed')),
  CHECK (completed_record_type IS NULL OR completed_record_type IN ('dailyLog', 'medicationLog', 'breedingRecord', 'pregnancyCheck')),
  CHECK (source_type IN ('manual', 'dailyLog', 'medicationLog', 'breedingRecord', 'pregnancyCheck')),
  CHECK (source_reason IS NULL OR source_reason IN ('manualFollowUp', 'breedingPregnancyCheck')),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status = 'open' AND completed_at IS NULL)
  ),
  CHECK (
    (completed_record_type IS NULL AND completed_record_id IS NULL)
    OR (completed_record_type IS NOT NULL AND completed_record_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_open_due
  ON tasks (status, due_date ASC, due_time ASC, mare_id);

CREATE INDEX IF NOT EXISTS idx_tasks_source
  ON tasks (source_type, source_record_id, source_reason);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_open_breeding_preg_check_unique
  ON tasks (source_record_id)
  WHERE status = 'open'
    AND source_type = 'breedingRecord'
    AND source_reason = 'breedingPregnancyCheck';
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
    requiresForeignKeysOff: true,
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
    requiresForeignKeysOff: true,
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
    requiresForeignKeysOff: true,
    shouldSkip: async (db) =>
      !(await tableDefinitionReferences(db, 'breeding_records', 'semen_collections_old')) &&
      !(await tableExists(db, 'semen_collections_old')),
  },
  {
    id: 13,
    name: '013_collection_extender_volume',
    statements: splitStatements(migration013),
    shouldSkip: async (db) => hasColumn(db, 'semen_collections', 'extender_volume_ml'),
  },
  {
    id: 14,
    name: '014_collection_extender_type',
    statements: splitStatements(migration014),
    shouldSkip: async (db) => hasColumn(db, 'semen_collections', 'extender_type'),
  },
  {
    id: 15,
    name: '015_breeding_records_straw_volume_real',
    statements: splitStatements(migration015),
    requiresForeignKeysOff: true,
    shouldSkip: async (db) => columnDefinitionHasType(db, 'breeding_records', 'straw_volume_ml', 'REAL'),
  },
  {
    id: 16,
    name: '016_canonicalize_stallions_and_semen_collections',
    statements: splitStatements(migration016),
    beforeApply: async (db) => assertCanonicalConstraintRepairPreconditions(db),
    requiresForeignKeysOff: true,
    shouldSkip: async (db) =>
      (await tableDefinitionIncludesAll(db, 'stallions', [
        /\bdate_of_birth\b\s+TEXT\b/i,
        /\bav_type\b\s+TEXT\b/i,
        /\bav_liner_type\b\s+TEXT\b/i,
        /\bav_notes\b\s+TEXT\b/i,
        /CHECK\s*\(date_of_birth IS NULL OR date_of_birth GLOB '\?\?\?\?-\?\?-\?\?'\)/i,
        /CHECK\s*\(av_temperature_f IS NULL OR typeof\(av_temperature_f\) IN \('integer', 'real'\)\)/i,
        /CHECK\s*\(av_type IS NULL OR typeof\(av_type\) = 'text'\)/i,
        /CHECK\s*\(av_liner_type IS NULL OR typeof\(av_liner_type\) = 'text'\)/i,
        /CHECK\s*\(av_water_volume_ml IS NULL OR \(typeof\(av_water_volume_ml\) = 'integer' AND av_water_volume_ml >= 0\)\)/i,
        /CHECK\s*\(av_notes IS NULL OR typeof\(av_notes\) = 'text'\)/i,
      ])) &&
      (await tableDefinitionIncludesAll(db, 'semen_collections', [
        /\bextender_volume_ml\b\s+REAL\b/i,
        /\bextender_type\b\s+TEXT\b/i,
        /FOREIGN KEY\s*\(stallion_id\)\s+REFERENCES\s+stallions\(id\)\s+ON UPDATE CASCADE ON DELETE RESTRICT/i,
        /CHECK\s*\(extender_volume_ml IS NULL OR extender_volume_ml >= 0\)/i,
        /CHECK\s*\(extender_type IS NULL OR typeof\(extender_type\) = 'text'\)/i,
      ])),
  },
  {
    id: 17,
    name: '017_mare_gestation_length_days',
    statements: splitStatements(migration017),
    shouldSkip: async (db) => hasColumn(db, 'mares', 'gestation_length_days'),
  },
  {
    id: 18,
    name: '018_collection_dose_event_shipping_details',
    statements: splitStatements(migration018),
    shouldSkip: async (db) => hasColumn(db, 'collection_dose_events', 'breeding_record_id'),
  },
  {
    id: 19,
    name: '019_collection_wizard_volume_rework',
    statements: splitStatements(migration019),
    requiresForeignKeysOff: true,
    shouldSkip: async (db) =>
      (await hasColumn(db, 'semen_collections', 'target_motile_sperm_millions_per_dose')) &&
      (await hasColumn(db, 'collection_dose_events', 'dose_semen_volume_ml')) &&
      (await hasColumn(db, 'collection_dose_events', 'dose_extender_volume_ml')),
  },
  {
    id: 20,
    name: '020_collection_target_mode',
    statements: splitStatements(migration020),
    shouldSkip: async (db) => hasColumn(db, 'semen_collections', 'target_mode'),
  },
  {
    id: 21,
    name: '021_daily_log_wizard',
    statements: splitStatements(migration021),
    shouldSkip: async (db) =>
      (await hasColumn(db, 'daily_logs', 'right_ovary_ovulation')) &&
      (await hasColumn(db, 'daily_logs', 'right_ovary_follicle_state')) &&
      (await hasColumn(db, 'daily_logs', 'right_ovary_follicle_measurements_mm')) &&
      (await hasColumn(db, 'daily_logs', 'right_ovary_consistency')) &&
      (await hasColumn(db, 'daily_logs', 'right_ovary_structures')) &&
      (await hasColumn(db, 'daily_logs', 'left_ovary_ovulation')) &&
      (await hasColumn(db, 'daily_logs', 'left_ovary_follicle_state')) &&
      (await hasColumn(db, 'daily_logs', 'left_ovary_follicle_measurements_mm')) &&
      (await hasColumn(db, 'daily_logs', 'left_ovary_consistency')) &&
      (await hasColumn(db, 'daily_logs', 'left_ovary_structures')) &&
      (await hasColumn(db, 'daily_logs', 'uterine_tone_category')) &&
      (await hasColumn(db, 'daily_logs', 'cervical_firmness')) &&
      (await hasColumn(db, 'daily_logs', 'discharge_observed')) &&
      (await hasColumn(db, 'daily_logs', 'discharge_notes')) &&
      (await tableExists(db, 'uterine_fluid')) &&
      (await indexExists(db, 'idx_uterine_fluid_daily_log_id')),
  },
  {
    id: 22,
    name: '022_frozen_semen_batches',
    statements: splitStatements(migration022),
    shouldSkip: async (db) =>
      (await tableExists(db, 'frozen_semen_batches')) &&
      (await indexExists(db, 'idx_frozen_semen_batches_stallion_id')) &&
      (await indexExists(db, 'idx_frozen_semen_batches_collection_id')),
  },
  {
    id: 23,
    name: '023_mare_is_recipient',
    statements: splitStatements(migration023),
    shouldSkip: async (db) => hasColumn(db, 'mares', 'is_recipient'),
  },
  {
    id: 24,
    name: '024_daily_logs_multiple_checks',
    statements: splitStatements(migration024),
    requiresForeignKeysOff: true,
    shouldSkip: async (db) =>
      (await hasColumn(db, 'daily_logs', 'time')) &&
      (await indexExists(db, 'idx_daily_logs_mare_date_time_unique')) &&
      (await indexExists(db, 'idx_daily_logs_mare_date_untimed_unique')),
  },
  {
    id: 25,
    name: '025_daily_log_flush_follow_up',
    statements: splitStatements(migration025),
    beforeApply: async (db) => ensureMedicationSourceDailyLogColumn(db),
    shouldSkip: async (db) =>
      (await tableExists(db, 'uterine_flushes')) &&
      (await tableExists(db, 'uterine_flush_products')) &&
      (await hasColumn(db, 'medication_logs', 'source_daily_log_id')) &&
      (await indexExists(db, 'idx_medication_logs_source_daily_log_id')),
  },
  {
    id: 26,
    name: '026_breeding_record_time',
    statements: splitStatements(migration026),
    beforeApply: async (db) => ensureBreedingRecordTimeColumn(db),
    requiresForeignKeysOff: true,
    shouldSkip: async (db) =>
      (await hasColumn(db, 'breeding_records', 'time')) &&
      (await indexExists(db, 'idx_breeding_records_mare_date_time')) &&
      (await indexExists(db, 'idx_breeding_records_stallion_date_time')) &&
      !(await indexExists(db, 'idx_breeding_records_mare_date')) &&
      !(await indexExists(db, 'idx_breeding_records_stallion_date')),
  },
  {
    id: 27,
    name: '027_tasks',
    statements: splitStatements(migration027),
    shouldSkip: async (db) =>
      (await tableExists(db, 'tasks')) &&
      (await indexExists(db, 'idx_tasks_open_due')) &&
      (await indexExists(db, 'idx_tasks_source')) &&
      (await indexExists(db, 'idx_tasks_open_breeding_preg_check_unique')),
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

    if (migration.beforeApply) {
      await migration.beforeApply(db);
    }

    if (migration.requiresForeignKeysOff) {
      await runMigrationWithForeignKeysDisabled(db, migration);
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

async function runMigrationWithForeignKeysDisabled(
  db: SQLite.SQLiteDatabase,
  migration: Migration,
): Promise<void> {
  let transactionStarted = false;

  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await db.execAsync('BEGIN;');
    transactionStarted = true;

    for (const statement of migration.statements) {
      await db.execAsync(statement);
    }

    await assertNoForeignKeyViolations(db, migration.name);

    await db.runAsync(
      'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?);',
      [migration.id, migration.name, new Date().toISOString()],
    );

    await db.execAsync('COMMIT;');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await db.execAsync('ROLLBACK;');
    }
    throw error;
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function assertNoForeignKeyViolations(
  db: SQLite.SQLiteDatabase,
  migrationName: string,
): Promise<void> {
  const rows = await db.getAllAsync<{
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }>('PRAGMA foreign_key_check;');

  if (rows.length === 0) {
    return;
  }

  const firstViolation = rows[0];
  throw new Error(
    `Foreign key check failed after migration ${migrationName}: ${firstViolation?.table ?? 'unknown'} row ${firstViolation?.rowid ?? 'unknown'} references missing parent ${firstViolation?.parent ?? 'unknown'}.`,
  );
}

async function hasColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return rows.some((row) => row.name === columnName);
}

async function ensureMedicationSourceDailyLogColumn(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  if (await hasColumn(db, 'medication_logs', 'source_daily_log_id')) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE medication_logs
      ADD COLUMN source_daily_log_id TEXT
        REFERENCES daily_logs(id) ON UPDATE CASCADE ON DELETE RESTRICT;
  `);
}

async function ensureBreedingRecordTimeColumn(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  if (await hasColumn(db, 'breeding_records', 'time')) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE breeding_records
      ADD COLUMN time TEXT
        CHECK (
          time IS NULL OR (
            length(time) = 5
            AND substr(time, 3, 1) = ':'
            AND substr(time, 1, 2) BETWEEN '00' AND '23'
            AND substr(time, 4, 2) BETWEEN '00' AND '59'
          )
        );
  `);
}

async function tableDefinitionReferences(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  referencedTable: string,
): Promise<boolean> {
  const sql = await getTableDefinitionSql(db, tableName);
  if (!sql) {
    return false;
  }

  const escapedTable = referencedTable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quotedPattern = new RegExp(`REFERENCES\\s+"${escapedTable}"\\s*\\(`, 'i');
  const unquotedPattern = new RegExp(`REFERENCES\\s+${escapedTable}\\s*\\(`, 'i');
  return quotedPattern.test(sql) || unquotedPattern.test(sql);
}

async function columnDefinitionHasType(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  expectedType: string,
): Promise<boolean> {
  const sql = await getTableDefinitionSql(db, tableName);
  if (!sql) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedType = expectedType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escapedColumn}\\b\\s+${escapedType}\\b`, 'i');
  return pattern.test(sql);
}

async function tableDefinitionIncludesAll(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  patterns: readonly RegExp[],
): Promise<boolean> {
  const sql = await getTableDefinitionSql(db, tableName);
  if (!sql) {
    return false;
  }

  return patterns.every((pattern) => pattern.test(sql));
}

async function getTableDefinitionSql(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?;",
    [tableName],
  );

  return row?.sql ?? null;
}

async function assertCanonicalConstraintRepairPreconditions(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  const invalidStallionDate = await findRowId(
    db,
    "SELECT id FROM stallions WHERE date_of_birth IS NOT NULL AND date_of_birth NOT GLOB '????-??-??' LIMIT 1;",
  );
  if (invalidStallionDate) {
    throw new Error(
      `Cannot apply migration 016_canonicalize_stallions_and_semen_collections: stallions.date_of_birth is invalid for stallion ${invalidStallionDate}.`,
    );
  }

  const invalidAvType = await findRowId(
    db,
    "SELECT id FROM stallions WHERE av_type IS NOT NULL AND typeof(av_type) <> 'text' LIMIT 1;",
  );
  if (invalidAvType) {
    throw new Error(
      `Cannot apply migration 016_canonicalize_stallions_and_semen_collections: stallions.av_type is invalid for stallion ${invalidAvType}.`,
    );
  }

  const invalidAvLinerType = await findRowId(
    db,
    "SELECT id FROM stallions WHERE av_liner_type IS NOT NULL AND typeof(av_liner_type) <> 'text' LIMIT 1;",
  );
  if (invalidAvLinerType) {
    throw new Error(
      `Cannot apply migration 016_canonicalize_stallions_and_semen_collections: stallions.av_liner_type is invalid for stallion ${invalidAvLinerType}.`,
    );
  }

  const invalidAvNotes = await findRowId(
    db,
    "SELECT id FROM stallions WHERE av_notes IS NOT NULL AND typeof(av_notes) <> 'text' LIMIT 1;",
  );
  if (invalidAvNotes) {
    throw new Error(
      `Cannot apply migration 016_canonicalize_stallions_and_semen_collections: stallions.av_notes is invalid for stallion ${invalidAvNotes}.`,
    );
  }

  const invalidExtenderType = await findRowId(
    db,
    "SELECT id FROM semen_collections WHERE extender_type IS NOT NULL AND typeof(extender_type) <> 'text' LIMIT 1;",
  );
  if (invalidExtenderType) {
    throw new Error(
      `Cannot apply migration 016_canonicalize_stallions_and_semen_collections: semen_collections.extender_type is invalid for collection ${invalidExtenderType}.`,
    );
  }
}

async function findRowId(
  db: SQLite.SQLiteDatabase,
  sql: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ id: string }>(sql);
  return row?.id ?? null;
}

async function tableExists(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;",
    [tableName],
  );

  return row != null;
}

async function indexExists(
  db: SQLite.SQLiteDatabase,
  indexName: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?;",
    [indexName],
  );

  return row != null;
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part};`);
}
