# Backup & Restore Implementation Plan

**Date:** 2026-04-16  
**Status:** Ready for implementation  
**Source Spec:** `docs/plans/2026-04-16-backup-restore-design-revised.md`

## Goal

Implement Phase 1 manual backup and full-replace restore for BreedWise using raw SQLite row export/import, explicit onboarding-state backup, safety snapshots, and a new Settings entry point.

## Repo Fit

This plan is grounded in the current codebase:

- SQLite access already flows through `src/storage/db.ts` and direct repository SQL.
- App navigation lives in `src/navigation/AppNavigator.tsx` and `src/navigation/TabNavigator.tsx`.
- Screen data orchestration already uses hook-first patterns such as `src/hooks/useDashboardData.ts` and `src/hooks/useHomeScreenData.ts`.
- Screen tests use Jest + RNTL and central mocks in `jest.setup.ts`.
- Storage/repository integration tests already use fake DB objects in `src/storage/repositories/repositories.test.ts`.

The backup feature should follow those patterns instead of introducing a second architecture.

## Recommended Technical Shape

- Keep backup domain logic in `src/utils/backup/*`.
- Keep `useDataBackup.ts` focused on orchestration and async state, not navigation.
- Keep navigation reset, alerts, and destructive-confirm UI in `DataBackupScreen`.
- Use explicit SQL column lists for export/import instead of `SELECT *` or repository helpers.
- Validate backup payloads before any writes and return row-specific errors.
- Treat onboarding as a separate storage concern that is restored after the SQLite transaction commits.

## Delivery Strategy

Implement in six waves so dependencies stay clean and the app remains testable after each checkpoint.

### Wave 1: Foundations

1. Runtime dependencies and Jest mocks
2. Onboarding helper expansion
3. Backup contract and shared types

### Wave 2: Core backup logic

4. Raw-row serializer
5. Backup validator
6. File I/O wrapper

### Wave 3: Restore engine

7. Safety snapshot management
8. Restore transaction flow

### Wave 4: App-facing orchestration

9. `useDataBackup` hook
10. `SettingsScreen`
11. `DataBackupScreen`

### Wave 5: Navigation and screen wiring

12. Navigation updates and integration coverage

### Wave 6: Final verification

13. Full test/lint/typecheck run and manual device QA

## Task Breakdown

### Task 1: Add Expo dependencies and test scaffolding

**Files**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `jest.setup.ts`

**Implementation**

- Install Expo-compatible versions of:
  - `expo-file-system`
  - `expo-sharing`
  - `expo-document-picker`
- Prefer `npx expo install expo-file-system expo-sharing expo-document-picker` so versions match SDK 55.
- Extend `jest.setup.ts` with mocks for all three packages.
- Mock only the APIs the backup flow actually uses:
  - file reads/writes and directory creation
  - sharing availability and share call
  - document picker result payloads

**Acceptance criteria**

- TypeScript resolves all three packages.
- Screen/unit tests can import backup modules without native-module failures.
- Existing tests still boot after the new mocks are added.

**Suggested verification**

- `npm run typecheck`
- `npm run test:screen -- AppNavigator.integration.test.tsx`

### Task 2: Expand onboarding storage helpers

**Files**

- Modify: `src/utils/onboarding.ts`
- Modify: `src/utils/onboarding.test.ts`

**Implementation**

- Keep the existing public helpers:
  - `getOnboardingComplete()`
  - `setOnboardingComplete()`
- Add `setOnboardingCompleteValue(value: boolean)`.
- Implement `setOnboardingComplete()` as a thin convenience wrapper over the new setter so storage behavior remains centralized.
- Keep the AsyncStorage key unchanged: `onboarding_complete`.

**Acceptance criteria**

- Backup/restore code can write either `true` or `false`.
- Existing onboarding callers continue to work unchanged.
- Tests cover both `true` and `false` writes.

**Suggested verification**

- `npm test -- src/utils/onboarding.test.ts`

### Task 3: Define backup contract and shared types

**Files**

- Create: `src/utils/backup/types.ts`

**Implementation**

- Define `BackupEnvelopeV1`.
- Define raw row types for all managed tables using persisted `snake_case` field names:
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
- Define result/helper types the rest of the feature will share:
  - `BackupSettings`
  - `BackupTableName`
  - `ValidateBackupResult`
  - `ValidateBackupError`
  - `BackupPreviewSummary`
  - `RestoreBackupResult`
  - `SafetySnapshotSummary`
- Add shared constants for ordered managed tables so serializer, validator, and restore stay aligned.

**Important detail**

- Do not reuse domain interfaces from `src/models/types.ts`. Those are camelCase view models and will blur the storage boundary the spec is trying to preserve.

**Acceptance criteria**

