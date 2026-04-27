# BreedWise

BreedWise is an offline-first Expo / React Native app for tracking mare reproductive management on a single device. It is built around fast daily use for breeders: record mare observations, breeding activity, pregnancy checks, foaling outcomes, and review each mare's history without needing a backend.

## What the app does

- Manages mares and stallions with local SQLite persistence
- Records daily logs, breeding records, pregnancy checks, foaling records, and foal details
- Shows a home dashboard with persisted mare tasks and follow-ups
- Supports mare search plus pregnant/open filtering on the home screen
- Provides per-mare detail tabs for daily logs, breeding, pregnancy, foaling, and medications
- Provides a per-mare calendar view with event dots and day-level history cards
- Includes onboarding state and a dev-only sample data seeder

## Stack

- Expo 55
- React Native 0.83
- React 19
- TypeScript
- `expo-sqlite` for on-device storage
- React Navigation
- Vitest for unit and repository tests
- Jest + React Native Testing Library for screen and navigation tests
- ESLint for source linting

## Project layout

```text
src/
  components/   reusable UI primitives and cards
  models/       domain types and derived reproductive logic
  navigation/   stack navigation
  screens/      app screens and mare detail tabs
  storage/      SQLite bootstrap, migrations, repositories
  utils/        filters, validation, task/date helpers, timeline/calendar helpers
docs/
  plans/        implementation plans and design notes
  superpowers/  older plan/spec artifacts
```

## Getting started

Prerequisites:

- Node.js 20+
- npm
- Expo-compatible Android or iOS simulator/device

Install dependencies:

```bash
npm install
```

Start the Expo dev server:

```bash
npm start
```

Common commands:

```bash
npm run android
npm run ios
npm run web
npm run typecheck
npm test
npm run test:screen
npm run test:coverage
npm run lint
```

## Storage and quality

- Database file: `breeder-helper.db`
- Migration entrypoint: `src/storage/migrations/index.ts`
- DB bootstrap: `src/storage/db.ts`
- CI: `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, coverage-enforced unit + screen tests (`npm run test:coverage:unit` and `npm run test:coverage:screen`), and `npm run lint`

## Product and planning docs

- Core product spec: `mare-tracker-spec.md`
- Current/recent design work: `docs/plans/`
- Earlier plan/spec artifacts: `docs/superpowers/plans/` and `docs/superpowers/specs/`
- Timeline/history design notes: `TIMELINE.md`

## Notes

- The app is local-first and intended to work fully offline.
- The repository currently contains both shipped code and in-progress planning/design documents for recent UI changes.
