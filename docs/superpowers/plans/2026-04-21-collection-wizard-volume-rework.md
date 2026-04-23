# Collection Wizard Volume Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the stallion-detail collection wizard around a per-dose volume model — each dose has its own semen/extender composition — with a 4-step flow (Basics → Calculator → Allocation → Review), a hard volume-based allocation cap, and a synchronized on-farm breeding-record companion event lifecycle.

**Architecture:** Schema migration 019 drops four `semen_collections` columns, adds two target fields, and adds two per-dose volume columns on `collection_dose_events`; legacy `usedOnSite` rows are canonicalized to `dose_count=1` with a note. Pure utils (`collectionCalculator`, `collectionAllocation`) back Step 2 live display, Step 3 pre-fill/summary, repo-level cap, edit-screen derived panel, and backup validation. Wizard components are rebuilt against the new row shape. `breedingRecords` gains bidirectional sync with its companion `usedOnSite` event. Backup bumps to v3 with v2→v3 restore shim.

**Tech Stack:** Expo SDK 55, React Native 0.83, TypeScript, `expo-sqlite` (inline TS migration constants in `src/storage/migrations/index.ts`), Vitest (pure utils + repos), Jest + RN Testing Library (screens).

**Spec:** `docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md` (commit `3095bd3` plus user-added on-farm lifecycle, FK semantics, migration canonicalization, create-time field mapping).

**Branch:** `feature/collection-wizard`. Phase-2.5 wizard scaffold (`2b4aa16`) is already landed and will be reshaped.

**Subagent usage:** Tasks marked `[subagent: X]` should be dispatched to a fresh subagent of the named type. Tasks without that marker run inline. Sequential dependencies are noted explicitly.

---

## Phase ordering

1. **Phase A — Foundations** (strictly sequential): migration 019, types, pure utils.
2. **Phase B — Repository layer** (parallelizable after A): semen_collections, collection_dose_events, internal allocation, wizard transaction, breeding_records sync.
3. **Phase C — Backup v3** (parallelizable after A, independent of B): types/fixtures, serialize, restore, validate.
4. **Phase D — Wizard UI** (sequential after A+B): hook, 4 steps, 2 row editors, screen shell.
5. **Phase E — Edit screen + modal** (parallelizable after B): CollectionFormScreen derived panel, DoseEventModal volume fields.
6. **Phase F — Verification**: typecheck, test, screen tests, lint, manual smoke.

---

## Phase A — Foundations

### Task A1: Migration 019 — schema rework + legacy canonicalization

**Files:**
- Modify: `src/storage/migrations/index.ts` (add `migration019` constant + entry in `migrations` array)
- Test: `src/storage/migrations/index.test.ts`

- [ ] **Step 1: Write failing migration tests**

Add to `src/storage/migrations/index.test.ts`:

```ts
describe('migration 019 — collection wizard volume rework', () => {
  it('adds target_motile_sperm_millions_per_dose and target_post_extension_concentration_millions_per_ml to semen_collections', async () => {
    const db = await openTestDb();
    await applyMigrations(db);
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(semen_collections);');
    const names = cols.map((c) => c.name);
    expect(names).toContain('target_motile_sperm_millions_per_dose');
    expect(names).toContain('target_post_extension_concentration_millions_per_ml');
  });

  it('drops extended_volume_ml, extender_volume_ml, dose_count, dose_size_millions from semen_collections', async () => {
    const db = await openTestDb();
    await applyMigrations(db);
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(semen_collections);');
    const names = cols.map((c) => c.name);
    expect(names).not.toContain('extended_volume_ml');
    expect(names).not.toContain('extender_volume_ml');
    expect(names).not.toContain('dose_count');
    expect(names).not.toContain('dose_size_millions');
  });

  it('adds dose_semen_volume_ml and dose_extender_volume_ml to collection_dose_events', async () => {
    const db = await openTestDb();
    await applyMigrations(db);
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(collection_dose_events);');
    const names = cols.map((c) => c.name);
    expect(names).toContain('dose_semen_volume_ml');
    expect(names).toContain('dose_extender_volume_ml');
  });

  it('canonicalizes legacy usedOnSite rows: forces dose_count=1, nullifies dose_extender_volume_ml', async () => {
    const db = await openTestDb();
    // stage up to migration 018
    await applyMigrationsUpTo(db, 18);
    // seed one usedOnSite row with dose_count=3 and non-empty notes
    await db.runAsync(
      `INSERT INTO collection_dose_events (id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at)
       VALUES ('legacy-usage-1', ?, 'usedOnSite', 'Bella', 3, '2026-03-01', 'pre-existing note', ?, ?);`,
      [seededCollectionId, nowIso, nowIso],
    );
    await applyMigrations(db);
    const row = await db.getFirstAsync<{ dose_count: number; dose_extender_volume_ml: number | null; notes: string }>(
      'SELECT dose_count, dose_extender_volume_ml, notes FROM collection_dose_events WHERE id = ?;',
      ['legacy-usage-1'],
    );
    expect(row?.dose_count).toBe(1);
    expect(row?.dose_extender_volume_ml).toBeNull();
    expect(row?.notes).toContain('pre-existing note');
    expect(row?.notes).toContain('Legacy on-farm dose count 3 collapsed to 1 during volume-model migration.');
  });

  it('canonicalization writes the migration note as the only note when notes was empty', async () => {
    const db = await openTestDb();
    await applyMigrationsUpTo(db, 18);
    await db.runAsync(
      `INSERT INTO collection_dose_events (id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at)
       VALUES ('legacy-usage-2', ?, 'usedOnSite', 'Bella', 2, '2026-03-01', NULL, ?, ?);`,
      [seededCollectionId, nowIso, nowIso],
    );
    await applyMigrations(db);
    const row = await db.getFirstAsync<{ notes: string | null }>(
      'SELECT notes FROM collection_dose_events WHERE id = ?;',
      ['legacy-usage-2'],
    );
    expect(row?.notes).toBe('Legacy on-farm dose count 2 collapsed to 1 during volume-model migration.');
  });

  it('does not touch legacy usedOnSite rows with dose_count=1', async () => {
    const db = await openTestDb();
    await applyMigrationsUpTo(db, 18);
    await db.runAsync(
      `INSERT INTO collection_dose_events (id, collection_id, event_type, recipient, dose_count, event_date, notes, created_at, updated_at)
       VALUES ('legacy-usage-3', ?, 'usedOnSite', 'Bella', 1, '2026-03-01', 'untouched', ?, ?);`,
      [seededCollectionId, nowIso, nowIso],
    );
    await applyMigrations(db);
    const row = await db.getFirstAsync<{ dose_count: number; notes: string | null }>(
      'SELECT dose_count, notes FROM collection_dose_events WHERE id = ?;',
      ['legacy-usage-3'],
    );
    expect(row?.dose_count).toBe(1);
    expect(row?.notes).toBe('untouched');
  });

  it('preserves breeding_records.collection_id FK with ON UPDATE CASCADE ON DELETE RESTRICT after rebuild', async () => {
    const db = await openTestDb();
    await applyMigrations(db);
    const sql = (await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='breeding_records';",
    ))?.sql ?? '';
    expect(sql).toMatch(/FOREIGN KEY\s*\(collection_id\)\s+REFERENCES\s+semen_collections\(id\)\s+ON UPDATE CASCADE ON DELETE RESTRICT/i);
  });

  it('fresh install and upgraded install produce identical final semen_collections definition', async () => {
    const fresh = await openTestDb();
    await applyMigrations(fresh);
    const upgrade = await openTestDb();
    await applyMigrationsUpTo(upgrade, 18);
    // seed legacy data then run final migration
    await applyMigrations(upgrade);
    const freshSql = (await fresh.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='semen_collections';",
    ))?.sql;
    const upgradeSql = (await upgrade.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='semen_collections';",
    ))?.sql;
    expect(normalizeSql(freshSql)).toBe(normalizeSql(upgradeSql));
  });
});
```

