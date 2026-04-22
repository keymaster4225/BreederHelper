# CLAUDE.md

## Project

BreedWise is an Expo + React Native + TypeScript mobile app for horse breeding recordkeeping.
It is offline-first and uses SQLite (`expo-sqlite`) for all core data.

Primary spec reference:
- `mare-tracker-spec.md`

## Current Implementation Snapshot

Implemented and working:
- Mares: create/edit/list/detail
- Stallions: create/edit/list
- Daily logs: create/edit/delete
- Breeding records: create/edit/delete
- Pregnancy checks: create/edit/delete
- Foaling records: create/edit/delete
- Foal records: create/edit/delete (linked 1:1 to foaling records)
- Mare detail swipeable tabs (Daily Logs, Breeding, Pregnancy, Foaling, Meds) via `react-native-pager-view`
- SQLite migrations + repository layer
- Typecheck/test CI plus local Vitest and Jest screen coverage

Recent UX/domain decisions reflected in code:
- Stallion form no longer shows `registration #` field in UI.
- Mare DOB is displayed in forms as `MM-DD-YYYY` (stored as `YYYY-MM-DD`).
- Daily log "None" choice for teasing/edema is labeled `N/A`.
- Edit actions use pencil icon (`✎`) via `IconButton` throughout (mare detail header, record cards, home screen mare list).
- Frozen AI includes optional `Straw Volume (mL)`.
- `Straw Volume (mL)` is constrained to optional 2-digit integer (`0-99`).
- Foaling outcome options: Live Foal, Stillbirth, Aborted (no "Unknown").
- Home screen shows "Pregnant" `StatusBadge` on mares with positive latest pregnancy check (derived at load time, not stored).
- Mare detail has 5 swipeable tabs (Daily Logs, Breeding, Pregnancy, Foaling, Meds) and a calendar button in the header card that navigates to `MareCalendarScreen`.
- Mare detail tab empty states show only text message; the `PrimaryButton` at top of each tab serves as the add action.
- Pregnancy check cards show days post-ovulation (when ovulation logs exist on or before check date) and estimated due date (positive results only).
- Date arithmetic (`calculateDaysPostBreeding`, `estimateFoalingDate`) uses UTC to avoid DST off-by-one bugs.
- `findMostRecentOvulationDate` scans daily logs for the latest ovulation on or before a given date.
- Breeding method enum values are formatted for display via `formatBreedingMethod` in `src/utils/outcomeDisplay.ts` (e.g. `frozenAI` → `Frozen AI`).
- Foal records are linked 1:1 to foaling records via `foaling_record_id` UNIQUE constraint (migration 005).
- Foal name is optional; unnamed foals display as "Unnamed foal" on mare detail cards.
- Live foal cards on mare detail are tappable (navigate to FoalFormScreen); non-live-foal cards are not.
- Pencil icon on foaling cards still edits the foaling record, not the foal.
- Foal milestones (7 keys: stood, nursed, passedMeconium, iggTested, enemaGiven, umbilicalTreated, firstVetCheck) stored as JSON TEXT in `milestones` column; parsed/validated by `parseFoalMilestones`.
- `placentaPassed` is excluded from foal milestones (it is a mare event).
- Foal sex initializes from `FoalingRecord.foalSex` on create but does not back-sync on edit (documented temporary duplication).
- Milestone `recordedAt` timestamps auto-set on first check, preserved on subsequent edits.
- Deleting a foaling record is proactively blocked when a foal exists (checked before delete attempt, not relying on FK error).
- Changing foaling outcome away from `liveFoal` is blocked when a foal record exists.
- Display formatters: `formatFoalColor`, `formatFoalSex` in `src/utils/outcomeDisplay.ts`; milestone labels in `src/utils/foalMilestones.ts`.
- Home screen dashboard section ("Today's Tasks") renders above mare list when actionable alerts exist; hides when empty.
- Dashboard alerts are derived from existing data (no schema changes): approaching due dates, pregnancy checks needed, recent ovulations, heat activity, stale logs.
- Alert generation is a pure function in `src/utils/dashboardAlerts.ts` with named constant thresholds (30-day due window, 14-day preg check min, 2-day ovulation window, 3-day heat window, 7-day stale log threshold, 60-DPO maintenance cutoff).
- HomeScreen uses bulk queries (`listAllDailyLogs`, `listAllBreedingRecords`, `listAllPregnancyChecks`, `listAllFoalingRecords`) instead of per-mare N+1 queries.
- Dashboard section is collapsible via header tap; defaults to collapsed on each app open.
- Alert cards navigate: approaching due → MareDetail, preg check needed → PregnancyCheckForm, ovulation/heat/stale log → DailyLogForm.

