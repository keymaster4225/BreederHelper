import { useCallback } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { useDataBackup } from '@/hooks/useDataBackup';
import { RootStackParamList } from '@/navigation/AppNavigator';
import type { RestoreBackupResult, SafetySnapshotSummary } from '@/storage/backup';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DataBackup'>;

export function DataBackupScreen({ navigation }: Props): JSX.Element {
  const {
    isBusy,
    busyStepLabel,
    errorMessage,
    safetySnapshots,
    isLoadingSnapshots,
    pendingRestorePreview,
    createBackup,
    prepareRestoreFromPickedFile,
    confirmPreparedRestore,
    restoreSafetySnapshot,
    clearPendingRestore,
  } = useDataBackup();

  const handleRestoreSuccess = useCallback(
    (result: Extract<RestoreBackupResult, { ok: true }>) => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
      });

      const messageParts = [
        'Restore complete. Returning to dashboard. Close and reopen the app if anything still looks stale.',
      ];

      if (result.warningMessage) {
        messageParts.push(result.warningMessage);
      }

      Alert.alert('Restore complete', messageParts.join('\n\n'));
    },
    [navigation],
  );

  const handleCreateBackup = useCallback(() => {
    void (async () => {
      const result = await createBackup();
      if (!result.ok) {
        Alert.alert('Backup failed', result.errorMessage);
        return;
      }

      const shareMessage = result.shared
        ? 'The share sheet opened so you can keep a copy outside the app.'
        : 'The backup was saved locally. Keep a copy outside the app for durable storage.';

      Alert.alert('Backup created', `${result.fileName}\n\n${shareMessage}`);
    })();
  }, [createBackup]);

  const handleRestoreFromFile = useCallback(() => {
    void (async () => {
      const result = await prepareRestoreFromPickedFile();
      if (!result.ok && !result.canceled && result.errorMessage) {
        Alert.alert('Restore failed', result.errorMessage);
      }
    })();
  }, [prepareRestoreFromPickedFile]);

  const executePreparedRestore = useCallback(() => {
    void (async () => {
      const result = await confirmPreparedRestore();
      if (!result.ok) {
        Alert.alert('Restore failed', result.errorMessage);
        return;
      }

      handleRestoreSuccess(result);
    })();
  }, [confirmPreparedRestore, handleRestoreSuccess]);

  const handleConfirmPreparedRestore = useCallback(() => {
    Alert.alert('Replace local data?', 'This will replace all current data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: executePreparedRestore,
      },
    ]);
  }, [executePreparedRestore]);

  const handleRestoreSnapshot = useCallback(
    (snapshot: SafetySnapshotSummary) => {
      Alert.alert(
        'Restore safety snapshot?',
        `This will replace all current data with the snapshot from ${formatDateTime(snapshot.createdAt)}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore Snapshot',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                const result = await restoreSafetySnapshot(snapshot);
                if (!result.ok) {
                  Alert.alert('Restore failed', result.errorMessage);
                  return;
                }

                handleRestoreSuccess(result);
              })();
            },
          },
        ],
      );
    },
    [handleRestoreSuccess, restoreSafetySnapshot],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Data Backup & Restore</Text>
          <Text style={styles.subtitle}>
            Create a manual backup file or replace all local data from a validated backup.
          </Text>
        </View>

        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={colors.error} />
            <Text style={styles.noticeTitle}>Restore replaces local data</Text>
          </View>
          <Text style={styles.noticeBody}>
            Restoring a backup fully replaces the current database. The app creates a safety snapshot first when you restore from a picked file.
          </Text>
        </View>

        <View style={styles.actionCard}>
          <PrimaryButton label="Create Backup" onPress={handleCreateBackup} disabled={isBusy} />
          <SecondaryButton label="Restore From File" onPress={handleRestoreFromFile} disabled={isBusy} />
          {Platform.OS === 'android' ? (
            <Text style={styles.platformNote}>
              On Android, the first saved copy lives inside app-private storage and can disappear if the app is uninstalled. Use the share step to keep a durable copy outside the app.
            </Text>
          ) : null}
        </View>

        {isBusy && busyStepLabel ? (
          <View style={styles.progressCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.progressText}>{busyStepLabel}</Text>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {pendingRestorePreview ? (
          <View style={styles.previewCard}>
            <Text style={styles.sectionTitle}>Ready to restore</Text>
            <Text style={styles.previewBody}>
              {pendingRestorePreview.sourceName}: {formatDateTime(pendingRestorePreview.createdAt)} | {pendingRestorePreview.mareCount} mares | {pendingRestorePreview.dailyLogCount} daily logs | onboarding {pendingRestorePreview.onboardingComplete ? 'complete' : 'incomplete'}
            </Text>
            <View style={styles.previewActions}>
              <PrimaryButton label="Restore This Backup" onPress={handleConfirmPreparedRestore} disabled={isBusy} />
              <SecondaryButton label="Cancel" onPress={clearPendingRestore} disabled={isBusy} />
            </View>
          </View>
        ) : null}

        <View style={styles.snapshotsSection}>
          <View style={styles.snapshotHeader}>
            <Text style={styles.sectionTitle}>Safety snapshots</Text>
            {isLoadingSnapshots ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>

          {safetySnapshots.length === 0 && !isLoadingSnapshots ? (
            <Text style={styles.emptyText}>No safety snapshots yet.</Text>
          ) : null}

          {safetySnapshots.map((snapshot) => (
            <View key={snapshot.fileUri} style={styles.snapshotCard}>
              <View style={styles.snapshotText}>
                <Text style={styles.snapshotTitle}>{formatDateTime(snapshot.createdAt)}</Text>
                <Text style={styles.snapshotMeta}>
                  {snapshot.mareCount} mares | schema v{snapshot.schemaVersion}
                </Text>
              </View>
              <View style={styles.snapshotAction}>
                <SecondaryButton
                  label="Restore Snapshot"
                  onPress={() => handleRestoreSnapshot(snapshot)}
                  disabled={isBusy}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  return date.toLocaleString();
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
    ...elevation.level1,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  noticeCard: {
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noticeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noticeTitle: {
    ...typography.titleMedium,
    color: colors.onErrorContainer,
  },
  noticeBody: {
    ...typography.bodySmall,
    color: colors.onErrorContainer,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.level1,
  },
  platformNote: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  progressCard: {
    alignItems: 'center',
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressText: {
    ...typography.bodyMedium,
    color: colors.onSecondaryContainer,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
  previewCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  previewBody: {
    ...typography.bodyMedium,
    color: colors.onPrimaryContainer,
  },
  previewActions: {
    gap: spacing.md,
  },
  snapshotsSection: {
    gap: spacing.md,
  },
  snapshotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  snapshotCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.level1,
  },
  snapshotText: {
    gap: spacing.xs,
  },
  snapshotTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  snapshotMeta: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  snapshotAction: {
    marginTop: spacing.xs,
  },
});
