# EAS Store Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate BreedWise production release preparation so quality gates run first, EAS builds are created reproducibly, binaries can be submitted to the app stores, and store-release creation is handled according to an explicit release mode.

**Architecture:** Keep release automation layered: local scripts validate and prepare the repo, EAS builds and submits binaries, and store release creation remains a separate optional stage because binary upload is not the same as App Store or Play Store release approval. Use manual triggers first so app identity, credentials, and store-side policies are proven before any tag- or main-branch automation.

**Tech Stack:** Expo SDK 55, EAS Build, EAS Submit, EAS Workflows or GitHub Actions, npm scripts, App Store Connect, Google Play Console, optional Fastlane for full metadata/release management.

---

## Current Repository Facts

- `eas.json` already defines `development`, `preview`, and `production` build profiles.
- `eas.json` uses `"appVersionSource": "remote"` and production `"autoIncrement": true`.
- `eas.json` currently has `"submit": { "production": {} }`, so store submission is not configured yet.
- `app.json` currently uses iOS bundle ID `com.tompkins.breedwise`.
- `app.json` currently uses Android package `com.anonymous.breedwise`; this must be verified before any Play Store automation.
- `scripts/build-release.sh` currently validates version sync, updates `package.json`, `package-lock.json`, and `app.json`, then runs `eas build -p all`.
- `.github/workflows/ci.yml` already runs install, typecheck, coverage-enforced unit tests, coverage-enforced screen tests, and lint.
- `docs/agent/seeding-preview-release.md` says release builds should go through `npm run build:release` or `bash scripts/build-release.sh`.

## Release Modes

The implementation must support exactly these release modes so "submit" and "release" do not drift into ambiguous behavior:

- `build-only`: run checks and create EAS production builds, but do not submit binaries.
- `upload-only`: run checks, create EAS production builds, and submit binaries to App Store Connect/TestFlight and the selected Google Play track.
- `prepare-release`: do everything from `upload-only`, then attach release notes and prepare store release records where supported, but do not submit for App Review or production rollout.
- `submit-for-review`: do everything from `prepare-release`, then submit iOS for App Review and/or promote Android to the configured rollout track. This mode must remain disabled until explicitly approved after the first successful `upload-only` run.

Default mode for the first implementation is `build-only`.

## Hard Stop Gates

Do not implement later phases until these gates are satisfied:

1. Android package identity has been confirmed.
   - Current value: `com.anonymous.breedwise`.
   - Required decision: keep this package because it is the real Play Console identity, or change it before first Play Store release.
   - If changed, update `app.json` and document the decision before configuring submit automation.

2. Store release mode has been selected.
   - Required decision: first automated workflow must use `build-only` or `upload-only`.
   - `submit-for-review` requires a separate explicit user approval after lower-risk runs succeed.

3. Store-side prerequisites are complete.
   - Apple app exists in App Store Connect.
   - Google Play app exists in Play Console.
   - Google Play first manual upload requirement has been satisfied if applicable.
   - Expo project access and EAS credentials are configured.

4. Secret storage location has been chosen.
   - EAS secrets if using EAS Workflows.
   - GitHub Actions secrets if using GitHub Actions.
   - No service-account JSON, API key, or private key may be committed to the repo.

---

## File Plan

Create:

- `docs/release-automation.md`: operator-facing release automation guide.
- Optional `.eas/workflows/release.yml`: EAS manual release workflow if EAS Workflows is selected.
- Optional `.github/workflows/release.yml`: GitHub manual release workflow if GitHub Actions is selected instead.

Modify:

- `eas.json`: add explicit `submit.production.ios` and `submit.production.android` configuration after app identities and credential strategy are confirmed.
- `scripts/build-release.sh`: turn the existing build script into a quality-gated release entrypoint with release modes.
- `package.json`: add release scripts that call the release entrypoint.
- `docs/agent/seeding-preview-release.md`: update release notes after the script behavior changes.
- `README.md`: update command summary only if new public npm scripts are added.

Do not modify:

- App runtime code under `src/`.
- SQLite migrations.
- Backup/import/export code.
- Store metadata assets unless Phase 5 is explicitly approved.

---

## Task 1: Record Release Decisions

**Files:**
- Create: `docs/release-automation.md`