(Helpers `applyMigrationsUpTo`, `openTestDb`, `normalizeSql`, `seededCollectionId`, `nowIso` — reuse/extend patterns already in the test file.)

- [ ] **Step 2: Run tests to verify fail**

Run: `npx vitest run src/storage/migrations/index.test.ts`
Expected: FAIL — migration 019 does not exist.

- [ ] **Step 3: Add `migration019` constant**

In `src/storage/migrations/index.ts`, before the `migrations: Migration[]` array, add:

```ts
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
  CHECK (target_motile_sperm_millions_per_dose IS NULL OR target_motile_sperm_millions_per_dose > 0),
  CHECK (target_post_extension_concentration_millions_per_ml IS NULL OR target_post_extension_concentration_millions_per_ml > 0)
);

INSERT INTO semen_collections_new (
  id, stallion_id, collection_date, raw_volume_ml, extender_type,
  concentration_millions_per_ml, progressive_motility_percent,
  target_motile_sperm_millions_per_dose, target_post_extension_concentration_millions_per_ml,
  notes, created_at, updated_at
)
SELECT
  id, stallion_id, collection_date, raw_volume_ml, extender_type,
  concentration_millions_per_ml, progressive_motility_percent,
  NULL, NULL,
  notes, created_at, updated_at
FROM semen_collections;

DROP TABLE semen_collections;

ALTER TABLE semen_collections_new RENAME TO semen_collections;

CREATE INDEX IF NOT EXISTS idx_semen_collections_stallion_date
  ON semen_collections (stallion_id, collection_date DESC);

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

ALTER TABLE collection_dose_events ADD COLUMN dose_semen_volume_ml REAL;

ALTER TABLE collection_dose_events ADD COLUMN dose_extender_volume_ml REAL;

UPDATE collection_dose_events
SET notes = CASE
      WHEN notes IS NULL OR TRIM(notes) = ''
        THEN 'Legacy on-farm dose count ' || dose_count || ' collapsed to 1 during volume-model migration.'
      ELSE notes || char(10) || char(10) || 'Legacy on-farm dose count ' || dose_count || ' collapsed to 1 during volume-model migration.'
    END,
    dose_count = 1,
    dose_extender_volume_ml = NULL,
    dose_semen_volume_ml = NULL
WHERE event_type = 'usedOnSite'
  AND dose_count IS NOT NULL
  AND dose_count > 1;

UPDATE collection_dose_events
SET dose_count = 1,
    dose_extender_volume_ml = NULL,
    dose_semen_volume_ml = NULL
WHERE event_type = 'usedOnSite'
  AND (dose_count IS NULL OR dose_count = 1);
`;
```

Note: CHECK constraints for non-negative dose volumes on `collection_dose_events` cannot be added via `ALTER TABLE ADD COLUMN`. If those checks are required at DB level, adopt the full table-rebuild idiom for `collection_dose_events` too. For now, volume non-negativity is enforced at the repo layer; document this in the migration comment.

- [ ] **Step 4: Register migration in the array**

Append to the `migrations: Migration[]` array (after entry id:18):

```ts
  {
    id: 19,
    name: '019_collection_wizard_volume_rework',
    statements: splitStatements(migration019),
    requiresForeignKeysOff: true,
    shouldSkip: async (db) =>
      hasColumn(db, 'semen_collections', 'target_motile_sperm_millions_per_dose')
      && !(await hasColumn(db, 'semen_collections', 'dose_count'))
      && hasColumn(db, 'collection_dose_events', 'dose_semen_volume_ml'),
  },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/storage/migrations/index.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/migrations/index.ts src/storage/migrations/index.test.ts
git commit -m "feat(migration): add 019 collection wizard volume rework"
```

---

### Task A2: Update domain types

**Files:**
- Modify: `src/models/types.ts`

- [ ] **Step 1: Remove dropped fields and add new fields on `SemenCollection`**

In `src/models/types.ts`, edit the `SemenCollection` interface (and `Create`/`Update` variants):

- Remove: `totalVolumeMl`, `extenderVolumeMl`, `doseCount`, `doseSizeMillions`.
- Add:

```ts
targetMotileSpermMillionsPerDose?: number | null;
targetPostExtensionConcentrationMillionsPerMl?: number | null;
```

- [ ] **Step 2: Add volume fields to `CollectionDoseEvent` types**

In the same file, on `CollectionDoseEvent`, `CreateCollectionDoseEventInput`, `UpdateCollectionDoseEventInput`:

```ts
doseSemenVolumeMl?: number | null;
doseExtenderVolumeMl?: number | null;
```

Note: `totalExtendedVolumeMl` is never on any type — it is computed on read.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: A flurry of new errors across repos/screens/tests (that's fine — those are addressed in later tasks). Collect the list for reference.

- [ ] **Step 4: Commit**

```bash
git add src/models/types.ts
git commit -m "refactor(types): per-dose volume + planning targets on collection types"
```

---

### Task A3: `src/utils/collectionCalculator.ts` — pure calculator math  [subagent: general-purpose]

**Files:**
- Create: `src/utils/collectionCalculator.ts`
- Create: `src/utils/collectionCalculator.test.ts`

Dispatch subagent with this brief:

> Implement the pure calculator util exactly as described in spec section "Pure functions (new utils) → `src/utils/collectionCalculator.ts`" of `docs/superpowers/specs/2026-04-21-collection-wizard-volume-rework-design.md`. TDD only: tests first, implementation after tests fail, commit at the end. Do not touch any other file.

- [ ] **Step 1: Write failing tests**

Create `src/utils/collectionCalculator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveCollectionMath } from './collectionCalculator';