- All later modules can depend on one shared contract file.
- Table names and row types map 1:1 to the live schema.

### Task 4: Implement raw-row serializer

**Files**

- Create: `src/utils/backup/serialize.ts`
- Create: `src/utils/backup/serialize.test.ts`

**Implementation**

- Query `getDb()` directly from `src/storage/db.ts`.
- Export raw rows via explicit `SELECT column_a, column_b... FROM table` statements.
- Use explicit column lists, not `SELECT *`, to protect against accidental column-order drift.
- Read onboarding state via `getOnboardingComplete()`.
- Build the full `BackupEnvelopeV1`.
- Preserve all persisted values as stored:
  - integer flags remain `0 | 1 | null`
  - JSON-backed columns remain raw JSON strings
  - soft-deleted rows remain included
  - numeric fields remain whatever SQLite returns on the device

**Test focus**

- soft-deleted mares are included
- soft-deleted stallions are included even though normal UI listing hides them
- raw JSON columns are not parsed or normalized
- `straw_volume_ml` survives numeric affinity differences
- onboarding state is included in `settings`

**Acceptance criteria**

- A serialized envelope is sufficient for direct restore without repository transforms.
- Serializer tests prove fidelity instead of domain-shape convenience.

**Suggested verification**

- `npm test -- src/utils/backup/serialize.test.ts`

### Task 5: Implement strict validator

**Files**

- Create: `src/utils/backup/validate.ts`
- Create: `src/utils/backup/validate.test.ts`

**Implementation**

- Parse unknown JSON safely into a candidate envelope.
- Reject unsupported schema versions.
- Validate required top-level keys and presence of all 10 table arrays.
- Enforce row-level shape rules for every table.
- Add strict local-date validation:
  - shape must be `YYYY-MM-DD`
  - date must also be a real calendar date
- Validate enum drift correctly:
  - allow `foaling_records.outcome = unknown`
  - allow both integer and real numeric forms for `breeding_records.straw_volume_ml`
- Enforce cross-row invariants with prebuilt `Map` and `Set` indexes for linear-time checks.
- Explicitly validate:
  - unique table IDs
  - unique `daily_logs (mare_id, date)`
  - FK existence
  - mare consistency across linked breeding/pregnancy/foaling rows
  - `collection_id` and `stallion_id` consistency
  - 1:1 `foals.foaling_record_id`
- Validate `foals.milestones` and `foals.igg_tests` by parsing the JSON text and reusing the semantics in `src/storage/repositories/internal/foalCodecs.ts` where practical.
- Return row-specific errors shaped for UI display and debugging.

**Recommended helper split inside the file**

- envelope parser
- primitive validators
- strict local-date validator
- per-table row validators
- cross-table validation pass
- preview-summary builder

**Test focus**

- unsupported schema versions
- impossible calendar dates
- duplicate `daily_logs (mare_id, date)`
- broken FK references
- wrong mare linkage across breeding/pregnancy/foaling records
- `unknown` foaling outcome acceptance
- integer vs real `straw_volume_ml` acceptance
- malformed JSON columns
- row-specific error messages

**Acceptance criteria**

- Validation failure happens before any write path.
- The UI can show a concrete error without guessing where the file is bad.

**Suggested verification**

- `npm test -- src/utils/backup/validate.test.ts`

### Task 6: Implement file I/O wrapper

**Files**

- Create: `src/utils/backup/fileIO.ts`

**Implementation**

- Wrap Expo modules behind app-level functions so screens/hooks never talk to Expo APIs directly.
- Add helpers for:
  - ensuring backup directories exist
  - writing JSON text to app-private storage
  - reading text from a local URI
  - launching the share sheet if available
  - opening document picker and normalizing result payloads
  - listing/deleting files for safety snapshot retention
- Keep the wrapper thin. Business rules belong in `useDataBackup`, `safetyBackups`, and `restore`, not here.

**Acceptance criteria**

- Callers can treat file operations as app-level functions with predictable return values.
- Sharing unavailable is treated as non-fatal.

**Testing note**

- Standalone unit tests are optional if the wrapper stays thin.
- Wrapper behavior will be exercised through `safetyBackups`, `useDataBackup`, and screen tests.

### Task 7: Implement safety snapshot management

**Files**

- Create: `src/utils/backup/safetyBackups.ts`
- Create: `src/utils/backup/safetyBackups.test.ts`

**Implementation**

- Create snapshots by reusing the same serializer as normal backup.
- Store them in `${FileSystem.documentDirectory}safety-snapshots/`.
- List recent snapshots by reading files, validating them, and deriving UI summary data from the envelope:
  - created timestamp
  - mare count
  - path/identifier needed for restore