- [ ] **Step 1: Create the release automation decision record**

Add `docs/release-automation.md` with this initial content:

````markdown
# Release Automation

BreedWise releases are automated in stages. The first safe target is `build-only`; `upload-only` is allowed after store credentials are verified. `prepare-release` and `submit-for-review` require separate explicit approval.

## App Identities

- iOS bundle identifier: `com.tompkins.breedwise`
- Android package: `com.anonymous.breedwise`

Before enabling Google Play submission, confirm that the Android package is the intended permanent Play Console app identity. If it is not, change it before the first Play Store release.

## Release Modes

- `build-only`: run checks and create EAS production builds.
- `upload-only`: build and submit binaries to App Store Connect/TestFlight and the selected Google Play track.
- `prepare-release`: upload binaries and prepare store release notes or release records.
- `submit-for-review`: submit the prepared release for App Review or Play rollout. This mode is disabled until explicitly approved.

## Required Secrets

Secrets must be stored in EAS or GitHub Actions secret storage, not in the repository.

- `EXPO_TOKEN`
- App Store Connect API key or EAS-managed Apple credentials
- Google Play service account JSON

## Quality Gates

Production release automation must run these commands before EAS build or submit:

```bash
npm run typecheck
npm run test:coverage:unit
npm run test:coverage:screen
npm run lint
```

Any failing command stops the release. Do not bypass a failing gate.
````

- [ ] **Step 2: Verify the document exists**

Run:

```bash
Get-Content docs\release-automation.md
```

Expected: the document prints with the app identities, release modes, required secrets, and quality gates.

- [ ] **Step 3: Commit the documentation decision**

Run:

```bash
git add docs/release-automation.md
git commit -m "Document release automation policy"
```

Expected: commit succeeds. If there are unrelated working-tree changes, stage only `docs/release-automation.md`.

---

## Task 2: Verify App Store and Play Store Identity

**Files:**
- Modify: `docs/release-automation.md`
- Optional modify: `app.json`

- [ ] **Step 1: Confirm iOS identity**

Check that App Store Connect has an app record for:

```text
Bundle ID: com.tompkins.breedwise
App name: BreedWise
```

Record the App Store Connect app ID in `docs/release-automation.md`:

```markdown
## Store Records

- App Store Connect app ID: `<numeric app id recorded by operator>`
- Google Play package: `com.anonymous.breedwise`
```

- [ ] **Step 2: Confirm Android package**

Check Play Console for the intended production app package.

If the intended package is `com.anonymous.breedwise`, keep `app.json` unchanged and record:

```markdown
- Android package decision: keep `com.anonymous.breedwise`; it is the permanent Play Console identity.
```

If the intended package is different, update `app.json` before any production Play release. For example, if the permanent package is `com.tompkins.breedwise`, change:

```json
"android": {
  "package": "com.tompkins.breedwise",
  "adaptiveIcon": {
    "foregroundImage": "./assets/foreground.png",
    "backgroundImage": "./assets/background.png"
  }
}
```

Then record:

```markdown
- Android package decision: changed to `com.tompkins.breedwise` before first Play Store release.
```

- [ ] **Step 3: Validate Expo config**

Run:

```bash
npx expo config --type public
```

Expected: command succeeds and prints the selected iOS bundle identifier and Android package.

- [ ] **Step 4: Commit identity documentation and any config change**

Run one of:

```bash
git add docs/release-automation.md
git commit -m "Record store app identities"
```

or, if `app.json` changed:

```bash
git add app.json docs/release-automation.md
git commit -m "Set permanent Android package identity"
```

Expected: commit succeeds. Do not continue if Android package identity is still uncertain.

---

## Task 3: Configure EAS Submit Profiles

**Files:**
- Modify: `eas.json`
- Modify: `.gitignore`
- Modify: `docs/release-automation.md`

- [ ] **Step 1: Add ignored local credential filename**

Ensure `.gitignore` contains:

```gitignore
google-service-account.json
*.p8
```

Expected: local Google service-account files and App Store Connect private keys cannot be committed accidentally.

- [ ] **Step 2: Update EAS submit config**

After recording the real App Store Connect app ID, update `eas.json`.

