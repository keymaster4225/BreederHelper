# Seeding, Preview, and Release Notes

Use this when changing sample data, preview build behavior, versioning, or release scripts.

## Seeding, Preview, and Release Notes

- Local sample-data seeding should stay available during normal local testing as well as preview builds via `canSeedPreviewData()`.
- Preview seeding is intended to be idempotent via stable fixture IDs and per-record existence checks.
- EAS `preview` Android builds use `buildType: app-bundle`.
- EAS `preview` uses `autoIncrement: true` with remote app versioning.
- Release builds should go through `npm run build:release` or `bash scripts/build-release.sh`.
- The release script updates `package.json`, `package-lock.json`, and `app.json`, then runs `eas build -p all`.
