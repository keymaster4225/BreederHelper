# Superhuman Board

**Status:** in-progress  
**Started:** 2026-04-16  
**Rollback Point:** `cffb3bdd3f200e5bc4196a6c23116f8669d7883c`

## Project Conventions

- Package manager: `npm` (`package-lock.json`)
- Runtime: Expo SDK 55 + React Native + TypeScript
- Unit tests: Vitest via `npm test`
- Screen tests: Jest + RNTL via `npm run test:screen`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Source roots: `src/`, `App.tsx`
- Existing plan: `docs/plans/2026-04-16-backup-restore-implementation-plan.md`

## Current Wave

### Wave 1

- [ ] Task 1: Add Expo dependencies and Jest mocks
- [ ] Task 2: Expand onboarding storage helpers
- [ ] Task 3: Define backup contract and shared types

### Later Waves

- [ ] Task 4: Implement raw-row serializer
- [ ] Task 5: Implement strict validator
- [ ] Task 6: Implement file I/O wrapper
- [ ] Task 7: Implement safety snapshot management
- [ ] Task 8: Implement restore transaction engine
- [ ] Task 9: Add `useDataBackup` orchestration hook
- [ ] Task 10: Implement `SettingsScreen`
- [ ] Task 11: Implement `DataBackupScreen`
- [ ] Task 12: Wire navigation and integration coverage
- [ ] Task 13: Final verification and manual QA
