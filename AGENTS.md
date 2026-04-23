# AGENTS.md

This file is the agent-facing working context for BreedWise. Use it with `CLAUDE.md`, but prefer this file when you need concise implementation guidance and project-specific guardrails.

## Project Overview

BreedWise is an offline-first Expo + React Native + TypeScript mobile app for horse breeding recordkeeping on a single device.

- Core storage: SQLite via `expo-sqlite`
- Primary product spec: `mare-tracker-spec.md`
- Default branch: `main`
- Remote: `origin` -> `https://github.com/keymaster4225/BreederHelper`

## User + Collaboration Expectations

- Explain reasoning clearly. The user is learning React Native / Expo and should not be treated like a professional mobile engineer who already knows the stack.
- Never push to GitHub without explicit user permission.
- For multi-step work, continue autonomously when the path is clear and tests are passing.

## Current Product State

Implemented and actively used:

- Mares: create, edit, list, detail
- Stallions: create, edit, list
- Daily logs: create, edit, delete
- Daily log wizard: multi-step create/edit flow with ovary and uterus details
- Breeding records: create, edit, delete
- Pregnancy checks: create, edit, delete
- Foaling records: create, edit, delete
- Foal records: create, edit, delete, linked 1:1 to foaling records
- Frozen semen batches: create, edit, delete, with stallion-level frozen inventory tab
- Mare detail tabs: Daily Logs, Breeding, Pregnancy, Foaling, Meds
- Mare calendar screen with event dots and day-level history
- Home dashboard with actionable breeding alerts
- Onboarding flow plus persistent onboarding state
- Dev/sample data seeding for local testing and preview builds
- SQLite migrations, repository layer, Vitest, Jest screen tests, and linting

## Architecture and Key Paths

- App entry: `App.tsx`
- Navigation: `src/navigation/AppNavigator.tsx`
- Screens: `src/screens/*`
- Mare detail tab screens: `src/screens/mare-detail/*`
- Shared components: `src/components/*`
- Hooks for orchestration: `src/hooks/*`
- Derived selectors: `src/selectors/*`
- Domain types: `src/models/types.ts`
- Storage bootstrap: `src/storage/db.ts`
- Migrations: `src/storage/migrations/*`
- Repositories: `src/storage/repositories/*`
- Utilities: `src/utils/*`
- Backup/restore helpers: `src/utils/backup/*`
- Onboarding helpers: `src/utils/onboarding.ts`
- Dashboard derivation: `src/utils/dashboardAlerts.ts`
- Dashboard UI: `src/components/DashboardSection.tsx`, `src/components/AlertCard.tsx`
- Shared form controls: `src/components/FormControls.tsx`
- Shared card parts: `src/components/RecordCardParts.tsx`
- Theme: `src/theme.ts`
- Import alias: `@/*` maps to `src/*`

## Data and Domain Invariants

- Local date storage is always canonical `YYYY-MM-DD`.
- UI may display alternate date formats, but persisted values stay canonical.
- Date arithmetic that affects breeding timelines must stay UTC-safe to avoid DST off-by-one errors.
- Foreign key behavior is intentionally restrictive (`ON DELETE RESTRICT`) to preserve relational integrity.
- Migration state is tracked in `schema_migrations`.
- Schema changes must ship with migration, repository, and type updates together.

## Current UX and Domain Decisions

Preserve these unless the user explicitly asks to change them:

