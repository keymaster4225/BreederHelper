# Multi-User Sync Readiness Roadmap

## Summary

Prepare BreedWise for future multi-user sync without choosing a backend or building sync now. The near-term goal is to make local SQLite data sync-shaped: globally safe IDs, consistent tombstones, workspace boundaries, local mutation metadata, and a future-ready change log.

Defaults chosen:

- Backend-agnostic.
- Prep-only roadmap, no cloud backup or collaboration implementation yet.
- Incremental migrations, not one large schema rewrite.
- Existing records keep their current IDs; only new records use the new ID format.

## Roadmap Items

### 1. ID Foundation

- Add `expo-crypto` and change `src/utils/id.ts` so persisted IDs use `Crypto.randomUUID()` from Expo Crypto.
- Keep existing IDs valid; do not migrate or rewrite old primary keys.
- New persisted records use plain UUID v4 strings.
- Client-only draft IDs may keep using `newId()` unless they become confusing in tests; only split into `newClientId()` if needed.
- Update tests that assert ID shape or mock `newId()`.

Source: Expo Crypto supports `Crypto.randomUUID()` in SDK 55: https://docs.expo.dev/versions/latest/sdk/crypto/

### 2. Tombstone Consistency

- Add `deleted_at TEXT` to syncable tables that currently hard-delete user-visible records: `daily_logs`, `breeding_records`, `pregnancy_checks`, `foaling_records`, `foals`, `medication_logs`, `semen_collections`, `collection_dose_events`, `frozen_semen_batches`.
- Convert normal delete repository functions to soft-delete by setting `deleted_at` and `updated_at`.
- Keep physical deletes only for restore/reset flows and carefully scoped internal cleanup.
- Follow-up wave: add tombstones to replace-managed child tables like `uterine_fluid`, `uterine_flushes`, and `uterine_flush_products`.
- Normal list/get queries exclude tombstoned rows by default, with explicit `includeDeleted` paths only where needed for restore, audit, or future sync.

### 3. Workspace Boundary

- Add a `workspaces` table with `id`, `name`, `created_at`, `updated_at`, and optional `deleted_at`.
- Add `workspace_id` first to root sync entities: `mares`, `stallions`, and any future independent root entity.
- Child records inherit workspace through their parent relationship unless a query needs direct filtering.
- Add an `ensureLocalWorkspace()` bootstrap step that creates one local workspace with a UUID and backfills null root rows.
- Keep workspace UI out of scope for now; this is a data boundary only.

### 4. Local Device Identity

- Add a local installation/device identity, stored outside shared data.
- Use a table or AsyncStorage key such as `device_id`, generated once with UUID v4.
- Never sync or restore the device ID from backup; restoring onto a new phone should create a new device identity.
- Repository metadata helpers use this device ID for `last_modified_device_id`.

### 5. Sync Metadata Sidecar

- Add an `entity_sync_metadata` table instead of adding revision columns to every table immediately.
- Shape: `entity_table`, `entity_id`, `workspace_id`, `local_revision`, `last_modified_at`, `last_modified_device_id`.
- Add a repository helper like `touchEntityMetadata(db, entityTable, entityId, workspaceId, now)`.
- Every create/update/delete repository path for syncable rows calls this helper in the same transaction as the data write.
- Keep `updated_at` on domain rows as user-visible/local edit time; use `local_revision` for future sync ordering.

### 6. Local Change Log / Outbox

- Add a `local_changes` table after metadata is stable.
- Shape: `id`, `workspace_id`, `entity_table`, `entity_id`, `operation`, `local_revision`, `changed_at`, `device_id`, `status`.
- Operations are `create`, `update`, `delete`.
- Composite transactions, such as daily log + fluid + flush products, write one change row per affected persisted entity.
- No network upload yet. This table proves the app can observe local mutations consistently.
- Exclude `local_changes` from manual backup for now; backups should preserve user data, not stale pending sync state.

### 7. Write Path Discipline

- Keep repository functions as the storage write boundary.
- Avoid adding new screen-level direct SQL or AsyncStorage writes for shared domain data.
- For new features, writes should flow through hook/use-case orchestration into repositories.
- Add a convention: every syncable repository mutation must update the row, touch metadata, append a local change, and emit invalidation.
- Update architecture docs to mark direct hard deletes and unmanaged writes as sync blockers.

### 8. Shared vs Device-Only Data Split

- Classify persisted state into three buckets: shared workspace data, per-user settings, and per-device state.
- Shared workspace data: horse records, reproductive records, semen inventory, future reminders.
- Per-user settings: clock preference and future display preferences.
- Per-device state: onboarding, local backup snapshots, device ID, cache/sync cursors.
- Do not move everything immediately; document the split and apply it to new features first.

### 9. Uniqueness and Conflict Policy

- Keep existing uniqueness rules for now, including daily log date/time constraints.
- Add a guideline: new features should prefer stable record IDs over natural unique keys unless the uniqueness is a true business invariant.
- Document current natural constraints as future sync conflict points.
- When a future backend is chosen, these constraints need explicit conflict UX rather than silent overwrite behavior.

### 10. Attachment Readiness

- Before photos or ultrasound media ship, design attachments as first-class rows.
- Future table shape: `attachments(id, workspace_id, owner_table, owner_id, media_type, local_uri, content_hash, byte_size, remote_object_key, created_at, updated_at, deleted_at)`.
- Do not store attachment lists as JSON blobs inside mares, foals, or daily logs.
- Keep actual media sync out of this prep phase.

## Suggested Sequence

1. ID foundation.
2. Device identity and local workspace bootstrap.
3. Tombstones for direct user-deleted records.
4. Metadata sidecar and repository touch helper.
5. Local change log/outbox.
6. Replace-managed child tombstones.
7. Shared/device state documentation.
8. Attachment table design before media work starts.

## Public Interfaces / Types

- `newId()` returns UUID v4 strings for new persisted records.
- Add `Workspace` and `EntitySyncMetadata` model/storage types.
- Add internal helpers: `ensureLocalWorkspace()`, `getOrCreateDeviceId()`, `touchEntityMetadata()`, and `recordLocalChange()`.
- Extend backup schema to include `workspaces` and tombstone fields for user data.
- Do not include `device_id` or `local_changes` in manual backup.

## Test Plan

- Migration tests verify new tables, columns, indexes, and backfill behavior.
- Repository tests verify soft deletes hide records from normal list/get paths.
- Backup tests verify tombstones and workspaces serialize/restore correctly.
- ID tests verify new persisted IDs match UUID v4 format.
- Metadata tests verify create/update/delete paths bump `local_revision` and store device ID.
- Outbox tests verify one local change is recorded per affected entity inside composite transactions.
- Regression tests verify restore/reset can still physically replace managed tables.

## Assumptions

- No backend, auth, accounts, invitations, or real sync transport is selected in this roadmap.
- Existing local backups remain full-replace recovery artifacts.
- Existing primary keys remain valid forever, even if they are not UUIDs.
- Multi-user conflict resolution is deliberately deferred until a backend and collaboration model are chosen.
