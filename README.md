# BreederHelper

Mobile app for horse breeders to track mare reproductive cycles, breeding events, pregnancy checks, and foaling outcomes.

## Current Status

This repository currently includes:
- Expo + React Native + TypeScript app scaffolding
- Local SQLite storage with migration runner
- CRUD flows for:
  - Mares
  - Stallions
  - Daily logs
  - Breeding records
  - Pregnancy checks
  - Foaling records
- Mare detail view with tabbed sections and record-level edit/delete actions
- Shared form components and date picker inputs
- Unit/smoke tests (Vitest)
- GitHub Actions CI for typecheck + tests

## Tech Stack

- React Native (Expo)
- TypeScript
- expo-sqlite
- React Navigation
- @react-native-community/datetimepicker
- Vitest (tests)

## Project Structure

```text
src/
  components/        # Shared UI components and form controls
  models/            # Domain types
  navigation/        # App navigation
  screens/           # App screens
  storage/           # DB bootstrap, migrations, repositories
  utils/             # Date/id/validation helpers
```

## Prerequisites

- Node.js 20+
- npm
- Android Studio (for Android emulator)
- Android SDK + Emulator image

## Setup

```bash
npm install
```

## Run

### Start Metro

```bash
npm start
```

### Run on Android emulator

1. Start an emulator from Android Studio Device Manager.
2. From project root:

```bash
npm run android
```

## Quality Checks

### Typecheck

```bash
npm run typecheck
```

### Tests

```bash
npm test
```

Current automated tests cover:
- Validation utility functions (`src/utils/validation.ts`)
- Repository smoke tests for key CRUD flows
- Constrained delete behavior (FK-style protection)

## CI

GitHub Actions workflow:
- `.github/workflows/ci.yml`
- Runs on push to `main` and on pull requests
- Executes:
  - `npm ci`
  - `npm run typecheck`
  - `npm test`

## Database

- Initial schema: `src/storage/migrations/001_initial_schema.sql`
- Migration runner: `src/storage/migrations/index.ts`
- DB bootstrap: `src/storage/db.ts`

## Useful Scripts

- `npm start` - Start Expo dev server
- `npm run android` - Build/run Android app
- `npm run ios` - Build/run iOS app (macOS only)
- `npm run web` - Run web target
- `npm run typecheck` - Run TypeScript checks
- `npm test` - Run Vitest test suites

## Notes

- Local-first/offline-first storage is implemented with SQLite.
- Some tests use a mocked DB adapter for deterministic repository smoke coverage.
- The product spec source is `mare-tracker-spec.md`.