For initial safe automation, target the Android `internal` track:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "REPLACE_WITH_NUMERIC_ASC_APP_ID"
      },
      "android": {
        "track": "internal",
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

Before committing, replace `REPLACE_WITH_NUMERIC_ASC_APP_ID` with the actual numeric App Store Connect app ID recorded in `docs/release-automation.md`.

- [ ] **Step 3: Document credential setup**

Append this to `docs/release-automation.md`:

```markdown
## Credential Setup

For local Android submission, place the Google Play service account key at `google-service-account.json`. This file is ignored and must not be committed.

For CI or EAS Workflow submission, inject the Google service account JSON from secret storage and write it to `google-service-account.json` only inside the job workspace.

For iOS submission, prefer App Store Connect API key authentication or EAS-managed Apple credentials. Do not commit `.p8` files.
```

- [ ] **Step 4: Validate JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8')); console.log('eas.json valid')"
```

Expected:

```text
eas.json valid
```

- [ ] **Step 5: Commit EAS submit config**

Run:

```bash
git add eas.json .gitignore docs/release-automation.md
git commit -m "Configure EAS submit profiles"
```

Expected: commit succeeds. If credentials are unavailable, stop after documenting the missing credential and do not fake the submit profile.

---

## Task 4: Add Quality-Gated Local Release Modes

**Files:**
- Modify: `scripts/build-release.sh`
- Modify: `package.json`
- Modify: `docs/agent/seeding-preview-release.md`
- Modify: `docs/release-automation.md`

- [ ] **Step 1: Extend `scripts/build-release.sh` arguments**

Add support for these options:

```text
--mode build-only|upload-only|prepare-release|submit-for-review
--version x.y.z
--skip-version-bump
--yes
```

Behavior:

- default `--mode build-only`
- reject `prepare-release` and `submit-for-review` with a clear error until Phase 5 enables them
- require a clean working tree unless `--skip-version-bump` is used for a CI workflow that already checked out a release commit
- run all quality gates before EAS commands
- run `eas build --platform all --profile production` for `build-only`
- run `eas build --platform all --profile production --auto-submit` for `upload-only`

- [ ] **Step 2: Preserve existing version checks**

Keep the existing checks that:

- `app.json` has valid semver
- `package.json` has valid semver
- versions match before bumping
- EAS remote versioning is reported
- production native build numbers auto-increment remotely

- [ ] **Step 3: Add quality gate function**

Implement the script flow so these commands run before EAS build:

```bash
npm run typecheck
npm run test:coverage:unit
npm run test:coverage:screen
npm run lint
```

Expected behavior: if any command exits non-zero, the script exits non-zero and does not call EAS.

- [ ] **Step 4: Add npm scripts**

Update `package.json` scripts:

```json
"release:check": "npm run typecheck && npm run test:coverage:unit && npm run test:coverage:screen && npm run lint",
"release:build": "bash scripts/build-release.sh --mode build-only",
"release:upload": "bash scripts/build-release.sh --mode upload-only",
"build:release": "bash scripts/build-release.sh"
```

- [ ] **Step 5: Update release docs**

In `docs/agent/seeding-preview-release.md`, replace the current release-script note with:

```markdown
- Release builds should go through `npm run release:build` for build-only validation or `npm run release:upload` after store credentials are configured.
- The release script updates `package.json`, `package-lock.json`, and `app.json`, runs typecheck, unit coverage, screen coverage, and lint, then runs the selected EAS build or build-and-submit mode.
- `submit-for-review` is not enabled by default and requires explicit approval after lower-risk release modes succeed.
```

In `docs/release-automation.md`, add:

````markdown
## Local Commands

```bash
npm run release:check
npm run release:build
npm run release:upload
```

Use `release:build` first. Use `release:upload` only after credentials and app identities have been verified.
````

- [ ] **Step 6: Verify local checks**

Run:

```bash
npm run release:check
```

Expected: typecheck, unit coverage, screen coverage, and lint all pass.

- [ ] **Step 7: Verify build-only dry behavior without starting EAS**

If the script supports a dry-run flag, run:

```bash
bash scripts/build-release.sh --mode build-only --skip-version-bump --dry-run
```

Expected: script prints the EAS command it would run and exits zero after quality gates.

If no dry-run flag is added, run only `npm run release:check` in this task and defer real EAS build to Task 7.

- [ ] **Step 8: Commit release script changes**

Run:

```bash
git add scripts/build-release.sh package.json package-lock.json docs/agent/seeding-preview-release.md docs/release-automation.md
git commit -m "Add quality-gated release modes"
```

Expected: commit succeeds. If `package-lock.json` did not change, omit it from `git add`.

---

## Task 5: Add Manual Workflow Automation

**Files:**
- Create one of:
  - `.eas/workflows/release.yml`
  - `.github/workflows/release.yml`
- Modify: `docs/release-automation.md`

Use EAS Workflows if the Expo project is connected to GitHub and EAS Workflow secrets are preferred. Use GitHub Actions if existing GitHub CI is the preferred release control surface.

### Option A: EAS Workflow

- [ ] **Step 1A: Create `.eas/workflows/release.yml`**

Use a manual trigger with inputs for release mode and platform. Keep default mode `build-only`.

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      mode:
        description: Release mode
        type: choice
        required: true
        default: build-only
        options:
          - build-only
          - upload-only
      platform:
        description: Platform
        type: choice
        required: true
        default: all
        options:
          - all
          - ios
          - android

jobs:
  build_android:
    name: Build Android production app
    if: ${{ inputs.platform == 'all' || inputs.platform == 'android' }}
    type: build
    params:
      platform: android
      profile: production

  build_ios:
    name: Build iOS production app
    if: ${{ inputs.platform == 'all' || inputs.platform == 'ios' }}
    type: build
    params:
      platform: ios
      profile: production

  submit_android:
    name: Submit Android production app
    if: ${{ inputs.mode == 'upload-only' && (inputs.platform == 'all' || inputs.platform == 'android') }}
    needs:
      - build_android
    type: submit
    params:
      platform: android
      profile: production

  submit_ios:
    name: Submit iOS production app
    if: ${{ inputs.mode == 'upload-only' && (inputs.platform == 'all' || inputs.platform == 'ios') }}
    needs:
      - build_ios
    type: submit
    params:
      platform: ios
      profile: production
```

- [ ] **Step 2A: Validate EAS Workflow schema**

Fetch and use the current EAS Workflow schema before treating the file as valid:

```bash
node C:\Users\Patrick\.codex\plugins\cache\openai-curated\expo\4ce8a86b\skills\expo-cicd-workflows\scripts\fetch.js https://api.expo.dev/v2/workflows/schema
node C:\Users\Patrick\.codex\plugins\cache\openai-curated\expo\4ce8a86b\skills\expo-cicd-workflows\scripts\validate.js .eas/workflows/release.yml
```

Expected: validator reports the workflow is valid. If it reports schema errors, update the workflow to match the current schema rather than forcing this YAML shape.

### Option B: GitHub Actions

- [ ] **Step 1B: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      mode:
        description: Release mode
        required: true
        default: build-only
        type: choice
        options:
          - build-only
          - upload-only
      platform:
        description: Platform
        required: true
        default: all
        type: choice
        options:
          - all
          - ios
          - android

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Unit Tests + Coverage
        run: npm run test:coverage:unit

      - name: Screen Tests + Coverage
        run: npm run test:coverage:screen

      - name: Lint
        run: npm run lint

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Write Google service account key
        if: ${{ inputs.mode == 'upload-only' }}
        shell: bash
        run: printf '%s' '${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}' > google-service-account.json

      - name: Build only
        if: ${{ inputs.mode == 'build-only' }}
        run: eas build --platform "${{ inputs.platform }}" --profile production --non-interactive

      - name: Build and submit
        if: ${{ inputs.mode == 'upload-only' }}
        run: eas build --platform "${{ inputs.platform }}" --profile production --auto-submit --non-interactive
```

- [ ] **Step 2B: Validate GitHub workflow syntax locally where possible**

Run:

```bash
node -e "console.log('release workflow created')"
```

Expected:

```text
release workflow created
```

If `actionlint` is installed, also run:

```bash
actionlint .github/workflows/release.yml
```

Expected: no output and exit code zero.

- [ ] **Step 3: Document chosen workflow**

Add one of these sections to `docs/release-automation.md`:

```markdown
## Manual EAS Workflow

Use the `Release` workflow in EAS. Start with `mode=build-only`. Use `mode=upload-only` only after app identities and credentials are verified.
```

or:

```markdown
## Manual GitHub Release Workflow

Use the `Release` workflow in GitHub Actions. Start with `mode=build-only`. Use `mode=upload-only` only after app identities and credentials are verified.
```

- [ ] **Step 4: Commit workflow**

Run one of:

```bash
git add .eas/workflows/release.yml docs/release-automation.md
git commit -m "Add manual EAS release workflow"
```

or:

```bash
git add .github/workflows/release.yml docs/release-automation.md
git commit -m "Add manual GitHub release workflow"
```

Expected: commit succeeds.

---

## Task 6: Add Release Notes Extraction

**Files:**
- Modify: `RELEASE-NOTES.md`
- Create: `scripts/release-notes.js`
- Modify: `package.json`
- Modify: `docs/release-automation.md`

- [ ] **Step 1: Standardize release notes format**

Update `RELEASE-NOTES.md` so each release section uses this format:

```markdown
## 1.3.6

- Added release automation dry-run checks.
- Fixed release script version validation.
```

- [ ] **Step 2: Create `scripts/release-notes.js`**

Create a Node script that reads `RELEASE-NOTES.md` and prints the section for a requested version:

```js
const fs = require('fs');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/release-notes.js <version>');
  process.exit(1);
}

