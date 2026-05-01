# How to test the Photos Archive memory spike on iOS

Use this runbook to test the Photos V1 archive hard gate on iOS. The goal is to prove that the app can write binary file chunks without building one giant archive in JavaScript memory.

There are two practical iOS paths:

- **Recommended:** run the spike on a Mac with iOS Simulator.
- **Possible, with setup:** run the spike on a physical iPhone through an EAS development build from Windows or another non-Mac machine.

Do not use web as proof for this hard gate. The spike depends on native `expo-file-system` behavior and React Native runtime memory behavior.

An EAS iOS Simulator build by itself does not remove the Mac requirement. EAS can build the `.app` artifact in the cloud, but an iOS Simulator still runs only on macOS. Use an EAS Simulator build only if a Mac is available but local native compilation is failing or too slow.

A rented cloud Mac is valid for this test if it provides an interactive macOS desktop with Xcode and iOS Simulator. In that case, follow Option A on the rented Mac.

## What success means

The spike passes only when all of these are true:

- `bytesRoundTrip` is `true`.
- `appendWrite` is `true`.
- `streamedBytesWritten` is `209715200` bytes, which is 100 files x 2 MB.
- `peakJsHeapBytes` is present, not `null`.
- `peakJsHeapMiB` is 150 MB or lower.

If `peakJsHeapBytes` is `null`, treat the run as failed for this hard gate. That means the runtime did not expose the JS heap number, so we cannot prove the memory limit.

## Prerequisites

For the recommended Mac Simulator path, make sure the Mac has:

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

## Option A: Mac with iOS Simulator

Use this path when a Mac is available. It is the cleanest way to test iOS without changing the app's build setup.

### Step 1: Open Terminal in the repo

Open the Terminal app and move into the BreedWise folder:

```bash
cd ~/BreederHelper
```

Confirm you are in the right place:

```bash
pwd
```

Expected result: Terminal prints the BreedWise folder path.

### Step 2: Install dependencies

Run:

```bash
npm install
```

Expected result: the command finishes without an error. Warnings are okay.

### Step 3: Start the memory spike on iOS Simulator

Run:

```bash
EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1 npm run ios
```

Expected result:

- The iOS Simulator opens.
- The BreedWise app launches.
- The first screen says `Photos Archive Memory Spike`.
- The screen shows `Running archive stress test...`.

The test may take a little while because it writes 200 MB of representative binary data.

### Step 4: Wait for PASS or FAIL

Do not close the Simulator while the spinner is visible.

When the run finishes, the screen will show either `PASS`, `FAIL`, or an error message.

Expected passing output looks similar to this:

```json
{
  "platform": "ios",
  "fileSystemImportPath": "expo-file-system",
  "bytesRoundTrip": true,
  "appendWrite": true,
  "streamedBytesWritten": 209715200,
  "peakJsHeapBytes": 73400320,
  "fallbackDecision": "Proceed only if this passes on both iOS and Android and peak JS heap remains below 150 MB.",
  "streamedMiB": 200,
  "peakJsHeapMiB": 70,
  "heapLimitMiB": 150
}
```

The exact heap number can differ. The important part is that `peakJsHeapMiB` is 150 or lower.

### Step 5: Save the result

Copy the full JSON result from the Simulator screen into the Photos V1 plan or the test notes.

Record this extra context with it:

- Mac model and chip, for example `MacBook Air M2`.
- macOS version.
- Xcode version.
- iOS Simulator device and iOS version.
- Date tested.

Use this format:

````markdown
## Photos archive memory spike - iOS Simulator

- Date:
- Mac:
- macOS:
- Xcode:
- Simulator:
- Result: PASS or FAIL
- Notes:

```json
paste the full spike result here
```
````

## Option B: Windows or cloud build with a physical iPhone

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

### Step 1: Prepare the repo for an iPhone development build

From the repo folder, install the development client package:

```bash
npx expo install expo-dev-client
```

Expected result: `package.json` and `package-lock.json` update.

Commit this on a temporary spike branch or a proper PR branch. Do not mix it into unrelated work.

### Step 2: Log in to EAS

Run:

```bash
npx eas login
```

Expected result: the command confirms you are logged in.

### Step 3: Build the iPhone development app in EAS

Run:

```bash
npx eas build --platform ios --profile development
```

Expected result:

- EAS starts an iOS build.
- EAS asks for or uses Apple signing credentials.
- When the build finishes, EAS provides an install link or QR code.

Install that build on the iPhone.

### Step 4: Start Metro with the spike flag

On Windows PowerShell, run:

```powershell
$env:EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE="1"; npx expo start --tunnel
```

Use `--tunnel` because it avoids most same-network discovery problems.

On macOS, Linux, or Git Bash, the equivalent command is:

```bash
EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1 npx expo start --tunnel
```

Expected result: Expo prints a QR code or development-server URL.

### Step 5: Open the development build on the iPhone

Open the installed BreedWise development build on the iPhone.

Use the development build launcher to open the project from the Expo server started in the previous step. If the launcher shows a QR scanner, scan the QR code from Terminal.

Expected result:

- The app opens.
- The first screen says `Photos Archive Memory Spike`.
- The screen shows `Running archive stress test...`.

If the normal BreedWise app opens instead, the spike flag did not reach the JavaScript bundle. Stop and confirm Metro was started with `EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1`.

### Step 6: Record the iPhone result

Use this format:

````markdown
## Photos archive memory spike - physical iPhone

- Date:
- iPhone model:
- iOS version:
- EAS build profile: development
- Result: PASS or FAIL
- Notes:

```json
paste the full spike result here
```
````

## If the test fails

Use the failure value to decide what to do next:

- `bytesRoundTrip: false`: binary read/write is not reliable in this Expo runtime.
- `appendWrite: false`: append-mode writes are not reliable, so the archive design is blocked.
- `streamedBytesWritten` is not `209715200`: the write loop did not complete correctly.
- `peakJsHeapBytes: null`: heap measurement is unavailable, so the hard gate is not proven.
- `peakJsHeapMiB` is over `150`: the archive approach is using too much JS memory.
- The app crashes or reloads: treat it as a failed memory spike and record what happened.

Do not start Photos V1 storage or UI work from a failed run. The archive hard gate has to pass before Phase 1 begins.

## Optional: Capture the terminal log

The app also prints a result line in Terminal beginning with:

```text
PHOTOS_ARCHIVE_SPIKE_RESULT
```

If the Simulator text is hard to copy, copy that Terminal line instead. It contains the same JSON payload.
