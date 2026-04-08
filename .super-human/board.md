# Super-Human Board

- Status: `completed`
- Started: `2026-04-07`
- Skill: `super-human`
- Source design: `docs/plans/2026-04-07-stallion-hub-phase2-design-revised.md`

## Intake Summary

- Board tracking: git-tracked
- Success criteria: migration, repository, hook, UI, and broad feasible test coverage
- Constraints: preserve current design standards; small UX cleanup is allowed
- Source of truth: the revised Phase 2 design doc is authoritative
- Documentation updates: out of scope

## Project Conventions

- Package manager: `npm` via `package-lock.json`
- Runtime: Expo + React Native + TypeScript
- Type check: `npm run typecheck`
- Unit/integration tests: `npm test` via Vitest
- Screen tests: `npm run test:screen` via Jest
- Lint: `npm run lint`
- Source layout: `src/models`, `src/storage`, `src/hooks`, `src/screens`, `src/components`, `src/utils`
- Codedocs available: `false`

## Rollback Point

- Commit: `f0f711fe8cf44a1c50d1c59899729ecef159b3a0`

## Task Graph

### Wave 1

- `SH-001` Update domain types and remove legacy collection shipped fields
- `SH-002` Implement migration 011 for dose events and shipped-data backfill
- `SH-005` Add dose event display utilities

### Wave 2

- `SH-003` Add dose-event repository and update semen collection repository
- `SH-006` Extend stallion detail hook to bulk-load dose events

### Wave 3

- `SH-004` Add repository tests for dose events and collection persistence changes
- `SH-007` Implement modal, collection card event UI, parent refresh wiring, and collection form cleanup

### Wave 4

- `SH-008` Add broad screen coverage for updated collections flow

### Wave 5

- `SH-009` Self code review
- `SH-010` Requirements validation
- `SH-011` Full project verification

## Execution Notes

- Dirty unrelated worktree changes were detected before execution; they will not be reverted.
- Shared-file ownership:
- `SH-007` owns `src/screens/stallion-detail/CollectionsTab.tsx`
- `SH-007` owns `src/screens/StallionDetailScreen.tsx`
- Testing preference: broadest feasible coverage in this session

## Progress Log

- `2026-04-07`: Intake, convention detection, discover, and planning completed. User approved execution.
- `2026-04-07`: Wave 1 completed. Added dose event types, migration 011, and dose event display utilities.
- `2026-04-07`: Wave 2 completed. Added `collectionDoseEvents` repository, removed legacy shipped fields from `semen_collections`, and extended the stallion detail data hook with bulk-loaded dose events.
- `2026-04-07`: Wave 3 completed. Added `DoseEventModal`, updated the collections tab to manage dose events through the parent `loadData()` path, and removed shipping controls from the collection form.
- `2026-04-07`: Wave 4 completed. Updated screen tests and added repository coverage for dose events.
- `2026-04-07`: Wave 5 completed. Self-review, requirements validation, and full verification all passed.

## Requirements Validation

- Migration 011 rebuilds `semen_collections` without `shipped` / `shipped_to`
- `collection_dose_events` table and index are added
- Legacy shipped collection rows backfill into shipped dose events
- Stallion detail data now bulk-loads dose events by collection id
- Collections UI now presents dose events on each collection card
- Collection form no longer owns shipping disposition fields
- Dose-event changes refresh through the existing parent `loadData()` path

## Verification Report

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run test:screen` ✅

## Change Summary

- Added: `src/storage/repositories/collectionDoseEvents.ts`
- Added: `src/storage/repositories/collectionDoseEvents.test.ts`
- Added: `src/screens/stallion-detail/DoseEventModal.tsx`
- Added: `.super-human/board.md`
- Updated storage, hook, and stallion-detail UI to use dose events instead of legacy shipped fields
