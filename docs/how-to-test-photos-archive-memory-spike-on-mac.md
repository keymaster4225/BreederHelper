# How to test the Photos archive spike on iOS

Use this runbook to test the remaining Photos V1 Phase 0 hard gate on iOS. The goal is to prove that BreedWise can create and read the real `.breedwisebackup` archive format without building one giant archive in JavaScript memory.

This is no longer just the raw `expo-file-system` byte-stream test. The iOS Simulator run recorded on 2026-05-01 still counts for the raw binary file API sub-gate. This runbook is for the real archive sub-gate: `backup.json` plus binary photo entries written with streaming ZIP chunks.

There are two practical iOS paths:

- **Recommended:** run the spike on a Mac with iOS Simulator.
- **Possible, with setup:** run the spike on a physical iPhone through an EAS development build.

Do not use web as proof for this gate. The spike depends on native `expo-file-system` behavior and React Native runtime memory behavior.

An EAS iOS Simulator build by itself does not remove the Mac requirement. EAS can build the `.app` artifact in the cloud, but an iOS Simulator still runs only on macOS. Use an EAS Simulator build only if a Mac is available but local native compilation is failing or too slow.

A rented cloud Mac is valid for this test if it provides an interactive macOS desktop with Xcode and iOS Simulator. In that case, follow Option A on the rented Mac.

## What Success Means

The spike passes only when all of these are true:

- It runs in an iOS Expo runtime, not web.
- `fileSystemImportPath` is `expo-file-system`.
- `zipLibrary` is `fflate`.
- `zipApi` identifies the streaming `Zip` callback path, not sync `zip()` or async `zip()`.
- `bytesRoundTrip` is `true`.
- `appendWrite` is `true`.
- `archiveWrite` is `true`.
- `archiveReadBack` is `true`.
- `backupJsonEntry` is `true`.
- `masterPhotoEntry` is `true`.
- `thumbnailPhotoEntry` is `true`.
- `manifestMatchesEntries` is `true`.
- `streamedBytesWritten` is `209715200` bytes or higher when the 100 x 2 MB stress payload is included.
- `peakJsHeapBytes` is present, not `null`.
- `peakJsHeapMiB` is 150 MB or lower.
- `passed` is `true`.

If the result only has `bytesRoundTrip`, `appendWrite`, and `streamedBytesWritten`, you are running the old raw-byte spike. Stop, update the spike to the real archive version, and rerun.

If `peakJsHeapBytes` is `null`, treat the run as failed for this hard gate. That means the runtime did not expose the JS heap number, so we cannot prove the memory limit.

## Before Running

Make sure the Phase 0 branch contains the archive spike implementation:

```bash
rg -n "fflate|new Zip|breedwisebackup|backup.json|archiveReadBack" scripts src
```

If `rg` is unavailable:

```bash
grep -R -n -E "fflate|new Zip|breedwisebackup|backup.json|archiveReadBack" scripts src
```

Expected result: the search shows the spike uses `fflate`, writes a `.breedwisebackup`-shaped archive, and records archive readback fields.

If `fflate` is not installed yet, install it on the Phase 0 branch:

```bash
npm install --save fflate
```

Keep `fflate` committed only if this real archive spike passes on Android and iOS.

## Option A: Mac With iOS Simulator

Use this path when a Mac is available. It is the cleanest way to test iOS without changing the app's build setup.

### Prerequisites

The Mac needs:

- Xcode installed from the Mac App Store.
- Xcode opened at least once so it can finish installing command line tools.
- An iOS Simulator installed in Xcode.
- Node.js installed.
- The BreedWise repo cloned locally.

These steps assume the repo is at:

```bash
~/BreederHelper
```

If the repo is somewhere else on the Mac, use that folder instead.

### Step 1: Open Terminal In The Repo

```bash
cd ~/BreederHelper
pwd
```

Expected result: Terminal prints the BreedWise folder path.

### Step 2: Sync The Branch And Install Dependencies

```bash
git fetch origin
git switch photos-v1-phase-0
npm ci
```

If the archive spike change has not been committed yet and you are testing local edits, use `npm install` instead of `npm ci`.

### Step 3: Confirm This Is The Archive Spike

```bash
rg -n "fflate|new Zip|breedwisebackup|backup.json|archiveReadBack" scripts src
```

If `rg` is unavailable:

```bash
grep -R -n -E "fflate|new Zip|breedwisebackup|backup.json|archiveReadBack" scripts src
```

If this does not show the archive spike, stop. The old raw-byte spike is not enough to clear Phase 0.

### Step 4: Start The iOS Simulator Spike

```bash
EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1 npm run ios
```

Expected result:

- The iOS Simulator opens.
- The BreedWise app launches.
- The first screen says `Photos Archive Memory Spike`.
- The screen shows `Running archive stress test...`.

The test may take a while because it writes an archive-shaped stress payload.

### Step 5: Wait For PASS Or FAIL

Do not close the Simulator while the spinner is visible.

When the run finishes, the screen will show either `PASS`, `FAIL`, or an error message.

Expected passing output should include fields like this:

