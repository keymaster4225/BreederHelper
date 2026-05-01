# How to test the Photos Archive memory spike on Android

Use this runbook to test the Photos V1 archive hard gate on a physical Android device connected with ADB.

Do not use web as proof for this hard gate. The spike depends on native `expo-file-system` behavior and the React Native runtime.

## What success means

The spike passes only when all of these are true:

- `bytesRoundTrip` is `true`.
- `appendWrite` is `true`.
- `streamedBytesWritten` is `209715200` bytes, which is 100 files x 2 MB.
- `peakJsHeapBytes` is present, not `null`.
- `peakJsHeapMiB` is 150 MB or lower.

If `peakJsHeapBytes` is `null`, treat the run as failed for this hard gate because the runtime did not expose the heap number.

## Steps

From the repo on the computer connected to the phone:

```bash
git fetch origin
git switch photos-v1-phase-0
npm ci
adb devices
```

Confirm `adb devices` lists the phone as `device`, not `unauthorized`.

Start the Android spike build:

```bash
EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE=1 npm run android
```

On Windows PowerShell, use:

```powershell
$env:EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE="1"; npm run android
```

Expected result:

- The BreedWise app launches on the phone.
- The first screen says `Photos Archive Memory Spike`.
- The screen shows `Running archive stress test...`.
- The run eventually shows `PASS`, `FAIL`, or an error message.

The app also logs a line beginning with:

```text
PHOTOS_ARCHIVE_SPIKE_RESULT
```

To capture that from another terminal:

```bash
adb logcat | grep PHOTOS_ARCHIVE_SPIKE
```

On Windows PowerShell:

```powershell
adb logcat | Select-String PHOTOS_ARCHIVE_SPIKE
```

## Record the result

Save this context with the JSON result:

````markdown
## Photos archive memory spike - physical Android

- Date:
- Phone model:
- Android version:
- Result: PASS or FAIL
- Notes:

```json
paste the full spike result here
```
````

## Optional device memory snapshot

After the spike finishes, this can provide extra native memory context:

```bash
adb shell dumpsys meminfo com.anonymous.breedwise
```

The hard gate is still the spike result JSON, not `dumpsys` alone.
