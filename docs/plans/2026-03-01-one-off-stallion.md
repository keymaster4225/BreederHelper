# One-Off Stallion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow breeding records to reference a one-off stallion by name instead of requiring a saved stallion entry.

**Architecture:** Add optional `stallion_name` column to `breeding_records`, make `stallion_id` nullable via table recreation migration. Update the BreedingRecord type, repository queries, form screen UI (add "Other" option), and detail screen display logic.

**Tech Stack:** SQLite migration (expo-sqlite), TypeScript types, React Native UI (OptionSelector + FormTextInput).

---

### Task 1: Database Migration

**Files:**
- Modify: `src/storage/migrations/index.ts`

**Step 1: Add migration003 constant**

After the `migration002` constant (line 139), add:

```typescript
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
```

**Step 2: Add migration003 to the migrations array**

In the `migrations` array (after the migration002 entry), add:

```typescript
{
  id: 3,
  name: '003_breeding_stallion_name',
  statements: splitStatements(migration003),
},
```

**Important:** This migration must NOT run inside `withTransactionAsync` because SQLite does not allow `PRAGMA foreign_keys` changes inside transactions, and table recreation with FKs can be tricky. However, the current migration runner wraps each migration in a transaction. Since we're using `DROP TABLE` and `RENAME`, we need the migration runner's transaction. The statements themselves are safe inside a transaction — `PRAGMA foreign_keys` is not involved here because we're not disabling FK enforcement, we're recreating the table with the same FK constraints. The `INSERT INTO ... SELECT` copies data faithfully.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (migration is just strings, no type dependencies yet)

**Step 4: Commit**

```bash
git add src/storage/migrations/index.ts
git commit -m "feat: add migration003 to make stallion_id nullable and add stallion_name"
```

---

### Task 2: Update Type and Repository

**Files:**
- Modify: `src/models/types.ts`
- Modify: `src/storage/repositories/queries.ts`

**Step 1: Update BreedingRecord type**

In `src/models/types.ts`, change the `BreedingRecord` interface:

```typescript
export interface BreedingRecord {
  id: UUID;
  mareId: UUID;
  stallionId: UUID | null;
  stallionName?: string | null;
  date: LocalDate;
  // ... rest unchanged
```

Change `stallionId: UUID;` to `stallionId: UUID | null;` and add `stallionName?: string | null;` right after it.

**Step 2: Update BreedingRecordRow type**

In `src/storage/repositories/queries.ts`, update the `BreedingRecordRow` type:

```typescript
type BreedingRecordRow = {
  id: string;
  mare_id: string;
  stallion_id: string | null;
  stallion_name: string | null;
  date: string;
  // ... rest unchanged
```

Change `stallion_id: string;` to `stallion_id: string | null;` and add `stallion_name: string | null;` after it.

**Step 3: Update mapBreedingRecordRow**

In the `mapBreedingRecordRow` function, add the new field:

```typescript
function mapBreedingRecordRow(row: BreedingRecordRow): BreedingRecord {
  return {
    id: row.id,
    mareId: row.mare_id,
    stallionId: row.stallion_id,
    stallionName: row.stallion_name,
    date: row.date,
    // ... rest unchanged
```

**Step 4: Update all SELECT queries to include stallion_name**

There are 3 SELECT queries for breeding_records. In each, add `stallion_name` to the column list right after `stallion_id`:

1. `getBreedingRecordById` (line ~250): add `stallion_name` after `stallion_id`
2. `listBreedingRecordsByMare` (line ~594): add `stallion_name` after `stallion_id`
3. There may be another query — search for all `FROM breeding_records` SELECTs

The column list should read:
```sql
id, mare_id, stallion_id, stallion_name, date, method, notes, volume_ml, ...
```

**Step 5: Update createBreedingRecord**

Change the input type to accept optional `stallionName`:

```typescript
export async function createBreedingRecord(input: {
  id: string;
  mareId: string;
  stallionId: string | null;
  stallionName?: string | null;
  date: string;
  // ... rest unchanged
```

Update the INSERT query to include `stallion_name`:

