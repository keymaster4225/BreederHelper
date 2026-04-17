docs\plans\2026-04-16-backup-restore-design-revised.md# Backup & Restore Design (Revised)

**Date:** 2026-04-16  
**Status:** Proposed  
**Supersedes:** `docs/plans/2026-04-10-full-data-backup-restore-design.md` and the external brainstorming draft at `~/.claude/plans/gentle-munching-marble.md`

## Summary

Phase 1 adds a manual backup and full-replace restore flow for BreedWise.

This revision keeps the user decisions from brainstorming:

- manual backup/restore in Phase 1
- backup saved locally and then offered to the OS share sheet
- restore is full replace only, no merge
- entry point lives under a new `Settings` bottom tab
- restore creates an automatic local safety snapshot and keeps the latest 3
- newer backup schemas are rejected

This design changes the implementation approach so it matches the current repo and preserves data correctly:

- backups store **raw database rows**, not repository-shaped domain objects
- restore uses **direct SQL inserts inside one SQLite transaction**, not repository create/update helpers
- onboarding restore is handled explicitly as **non-transactional AsyncStorage state**
- post-restore UI refresh uses `emitDataInvalidation('all')` plus a user-facing reopen prompt, rather than pretending every mounted screen will refresh perfectly

## Goals

- Give the user reliable local disaster recovery for all breeding data.
- Preserve the exact current SQLite dataset, including soft-deleted mares/stallions and raw JSON-backed columns.
- Make restore deterministic and easy to reason about.
- Keep Phase 1 compatible with future automated/cloud backup work.

## Non-Goals

- encryption or password protection
- automatic cloud sync or scheduled backup
- merge restore
- best-effort restore across unknown future backup schemas
- backing up `schema_migrations` or diagnostic AsyncStorage keys

## Repo Constraints That Drive The Design

- SQLite is opened through [src/storage/db.ts](/home/keymaster4225/BreederHelper/src/storage/db.ts:9); there is no higher-level backup transaction helper today.
- Onboarding state lives in AsyncStorage via [src/utils/onboarding.ts](/home/keymaster4225/BreederHelper/src/utils/onboarding.ts:1), not in SQLite.
- Mare and stallion soft-deletes are persisted via `deleted_at`, but only mares currently expose an include-deleted list API.
- Several persisted fields are not 1:1 with domain objects:
  - `daily_logs.ovulation_detected` and `pregnancy_checks.heartbeat_detected` are stored as integer flags.
  - `foals.milestones` and `foals.igg_tests` are stored as JSON text.
  - breeding records allow nullable `stallion_id` with required `stallion_name` fallback.
- The app already has invalidation fanout through [src/storage/dataInvalidation.ts](/home/keymaster4225/BreederHelper/src/storage/dataInvalidation.ts:1), but not every mounted detail/form screen subscribes to it.

These constraints make repository-shaped export/import the wrong abstraction for recovery.

## Design Principles

### 1. Fidelity over pretty JSON

The backup file is an internal recovery artifact, not a user-edited interchange format. It should mirror the persisted schema closely enough that restore can reinsert exact values without lossy transforms.

### 2. Backup schema version is separate from SQLite migration IDs

`schemaVersion` tracks the JSON backup format. If the backup row shape changes, bump `schemaVersion` even if SQLite migrations already exist for the app.

### 3. Do not over-promise atomicity

The SQLite table replace is atomic. AsyncStorage writes are not. Phase 1 will be explicit about that.

### 4. Keep backup logic isolated from feature repositories

Backup/restore should not pollute the normal CRUD repositories with raw-row APIs that only recovery needs.

### 5. Backward restore compatibility is a product commitment

Phase 1 ships `schemaVersion: 1`. Future app versions may export newer backup schemas, but they should continue to restore v1 backups unless the product explicitly declares old backups unsupported.

## UX And Navigation

### Navigation

