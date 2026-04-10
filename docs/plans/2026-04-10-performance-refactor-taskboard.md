# Performance + Maintainability Refactor Taskboard

Date: 2026-04-10  
Owner: Codex + user  
Status: Complete (PR1-PR5 complete)

## Scope

This board tracks execution of the approved multi-PR plan:

1. Baseline + safety net tests.
2. Dashboard alert engine refactor.
3. Incremental Home/Dashboard loading with invalidation.
4. Shared form orchestration utilities.
5. Coverage gates and CI enforcement.

## PR Checklist

### PR1: Baseline + Safety Net

- [x] Add selector tests for home-screen derived data.
- [x] Strengthen Home screen focus/reload tests.
- [x] Strengthen Dashboard screen focus/reload tests.
- [x] Run full local quality gate (`typecheck`, `test`, `test:screen`, `lint`).

### PR2: Alert Engine Refactor

- [x] Add pre-indexed dashboard alert context.
- [x] Split alert rules into modular pure functions.
- [x] Keep public alert APIs and outputs stable.
- [x] Prove parity through tests.

### PR3: Incremental Data Loading

- [x] Add lightweight repository invalidation bus.
- [x] Emit invalidation events from write repositories.
- [x] Convert Home/Dashboard hooks to focus + stale-window + invalidation reload model.
- [x] Update affected screen tests.

### PR4: Form Orchestration Consolidation

- [x] Create shared record-form orchestration hook.
- [x] Create shared delete-confirm helper.
- [x] Migrate mare/stallion and record form screens in waves.
- [x] Add missing form screen test coverage.

### PR5: Coverage Gates + CI

- [x] Add explicit coverage scripts.
- [x] Configure initial Jest/Vitest coverage thresholds.
- [x] Enforce thresholds in CI.
- [x] Document quality bar in README.

## Rollback Notes

- If PR2 changes alert outputs unexpectedly, revert only rule orchestration files and keep PR1 tests.
- If PR3 introduces stale UI behavior, fall back to always-on-focus reload while keeping invalidation code behind a feature flag.
- If PR4 migration introduces regressions, migrate forms one at a time and keep old screen logic until each screen-specific test is green.
- If PR5 blocks delivery due to threshold strictness, lower initial threshold to current baseline and ratchet upward incrementally.