## Tech Stack

- Expo SDK 55
- React 19.2
- React Native 0.83
- TypeScript
- React Navigation (native stack)
- `@react-native-community/datetimepicker`
- `expo-sqlite`
- `@expo/vector-icons`
- `@react-native-async-storage/async-storage`
- `react-native-pager-view`
- Vitest
- Jest
- React Native Testing Library
- ESLint

## Key Paths

- App entry: `App.tsx`
- Navigation: `src/navigation/AppNavigator.tsx`
- Screens: `src/screens/*`
- Mare detail tab content: `src/screens/mare-detail/*`
- Shared card parts (CardRow, ScoreBadge, EditIconButton): `src/components/RecordCardParts.tsx`
- Shared form controls: `src/components/FormControls.tsx`
- Screen wrapper: `src/components/Screen.tsx`
- Button components: `src/components/Buttons.tsx`
- Status badges: `src/components/StatusBadge.tsx`
- Domain types: `src/models/types.ts`
- Repositories: `src/storage/repositories/*`
- Migrations: `src/storage/migrations/*`
- Validation/date helpers: `src/utils/validation.ts`, `src/utils/dates.ts`
- Theme: `src/theme.ts`
- Score colors: `src/utils/scoreColors.ts`
- Display formatters: `src/utils/outcomeDisplay.ts` (foaling outcomes, breeding methods)
- Dashboard alerts: `src/utils/dashboardAlerts.ts` (pure alert generation logic)
- Dashboard UI: `src/components/DashboardSection.tsx`, `src/components/AlertCard.tsx`
- Onboarding: `src/utils/onboarding.ts`
- ID generation: `src/utils/id.ts`

## Data + Storage Notes

- Local date canonical format is `YYYY-MM-DD`.
- UI can display alternate formats via `FormDateInput` `displayFormat`.
- FK behavior is restrictive (`ON DELETE RESTRICT`) for relational integrity.
- Migration runner records applied migrations in `schema_migrations`.

## Runbook

Install:
- `npm install`

Run:
- `npm start`
- `npm run android`

Quality checks:
- `npm run typecheck`
- `npm test`

## Emulator / Expo Notes

If bundling/native module errors appear:
- Ensure dependencies are installed and aligned with Expo SDK 55.
- Run `npm install`.
- Prefer running Android via `npm run android` (native run) when native-module issues appear.

## Working Conventions For Future Edits

- Keep local date storage normalized as `YYYY-MM-DD`.
- Keep business logic in repositories/utils, not directly in UI components.
- Home, foal form, medication form, and mare detail screens now delegate load/save/delete orchestration to hooks in `src/hooks/`, with reusable pure derivation in selectors/utils.
- Add migration + repository + type updates together for schema changes.
- For behavior changes, update tests where practical (`validation.test.ts`, repository tests).
- When adding a new persisted entity, also extend the backup pipeline: `src/utils/backup/types.ts`, `serialize.ts`, `restore.ts`, `validate.ts`, `safetyBackups.ts`, `testFixtures.ts`, plus their `*.test.ts` round-trip and validation coverage. Restore order must respect FK dependencies.
- When a new entity is surfaced in an existing screen (cards, allocations, tabs), extend that screen's `*.screen.test.tsx` for the new render paths, navigation, and soft-delete (`isDeleted`) gating.
- When a domain field uses an enum-with-`'Other'` pattern (e.g. extender, color), add a display formatter to `src/utils/outcomeDisplay.ts` (or a sibling `*Display.ts` file) plus a test that covers both enum and `'Other:<freetext>'` rendering.
- New screens count toward the screen-coverage CI threshold (see commit `48e3c52`); each needs at least one happy-path and one error-path screen test.
- Every new icon-only button needs an `accessibilityLabel`.
- Run `npm run typecheck`, `npm test`, `npm run test:screen`, and `npm run lint` before commit.
- Import alias: `@/*` maps to `src/*` (configured in `tsconfig.json` + babel).

## Git

- Default branch: `main`
- Remote: `origin` -> `https://github.com/keymaster4225/BreederHelper`