const baseline = {
  rawVolumeMl: 30,
  concentrationMillionsPerMl: 250,
  progressiveMotilityPercent: 70,
  targetMotileSpermMillionsPerDose: 500,
  targetPostExtensionConcentrationMillionsPerMl: 25,
};

describe('deriveCollectionMath', () => {
  it('computes happy path', () => {
    const d = deriveCollectionMath(baseline);
    // semenPerDose = 500 / (250 * 0.70) = 2.857...
    expect(d.semenPerDoseMl).toBeCloseTo(2.857, 2);
    // doseVolume = 500 / 25 = 20
    expect(d.doseVolumeMl).toBeCloseTo(20, 5);
    // extenderPerDose = 20 - 2.857 = 17.142...
    expect(d.extenderPerDoseMl).toBeCloseTo(17.143, 2);
    // maxDoses = floor(30 * 250 * 0.70 / 500) = floor(10.5) = 10
    expect(d.maxDoses).toBe(10);
    expect(d.warnings).toEqual([]);
  });

  it('returns nulls when motility is missing', () => {
    const d = deriveCollectionMath({ ...baseline, progressiveMotilityPercent: null });
    expect(d.semenPerDoseMl).toBeNull();
    expect(d.doseVolumeMl).toBeCloseTo(20, 5); // doseVolume only needs D and Cpost
    expect(d.maxDoses).toBeNull();
  });

  it('returns nulls when concentration is missing', () => {
    const d = deriveCollectionMath({ ...baseline, concentrationMillionsPerMl: null });
    expect(d.semenPerDoseMl).toBeNull();
    expect(d.maxDoses).toBeNull();
  });

  it('returns nulls when C*M = 0', () => {
    const d = deriveCollectionMath({ ...baseline, progressiveMotilityPercent: 0 });
    expect(d.semenPerDoseMl).toBeNull();
  });

  it('flags target-exceeds-capacity warning', () => {
    const d = deriveCollectionMath({ ...baseline, targetMotileSpermMillionsPerDose: 10_000 });
    expect(d.maxDoses).toBe(0);
    expect(d.warnings).toContain('target-exceeds-capacity');
  });

  it('flags negative-extender warning when target post-ext concentration >= raw motile concentration', () => {
    // raw motile concentration = 250 * 0.7 = 175 M/mL
    const d = deriveCollectionMath({
      ...baseline,
      targetPostExtensionConcentrationMillionsPerMl: 200,
    });
    expect(d.extenderPerDoseMl).toBeLessThan(0);
    expect(d.warnings).toContain('negative-extender');
  });

  it('returns all nulls when no inputs', () => {
    const d = deriveCollectionMath({
      rawVolumeMl: null,
      concentrationMillionsPerMl: null,
      progressiveMotilityPercent: null,
      targetMotileSpermMillionsPerDose: null,
      targetPostExtensionConcentrationMillionsPerMl: null,
    });
    expect(d.semenPerDoseMl).toBeNull();
    expect(d.extenderPerDoseMl).toBeNull();
    expect(d.doseVolumeMl).toBeNull();
    expect(d.maxDoses).toBeNull();
    expect(d.warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `npx vitest run src/utils/collectionCalculator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/utils/collectionCalculator.ts`:

```ts
export interface CollectionInputs {
  rawVolumeMl: number | null;
  concentrationMillionsPerMl: number | null;
  progressiveMotilityPercent: number | null;
  targetMotileSpermMillionsPerDose: number | null;
  targetPostExtensionConcentrationMillionsPerMl: number | null;
}

export type CollectionWarning = 'negative-extender' | 'target-exceeds-capacity';

export interface CollectionDerived {
  semenPerDoseMl: number | null;
  extenderPerDoseMl: number | null;
  doseVolumeMl: number | null;
  maxDoses: number | null;
  warnings: CollectionWarning[];
}

export function deriveCollectionMath(i: CollectionInputs): CollectionDerived {
  const warnings: CollectionWarning[] = [];
  const V = i.rawVolumeMl;
  const C = i.concentrationMillionsPerMl;
  const Mpct = i.progressiveMotilityPercent;
  const D = i.targetMotileSpermMillionsPerDose;
  const Cpost = i.targetPostExtensionConcentrationMillionsPerMl;

  const M = Mpct == null ? null : Mpct / 100;
  const rawMotileConcentration =
    C != null && M != null ? C * M : null;

  const semenPerDoseMl =
    D != null && rawMotileConcentration != null && rawMotileConcentration > 0
      ? D / rawMotileConcentration
      : null;

  const doseVolumeMl =
    D != null && Cpost != null && Cpost > 0 ? D / Cpost : null;

  const extenderPerDoseMl =
    semenPerDoseMl != null && doseVolumeMl != null
      ? doseVolumeMl - semenPerDoseMl
      : null;

  const maxDoses =
    V != null && D != null && rawMotileConcentration != null && rawMotileConcentration > 0
      ? Math.floor((V * rawMotileConcentration) / D)
      : null;

  if (extenderPerDoseMl != null && extenderPerDoseMl < 0) {
    warnings.push('negative-extender');
  }
  if (maxDoses != null && maxDoses < 1) {
    warnings.push('target-exceeds-capacity');
  }

  return { semenPerDoseMl, extenderPerDoseMl, doseVolumeMl, maxDoses, warnings };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/utils/collectionCalculator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/collectionCalculator.ts src/utils/collectionCalculator.test.ts
git commit -m "feat(util): pure collection calculator math"
```

---

### Task A4: `src/utils/collectionAllocation.ts` — volume-based allocation summary  [subagent: general-purpose]

**Files:**
- Create: `src/utils/collectionAllocation.ts`
- Create: `src/utils/collectionAllocation.test.ts`

Dispatch subagent with this brief:

> Implement `computeAllocationSummary` exactly as described in the spec ("Pure functions → `src/utils/collectionAllocation.ts`"). TDD only, commit at the end. Do not modify other files.

- [ ] **Step 1: Write failing tests**

Create `src/utils/collectionAllocation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeAllocationSummary } from './collectionAllocation';

describe('computeAllocationSummary', () => {
  it('empty rows', () => {
    const s = computeAllocationSummary([], 30);
    expect(s.totalAllocatedMl).toBe(0);
    expect(s.remainingMl).toBe(30);
    expect(s.blankVolumeRowCount).toBe(0);
    expect(s.exceededByMl).toBe(0);
    expect(s.isWithinCap).toBe(true);
  });

  it('sums shipped rows with doseCount multiplier', () => {
    const s = computeAllocationSummary(
      [
        { doseSemenVolumeMl: 2.86, doseCount: 3 },
        { doseSemenVolumeMl: 1.5, doseCount: 2 },
      ],
      30,
    );
    expect(s.totalAllocatedMl).toBeCloseTo(2.86 * 3 + 1.5 * 2, 5);
    expect(s.isWithinCap).toBe(true);
  });

  it('excludes rows with null doseSemenVolumeMl and counts them as blank', () => {
    const s = computeAllocationSummary(
      [
        { doseSemenVolumeMl: 2.86, doseCount: 1 },
        { doseSemenVolumeMl: null, doseCount: 1 },
        { doseSemenVolumeMl: null, doseCount: 1 },
      ],
      30,
    );
    expect(s.totalAllocatedMl).toBeCloseTo(2.86, 5);
    expect(s.blankVolumeRowCount).toBe(2);
    expect(s.isWithinCap).toBe(true);
  });

  it('marks cap exceeded', () => {
    const s = computeAllocationSummary(
      [{ doseSemenVolumeMl: 20, doseCount: 2 }],
      30,
    );
    expect(s.totalAllocatedMl).toBe(40);
    expect(s.exceededByMl).toBe(10);
    expect(s.isWithinCap).toBe(false);
  });

  it('cap exactly met = within cap', () => {
    const s = computeAllocationSummary(
      [{ doseSemenVolumeMl: 10, doseCount: 3 }],
      30,
    );
    expect(s.totalAllocatedMl).toBe(30);
    expect(s.remainingMl).toBe(0);
    expect(s.exceededByMl).toBe(0);
    expect(s.isWithinCap).toBe(true);
  });

  it('rawVolumeMl null: remainingMl null, always within cap', () => {
    const s = computeAllocationSummary(
      [{ doseSemenVolumeMl: 100, doseCount: 5 }],
      null,
    );
    expect(s.remainingMl).toBeNull();
    expect(s.isWithinCap).toBe(true);
    expect(s.exceededByMl).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `npx vitest run src/utils/collectionAllocation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/utils/collectionAllocation.ts`:

```ts
export interface AllocationRow {
  doseSemenVolumeMl: number | null;
  doseCount: number;
}

export interface AllocationSummary {
  totalAllocatedMl: number;
  remainingMl: number | null;
  blankVolumeRowCount: number;
  exceededByMl: number;
  isWithinCap: boolean;
}

export function computeAllocationSummary(
  rows: readonly AllocationRow[],
  rawVolumeMl: number | null,
): AllocationSummary {
  let totalAllocatedMl = 0;
  let blankVolumeRowCount = 0;
  for (const row of rows) {
    if (row.doseSemenVolumeMl == null) {
      blankVolumeRowCount += 1;
      continue;
    }
    totalAllocatedMl += row.doseSemenVolumeMl * row.doseCount;
  }

  if (rawVolumeMl == null) {
    return {
      totalAllocatedMl,
      remainingMl: null,
      blankVolumeRowCount,
      exceededByMl: 0,
      isWithinCap: true,
    };
  }

  const remainingMl = rawVolumeMl - totalAllocatedMl;
  const exceededByMl = remainingMl < 0 ? -remainingMl : 0;
  return {
    totalAllocatedMl,
    remainingMl,
    blankVolumeRowCount,
    exceededByMl,
    isWithinCap: exceededByMl === 0,
  };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/utils/collectionAllocation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/collectionAllocation.ts src/utils/collectionAllocation.test.ts
git commit -m "feat(util): volume-based collection allocation summary"
```

---

## Phase B — Repository layer

### Task B1: `semenCollections` repo updates  [subagent: general-purpose]

**Files:**
- Modify: `src/storage/repositories/semenCollections.ts`
- Modify: `src/storage/repositories/semenCollections.test.ts`

Dispatch subagent with this brief:

> Update semen_collections repo to match new schema: drop writes/reads of `extended_volume_ml`, `extender_volume_ml`, `dose_count`, `dose_size_millions`; add writes/reads of `target_motile_sperm_millions_per_dose` and `target_post_extension_concentration_millions_per_ml`. Update the corresponding tests. TDD: update tests first, run to verify fail, then update impl, run to verify pass. Files allowed: the two above only. Commit when green.

Steps:

- [ ] **Step 1: Update `semenCollections.test.ts`** to drop references to removed fields, add CRUD coverage for the two new target fields (both NULL default; both writable/readable; clearing to NULL supported).

- [ ] **Step 2: Run `npx vitest run src/storage/repositories/semenCollections.test.ts` — expect FAIL.**

- [ ] **Step 3: Update `semenCollections.ts`** — remove all references to dropped columns in create/update/find/listByStallion, add mapping for new target columns. Preserve existing patterns (`number | null` normalization, row shape).

- [ ] **Step 4: Re-run vitest — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/storage/repositories/semenCollections.ts src/storage/repositories/semenCollections.test.ts
git commit -m "refactor(repo): semen_collections targets replace dose_count/dose_size"
```

---

### Task B2: `collectionDoseEvents` repo updates  [subagent: general-purpose]

**Files:**
- Modify: `src/storage/repositories/collectionDoseEvents.ts`
- Modify: `src/storage/repositories/collectionDoseEvents.test.ts`

Dispatch subagent with this brief:

> Add per-dose volume fields (`doseSemenVolumeMl`, `doseExtenderVolumeMl`) to collection_dose_events CRUD and tests. Enforce at repo layer:
> 1. `usedOnSite` rows must have `doseExtenderVolumeMl = null` and `doseCount = 1`; reject write attempts that violate this.
> 2. `shipped` rows must have non-null `doseSemenVolumeMl` and non-null `doseExtenderVolumeMl` on create.
> 3. Volumes, if present, must be ≥ 0.
> TDD, commit when green. Only these two files.

Tests to add/update:
- round-trip volumes on shipped
- round-trip null volumes on usedOnSite
- reject non-null extender on usedOnSite (error message: "Extender volume not allowed on on-farm events")
- reject dose_count ≠ 1 on usedOnSite write path (error message: "On-farm events are fixed at dose_count = 1")
- reject null doseSemenVolumeMl on shipped create
- reject null doseExtenderVolumeMl on shipped create

- [ ] **Step 1: Update tests**
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Update impl (mapping + guards)**
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add src/storage/repositories/collectionDoseEvents.ts src/storage/repositories/collectionDoseEvents.test.ts
git commit -m "refactor(repo): collection_dose_events per-dose volumes + type invariants"
```

---

### Task B3: Replace internal allocation with volume-based cap

**Files:**
- Modify: `src/storage/repositories/internal/collectionAllocation.ts`
- Modify: `src/storage/repositories/repositories.test.ts` (cap tests)

- [ ] **Step 1: Update tests** in `repositories.test.ts` to:
  - Remove dose-count cap assertions.
  - Add volume-cap assertions: sum of `dose_semen_volume_ml * dose_count` across events with non-null semen volume must not exceed `raw_volume_ml`.
  - Lowering `raw_volume_ml` below allocated sum fails.
  - Exclude current event when recomputing for an update.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Rewrite `internal/collectionAllocation.ts`**. Replace dose-count-based helpers with volume-based:

```ts
// Drop getCollectionDoseCount, getAllocatedDoseCountForCollectionDb,
// assertCollectionDoseCountCanSupportAllocations,
// assertCollectionDoseCountCanBeUpdated.
// Add:

export type AllocationExclusionOptions = {
  excludeDoseEventId?: string;
  excludeBreedingRecordId?: string;
};

export async function getCollectionRawVolumeMl(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
): Promise<number | null> { /* SELECT raw_volume_ml FROM semen_collections */ }

export async function getAllocatedSemenVolumeMl(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  options?: AllocationExclusionOptions,
): Promise<number> {
  // SELECT COALESCE(SUM(dose_semen_volume_ml * COALESCE(dose_count, 1)), 0) AS allocated
  // FROM collection_dose_events
  // WHERE collection_id = ? AND dose_semen_volume_ml IS NOT NULL
  //   [AND id <> ?] [AND breeding_record_id <> ?]
}

export async function assertCollectionVolumeCanSupportAllocation(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  deltaSemenMl: number,
  options?: AllocationExclusionOptions,
): Promise<void> {
  const raw = await getCollectionRawVolumeMl(db, collectionId);
  if (raw == null) return; // no cap when raw volume unrecorded
  const allocated = await getAllocatedSemenVolumeMl(db, collectionId, options);
  if (allocated + deltaSemenMl > raw + 1e-6) {
    throw new Error('Allocated semen volume cannot exceed the collection raw volume.');
  }
}

export async function assertCollectionRawVolumeCanBeUpdated(
  db: SQLite.SQLiteDatabase,
  collectionId: string,
  nextRawVolumeMl: number | null,
): Promise<void> {
  if (nextRawVolumeMl == null) return; // clearing allowed; cap simply disappears
  const allocated = await getAllocatedSemenVolumeMl(db, collectionId);
  if (allocated > nextRawVolumeMl + 1e-6) {
    throw new Error('Raw volume cannot be lower than the allocated semen total.');
  }
}
```

- [ ] **Step 4: Update callers** in `semenCollections.ts`, `collectionDoseEvents.ts` to use the new helpers. `typecheck` should pinpoint all caller sites.

- [ ] **Step 5: Run — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add src/storage/repositories/internal/collectionAllocation.ts \
        src/storage/repositories/semenCollections.ts \
        src/storage/repositories/collectionDoseEvents.ts \
        src/storage/repositories/repositories.test.ts
git commit -m "refactor(repo): volume-based collection allocation cap"
```

---

### Task B4: `collectionWizard` transactional save

**Files:**
- Modify: `src/storage/repositories/collectionWizard.ts`
- Modify: `src/storage/repositories/collectionWizard.test.ts`

Behavior updates:
1. Accept the new payload shape: collection with targets + rows with per-dose volumes.
2. For each shipped row: insert a `shipped` dose event with `doseSemenVolumeMl`, `doseExtenderVolumeMl`, `doseCount`.
3. For each on-farm row: insert a `freshAI` breeding record then a companion `usedOnSite` dose event with `doseSemenVolumeMl` (possibly null), `doseCount = 1`, `doseExtenderVolumeMl = NULL`, linking via `breeding_record_id`.
4. Create-time field mapping for on-farm (per spec):
   - `breeding_records.volume_ml = doseSemenVolumeMl`
   - `breeding_records.concentration_m_per_ml = collection.concentrationMillionsPerMl` snapshot
   - `breeding_records.motility_percent = collection.progressiveMotilityPercent` snapshot
   - `breeding_records.collection_date = collection.collectionDate`
   - `breeding_records.notes = on-farm row notes`
   - `collection_dose_events.event_date = breeding_records.date`
   - `collection_dose_events.notes = breeding_records.notes`
5. In-transaction cap check via new volume helpers (defense in depth). Abort+rollback on violation.

- [ ] **Step 1: Update tests** — replace dose-count cap fixtures with volume-cap fixtures. Add:
  - transactional save with mixed shipped + on-farm rows (verify stored volumes on both tables)
  - in-transaction cap check fires when shipped rows sum > raw volume
  - on-farm breeding record stores `volume_ml = doseSemenVolumeMl` (NOT collection rawVolumeMl)
  - on-farm companion event has `dose_count = 1`, `dose_extender_volume_ml = NULL`
  - targets persisted on the collection
  - snapshot fields (`concentration_m_per_ml`, `motility_percent`) captured on breeding record even if changed later on collection

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Update `collectionWizard.ts`** — reshape input types, rewrite insert block per above. Keep `db.withTransactionAsync` wrapper. Emit the same invalidation events as before (semenCollections, collectionDoseEvents, breedingRecords).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/storage/repositories/collectionWizard.ts src/storage/repositories/collectionWizard.test.ts
git commit -m "feat(repo): collectionWizard transactional save for volume model"
```

---

### Task B5: `breedingRecords` ↔ companion event sync  [subagent: general-purpose]

**Files:**
- Modify: `src/storage/repositories/breedingRecords.ts`
- Create: `src/storage/repositories/breedingRecords.test.ts`

Dispatch subagent with this brief:

> Implement bidirectional sync between `breeding_records` and its companion `usedOnSite` `collection_dose_events` row. Exact rules are in spec section "On-farm lifecycle after save" and "Allocation invariants (updated)". Include:
>
> 1. On UPDATE to a breeding record that has a companion `usedOnSite` event (look it up by `breeding_record_id`), update the companion in the same transaction:
>    - `event_date = breeding_records.date`
>    - `dose_semen_volume_ml = breeding_records.volume_ml` (NULL preserved)
>    - `notes = breeding_records.notes`
> 2. Block these edits on a breeding record with a companion event:
>    - changing `method` away from `'freshAI'`
>    - clearing `collection_id`
>    - switching `collection_id` to a different collection
>    Error messages should be clear and user-facing.
> 3. Rerun the volume cap check (using `assertCollectionVolumeCanSupportAllocation`, excluding the companion event id during recompute) whenever `volume_ml` changes on a linked breeding record.
> 4. DELETE of the breeding record cascades via existing FK; verify the companion is gone.
> 5. `recipient` on the companion is a mare-name **snapshot at creation**, never updated by this sync.
>
> TDD: write tests first. Only touch `src/storage/repositories/breedingRecords.ts` and the new test file. Commit when green.

Test cases required:
- update linked breeding record date → companion event_date updated
- update linked breeding record volume_ml → companion dose_semen_volume_ml updated + cap rechecked
- clear volume_ml → companion dose_semen_volume_ml becomes NULL
- update notes → companion notes updated
- attempt to change method to `shippedCooledAI` → throws, transaction rolled back
- attempt to clear collection_id → throws
- attempt to switch collection_id → throws
- update mare name (via mares repo) → companion `recipient` unchanged
- delete breeding record → companion event is gone (existing FK cascade)
- update breeding record that has **no** companion event (normal freshAI entered mare-side) → works as before, no sync path

- [ ] **Step 1: Write tests**
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement sync + blocks**
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add src/storage/repositories/breedingRecords.ts src/storage/repositories/breedingRecords.test.ts
git commit -m "feat(repo): on-farm breeding record syncs companion usedOnSite event"
```

---

## Phase C — Backup v3

### Task C1: v3 types + fixtures

**Files:**
- Modify: `src/utils/backup/types.ts`
- Modify: `src/utils/backup/testFixtures.ts`

- [ ] **Step 1:** In `types.ts`, add `BackupV3` shape reflecting: `semen_collections` with target fields, no dropped fields; `collection_dose_events` with `doseSemenVolumeMl`/`doseExtenderVolumeMl`. Keep `BackupV2` intact (restore-path only).

- [ ] **Step 2:** In `testFixtures.ts`, add a v3 fixture (reuse the v2 fixture's data where possible, then apply the same row shape transforms the v2→v3 restore path will perform). Keep the v2 fixture for round-trip tests.

- [ ] **Step 3: Commit**

```bash
git add src/utils/backup/types.ts src/utils/backup/testFixtures.ts
git commit -m "feat(backup): v3 types + fixtures"
```

---

### Task C2: Serialize v3  [subagent: general-purpose]

**Files:**
- Modify: `src/utils/backup/serialize.ts`
- Modify: `src/utils/backup/serialize.test.ts`

Dispatch subagent with:

> Update backup serialize to emit v3 (drop the four removed fields on semen_collections, add two target fields; on collection_dose_events add the two volume fields, nullable). Reject backups that can't match v3 shape. TDD: tests first. Only these two files.

- [ ] Steps: update tests → fail → implement → pass → commit.

```bash
git add src/utils/backup/serialize.ts src/utils/backup/serialize.test.ts
git commit -m "feat(backup): serialize v3 with per-dose volumes and targets"
```

---

### Task C3: Restore v2→v3 path  [subagent: general-purpose]

**Files:**
- Modify: `src/utils/backup/restore.ts`
- Modify: `src/utils/backup/restore.test.ts`

Dispatch subagent with:

> Update restore to accept both v2 and v3. v2→v3 path:
> - drop `extended_volume_ml`, `extender_volume_ml`, `dose_count`, `dose_size_millions` from semen_collections rows
> - insert new target fields as NULL
> - canonicalize legacy `usedOnSite` events identically to migration 019 (force dose_count=1, nullify dose_extender_volume_ml and dose_semen_volume_ml, append legacy-collapse note when prior dose_count>1)
> - v3: direct restore
> - unknown keys on v3 are permitted during validation but not preserved (SQLite columns are fixed)
>
> TDD, only these two files.

Tests:
- v2 fixture restored into a fresh DB matches v3 fixture expectations
- v2 legacy usedOnSite with dose_count=3 lands as dose_count=1 with note appended
- v3 fixture restores with no transformation
- unknown key on v3 root (e.g. `__future__`) is ignored, restore succeeds

- [ ] Steps: tests → fail → implement → pass → commit.

```bash
git add src/utils/backup/restore.ts src/utils/backup/restore.test.ts
git commit -m "feat(backup): restore supports v2→v3 migration path"
```

---

### Task C4: Validate — new volume cap + row type rules  [subagent: general-purpose]

**Files:**
- Modify: `src/utils/backup/validate.ts`
- Modify: `src/utils/backup/validate.test.ts`
- Modify: `src/utils/backup/safetyBackups.test.ts` (pin to new shape)

Dispatch subagent with:

> Update backup validator:
> - Replace dose-count cap rule with volume cap rule: for each collection with non-null raw_volume_ml, `SUM(dose_semen_volume_ml * dose_count)` across events with non-null dose_semen_volume_ml ≤ raw_volume_ml. Reject on violation.
> - Enforce usedOnSite rules: dose_extender_volume_ml must be NULL; dose_count must be 1.
> - Keep existing FK integrity rules.
> Only these three files. TDD, commit when green.

- [ ] Steps: tests → fail → implement → pass → update `safetyBackups.test.ts` pins → commit.

```bash
git add src/utils/backup/validate.ts src/utils/backup/validate.test.ts src/utils/backup/safetyBackups.test.ts
git commit -m "feat(backup): v3 validation for volume cap and usedOnSite invariants"
```

---

## Phase D — Wizard UI

### Task D1: `useCollectionWizard` hook — draft shape + validators

**Files:**
- Modify: `src/hooks/useCollectionWizard.ts`

Update draft state to match new wizard shape. Key draft fields:

```ts
type WizardDraft = {
  collectionDate: string;
  rawVolumeMl: string;             // UI-labeled "Total Volume"
  concentrationMillionsPerMl: string;
  progressiveMotilityPercent: string;
  extenderType: string | null;
  notes: string;
  targetMotileSpermMillionsPerDose: string;
  targetPostExtensionConcentrationMillionsPerMl: string;
  shippedRows: ShippedDraftRow[];
  onFarmRows: OnFarmDraftRow[];
};
```

`ShippedDraftRow`:

```ts
{
  id: string;
  recipient: string;
  recipientPhone?: string;
  recipientStreet?: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  carrierService: string;
  containerType: string;
  trackingNumber?: string;
  eventDate: string;          // ship date; defaults from collectionDate
  doseSemenVolumeMl: string;  // required
  doseExtenderVolumeMl: string; // required
  doseCount: string;          // default '1'
  notes?: string;
}
```

`OnFarmDraftRow`:

```ts
{
  id: string;
  mareId: string;
  eventDate: string;            // breeding date; defaults from collectionDate
  doseSemenVolumeMl: string;    // optional
  notes?: string;
  // doseCount is always 1, never on the draft
}
```

Per-step validators:
- Step 1: `collectionDate` required; numeric ranges on optional fields
- Step 2: all fields optional
- Step 3: for each shipped row — recipient, carrier, container, ship date, doseSemenVolumeMl > 0, doseExtenderVolumeMl ≥ 0, doseCount ≥ 1 integer; for each on-farm row — mareId required, no duplicate mare within on-farm list, breeding date required, optional volume ≥ 0; volume cap not exceeded (`computeAllocationSummary(allSemenRows, rawVolumeMl).isWithinCap`).
- Step 4: Save guard = step 3 validator + cap.

Add `rowPrefillFromCalculator(derived: CollectionDerived)` helper used when user taps "Add shipped" / "Add on-farm".

- [ ] **Step 1:** Update hook (no new tests required here — behavior is exercised by screen tests later).
- [ ] **Step 2:** `npm run typecheck` — expect all hook-internal errors resolved.
- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCollectionWizard.ts
git commit -m "refactor(hook): useCollectionWizard draft for volume model"
```

---

### Task D2: Rewrite `CollectionBasicsStep` (Step 1)  [subagent: Frontend Developer]

**Files:**
- Modify: `src/screens/collection-wizard/CollectionBasicsStep.tsx`

Fields (in order): Collection Date (required), Total Volume (mL), Concentration (M/mL, raw), Progressive Motility (%). Remove dose count + dose size + notes fields from this step (notes moves off Step 1; notes now lives on Step 2).

Subagent brief:

> Replace field set of `CollectionBasicsStep.tsx` with the four fields listed above. Use existing `FormDateInput`, `FormNumberField` (or the project's equivalent) from `src/components/FormControls.tsx`. Keep the component contract: consumes `draft` and `setField` from the hook, shows inline errors from the per-step validator. Do not change other files. Commit when typecheck is green.

- [ ] Step 1: Reshape component.
- [ ] Step 2: `npm run typecheck`.
- [ ] Step 3: Commit.

```bash
git commit -m "refactor(wizard): Step 1 Basics for volume model"
```

---

### Task D3: Rebuild `ProcessingDetailsStep` as Live Calculator (Step 2)  [subagent: Frontend Developer]

**Files:**
- Modify: `src/screens/collection-wizard/ProcessingDetailsStep.tsx`
- Modify: `src/screens/collection-wizard/ProcessingDetailsStep.test.tsx` (create if missing)

Subagent brief:

> Rebuild Step 2 per spec section "Step 2 — Processing (Live Calculator)":
> - Pinned chips at top: Total Volume, Concentration, Motility (from `draft`).
> - Inputs: Target motile sperm / dose (M), Target post-extension concentration (M/mL), Extender Type (autocomplete from `EXTENDER_TYPES`), Notes.
> - Derived display panel underneath that reads `deriveCollectionMath(draft)` and shows: `~ N doses possible`, `~ X mL semen per dose`, `~ Y mL extender per dose`. Two-decimal display.
> - Empty state: "Enter a target to see per-dose math." when any of {V, C, M, D, Cpost} missing OR when `C * M = 0`.
> - Warnings (inline, non-blocking): `negative-extender` and `target-exceeds-capacity` with spec-exact copy.
>
> Add a screen-level test: changing targets updates the derived panel live (React Testing Library). Only touch these two files. TDD, commit when green.

- [ ] Steps: write component test first → fail → implement → pass → commit.

```bash
git commit -m "feat(wizard): Step 2 live calculator"
```

---

### Task D4: `ShippedDoseRowEditor` volume fields  [subagent: Frontend Developer]

**Files:**
- Modify: `src/screens/collection-wizard/ShippedDoseRowEditor.tsx`

Brief:

> Add two required numeric fields to the shipped row editor: "Semen per dose (mL)" and "Extender per dose (mL)". Preserve existing fields (recipient block, carrier, container, ship date, dose count, tracking, notes). Add a read-only derived footer inside the editor:
>   - Total per dose: `{semen + extender} mL`
>   - Total semen used by this row: `{semen × count} mL`
>   - Total extender used by this row: `{extender × count} mL`
> Pre-fill of semen/extender is handled by the hook when rows are added — this file just wires `doseSemenVolumeMl` and `doseExtenderVolumeMl` through props.

- [ ] Step 1: Reshape fields.
- [ ] Step 2: typecheck + existing screen tests.
- [ ] Step 3: Commit.

```bash
git commit -m "refactor(wizard): shipped row editor per-dose volumes"
```

---

### Task D5: `OnFarmMareRowEditor` volume + no dose count  [subagent: Frontend Developer]

**Files:**
- Modify: `src/screens/collection-wizard/OnFarmMareRowEditor.tsx`

Brief:

> Fields: Mare (required, unique within on-farm rows), Breeding date (required, defaults from collectionDate), Semen volume (mL) (optional), Notes (optional). No dose count UI. Derived text footer: if volume present, "Semen used: X mL"; else "Semen volume not recorded".

- [ ] Steps: reshape → typecheck → commit.

```bash
git commit -m "refactor(wizard): on-farm row editor without dose count"
```

---

### Task D6: Rebuild `DoseAllocationStep` (Step 3)

**Files:**
- Modify: `src/screens/collection-wizard/DoseAllocationStep.tsx`

Structure (per spec):
- Top summary band driven by `computeAllocationSummary`:
  - `Semen used: X / Y mL`
  - `Remaining: Z mL (~W doses)` where `W = floor(Z / derived.semenPerDoseMl)` when both non-null/positive
  - Append `N row(s) have no volume entered — not counted toward allocation.` if `blankVolumeRowCount > 0`
  - Warning color when `!isWithinCap`; Next button disabled with inline overflow message
  - Show "Total volume not recorded — allocation not capped." when `rawVolumeMl == null`
- List of rows (shipped + on-farm interleaved in add order)
- `+ Add shipped row` — uses `rowPrefillFromCalculator` to seed `doseSemenVolumeMl` and `doseExtenderVolumeMl`
- `+ Add on-farm row` — seeds `doseSemenVolumeMl` only (no extender for on-farm)

- [ ] Step 1: Reshape component.
- [ ] Step 2: typecheck.
- [ ] Step 3: Commit.

```bash
git commit -m "feat(wizard): Step 3 volume-based allocation summary"
```

---

### Task D7: Rebuild `ReviewStep` (Step 4)

**Files:**
- Modify: `src/screens/collection-wizard/ReviewStep.tsx`

Sections per spec:
- Collection (date, volumes, concentration, motility)
- Processing Plan (targets, extender type, notes)
- Shipped rows (recipient + carrier + container + `semen + extender × count`)
- On-farm rows (mare + date + semen volume or "not recorded")
- Totals (semen allocated / total, remaining)
- Calculator warnings if any

Save button disabled when `!isWithinCap`; tapping a section jumps back to the corresponding step.

- [ ] Step 1: Reshape.
- [ ] Step 2: typecheck.
- [ ] Step 3: Commit.

```bash
git commit -m "feat(wizard): Step 4 Review with volume totals"
```

---

### Task D8: `CollectionWizardScreen` shell + screen tests  [subagent: Frontend Developer]

**Files:**
- Modify: `src/screens/CollectionWizardScreen.tsx`
- Modify: `src/screens/CollectionWizardScreen.screen.test.tsx`

Subagent brief (screen-level tests, Jest + RNTL):

> Update the wizard screen test for the new flow. Required test cases:
> 1. All four steps render with expected headings.
> 2. Changing target inputs on Step 2 updates derived display.
> 3. Adding a shipped row on Step 3 after filling Step 2 pre-fills semen/extender per dose.
> 4. Adding an on-farm row pre-fills only semen volume.
> 5. Editing targets on Step 2 *does not* mutate already-added rows; new rows pick up fresh defaults.
> 6. Over-allocation (semen × count sum > rawVolumeMl) disables Save on Step 4 with inline message.
> 7. Collection-only save (no rows) succeeds.
> 8. Targets round-trip through save (assert payload passed to repo mock).
> 9. Same mare cannot be selected twice in on-farm rows (dropdown filters or editor validates).
>
> Assume the wizard screen shell is already wired to the hook; only adjust shell for navigation if needed. TDD. Commit when green.

- [ ] Steps: tests → fail → minimal shell adjustments → pass → commit.

```bash
git commit -m "test(wizard): screen tests for volume-model 4-step flow"
```

---

## Phase E — Edit screen + modal

### Task E1: `CollectionFormScreen` — targets + derived panel  [subagent: Frontend Developer]

**Files:**
- Modify: `src/screens/CollectionFormScreen.tsx`
- Modify: `src/screens/CollectionFormScreen.screen.test.tsx`

Subagent brief:

> Update the single-page edit form for saved collections:
> - Remove fields: dose count, dose size (millions), total/extender volume (mL).
> - Add fields: Target motile sperm per dose (M), Target post-extension concentration (M/mL).
> - Under inputs, add a read-only "Derived" panel that calls `deriveCollectionMath` on current inputs and shows per-dose semen / per-dose extender / dose volume / max doses, same format as Step 2.
> - No dose-event editing here (unchanged).
>
> Screen tests:
> - new fields render, old fields absent
> - editing targets updates derived panel live
> - saving persists targets (assert repo mock payload)
>
> TDD. Commit when green.

- [ ] Steps: tests → fail → implement → pass → commit.

```bash
git commit -m "feat(screen): CollectionForm targets + live derived panel"
```

---

### Task E2: `DoseEventModal` shipped volume fields

**Files:**
- Modify: `src/screens/DoseEventModal.tsx` (or wherever the modal lives under `CollectionsTab`)
- Modify: its test file

For shipped events: add `doseSemenVolumeMl` and `doseExtenderVolumeMl` fields. `usedOnSite` events continue to reject edits (existing behavior). Derived footer inside modal: `Semen total = semen × count`, `Extender total = extender × count`, `Total per dose = semen + extender`.

- [ ] Steps: update tests → fail → implement → pass → commit.

```bash
git commit -m "feat(modal): dose event shipped volume fields"
```

---

### Task E3: Shim or fix downstream mocks + screens that referenced dropped fields

Quick regression sweep. Grep for removed field names and fix each hit:

```bash
grep -rn "totalVolumeMl\|extenderVolumeMl\|doseCount\|doseSizeMillions" src --include='*.ts' --include='*.tsx' | grep -v collection_dose_events
```

Expected hits include `StallionDetailScreen`, `AppNavigator.integration.test.tsx`, any CollectionsTab helpers, any `devSeed`. Update each:
- mocks → new shape
- display → targets or derived-panel values
- `devSeed` → populate `targetMotileSpermMillionsPerDose` / `targetPostExtensionConcentrationMillionsPerMl` instead of old fields

- [ ] Step 1: Sweep.
- [ ] Step 2: `npm run typecheck` + `npm test` + `npm run test:screen` until green.
- [ ] Step 3: Commit.

```bash
git commit -m "chore: drop references to removed collection fields"
```

---

## Phase F — Verification

### Task F1: Full quality gate

- [ ] `npm run typecheck` — green
- [ ] `npm test` — green
- [ ] `npm run test:screen` — green
- [ ] `npm run lint` — green

### Task F2: Manual smoke test on device

Per spec "Verification before merge":

- [ ] Create wizard end-to-end: enter basics, set targets, add shipped + on-farm rows, save, confirm DB contents.
- [ ] Edit saved collection: change a target, confirm derived panel updates and save persists.
- [ ] Edit shipped dose event: change `doseSemenVolumeMl`, confirm cap enforced.
- [ ] Add an on-farm row with blank volume, save; confirm breeding record has `volume_ml = NULL` and companion event has `dose_semen_volume_ml = NULL`.
- [ ] Edit the on-farm linked breeding record: change date, volume, notes → confirm companion `collection_dose_events` row mirrors.
- [ ] Attempt to change the linked breeding record method to `shippedCooledAI` → blocked with clear error.
- [ ] Delete the linked breeding record → companion event is gone.
- [ ] Restore a pre-v3 backup (v2 fixture) → legacy `usedOnSite` with prior `dose_count > 1` lands with note, `dose_count = 1`, extender null.

### Task F3: Update project memory

- [ ] Update `.claude/projects/.../memory/project_stallion_collections.md` to reflect: Phase 2.5a (volume rework) implemented on `feature/collection-wizard`, pending merge to `main`.

---

## Self-review notes

- **Spec coverage:** all sections of the design spec map to tasks — migration 019 (A1), types (A2), pure utils (A3/A4), repo layer (B1–B5 including on-farm lifecycle), backup v3 (C1–C4), wizard UI Steps 1–4 + two row editors + screen test (D1–D8), edit screen + dose modal (E1–E2), regression sweep (E3), verification (F1–F2), memory (F3).
- **Type consistency:** `CollectionInputs.rawVolumeMl` matches spec rename from `totalVolumeMl`; `AllocationRow` fields match repo helper names; hook draft field names match screen-test expectations.
- **Placeholder scan:** no TBDs. Every step has concrete content or an exact grep/command.
- **Subagent dispatch:** tasks marked `[subagent: X]` are genuinely self-contained with explicit file lists and TDD instructions. Tasks that cross many files (B3, D1) run inline.