const source = fs.readFileSync('RELEASE-NOTES.md', 'utf8');
const heading = `## ${version}`;
const start = source.indexOf(heading);

if (start === -1) {
  console.error(`No release notes found for ${version}`);
  process.exit(1);
}

const rest = source.slice(start + heading.length);
const nextHeading = rest.search(/\n## \d+\.\d+\.\d+/);
const section = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();

if (!section) {
  console.error(`Release notes for ${version} are empty`);
  process.exit(1);
}

console.log(section);
```

- [ ] **Step 3: Add npm script**

Add:

```json
"release:notes": "node scripts/release-notes.js"
```

- [ ] **Step 4: Verify notes extraction**

Run:

```bash
npm run release:notes -- 1.3.5
```

Expected: prints the `1.3.5` release notes section, or fails with `No release notes found for 1.3.5` if the section has not been added yet. If it fails, add a `## 1.3.5` section before continuing.

- [ ] **Step 5: Document release notes**

Append to `docs/release-automation.md`:

````markdown
## Release Notes

Release notes live in `RELEASE-NOTES.md`. Each release must have a `## x.y.z` section before `prepare-release` or `submit-for-review` can run.

Use:

```bash
npm run release:notes -- 1.3.5
```
````

- [ ] **Step 6: Commit release notes tooling**

Run:

```bash
git add RELEASE-NOTES.md scripts/release-notes.js package.json package-lock.json docs/release-automation.md
git commit -m "Add release notes extraction"
```

Expected: commit succeeds. If `package-lock.json` did not change, omit it from `git add`.

---

## Task 7: Prove Build-Only Release

**Files:**
- Modify: `docs/release-automation.md`

- [ ] **Step 1: Run full local gate**

Run:

```bash
npm run release:check
```

Expected: typecheck, unit coverage, screen coverage, and lint pass.

- [ ] **Step 2: Run production build without submit**

Run:

```bash
npm run release:build
```

Expected:

- script validates versions
- script runs all quality gates
- EAS starts production builds
- EAS provides build URLs
- no store submission starts

- [ ] **Step 3: Record build-only result**

Append to `docs/release-automation.md`:

```markdown
## First Build-Only Verification

- Date: 2026-04-30
- Mode: `build-only`
- Result: `<record pass/fail>`
- Android build URL: `<record EAS URL>`
- iOS build URL: `<record EAS URL>`
- Follow-up: `<record any credential, build, or store issue>`
```

- [ ] **Step 4: Commit verification notes**

Run:

```bash
git add docs/release-automation.md
git commit -m "Record first build-only release verification"
```

Expected: commit succeeds.

---

## Task 8: Prove Upload-Only Release

**Files:**
- Modify: `docs/release-automation.md`

Prerequisites:

- Task 7 succeeded.
- Store credentials are configured.
- Android target track is non-production, preferably `internal`.
- User explicitly approves running upload-only release.

- [ ] **Step 1: Run upload-only release**

Run:

```bash
npm run release:upload
```

Expected:

- script validates versions
- script runs all quality gates
- EAS starts production builds
- successful builds are submitted
- iOS appears in App Store Connect/TestFlight after processing
- Android appears in the configured Play Console track
- no final production rollout or App Review submission is performed by this task

- [ ] **Step 2: Record upload-only result**

Append to `docs/release-automation.md`:

```markdown
## First Upload-Only Verification

- Date: 2026-04-30
- Mode: `upload-only`
- Result: `<record pass/fail>`
- Android submission URL: `<record EAS or Play Console URL>`
- iOS submission URL: `<record EAS or App Store Connect URL>`
- Follow-up: `<record any processing, credential, or store issue>`
```

- [ ] **Step 3: Commit verification notes**

Run:

```bash
git add docs/release-automation.md
git commit -m "Record first upload-only release verification"
```

Expected: commit succeeds.

---

## Task 9: Decide Whether Full Store Release Creation Is Needed

**Files:**
- Modify: `docs/release-automation.md`
- Optional create: `fastlane/Appfile`
- Optional create: `fastlane/Fastfile`
- Optional create: `fastlane/metadata/android/en-US/changelogs/default.txt`
- Optional create: `fastlane/metadata/ios/en-US/release_notes.txt`

- [ ] **Step 1: Make an explicit Phase 5 decision**

Add one of these to `docs/release-automation.md`:

```markdown
## Store Release Creation Decision

Decision: keep v1 automation at `upload-only`. Final App Store review submission, Google Play rollout, screenshots, and metadata are handled manually in the store consoles.
```

or:

```markdown
## Store Release Creation Decision

Decision: automate `prepare-release` with release notes, but keep final App Review submission and Play production rollout manual.
```

or:

```markdown
## Store Release Creation Decision

Decision: automate `submit-for-review` after explicit release approval. This requires Fastlane or store API integration and must be tested first against TestFlight/internal or closed tracks.
```

- [ ] **Step 2: If staying at upload-only, stop here**

Expected: no Fastlane files are created. Release operators finish metadata and review submission manually.

- [ ] **Step 3: If automating metadata, add Fastlane as a separate implementation plan**

Create a follow-up plan before adding Fastlane. The follow-up must cover:

- credential storage
- release notes mapping
- Android track and rollout percentage
- iOS review submission policy
- screenshot and metadata ownership
- rollback/manual intervention
- first-run verification on non-production tracks

Expected: no `submit-for-review` automation is implemented without this follow-up plan and approval.

---

## Verification Checklist

- [ ] `docs/release-automation.md` records app identities, release modes, required secrets, and quality gates.
- [ ] Android package identity is confirmed before Play Store automation.
- [ ] `eas.json` has real submit profiles before `upload-only` is used.
- [ ] Credential files are ignored and not committed.
- [ ] Local release script runs quality gates before EAS commands.
- [ ] Manual workflow defaults to `build-only`.
- [ ] EAS workflow YAML is schema-validated if EAS Workflows are used.
- [ ] GitHub workflow is linted with `actionlint` if GitHub Actions are used and `actionlint` is available.
- [ ] First `build-only` run is recorded.
- [ ] First `upload-only` run is recorded.
- [ ] `submit-for-review` remains disabled until explicitly approved.

## Residual Risks

- Google Play may require one manual upload before API submission works.
- App Store Connect processing can delay TestFlight availability after upload.
- Store metadata, screenshots, privacy labels, and review notes are not handled by EAS Submit.
- Android package identity cannot be changed for an existing Play app without creating a new app.
- EAS Workflow syntax may evolve; validate against the current Expo schema before relying on workflow YAML.

## Plan Amendments From Brooks-Lint Review

This plan incorporates the prior Brooks-Lint findings:

- Android package identity is now a hard stop gate.
- Release behavior is split into explicit modes: `build-only`, `upload-only`, `prepare-release`, and `submit-for-review`.
- `submit-for-review` is disabled until lower-risk modes succeed and the user explicitly approves enabling it.
- EAS Workflow schema validation is an explicit task.
- Store release creation is separated from binary submission and deferred unless explicitly approved.