- Add `Settings: undefined` to `TabParamList`
- Add `DataBackup: undefined` to `RootStackParamList`
- Update [src/navigation/TabNavigator.tsx](/home/keymaster4225/BreederHelper/src/navigation/TabNavigator.tsx:1) to add a 4th tab after `Stallions`
- Add `SettingsScreen` as the tab root
- Push `DataBackupScreen` from `SettingsScreen` using the root stack

### SettingsScreen

Minimal settings hub for Phase 1:

- title: `Settings`
- one card row: `Data Backup & Restore`
- tapping the row navigates to `DataBackup`

This preserves room for later settings without turning backup UI into a permanent tab root.

### DataBackupScreen

Primary actions:

- `Create Backup`
- `Restore From File`

Secondary content:

- short explanation that restore fully replaces local data
- recent safety snapshots list (up to 3 entries)
- each safety snapshot entry shows:
  - created timestamp
  - mare count
  - `Restore Snapshot` action

Operation state:

- while backup or restore is running, disable `Create Backup`, `Restore From File`, and all `Restore Snapshot` actions
- show inline progress state during long-running work, with step text such as:
  - `Reading backup...`
  - `Validating backup...`
  - `Creating safety snapshot...`
  - `Restoring data...`

Restore preview:

- after a picked file validates successfully, show a one-line summary before destructive confirmation
- summary should include at least:
  - backup created timestamp
  - mare count
  - daily log count
  - whether onboarding was complete in the backup

Platform caveat:

- on Android, the initial local write lives in app-private storage and can disappear if the app is uninstalled
- the share/export step is the durable copy the user should keep outside the app

Restore confirmation copy:

- first dialog: `This will replace all current data. Continue?`
- second dialog or destructive confirmation button before execution

Success copy:

- `Restore complete. Returning to dashboard. Close and reopen the app if anything still looks stale.`

## Backup Artifact

### Filename conventions

Manual backups:

- `breedwise-backup-v1-YYYYMMDD-HHmmss.json`

Automatic safety snapshots:

- `breedwise-safety-backup-v1-YYYYMMDD-HHmmss.json`

