## Photos archive format spike - iOS Simulator

- Date: 05/02/26
- Mac: MacBook Air M2
- macOS: 26.2
- Xcode: 26.4.1
- Simulator: iPhone 17 Pro iOS 26.4
- Branch/commit: photos-v1-phase-0
- Result: PASS
- Notes:

```json output in terminal
{
    "platform":"ios",
    "fileSystemImportPath":"expo-file-system",
    "zipLibrary":"fflate",
    "zipApi":"Zip + ZipPassThrough streaming callbacks",
    "bytesRoundTrip":true,
    "appendWrite":true,
    "archiveWrite":true,
    "archiveReadBack":true,
    "backupJsonEntry":true,
    "masterPhotoEntry":true,
    "thumbnailPhotoEntry":true,
    "manifestMatchesEntries":true,
    "archiveEntryCount":201,
    "peakJsHeapBytes":10906552,
    "streamedBytesWritten":209812421,
    "fallbackDecision":"Proceed only if the real archive writer passes on both iOS and Android and peak JS heap remains below 150 MB.",
    "passed":true
}
```
```json output in simulator window
{
  "platform": "ios",
  "fileSystemImportPath": "expo-file-system",
  "zipLibrary": "fflate",
  "zipApi": "Zip + ZipPassThrough streaming callbacks",
  "bytesRoundTrip": true,
  "appendWrite": true,
  "archiveWrite": true,
  "archiveReadBack": true,
  "backupJsonEntry": true,
  "masterPhotoEntry": true,
  "thumbnailPhotoEntry": true,
  "manifestMatchesEntries": true,
  "archiveEntryCount": 201,
  "peakJsHeapBytes": 10906552,
  "streamedBytesWritten": 209812421,
  "fallbackDecision": "Proceed only if the real archive writer passes on both iOS and Android and peak JS heap remains below 150 MB.",
  "streamedMiB": 200.1,
  "peakJsHeapMiB": 10.4,
  "heapLimitMiB": 150
}
```