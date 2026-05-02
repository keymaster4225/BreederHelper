# How to test the Photos archive spike on Android

Use this runbook to test the remaining Photos V1 Phase 0 hard gate on a physical Android device connected with ADB.

This is no longer just the raw `expo-file-system` byte-stream test. The raw Android test already proved binary round-trip, append writes, and low-heap raw streaming. This runbook is for the real `.breedwisebackup` archive path: `backup.json` plus binary photo entries written with streaming ZIP chunks.

Do not use web as proof for this gate. The spike depends on native `expo-file-system` behavior and the React Native runtime.

## What Success Means

The spike passes only when all of these are true:

- It runs in an Android Expo runtime, not web.
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

If `peakJsHeapBytes` is `null`, treat the run as failed for this hard gate because the runtime did not expose the heap number.

## Before Running

From the repo on the computer connected to the phone:

```bash
git fetch origin
git switch photos-v1-phase-0
npm ci
```

Confirm the Phase 0 branch contains the archive spike implementation:

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

## Run The Android Test

Confirm ADB can see the phone:

```bash
adb devices
```

Expected result: the phone is listed as `device`, not `unauthorized`.

Start the Android spike build:

```bash
EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1 npm run android
```

On Windows PowerShell:

```powershell
$env:EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE="1"; npm run android
```

Expected app behavior:

- The BreedWise app launches on the phone.
- The first screen says `Photos Archive Memory Spike`.
- The screen shows `Running archive stress test...`.
- The run eventually shows `PASS`, `FAIL`, or an error message.

The app also logs a line beginning with:

```text
PHOTOS_ARCHIVE_SPIKE_RESULT
```

Capture it from another terminal:

```bash
adb logcat | grep PHOTOS_ARCHIVE_SPIKE
```

On Windows PowerShell:

```powershell
adb logcat | Select-String PHOTOS_ARCHIVE_SPIKE
```

## Record The Result

Save this context with the JSON result:

````markdown
## Photos archive format spike - physical Android

- Date:
- Phone model:
- Android version:
- Branch/commit:
- Result: PASS or FAIL
- Notes:

```json
paste the full PHOTOS_ARCHIVE_SPIKE_RESULT payload here
```
````

Also paste the result into the Phase 0 execution notes in `docs/plans/2026-04-30-photos-v1-amended-implementation-plan.md`.

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

Do not start Phase 1 from a failed Android archive spike.

## Optional Device Memory Snapshot

After the spike finishes, this can provide extra native memory context:

```bash
adb shell dumpsys meminfo com.anonymous.breedwise
```

The hard gate is still the spike result JSON, not `dumpsys` alone.
