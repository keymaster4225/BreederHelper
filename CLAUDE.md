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
- Mare detail tabs for Daily Logs, Breeding, Pregnancy, Foaling
- SQLite migrations + repository layer
- Typecheck/test CI and local Vitest coverage

Recent UX/domain decisions reflected in code:
- Stallion form no longer shows `registration #` field in UI.
- Mare DOB is displayed in forms as `MM-DD-YYYY` (stored as `YYYY-MM-DD`).
- Daily log "None" choice for teasing/edema is labeled `N/A`.
- Edit actions use pencil icon (`✎`) via `IconButton` throughout (mare detail header, record cards, home screen mare list).
- Frozen AI includes optional `Straw Volume (mL)`.
- `Straw Volume (mL)` is constrained to optional 2-digit integer (`0-99`).
- Foaling outcome options: Live Foal, Stillbirth, Aborted (no "Unknown").
- Home screen shows "Pregnant" `StatusBadge` on mares with positive latest pregnancy check (derived at load time, not stored).
- Mare detail tab empty states show only text message; the `PrimaryButton` at top of each tab serves as the add action.
- Pregnancy check cards show days post-ovulation (when ovulation logs exist on or before check date) and estimated due date (positive results only).
- Date arithmetic (`calculateDaysPostBreeding`, `estimateFoalingDate`) uses UTC to avoid DST off-by-one bugs.
- `findMostRecentOvulationDate` scans daily logs for the latest ovulation on or before a given date.

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
- Vitest

## Key Paths

- App entry: `App.tsx`
- Navigation: `src/navigation/AppNavigator.tsx`
- Screens: `src/screens/*`
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
- Add migration + repository + type updates together for schema changes.
- For behavior changes, update tests where practical (`validation.test.ts`, repository tests).
- Run `npm run typecheck` and `npm test` before commit.
- Import alias: `@/*` maps to `src/*` (configured in `tsconfig.json` + babel).

## Git

- Default branch: `main`
- Remote: `origin` -> `https://github.com/keymaster4225/BreederHelper`

