# BreedWise Maintainability Refactor

## Summary

Implement this in three phases with no user-facing behavior
- Extract `HomeScreen` into a hook for bulk loading/deletion plus selectors for pregnancy projection, dashboard inputs, and filtered mare lists.
- Extract `FoalFormScreen` and `MedicationFormScreen` into form hooks that own load/save/delete/validation, while keeping field rendering in the screen or small child sections.
- Extract `MareDetailScreen` into a hook for loading all mare-detail datasets and simple child components for header and tab strip.
- Shared pure derivation that could be reused across screens goes in `selectors` or existing `utils`, not hooks.
- Reusable UI sections stay presentational only and receive fully prepared props.

Boundary decisions:
- Repositories: fetch/store raw domain records.
- Selectors: transform records into screen-ready data.
- Hooks: orchestrate repository calls, selectors, and mutation lifecycle.
- Screens/components: render and navigate.

### 2. Repository split with stable public API

Split the current repository monolith into domain modules behind the existing barrel.

Module ownership:
- `mares.ts` remains mare-only CRUD.
- Add domain modules for stallions, daily logs, breeding records, pregnancy checks, foaling records, foals, and medications.
- Add one shared internal module for row mappers/codecs used by more than one domain module.
- Move foal milestone parsing and IgG parsing into internal codec helpers owned by the foal domain or shared codec module, not screen code.

Public API rules:
- All application code continues importing from `@/storage/repositories`.
- `src/storage/repositories/index.ts` remains the only public export surface.
- Domain files may import shared internal helpers, but application screens/hooks must not import internal repository modules directly.
- Preserve all current function names and signatures during the split unless there is a duplicate or ambiguous name.
- Do not change SQL behavior, migration order, or schema shape in this refactor.

Migration sequence:
1. Create domain modules and move functions without changing exports.
2. Re-export everything from the barrel.
3. Move shared row-mapping/codecs last, after domain ownership is clear.
4. Keep repository tests passing at each step.

### 3. Test infrastructure and CI

Adopt a two-runner test strategy.

Unit and repository tests:
- Keep `Vitest` as-is for pure logic and repository tests.
- Continue using Node environment for `src/**/*.test.ts` unit-style tests.

Screen and navigation tests:
- Add `Jest` with the React Native preset plus React Native Testing Library.
- Add a dedicated Jest setup file for mocks and test helpers.
- Mock these dependencies centrally in Jest setup:
  - React Navigation container/hooks as needed for screen rendering
  - Expo font/bootstrap side effects that block screen mount
  - `react-native-pager-view`
  - `react-native-calendars`
  - native alert/date-picker behavior when required by tested flows
- Keep screen tests in a separate naming pattern such as `*.screen.test.tsx` or `*.integration.test.tsx`; Jest owns that pattern exclusively.

Required test coverage:
- `HomeScreen`
  - loads dashboard/search/filter state correctly
  - delete flow refreshes data
  - alert tap routes to the correct destination
- `MareDetailScreen`
  - honors `initialTab`
  - updates active tab on tab press/page change
- `FoalFormScreen`
  - existing record loads
  - milestone toggle updates state
  - IgG add/remove/save flow works
  - invalid input blocks save
- `MedicationFormScreen`
  - create and edit flows work
  - custom medication path works
  - route deselection persists correctly
- One navigation smoke test proving an alert deep-link reaches the intended screen/params.

CI changes:
- Run `npm run typecheck`
- Run `npm test` for Vitest
- Run a dedicated Jest command for screen/integration tests
- Run `npm run lint`

### 4. Linting and documentation policy

Linting:
- Standardize on ESLint with TypeScript and React/React Native support.
- Scope linting to source files only; formatting changes are out of scope for this refactor.
- Treat lint adoption as pragmatic: enable rules that catch correctness and maintainability issues, not cosmetic churn.

Documentation policy:
- `README.md` and `CLAUDE.md` are living documentation and must reflect shipped behavior.
- `docs/plans/` is for active or recently implemented work.
- `docs/superpowers/` and superseded design artifacts are archival history only.
- When a feature is fully shipped and reflected in living docs, leave the design plan in place but treat it as historical, not current truth.
- As part of this roadmap, update living docs to match the current shipped app surface and remove stale statements about tab/screen counts.

## Test Plan

Sequence the work to preserve behavior:

1. Add Jest infrastructure first and write the missing screen/navigation tests around current behavior.
2. Refactor screen logic into hooks/selectors/components with tests guarding behavior.
3. Split repositories behind the barrel while running existing repository tests after each domain move.
4. Add ESLint last, then fix only issues required to make CI green without broad stylistic rewrites.

Acceptance criteria:
- No route names, navigation params, repository function signatures, or schema behavior change.
- Existing Vitest suite remains green.
- New Jest screen suite is green.
- Typecheck and ESLint are green in CI.
- Living docs match the shipped features present in the app.

## Assumptions

- This is a maintainability refactor only; no product behavior changes are intended.
- The app remains offline-first and SQLite-backed with the current migration model.
- The repository barrel remains a deliberate compatibility layer for the whole codebase.
- Hooks/selectors introduced by this refactor are internal implementation details and not new public APIs.