### Envelope

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-04-16T20:00:00.000Z",
  "app": { "name": "BreedWise", "version": "0.2.0" },
  "settings": { "onboardingComplete": true },
  "tables": {
    "mares": [],
    "stallions": [],
    "daily_logs": [],
    "breeding_records": [],
    "pregnancy_checks": [],
    "foaling_records": [],
    "foals": [],
    "medication_logs": [],
    "semen_collections": [],
    "collection_dose_events": []
  }
}
```

`app.version` is informational metadata for support/debugging. Phase 1 does not use it to allow or block restore.

### Canonical row format

Every row in `tables` uses the **raw persisted column names and persisted value types** from the current live schema.

Examples:

- `mares.deleted_at` stays `string | null`
- `daily_logs.ovulation_detected` stays `0 | 1 | null`
- `pregnancy_checks.heartbeat_detected` stays `0 | 1 | null`
- `foals.milestones` stays JSON text, not parsed object
- `foals.igg_tests` stays JSON text, not parsed array

This keeps restore deterministic and avoids domain-to-storage re-encoding bugs.

## Data Coverage

Included tables:

- `mares`
- `stallions`
- `daily_logs`
- `breeding_records`
- `pregnancy_checks`
- `foaling_records`
- `foals`
- `medication_logs`
- `semen_collections`
- `collection_dose_events`

Included settings:

- AsyncStorage key `onboarding_complete` mapped to `settings.onboardingComplete`

Explicitly excluded:

- `schema_migrations`
- AsyncStorage key `startup_error_latest`

## Implementation Architecture

### New modules

- `src/screens/SettingsScreen.tsx`
- `src/screens/DataBackupScreen.tsx`
- `src/hooks/useDataBackup.ts`
- `src/utils/backup/types.ts`
- `src/utils/backup/serialize.ts`
- `src/utils/backup/validate.ts`
- `src/utils/backup/restore.ts`
- `src/utils/backup/fileIO.ts`
- `src/utils/backup/safetyBackups.ts`

### Modified modules

- `src/navigation/TabNavigator.tsx`
- `src/navigation/AppNavigator.tsx`
- `src/utils/onboarding.ts`
- `package.json`
- `jest.setup.ts`

### `types.ts`

Defines:

- `BackupEnvelopeV1`
- raw table row types for all 10 tables
- `ValidateBackupResult`
- `RestoreBackupResult`
- `SafetySnapshotSummary`

Row types should mirror the live schema exactly, in `snake_case`.

### `serialize.ts`

Responsibilities:

- get `db` from `getDb()`
- run direct `SELECT` queries against each managed table
- preserve raw columns exactly as stored
- read onboarding state from AsyncStorage
- assemble the envelope

Important: `serialize.ts` must **not** use CRUD repositories for row export. The repositories return transformed domain objects and currently do not expose everything backup needs.

### `validate.ts`

Responsibilities:

- parse unknown JSON into `BackupEnvelopeV1`
- reject unsupported `schemaVersion`
- verify all required top-level keys and table arrays
- validate each row shape per table
- enforce internal FK coherence and important cross-row invariants
- return structured, user-visible validation errors that name the table, row index, and reason when validation reaches row-level data

### `restore.ts`

Responsibilities:

- validate candidate payload
- optionally create a safety snapshot first
- replace managed SQLite tables inside one transaction
- restore onboarding state after commit
- emit `emitDataInvalidation('all')`
- return success or warning status for UI

Important: `restore.ts` must insert rows directly with SQL, not call repository helpers. Repository helpers would:

- rewrite timestamps
- generate IDs in some paths
- enforce interactive CRUD rules that are wrong for historical restore
- emit invalidation events many times instead of once
- reject legitimate backup states such as soft-deleted parent records included for fidelity

### `fileIO.ts`

Thin wrapper around:

- `expo-file-system`
- `expo-sharing`
- `expo-document-picker`

The wrapper should hide package-specific details from the rest of the app.

Key behaviors:

- backup export always writes locally first
- share sheet is attempted after local write
- if sharing is unavailable, the backup still counts as successful
- document picker uses a local readable URI and validates content after read, not by MIME type alone

### `safetyBackups.ts`

Responsibilities:

- create safety snapshot envelope using the same serializer as normal backup
- write safety snapshot to `${FileSystem.documentDirectory}safety-snapshots/`
- list recent snapshots with parsed metadata for UI
- best-effort retention cleanup to the newest 3 files

Retention cleanup failure should **not** block restore after a valid safety snapshot has been created. Blocking on file deletion would be disproportionate and would not protect data any further.

Phase 1 uses a count-based ceiling only: newest 3 snapshots, no separate byte-size cap. That bounds snapshot storage to roughly 3x the current full-backup size.

## Validation Rules

### Envelope-level checks

- Phase 1 exports and restores `schemaVersion: 1`
- in Phase 1, any other `schemaVersion` value is unsupported
- if `schemaVersion > maxSupportedSchemaVersion`, show: `This backup was created with a newer version of BreedWise. Please update the app.`
- future app versions should keep support for `schemaVersion: 1` restores even if they export a newer schema
- `createdAt`, `app`, `settings`, and `tables` must exist
- all 10 table arrays must exist

### Row-level checks

Validate exact current schema expectations, including nullability and enums.

Examples:

- `mares.name` and `mares.breed` are required strings
- `stallions.name` is required
- local dates must parse as real calendar dates in `YYYY-MM-DD`, not just match the shape
- integer flag columns must be `0 | 1 | null`
- `collection_dose_events.event_type` must be `shipped | usedOnSite`
- `collection_dose_events.dose_count`, if present, must be `> 0`
- `breeding_records.method` must be one of the four current enum values
- `breeding_records.number_of_straws` rules for `frozenAI` must match current schema
- `breeding_records.straw_volume_ml`, if present, may be any finite numeric value accepted by SQLite on existing installs, including integer or real forms
- `foaling_records.outcome` must accept the persisted enum set `liveFoal | stillbirth | aborted | unknown`
- `foals.birth_weight_lbs`, if present, must be `> 0`

### Cross-table checks

- build `Map`/`Set` indexes per table up front so cross-table validation remains linear in total row count
- IDs are unique within each table
- `daily_logs` must remain unique by `(mare_id, date)`
- every child FK points at an existing parent row in the same backup
- `pregnancy_checks.mare_id` must match the referenced breeding record’s `mare_id`
- `foaling_records.mare_id` must match the referenced breeding record’s `mare_id` when a breeding record exists
- `breeding_records.collection_id`, if present, must reference an existing semen collection
- `breeding_records.collection_id`, if present, must belong to the same `stallion_id`
- `breeding_records` must satisfy the current invariant: `stallion_id` or `stallion_name` must be present
- `foals` remain 1:1 by unique `foaling_record_id`

### Validation error reporting

Validation failures should be specific enough for a user or developer to diagnose a bad file.

Examples:

- `mares[3].date_of_birth: invalid calendar date`
- `daily_logs[41]: duplicate (mare_id, date) pair`
- `breeding_records[2].collection_id: references missing semen collection`

### JSON-backed column checks

For `foals.milestones` and `foals.igg_tests`:

- the stored value must be valid JSON text
- parse and validate using the existing foal codec helpers where practical
- reserialize is not required during validation; only semantic correctness matters

## Restore Semantics

Restore is full replace only.

### Restore from picked file

1. User chooses a file via document picker.
2. App reads the file as text.
3. App parses and validates the envelope.
4. If validation fails, no writes occur and the UI surfaces the exact validation error.
5. App shows a restore preview summary.
6. User confirms destructive restore.
7. App creates a safety snapshot of current data.
8. App replaces managed SQLite tables in one transaction.
9. App writes onboarding state to AsyncStorage after the transaction commits.
10. App emits `emitDataInvalidation('all')`.
11. App resets navigation to a stable screen and shows completion messaging.

### Restore from safety snapshot

Same flow, except:

- no document picker step
- no extra safety snapshot is created first

This avoids infinite safety-backup chains.

### Delete order inside the transaction

Delete child tables before parents:

The explicit delete of `collection_dose_events` is redundant because `collection_id` cascades from `semen_collections`, but Phase 1 keeps it for readability and to avoid relying on implicit cascade behavior during restore.

1. `collection_dose_events`
2. `foals`
3. `pregnancy_checks`
4. `foaling_records`
5. `medication_logs`
6. `daily_logs`
7. `breeding_records`
8. `semen_collections`
9. `mares`
10. `stallions`

### Insert order inside the transaction

Insert parents before children:

1. `mares`
2. `stallions`
3. `semen_collections`
4. `breeding_records`
5. `daily_logs`
6. `medication_logs`
7. `pregnancy_checks`
8. `foaling_records`
9. `foals`
10. `collection_dose_events`

## Onboarding State Handling

Phase 1 needs a more general onboarding helper.

Update [src/utils/onboarding.ts](/home/keymaster4225/BreederHelper/src/utils/onboarding.ts:1) to expose:

- `getOnboardingComplete()`
- `setOnboardingComplete()`
- `setOnboardingCompleteValue(value: boolean)`

Restore behavior:

- SQLite restore commits first
- onboarding AsyncStorage is written second

This means the restore contract is:

- **database replace is atomic**
- **onboarding state write is best-effort after commit**

If onboarding write fails after commit:

- the user’s recovered breeding data is still intact
- the screen shows a warning
- because onboarding is non-critical UI state, the app does not attempt to roll back the database

## UI Refresh Strategy After Restore

After successful restore:

- call `emitDataInvalidation('all')`
- reset navigation with `navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } }] })`
- show completion alert with reopen guidance

Why both?

- invalidation refreshes list/dashboard screens that already subscribe
- navigation reset gets the user off potentially stale detail/form routes
- the explicit reopen prompt covers any still-mounted view that does not subscribe today

## Package Changes

Add:

- `expo-file-system`
- `expo-sharing`
- `expo-document-picker`

No other new runtime dependency is required for Phase 1.

## Testing Strategy

### Unit tests (Vitest)

- `validate.ts`
  - accepts valid v1 envelope
  - rejects missing top-level keys
  - rejects missing table arrays
  - rejects unsupported schema version
  - rejects impossible calendar dates
  - rejects duplicate `daily_logs (mare_id, date)` pairs
  - rejects broken FK references
  - rejects invalid breeding-record collection/stallion combinations
  - accepts `foaling_records.outcome = unknown`
  - accepts integer or real `straw_volume_ml`
  - rejects malformed foal JSON columns
  - returns row-specific validation errors
- `serialize.ts`
  - preserves raw row fields exactly
  - includes soft-deleted mares/stallions
  - includes onboarding setting
- `safetyBackups.ts`
  - creates snapshot
  - returns UI summary with timestamp and mare count
  - best-effort retention keeps newest 3 when deletes succeed

### Restore integration tests (Vitest with fake DB)

Follow the existing repository/migration test pattern: fake `db` object with `getAllAsync`, `runAsync`, and `withTransactionAsync`.

Cover:

- delete order is FK-safe
- insert order is FK-safe
- transaction rollback on injected insert failure
- onboarding setter is called only after successful commit
- `emitDataInvalidation('all')` fires once on success
- restoring a safety snapshot skips creating another safety snapshot
- export -> wipe -> restore -> export round-trip preserves envelope contents aside from expected metadata that changes at export time

### Screen tests (Jest + RNTL)

- `SettingsScreen`
  - renders `Data Backup & Restore`
  - navigates to `DataBackup`
- `DataBackupScreen`
  - create backup triggers hook action
  - buttons and snapshot actions are disabled while an operation is in progress
  - restore path shows validated preview summary before destructive confirmation
  - restore path shows destructive confirmation
  - safety snapshot list renders
  - snapshot restore action triggers hook path
- `AppNavigator.integration.test.tsx`
  - verifies the new `Settings` tab is present and reachable

### Jest setup changes

Update [jest.setup.ts](/home/keymaster4225/BreederHelper/jest.setup.ts:1) to mock:

- `expo-file-system`
- `expo-sharing`
- `expo-document-picker`

## File Layout

### New files

- `src/screens/SettingsScreen.tsx`
- `src/screens/DataBackupScreen.tsx`
- `src/hooks/useDataBackup.ts`
- `src/utils/backup/types.ts`
- `src/utils/backup/serialize.ts`
- `src/utils/backup/validate.ts`
- `src/utils/backup/restore.ts`
- `src/utils/backup/fileIO.ts`
- `src/utils/backup/safetyBackups.ts`

### Modified files

- `src/navigation/TabNavigator.tsx`
- `src/navigation/AppNavigator.tsx`
- `src/utils/onboarding.ts`
- `src/navigation/AppNavigator.integration.test.tsx`
- `jest.setup.ts`
- `package.json`

## Implementation Sequence

1. Add the three Expo packages and Jest mocks.
2. Add `setOnboardingCompleteValue` to onboarding storage.
3. Define raw backup row types and the envelope contract.
4. Build `serialize.ts` with direct SQL export and onboarding capture.
5. Build `validate.ts` with structural, semantic, and cross-table checks.
6. Build `fileIO.ts` wrappers and `safetyBackups.ts`.
7. Build `restore.ts` with transaction, onboarding write, invalidation, and result states.
8. Add `useDataBackup.ts`.
9. Add `SettingsScreen` and `DataBackupScreen`.
10. Wire `Settings` tab and `DataBackup` stack route.
11. Add unit, integration, and screen tests.
12. Run `npm run typecheck`, `npm test`, `npm run test:screen`, and `npm run lint`.

## Why This Plan Is Safer Than The Previous Draft

- It does not rely on repository APIs that do not exist.
- It does not confuse domain objects with persisted rows.
- It does not claim full atomicity across SQLite and AsyncStorage.
- It uses existing invalidation infrastructure where helpful, but still plans for stale mounted screens.
- It isolates recovery logic so normal CRUD code stays clean.
