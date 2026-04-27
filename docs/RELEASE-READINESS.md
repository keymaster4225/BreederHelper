# Release Readiness Assessment

> Generated: 2026-04-27
> Branch state at time of writing: `codex/dashboard-rework` (1 commit ahead of `origin/codex/dashboard-rework`); `main` up to date with `origin/main` at `0770001`.

## Context

Question being answered: are there any substantive features to add before pushing a release and moving on to the photo features?

Answer: **no — ship the release as-is, after a small housekeeping pass.**

## What just shipped (last 3 days)

Dashboard tasks v1, sticky follow-up actions, breeding-flow → pregnancy-check task generation, persisted task data layer, tasks in backup schema, breeding record timestamps, daily-log fluid tracking + flush follow-up, breeding event detail view, optional placeholder cleanup, clock-format setting, ovary display refinements.

That is a lot of user-visible surface. A release here is well-justified on its own.

## Recommendation: ship now

Walking the roadmap theme by theme:

- **Mare care depth** — the only P0 is Cyst mapping, and the roadmap explicitly says it needs a design pass. Don't rush it into a release.
- **Stallion depth** — every P1 here (outside-mare records, straw consumption, fertility trends) is non-trivial and is best done as its own focused effort post-release.
- **Proactive workflow** — broader auto-scheduled tasks is a natural follow-up to what just shipped. Better to let the current task system get real-world use first so you know which generated tasks people actually want.
- **Photos V1** — already deferred to after the release; the plan + adversarial review are in place.
- **Archive / soft-delete, calendar-at-a-glance, bottom tab phases 3-5** — all P1, none blocking, all sized like their own release.

The risk in adding "one more thing" right now is that the dashboard task system is brand new (merged today) and benefits from a soak window before another big surface lands on top of it.

## Pre-release housekeeping

1. Decide what to do with the uncommitted dashboard alert files (`src/utils/dashboardAlerts.ts`, `src/components/AlertCard.tsx`, `src/utils/dashboardAlertContext.ts`, `src/utils/dashboardAlertRules.ts`, `src/utils/dashboardAlertTypes.ts`, `src/utils/dashboardAlerts.test.ts`) and the ROADMAP.md tweaks — either commit or revert before tagging.
2. The untracked review / audit docs at the repo root (`BROOKS_REVIEW_PR4.md`, `TEST-AUDIT.md`, `SYNC-ROADMAP.md`, `docs/plans/2026-04-26-photos-v1-implementation-plan.md.local-backup`) — move under `docs/` or delete. Don't ship a release with stray top-level files.
3. Push `ef2d9f6` ("Fix dashboard task and follow-up regressions"). It's currently only on the local `codex/dashboard-rework` branch.
4. Run the full quality gate on `main` after any final merges: `npm run typecheck`, `npm test`, `npm run test:screen`, `npm run lint`.

## After the release

Photos V1 is the next feature, per the existing implementation plan at `docs/plans/2026-04-26-photos-v1-implementation-plan.md`. Phase 0 hard gates (SDK 55 file byte/append behavior, streaming archive memory behavior, backup picker / share support for `.breedwisebackup`) should be proven before storage work starts.
