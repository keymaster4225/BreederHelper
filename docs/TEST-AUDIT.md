# Brooks-Lint Review

**Mode:** Test Quality Review  
**Scope:** full test suite; auto-scope found only unstaged `AGENTS.md` and `ROADMAP.md`, so no changed production/test area to prioritize.  
**Health Score:** 80/100

The suite is broad and currently passing, but its weakest protection is around mocked screen/integration tests and repository tests that verify implementation shape more than observable behavior.

## Test Suite Map

```text
Unit tests:        39 files, 432 tests
Screen tests:      30 files, 140 tests
Integration tests: 1 file, 4 tests
E2E tests:         0 files, 0 tests
Ratio by tests:    Unit 75% : Screen/Integration 25% : E2E 0%
Runtime checked:   Vitest 22.00s, Jest 47.14s
Coverage areas:    storage/utils/screens/hooks have coverage; components have 8 prod files and 0 direct tests
```

## Findings

### Warning

**Mock Abuse — Integration tests are mostly testing mocked wiring**  
Symptom: `src/navigation/AppNavigator.integration.test.tsx` mocks dashboard hooks, onboarding, repositories, and most destination screens before rendering the navigator; `src/hooks/navigationCallbackReloadGuards.screen.test.tsx` mocks 24 repository methods plus mapper factories.  
Source: xUnit Test Patterns — Behavior Verification; The Art of Unit Testing — mock usage guidelines  
Consequence: Real route contracts, screen dependencies, and repository integration can drift while these tests still pass because the test defines both sides of the interaction.  
Remedy: Keep mocked hook tests for focused unit behavior, but add a small real-navigator smoke path using real destination components and a single repository fake. Rename heavily mocked "integration" tests if they remain wiring tests.

**Test Brittleness — Repository tests assert SQL call positions and parameter indexes**  
Symptom: `src/storage/repositories/dailyLogs.test.ts` asserts exact `runAsync` call counts, call order, SQL fragments, and parameter indexes; `src/storage/backup/restore.test.ts` asserts deletion/insertion calls by array position through `sqlCalls[23]`.  
Source: xUnit Test Patterns — Eager Test / Behavior Verification; The Pragmatic Programmer — Orthogonality  
Consequence: A harmless SQL refactor, batching change, or parameter reorder can break tests even when database state remains correct.  
Remedy: Prefer state-based repository tests against an in-memory SQLite fixture seeded through migrations. Where order is the contract, wrap assertions in domain helpers like `expectRestoreDeletesChildrenBeforeParents()`.

**Test Duplication — Repository fake database patterns are copied across files**  
Symptom: `createFakeDb` appears in 10 repository test files, `normalized(sql)` appears in 7 files, and `vi.mock('@/storage/db')` appears across storage repository/backup tests.  
Source: xUnit Test Patterns — Test Code Duplication; The Pragmatic Programmer — DRY  
Consequence: Schema or repository-contract changes require updating several local fakes, and divergent fakes can make tests pass against behavior the real SQLite adapter does not have.  
Remedy: Extract shared repository test utilities under `src/storage/repositories/testUtils` or move more tests to a common in-memory SQLite harness.

**Coverage Illusion — Coverage gates are too low to prove risk coverage**  
Symptom: `vitest.config.ts` allows 20% lines / 40% branches, while `jest.config.js` allows 10% lines / 8% branches across collected screen coverage.  
Source: How Google Tests Software — change coverage vs. line coverage; The Art of Unit Testing — test completeness principle  
Consequence: CI can report coverage enforcement while major UI, error, and boundary paths remain unprotected; new code can land with little meaningful behavioral coverage.  
Remedy: Ratchet thresholds from current measured baselines by subsystem, and add changed-file or critical-path coverage expectations for storage, backup/restore, dashboard alerts, and form workflows.

## Summary

The suite has good breadth and fast enough feedback, but several tests are coupled to mocks and call mechanics rather than user-visible or database-visible outcomes. The highest-value next step is to add a shared repository/in-memory DB fixture and convert the most mocked integration path into a real smoke test.

Verification run: `npm test` passed, `npm run test:screen` passed.
