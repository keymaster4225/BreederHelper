# CLAUDE.md

## Project

BreederHelper is an Expo + React Native + TypeScript mobile app for horse breeding recordkeeping.
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
- Mare detail rows use a pencil edit button; delete actions are on edit screens.
- Frozen AI includes optional `Straw Volume (mL)`.
- `Straw Volume (mL)` is constrained to optional 2-digit integer (`0-99`).

## Tech Stack

- Expo SDK 53
- React 19
- React Native 0.79
- TypeScript
- React Navigation (native stack)
- `@react-native-community/datetimepicker`
- `expo-sqlite`
- Vitest

## Key Paths

- App entry: `App.tsx`
- Navigation: `src/navigation/AppNavigator.tsx`
- Screens: `src/screens/*`
- Shared form controls: `src/components/FormControls.tsx`
- Domain types: `src/models/types.ts`
- Repositories: `src/storage/repositories/*`
- Migrations: `src/storage/migrations/*`
- Validation/date helpers: `src/utils/validation.ts`, `src/utils/dates.ts`

## Data + Storage Notes

- Local date canonical format is `YYYY-MM-DD`.
- UI can display alternate formats via `FormDateInput` `displayFormat`.
- FK behavior is restrictive (`ON DELETE RESTRICT`) for relational integrity.
- Migration runner records applied migrations in `schema_migrations`.
- `straw_volume_ml` exists in `breeding_records` schema and repositories.

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
- Ensure dependencies are installed and aligned with Expo SDK 53.
- Run `npm install`.
- Prefer running Android via `npm run android` (native run) when native-module issues appear.

## Working Conventions For Future Edits

- Keep local date storage normalized as `YYYY-MM-DD`.
- Keep business logic in repositories/utils, not directly in UI components.
- Add migration + repository + type updates together for schema changes.
- For behavior changes, update tests where practical (`validation.test.ts`, repository tests).
- Run `npm run typecheck` and `npm test` before commit.

## Git

- Default branch: `main`
- Remote: `origin` -> `https://github.com/keymaster4225/BreederHelper`

