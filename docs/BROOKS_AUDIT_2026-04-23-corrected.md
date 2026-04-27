# Brooks-Lint Review

**Mode:** Architecture Audit (corrected)
**Date:** 2026-04-23
**Scope:** full project (`src/`, navigation, app entry, storage, and repo-root architecture docs)
**Health Score:** 79 / 100
**Trend:** This corrected run supersedes both earlier 2026-04-23 audit artifacts. It keeps the read-only architectural observations that still hold, removes overreach from the second run, and resets the remediation baseline to the issues that are both real and worth fixing now.

One-sentence verdict: BreedWise has a workable layered shape, but the codebase is carrying a few half-finished architecture moves that should be completed so screens, hooks, repositories, and backup ownership follow one clear policy.

---

## Corrected Findings

### Warning

**Accidental Complexity — dead parallel screen-local orchestration modules still exist**

Symptom: old `useXxx` modules remain under `src/screens/*/` even though the live app already uses authoritative hooks under `src/hooks/`. `src/selectors/home.ts` is only part of that abandoned path.

Consequence: a reader can land on the wrong `useFoalForm` or `useMedicationForm`, patch dead code, and leave the runtime behavior unchanged. It also obscures which layer owns orchestration.

Remedy: delete the dead screen-local hook modules and the stale selector, then remove empty directories.

### Warning

**Dependency Disorder — screen orchestration policy is only partially enforced**

Symptom: some screens correctly delegate repository access to hooks, while a second group still imports repositories directly. The codebase therefore has two competing patterns for the same job.

Consequence: repository and invalidation behavior has to be audited in both screens and hooks, and the documented convention in `AGENTS.md` / `CLAUDE.md` no longer matches reality.

Remedy: make hooks the sole home for repository calls in top-level screens and reusable child UI components. `useRecordForm` remains valid, but only inside hooks.

### Warning

**Boundary Drift — backup and restore live under `utils/` even though the code is storage ownership**

Symptom: the backup pipeline is implemented in `src/utils/backup/*`, but it owns raw SQLite snapshots, restore ordering, safety snapshots, and invalidation side effects.

Consequence: the path communicates the wrong dependency direction and makes storage-specific behavior look like generic utility code.

Remedy: move the backup feature under `src/storage/backup/`, add a single public index surface, and keep the raw snapshot/restore behavior there.

### Warning

**Testability Seam — repositories only obtain the DB handle through `getDb()`**

Symptom: exported repository functions call the module singleton directly, so tests that want a fake handle must mock the module instead of injecting the dependency at the callsite.

Consequence: repository tests are heavier than they need to be, shared-handle workflows are harder to express, and multi-call transaction coverage is less direct.

Remedy: add an internal `RepoDb` seam with an optional trailing `db` parameter on exported repository functions. Existing app callsites stay unchanged.

### Warning

**Cognitive Overload — `useDailyLogWizard.ts` mixes step state, validation, mapping, and persistence in one large hook**

Symptom: the wizard hook owns constants, draft types, measurement parsing, hydration, validation, payload building, navigation, and save/delete orchestration in one file.

Consequence: step-specific changes require rereading a wide lexical scope, and focused unit tests for mapping or validation logic are harder to write than they should be.

Remedy: keep `useDailyLogWizard.ts` as the public entrypoint, but extract pure constants, types, measurement helpers, mappers, and validation into `src/hooks/dailyLogWizard/`.

### Suggestion

**Type Ownership — `DailyLogOvulationSource` should be a domain type, not a repository export**

Symptom: a UI review component imports a domain-state type from repository exports.

Consequence: presentation code becomes coupled to a storage module for type-only knowledge.

Remedy: move `DailyLogOvulationSource` into `src/models/types.ts` and import it from there everywhere else.

---

## Remediation Order

1. Delete the dead parallel modules and stale selector.
2. Document the architecture rule set in repo docs and enforce one orchestration policy.
3. Move backup ownership under `src/storage/backup/`.
4. Add the repository DB seam with a shared-handle path for tests and workflows.
5. Decompose `useDailyLogWizard` while keeping its public API stable.

---

## Constraints

- Preserve current product behavior, schema, navigation, and existing user-visible workflows.
- Do not change backup envelope versions, restore ordering, or restore side effects in this pass.
- Do not rename `models/` to `domain/` in this pass.
- Keep `src/hooks/` as the authoritative home for live orchestration hooks.

---

## Verification Expectations

Run the standard quality gates after remediation:

```bash
npm run typecheck
npm test
npm run test:screen
npm run lint
```

Spot-checks that should be true after the work:

```bash
# no dead screen-local hook copies remain
find src/screens -type f | grep "use.*Form\\|useHomeScreen\\|useMareDetailScreen"

# no screen or reusable child UI component imports repositories directly
grep -RIn "@/storage/repositories\\|@/storage/dataInvalidation" src/screens src/components

# backup feature lives under storage
find src/storage/backup -maxdepth 1 -type f | sort

# daily-log review UI imports the ovulation-source type from models
grep -RIn "DailyLogOvulationSource" src/screens/daily-log-wizard src/hooks/useDailyLogWizard.ts src/models/types.ts
```
