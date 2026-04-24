# Commands and Quality Gates

Use this when installing, running, testing, linting, or preparing code for handoff.

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
