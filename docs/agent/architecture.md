# Architecture and Code Ownership

Use this when changing module structure, moving logic, or deciding where new code belongs.

## Key Paths

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
- Backup/restore helpers: `src/storage/backup/*`
- Onboarding helpers: `src/utils/onboarding.ts`
- Dashboard derivation: `src/utils/dashboardAlerts.ts`
- Dashboard UI: `src/components/DashboardSection.tsx`, `src/components/AlertCard.tsx`
- Shared form controls: `src/components/FormControls.tsx`
- Shared card parts: `src/components/RecordCardParts.tsx`
- Theme: `src/theme.ts`
- Import alias: `@/*` maps to `src/*`

## Working Conventions for Code Changes

- Keep business logic in repositories, hooks, selectors, or utilities, not directly in presentation components.
- Home, mare detail, foal form, and medication form flows already delegate load/save/delete orchestration to hooks; preserve that separation.
- Top-level screens and reusable child UI components do not import `@/storage/repositories` or `@/storage/dataInvalidation`.
- Repository access belongs in hooks under `src/hooks/`.
- `useRecordForm` is a helper for hooks, not for screen components directly.
- Backup and restore ownership lives under `src/storage/backup`.
- Prefer reusable pure derivation logic over screen-local ad hoc transforms.
- For behavior changes, update tests when practical, especially validation, repository, and screen coverage.
- If Jest tests touch onboarding mocks and use `jest.requireMock`, make sure `@/utils/onboarding` is explicitly mocked or CI can fail with missing `setOnboardingComplete`.