- Keep only the newest 3 snapshots.
- If retention cleanup fails after a valid snapshot is written, log/return the problem but do not block restore.

**Important detail**

- No separate metadata sidecar file is needed in Phase 1. Parse the stored backup file itself for summary data.

**Test focus**

- snapshot creation
- summary derivation
- retention pruning when deletes succeed
- retention failure does not fail the overall snapshot flow

**Acceptance criteria**

- Safety snapshots are reusable as restore inputs.
- Snapshot listing is deterministic and UI-ready.

**Suggested verification**

- `npm test -- src/utils/backup/safetyBackups.test.ts`

### Task 8: Implement restore transaction engine

**Files**

- Create: `src/utils/backup/restore.ts`
- Create: `src/utils/backup/restore.test.ts`

**Implementation**

- Accept a candidate envelope or raw file content plus options indicating whether this is a picked-file restore or safety-snapshot restore.
- Validate before any writes.
- For file-based restore:
  - create a safety snapshot first
- For safety-snapshot restore:
  - skip snapshot creation to avoid recursive chains
- Replace managed tables inside one `db.withTransactionAsync(...)` block.
- Use explicit delete order and insert order from the spec.
- Insert via direct SQL with explicit column lists and parameter arrays.
- Restore onboarding state only after the transaction commits.
- Emit one `emitDataInvalidation('all')` after successful restore.
- Return a structured result that surfaces:
  - success/failure
  - warning text if onboarding persistence fails
  - whether a safety snapshot was created
  - preview counts or metadata useful to the screen

**Recommended internal structure**

- `restoreBackup(payload, options)`
- `replaceManagedTables(db, envelope)`
- `deleteManagedTables(db)`
- `insertManagedTables(db, envelope)`
- one insert helper per table or a shared table-spec map

**Test focus**

- FK-safe delete order
- FK-safe insert order
- rollback on injected insert failure
- onboarding setter called only after commit
- `emitDataInvalidation('all')` called once
- safety snapshot skipped on snapshot restore
- export -> wipe -> restore -> export round-trip matches data content apart from expected metadata drift

**Acceptance criteria**

- Restore does not depend on CRUD repositories.
- Transaction boundary is honest and test-proven.

**Suggested verification**

- `npm test -- src/utils/backup/restore.test.ts`

### Task 9: Add `useDataBackup` orchestration hook

**Files**

- Create: `src/hooks/useDataBackup.ts`

**Implementation**

- Follow the existing hook-first data loading style used by `useDashboardData.ts` and `useHomeScreenData.ts`.
- Centralize:
  - busy state
  - progress-step label
  - snapshot loading
  - backup creation flow
  - picked-file read/validate/preview flow
  - restore execution flow
- Keep navigation and alerts out of the hook. Return structured state/actions the screen can render around.

**Recommended hook surface**

- `isBusy`
- `busyStepLabel`
- `errorMessage`
- `safetySnapshots`
- `isLoadingSnapshots`
- `pendingRestorePreview`
- `refreshSafetySnapshots()`
- `createBackup()`
- `prepareRestoreFromPickedFile()`
- `confirmPreparedRestore()`
- `restoreSafetySnapshot(snapshotIdOrPath)`
- `clearPendingRestore()`

**Implementation notes**

- `createBackup()` should:
  - serialize
  - write local file
  - attempt share
  - report local success even if share is unavailable
- `prepareRestoreFromPickedFile()` should:
  - pick file
  - read file
  - validate file
  - compute preview summary
  - stage a pending restore candidate for UI confirmation
- Snapshot refresh should run on mount and after successful restore/snapshot creation.

**Acceptance criteria**

- The screen layer only handles rendering, confirmations, alerts, and navigation reset.
- Long-running operations expose enough state for disabled buttons and inline progress.

### Task 10: Implement `SettingsScreen`

**Files**

- Create: `src/screens/SettingsScreen.tsx`
- Create: `src/screens/SettingsScreen.screen.test.tsx`

**Implementation**

- Use the existing `Screen` wrapper and theme tokens.
- Render a simple settings hub with one row:
  - title `Data Backup & Restore`
  - optional subtitle describing local backup/restore
- Follow navigation typing patterns already used by `DashboardScreen`.
- Tapping the row should navigate to root-stack route `DataBackup`.

**Acceptance criteria**

- Screen remains intentionally minimal and extensible.
- Screen test verifies render and navigation action.

**Suggested verification**

- `npm run test:screen -- SettingsScreen.screen.test.tsx`

### Task 11: Implement `DataBackupScreen`

**Files**

- Create: `src/screens/DataBackupScreen.tsx`
- Create: `src/screens/DataBackupScreen.screen.test.tsx`

**Implementation**