- Stallion form does not show `registration #` in the UI.
- Mare DOB displays as `MM-DD-YYYY` in forms, while storage remains `YYYY-MM-DD`.
- Daily log `None` options for teasing and edema are labeled `N/A`.
- Daily log wizard ovary step uses `Follicle Size` numeric entry for both left and right ovaries (same input type on both sides).
- Follicle size validation allows `0-100` with up to one decimal place.
- Edit affordances use the pencil icon (`✎`) through `IconButton`.
- Frozen AI supports optional `Straw Volume (mL)`.
- `Straw Volume (mL)` is limited to an optional 2-digit integer (`0-99`).
- Foaling outcome options are `Live Foal`, `Stillbirth`, and `Aborted`. Do not reintroduce `Unknown`.
- Home screen `Pregnant` badge is derived from the latest positive pregnancy check and is not stored.
- Mare detail has five swipeable tabs plus a calendar button in the header card that opens `MareCalendarScreen`.
- Empty tab states on mare detail are text-only; the top `PrimaryButton` in each tab is the add action.
- Pregnancy check cards show days post-ovulation when an ovulation log exists on or before the check date, and estimated due date only for positive results.
- `findMostRecentOvulationDate` should keep scanning for the latest ovulation on or before the target date.
- Breeding method display formatting lives in `src/utils/outcomeDisplay.ts`.
- Foal records are linked 1:1 to foaling records via `foaling_record_id` uniqueness.
- Foal name is optional; unnamed foals display as `Unnamed foal`.
- Live foal cards navigate to the foal form; non-live-foal cards do not.
- The pencil icon on foaling cards edits the foaling record, not the foal.
- Foal milestones are stored as JSON text in `milestones` and validated by `parseFoalMilestones`.
- `placentaPassed` is a mare event and is not part of foal milestones.
- Foal sex initializes from `FoalingRecord.foalSex` on create and does not back-sync on edit.
- Milestone `recordedAt` timestamps are set on first check and preserved on later edits.
- Deleting a foaling record is proactively blocked when a foal exists.
- Changing a foaling outcome away from `liveFoal` is blocked when a foal record exists.
- Display helpers for foal color, foal sex, and milestone labels live in utilities rather than UI components.

## Dashboard and First-Run Rules

- Dashboard alerts are derived from existing data. Do not add schema just to support dashboard cards.
- Alert generation should remain a pure function with explicit thresholds.
- Home screen should use bulk queries instead of per-mare N+1 fetches.
- Dashboard is collapsible and defaults to collapsed on app open.
- Alert navigation behavior is fixed:
  - due date alerts -> mare detail
  - pregnancy check alerts -> pregnancy check form
  - ovulation, heat, and stale log alerts -> daily log form
- The onboarding carousel is the primary first-run explanatory surface.
- After onboarding, an empty dashboard should stay minimal and action-focused rather than repeating onboarding copy.
- A populated dashboard should not add an extra top hero or `Daily board` section unless the user explicitly wants it.
- When animals already exist, dashboard loading should not block on async onboarding storage reads.

## Seeding, Preview, and Release Notes

- Local sample-data seeding should stay available during normal local testing as well as preview builds via `canSeedPreviewData()`.
- Preview seeding is intended to be idempotent via stable fixture IDs and per-record existence checks.
- EAS `preview` Android builds use `buildType: app-bundle`.
- EAS `preview` uses `autoIncrement: true` with remote app versioning.
- Release builds should go through `npm run build:release` or `bash scripts/build-release.sh`.
- The release script updates `package.json`, `package-lock.json`, and `app.json`, then runs `eas build -p all`.

## Working Conventions for Code Changes

- Keep business logic in repositories, hooks, selectors, or utilities, not directly in presentation components.
- Home, mare detail, foal form, and medication form flows already delegate load/save/delete orchestration to hooks; preserve that separation.
- Prefer reusable pure derivation logic over screen-local ad hoc transforms.
- For behavior changes, update tests when practical, especially validation, repository, and screen coverage.
- If Jest tests touch onboarding mocks and use `jest.requireMock`, make sure `@/utils/onboarding` is explicitly mocked or CI can fail with missing `setOnboardingComplete`.

## Commands

Install and run:

```bash
npm install
npm start
npm run android
npm run ios
npm run web
```

Quality checks:

```bash
npm run typecheck
npm test
npm run test:screen
npm run test:coverage
npm run lint
```

## Quality Gates

- CI runs typecheck, lint, and coverage-enforced unit and screen tests.
- Before handing off substantial code changes, prefer running:
  - `npm run typecheck`
  - `npm test`
  - `npm run test:screen`
  - `npm run lint`

## Source References

Use these documents when the task needs more detail:

- `CLAUDE.md` for the longer project context snapshot
- `README.md` for current repo layout and command summary
- `mare-tracker-spec.md` for product behavior and data model intent
- `docs/plans/` for recent design and implementation decisions
