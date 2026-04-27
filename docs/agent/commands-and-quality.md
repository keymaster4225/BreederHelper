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

## Test Policy

- Prefer behavior and state assertions over SQL call-index assertions. When storage tests need to inspect SQL, use the shared repository DB harness in `src/test/repoDb.ts` and assert named insert/update fields.
- Do not add new local `createFakeDb` helpers in repository or backup tests. Extend the shared harness and keep domain-specific maps local only when a test needs stateful behavior.
- Use `integration` only for tests that exercise real module boundaries. If screens, hooks, repositories, or destinations are heavily mocked, name the test as a wiring, hook, unit, or screen test instead.
- Keep order assertions only where order is the contract, such as restore foreign-key deletes/inserts and same-transaction child replacement.