```sql
INSERT INTO breeding_records (
  id, mare_id, stallion_id, stallion_name, date, method, notes,
  volume_ml, concentration_m_per_ml, motility_percent,
  number_of_straws, straw_volume_ml, straw_details,
  collection_date, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

And in the params array, add `input.stallionName ?? null` after `input.stallionId`:

```typescript
[
  input.id,
  input.mareId,
  input.stallionId,
  input.stallionName ?? null,
  input.date,
  // ... rest unchanged
```

**Step 6: Update updateBreedingRecord**

Change the input type:

```typescript
export async function updateBreedingRecord(
  id: string,
  input: {
    stallionId: string | null;
    stallionName?: string | null;
    date: string;
    // ... rest unchanged
```

Update the SET clause to include `stallion_name = ?`:

```sql
UPDATE breeding_records
SET
  stallion_id = ?,
  stallion_name = ?,
  date = ?,
  // ... rest unchanged
```

And add `input.stallionName ?? null` to the params after `input.stallionId`.

**Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: May show errors in BreedingRecordFormScreen where `stallionId` was required — that's expected and will be fixed in Task 4.

Check if there are errors. If there are type errors in the form screen, that's OK — we'll fix them in Task 4. The types and queries should be internally consistent.

**Step 8: Commit**

```bash
git add src/models/types.ts src/storage/repositories/queries.ts
git commit -m "feat: update BreedingRecord type and queries for optional stallion_name"
```

---

### Task 3: Update Tests

**Files:**
- Modify: `src/storage/repositories/repositories.test.ts`

**Step 1: Update the mock's breeding record insert handler**

In `createFakeDb()`, find the `if (stmt.startsWith('insert into breeding_records'))` block (around line 305). Update the destructured params to include `stallionName` after `stallionId`:

```typescript
if (stmt.startsWith('insert into breeding_records')) {
  const [
    id,
    mareId,
    stallionId,
    stallionName,
    date,
    method,
    notes,
    volumeMl,
    concentration,
    motility,
    numberOfStraws,
    strawVolumeMl,
    strawDetails,
    collectionDate,
    createdAt,
    updatedAt,
  ] = params as [
    string,
    string,
    string | null,
    string | null,
    string,
    string,
    string | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    string | null,
    string | null,
    string,
    string,
  ];
  breedingRecords.set(id, {
    id,
    mare_id: mareId,
    stallion_id: stallionId,
    stallion_name: stallionName,
    date,
    method,
    notes,
    volume_ml: volumeMl,
    concentration_m_per_ml: concentration,
    motility_percent: motility,
    number_of_straws: numberOfStraws,
    straw_volume_ml: strawVolumeMl,
    straw_details: strawDetails,
    collection_date: collectionDate,
    created_at: createdAt,
    updated_at: updatedAt,
  });
  return;
}
```

**Step 2: Update the BreedingRecordRow-like type in the mock**

Find the `breeding_records` Map type declaration (around line 62-66). Add `stallion_name` field:

```typescript
stallion_id: string | null;
stallion_name: string | null;
```

**Step 3: Add a test for creating a breeding record with stallion_name**

After the existing breeding record tests, add:

```typescript
it('creates breeding record with stallion_name instead of stallionId', async () => {
  await createMare({ id: 'mare-sn', name: 'Bella', breed: 'Thoroughbred' });
  await createBreedingRecord({
    id: 'breed-sn',
    mareId: 'mare-sn',
    stallionId: null,
    stallionName: 'Outside Stallion',
    date: '2026-06-01',
    method: 'liveCover',
  });

  const record = await getBreedingRecordById('breed-sn');
  expect(record).not.toBeNull();
  expect(record?.stallionId).toBeNull();
  expect(record?.stallionName).toBe('Outside Stallion');
});
```

**Step 4: Update the mock's getFirstAsync to handle breeding_records**

In `getFirstAsync`, add a handler for `from breeding_records` (if not already present):

```typescript
if (stmt.includes('from breeding_records') && stmt.includes('where id = ?')) {
  const [id] = params as [string];
  return (breedingRecords.get(id) as T | undefined) ?? null;
}
```

Add this before the `return null;` at the end of `getFirstAsync`.

**Step 5: Run tests**

Run: `npm test`
Expected: All tests pass including the new one.

**Step 6: Commit**

```bash
git add src/storage/repositories/repositories.test.ts
git commit -m "test: add test for breeding record with stallion_name"
```

---

### Task 4: Update BreedingRecordFormScreen UI

**Files:**
- Modify: `src/screens/BreedingRecordFormScreen.tsx`

**Step 1: Add stallionName state**

After the existing `stallionId` state (line 56), add:

```typescript
const [stallionName, setStallionName] = useState('');
```

**Step 2: Add "Other" constant**

Near the top of the component (or as a module-level constant), define:

```typescript
const OTHER_STALLION = '__other__';
```

**Step 3: Update the stallion OptionSelector**

Replace the current stallion field content (lines ~297-308). The new logic:

- Build options array from stallions + an "Other" option at the end
- When "Other" is selected, show a text input for stallion name
- Track selection via `stallionId` state — use `OTHER_STALLION` sentinel when "Other" is picked

```tsx
<FormField label="Stallion" required error={errors.stallionId}>
  {isLoadingStallions ? (
    <ActivityIndicator color={colors.primary} size="large" />
  ) : (
    <>
      <OptionSelector
        value={stallionId || OTHER_STALLION}
        onChange={(value) => {
          if (value === OTHER_STALLION) {
            setStallionId('');
          } else {
            setStallionId(value);
            setStallionName('');
          }
        }}
        options={[
          ...stallions.map((s) => ({ label: s.name, value: s.id })),
          { label: 'Other', value: OTHER_STALLION },
        ]}
      />
      {!stallionId ? (
        <FormTextInput
          value={stallionName}
          onChangeText={setStallionName}
          placeholder="Enter stallion name"
        />
      ) : null}
    </>
  )}
</FormField>
```

**Note:** Remove the old `stallions.length === 0` empty state since "Other" is always available now.

**Step 4: Update validation**

In the `validate` function, change the `stallionId` validation (line ~178):

```typescript
stallionId: stallionId
  ? undefined
  : (validateRequired(stallionName.trim(), 'Stallion name') ?? undefined),
```

This means: if a saved stallion is selected, no error. If not, the typed stallion name must be non-empty.

**Step 5: Update the save payload**

In `onSave`, update the payload to send the right stallion fields:

```typescript
const payload = {
  stallionId: stallionId || null,
  stallionName: stallionId ? null : stallionName.trim() || null,
  date: date.trim(),
  // ... rest unchanged
```

**Step 6: Update edit mode data loading**

In the `useEffect` that loads an existing record (lines ~109-155), after `setStallionId(record.stallionId)`, handle the case where the record has a `stallionName` instead:

```typescript
setStallionId(record.stallionId ?? '');
setStallionName(record.stallionName ?? '');
```

Replace `setStallionId(record.stallionId);` with the above two lines.

**Step 7: Fix default stallion selection on new records**

In the `useEffect` that loads stallions (lines ~76-107), the line `setStallionId(rows[0].id)` sets a default. Keep this — if stallions exist, default to the first one. If no stallions exist, `stallionId` stays `''` which will show the "Other" text input by default.

**Step 8: Fix the save button disabled condition**

Currently the save button is disabled when `stallions.length === 0`. Remove this condition since the user can always use "Other":

```tsx
<PrimaryButton
  label={isSaving ? 'Saving...' : 'Save'}
  onPress={onSave}
  disabled={isSaving}
/>
```

**Step 9: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS

**Step 10: Commit**

```bash
git add src/screens/BreedingRecordFormScreen.tsx
git commit -m "feat: add 'Other' stallion option to breeding record form"
```

---

### Task 5: Update MareDetailScreen Display

**Files:**
- Modify: `src/screens/MareDetailScreen.tsx`

**Step 1: Update stallion name resolution in breeding cards**

Find the line that displays the stallion name in breeding record cards (currently around line 142):

```tsx
{renderCardRow('Stallion', stallionNameById[record.stallionId] ?? 'Unknown')}
```

Replace with:

```tsx
{renderCardRow('Stallion', record.stallionName ?? stallionNameById[record.stallionId ?? ''] ?? 'Unknown')}
```

This prefers `stallionName` (the one-off name) when set, falls back to the saved stallion lookup, and finally falls back to "Unknown".

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/screens/MareDetailScreen.tsx
git commit -m "feat: display one-off stallion name in breeding record cards"
```

---

### Task 6: Final Verification

**Step 1: Run full quality checks**

Run: `npm run typecheck && npm test`
Expected: All pass.

**Step 2: Visual smoke test**

Run: `npm start` or `npm run android`
Verify:
- Open breeding record form: stallion pills show saved stallions + "Other" at end
- Tap "Other": text input appears for stallion name
- Tap a saved stallion: text input disappears
- Save with "Other" + typed name: saves successfully
- Edit that record: "Other" is selected, typed name is populated
- Mare detail: breeding card shows the typed stallion name
- Save with no stallions at all (empty stallion list): "Other" + text input still works