- Use `Screen`, `PrimaryButton`, `SecondaryButton`, `ActivityIndicator`, and existing theme tokens.
- Consume `useDataBackup`.
- Render:
  - `Create Backup`
  - `Restore From File`
  - destructive restore explanation
  - Android storage caveat copy
  - inline progress state
  - recent safety snapshots list
- Add preview and confirmation flow:
  - show preview summary after file validation
  - ask for destructive confirm before actual restore
- On successful restore:
  - run exact `navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Home' } }] })`
  - show completion alert with reopen guidance
- On warning result:
  - still navigate/reset after successful DB restore
  - include onboarding warning text in the completion alert

**Recommended UI split**

- header/explanation card
- primary actions block
- inline busy banner or status row
- pending preview card
- safety snapshot list section

**Test focus**

- primary actions trigger hook actions
- buttons disable while busy
- preview shows before destructive confirm
- snapshot list renders and snapshot restore action is wired
- success path uses reset callback and alert flow

**Acceptance criteria**

- The screen exposes the entire Phase 1 UX from the spec without leaking Expo/file-system details.

**Suggested verification**

- `npm run test:screen -- DataBackupScreen.screen.test.tsx`

### Task 12: Wire navigation and integration coverage

**Files**

- Modify: `src/navigation/AppNavigator.tsx`
- Modify: `src/navigation/TabNavigator.tsx`
- Modify: `src/navigation/AppNavigator.integration.test.tsx`

**Implementation**

- Add `Settings` to `TabParamList`.
- Add `DataBackup` to `RootStackParamList`.
- Import and register:
  - `SettingsScreen`
  - `DataBackupScreen`
- Add the Settings bottom tab after Stallions.
- Choose a stable icon pair such as `cog-outline` / `cog`.
- Extend navigation integration test coverage to verify:
  - Settings tab is visible
  - Settings tab opens the settings screen
  - tapping the backup row reaches `DataBackup`

**Important detail**

- Update mocked screens/repository dependencies in `AppNavigator.integration.test.tsx` so the new routes render deterministically.

**Acceptance criteria**

- Backup UI is reachable from a cold app launch.
- New tab/stack routes are type-safe and integration-tested.

### Task 13: Final verification and manual QA

**Automated verification**

- `npm run typecheck`
- `npm test`
- `npm run test:screen`
- `npm run lint`

**Manual QA checklist**

1. Create a manual backup with a non-trivial dataset.
2. Confirm the backup writes locally even if share is unavailable.
3. Confirm the share sheet opens when available.
4. Attempt restore from an invalid/corrupt file and verify no writes occur.
5. Attempt restore from a backup with a duplicate `daily_logs (mare_id, date)` pair and verify the UI shows a precise validation error.
6. Restore a valid picked file and verify:
   - preview appears before destructive confirm
   - safety snapshot is created first
   - navigation resets to Home
   - dashboard/lists refresh
7. Restore from a safety snapshot and verify no additional safety snapshot is created.
8. Verify snapshot retention keeps only the newest 3 entries.
9. Restore a backup with `onboardingComplete=false` and no animals, then verify the app lands on Home and still behaves correctly with onboarding UI.
10. Restart the app after restore and confirm the data matches expectations.

**Exit criteria**

- All automated checks pass.
- Manual flows work on at least one real device/emulator build, preferably Android because file access and sharing behavior matter there.

## Risks To Watch During Implementation

### 1. SQLite row fidelity drift

If serializer or restore code accidentally reuses repository mappers, the feature will silently lose storage fidelity. Guard against this with raw row types and serializer tests.

### 2. Validation under-specification

Loose validation will push failures into the restore transaction where the user only sees a generic SQLite error. Keep validation strict and front-loaded.

### 3. Navigation reset placement

If reset logic lives in the hook instead of the screen, it will couple backup orchestration to React Navigation and make tests harder. Keep reset in `DataBackupScreen`.

### 4. Snapshot retention side effects

Retention cleanup must never convert a successful restore into a failure. Snapshot creation success is the only hard requirement.

### 5. Onboarding restore edge cases

The app still uses onboarding state in `DashboardScreen` via `useOnboardingState`. Restoring `false` is valid and should be manually verified with both empty and populated datasets.

## Suggested Checkpoints

Use these as natural commit/review boundaries:

1. Dependencies + onboarding helper + shared backup types
2. Serializer + validator
3. File I/O + safety snapshots + restore engine
4. Hook + screens
5. Navigation + tests + verification

## Definition of Done

- Manual backup works and produces a durable export path for the user.
- Full-replace restore works from both picked files and local safety snapshots.
- Validation catches schema/content issues before write time and surfaces precise errors.
- Post-restore state is coherent across SQLite, onboarding storage, invalidation, and navigation.
- Automated checks are green and manual QA passes.