```json
{
  "platform": "ios",
  "fileSystemImportPath": "expo-file-system",
  "zipLibrary": "fflate",
  "zipApi": "Zip streaming callbacks",
  "bytesRoundTrip": true,
  "appendWrite": true,
  "archiveWrite": true,
  "archiveReadBack": true,
  "backupJsonEntry": true,
  "masterPhotoEntry": true,
  "thumbnailPhotoEntry": true,
  "manifestMatchesEntries": true,
  "streamedBytesWritten": 209715200,
  "peakJsHeapBytes": 73400320,
  "streamedMiB": 200,
  "peakJsHeapMiB": 70,
  "heapLimitMiB": 150,
  "passed": true
}
```

The exact heap number can differ. The important part is that `peakJsHeapMiB` is 150 or lower and the archive readback fields are true.

### Step 6: Save The Result

Record this context with the JSON:

````markdown
## Photos archive format spike - iOS Simulator

- Date:
- Mac:
- macOS:
- Xcode:
- Simulator:
- Branch/commit:
- Result: PASS or FAIL
- Notes:

```json
paste the full PHOTOS_ARCHIVE_SPIKE_RESULT payload here
```
````

Also paste the result into the Phase 0 execution notes in `docs/plans/2026-04-30-photos-v1-amended-implementation-plan.md`.

## Option B: EAS Development Build With A Physical iPhone

Use this path only when no Mac is available but a physical iPhone is available.

Important constraints:

- This tests a real iPhone, not an iOS Simulator.
- A paid Apple Developer account is usually required for signing an installable iPhone build.
- The current spike is guarded by `__DEV__`, so a normal EAS preview or production build will not show the spike screen.
- The clean version of this path is an EAS development build using `expo-dev-client`, then loading the JavaScript bundle from Metro with the spike flag enabled.

Current repo status:

- `eas.json` already has a `development` build profile with `"developmentClient": true`.
- `package.json` does not currently list `expo-dev-client`.
- Before using this path, add `expo-dev-client` in a small branch and build from that branch, or create a dedicated temporary spike build that allows the spike screen in an internal build.

### Step 1: Prepare The Repo

```bash
git fetch origin
git switch photos-v1-phase-0
npm install
npx expo install expo-dev-client
```

Expected result: `package.json` and `package-lock.json` update for `expo-dev-client`.

Do not mix the temporary development-client setup into unrelated work.

### Step 2: Confirm This Is The Archive Spike

```bash
rg -n "fflate|new Zip|breedwisebackup|backup.json|archiveReadBack" scripts src
```

If `rg` is unavailable:

```bash
grep -R -n -E "fflate|new Zip|breedwisebackup|backup.json|archiveReadBack" scripts src
```

If this does not show the archive spike, stop.

### Step 3: Log In To EAS

```bash
npx eas login
```

Expected result: the command confirms you are logged in.

### Step 4: Build The iPhone Development App

```bash
npx eas build --platform ios --profile development
```

Expected result:

- EAS starts an iOS build.
- EAS asks for or uses Apple signing credentials.
- When the build finishes, EAS provides an install link or QR code.

Install that build on the iPhone.

### Step 5: Start Metro With The Spike Flag

On Windows PowerShell:

```powershell
$env:EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE="1"; npx expo start --tunnel
```

On macOS, Linux, or Git Bash:

```bash
EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1 npx expo start --tunnel
```

Expected result: Expo prints a QR code or development-server URL.

### Step 6: Open The Development Build On The iPhone

Open the installed BreedWise development build on the iPhone.

Use the development build launcher to open the project from the Expo server started in the previous step. If the launcher shows a QR scanner, scan the QR code from Terminal.

Expected result:

- The app opens.
- The first screen says `Photos Archive Memory Spike`.
- The screen shows `Running archive stress test...`.

If the normal BreedWise app opens instead, the spike flag did not reach the JavaScript bundle. Stop and confirm Metro was started with `EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1`.

### Step 7: Record The iPhone Result

Use this format:

````markdown
## Photos archive format spike - physical iPhone

- Date:
- iPhone model:
- iOS version:
- EAS build profile: development
- Branch/commit:
- Result: PASS or FAIL
- Notes:

```json
paste the full PHOTOS_ARCHIVE_SPIKE_RESULT payload here
```
````

## Failure Meaning

- `zipLibrary` is missing or not `fflate`: wrong spike.
- `zipApi` says sync or async `zip()`: wrong archive strategy because it can buffer the full archive.
- `archiveWrite: false`: streaming archive creation failed.
- `archiveReadBack: false`: archive output was not readable and cannot be trusted for backup/restore.
- `backupJsonEntry`, `masterPhotoEntry`, or `thumbnailPhotoEntry` is `false`: archive manifest shape is incomplete.
- `manifestMatchesEntries: false`: restore cannot safely trust the archive.
- `peakJsHeapBytes: null`: memory gate is not proven.
- `peakJsHeapMiB` over `150`: archive strategy uses too much JS heap.
- App crash or reload: treat as a failed archive spike and record what happened.

Do not start Phase 1 from a failed iOS archive spike.

## Optional: Capture The Terminal Log

The app also prints a result line in Terminal beginning with:

```text
PHOTOS_ARCHIVE_SPIKE_RESULT
```

If the Simulator text is hard to copy, copy that Terminal line instead. It contains the same JSON payload.
