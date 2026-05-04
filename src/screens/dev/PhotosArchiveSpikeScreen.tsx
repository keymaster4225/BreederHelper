import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  runPhotosArchiveSpike,
  type PhotosArchiveSpikeResult,
} from '../../../scripts/spikes/photos-archive-spike';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/theme';

const EXPECTED_STREAMED_BYTES = 100 * 2 * 1024 * 1024;
const HEAP_LIMIT_BYTES = 150 * 1024 * 1024;
const LOG_PREFIX = 'PHOTOS_ARCHIVE_SPIKE_RESULT';
const ERROR_LOG_PREFIX = 'PHOTOS_ARCHIVE_SPIKE_ERROR';

type SpikeState =
  | { readonly status: 'running' }
  | { readonly status: 'passed'; readonly result: PhotosArchiveSpikeResult }
  | { readonly status: 'failed'; readonly result: PhotosArchiveSpikeResult }
  | { readonly status: 'error'; readonly message: string };

export function PhotosArchiveSpikeScreen(): JSX.Element {
  const [state, setState] = useState<SpikeState>({ status: 'running' });

  useEffect(() => {
    let isMounted = true;

    runPhotosArchiveSpike(Platform.OS)
      .then((result) => {
        const passed = passesHardGate(result);
        console.log(LOG_PREFIX, JSON.stringify({ ...result, passed }));
        if (isMounted) {
          setState({ status: passed ? 'passed' : 'failed', result });
        }
      })
      .catch((error: unknown) => {
        const message = stringifyError(error);
        console.error(ERROR_LOG_PREFIX, message);
        if (isMounted) {
          setState({ status: 'error', message });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Photos Archive Memory Spike</Text>
        <Text style={styles.body}>
          Runtime test for binary file round-trip, append writes, and the streaming .breedwisebackup archive path.
        </Text>

        {state.status === 'running' ? (
          <View style={styles.runningRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Running archive stress test...</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <Text selectable style={styles.errorText}>
            {state.message}
          </Text>
        ) : null}

        {state.status === 'passed' || state.status === 'failed' ? (
          <View style={styles.resultBox}>
            <Text style={state.status === 'passed' ? styles.passText : styles.failText}>
              {state.status === 'passed' ? 'PASS' : 'FAIL'}
            </Text>
            <Text selectable style={styles.monoText}>
              {formatResult(state.result)}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function passesHardGate(result: PhotosArchiveSpikeResult): boolean {
  return (
    result.bytesRoundTrip &&
    result.appendWrite &&
    result.zipLibrary === 'fflate' &&
    result.zipApi === 'Zip + ZipPassThrough streaming callbacks' &&
    result.archiveWrite &&
    result.archiveReadBack &&
    result.backupJsonEntry &&
    result.masterPhotoEntry &&
    result.thumbnailPhotoEntry &&
    result.manifestMatchesEntries &&
    result.streamedBytesWritten >= EXPECTED_STREAMED_BYTES &&
    result.peakJsHeapBytes != null &&
    result.peakJsHeapBytes <= HEAP_LIMIT_BYTES
  );
}

function formatResult(result: PhotosArchiveSpikeResult): string {
  return JSON.stringify(
    {
      ...result,
      streamedMiB: bytesToMiB(result.streamedBytesWritten),
      peakJsHeapMiB: result.peakJsHeapBytes == null ? null : bytesToMiB(result.peakJsHeapBytes),
      heapLimitMiB: bytesToMiB(HEAP_LIMIT_BYTES),
    },
    null,
    2,
  );
}

function bytesToMiB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

const styles = StyleSheet.create({
  screen: {
    padding: 0,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  body: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  runningRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resultBox: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md,
  },
  passText: {
    ...typography.titleMedium,
    color: colors.positive,
  },
  failText: {
    ...typography.titleMedium,
    color: colors.error,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
  monoText: {
    color: colors.onSurface,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
