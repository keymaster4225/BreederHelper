import { useCallback } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { useDataBackup } from '@/hooks/useDataBackup';
import {
  useHorseImport,
  type HorseImportRowResult,
  type HorseImportSummary,
  type PendingHorseImportPreview,
} from '@/hooks/useHorseImport';
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
    refreshSafetySnapshots,
    createBackup,
    prepareRestoreFromPickedFile,
    confirmPreparedRestore,
    restoreSafetySnapshot,
    clearPendingRestore,
  } = useDataBackup();
  const {
    isBusy: isHorseImportBusy,
    busyStepLabel: horseImportBusyStepLabel,
    errorMessage: horseImportErrorMessage,
    pendingImport,
    finalSummary: horseImportSummary,
    prepareImportFromPickedFile,
    selectCreateNewTarget,
    selectExistingTarget,
    confirmPreparedImport,
    clearPendingImport,
    clearFinalSummary,
  } = useHorseImport({ onImportCompleted: refreshSafetySnapshots });
  const isAnyBusy = isBusy || isHorseImportBusy;
  const visibleBusyStepLabel = busyStepLabel ?? horseImportBusyStepLabel;

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

  const handleImportHorse = useCallback(() => {
    void (async () => {
      const result = await prepareImportFromPickedFile();
      if (!result.ok && !result.canceled && result.errorMessage) {
        Alert.alert('Import failed', result.errorMessage);
      }
    })();
  }, [prepareImportFromPickedFile]);

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

  const executePreparedHorseImport = useCallback(() => {
    void (async () => {
      const result = await confirmPreparedImport();
      if (!result.ok) {
        const safetyMessage = result.safetySnapshotCreated
          ? '\n\nA safety snapshot was created before the failed import attempt.'
          : '';
        Alert.alert('Import failed', `${result.errorMessage}${safetyMessage}`);
        return;
      }

      Alert.alert('Horse import complete', formatImportSummaryAlert(result.summary));
    })();
  }, [confirmPreparedImport]);

  const handleConfirmHorseImport = useCallback(() => {
    Alert.alert(
      'Import horse package?',
      'Importing never overwrites existing data. A safety snapshot is created before any rows are imported.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: executePreparedHorseImport,
        },
      ],
    );
  }, [executePreparedHorseImport]);

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
          <PrimaryButton label="Create Backup" onPress={handleCreateBackup} disabled={isAnyBusy} />
          <SecondaryButton label="Restore From File" onPress={handleRestoreFromFile} disabled={isAnyBusy} />
          {Platform.OS === 'android' ? (
            <Text style={styles.platformNote}>
              On Android, the first saved copy lives inside app-private storage and can disappear if the app is uninstalled. Use the share step to keep a durable copy outside the app.
            </Text>
          ) : null}
        </View>

        <View style={styles.horseImportCard}>
          <View style={styles.horseImportHeader}>
            <MaterialCommunityIcons name="horse-variant" size={20} color={colors.onSecondaryContainer} />
            <Text style={styles.horseImportTitle}>Horse packages</Text>
          </View>
          <Text style={styles.horseImportBody}>
            Import a single mare or stallion package without replacing the rest of this device.
          </Text>
          <PrimaryButton label="Import Horse" onPress={handleImportHorse} disabled={isAnyBusy} />
        </View>

        {isAnyBusy && visibleBusyStepLabel ? (
          <View style={styles.progressCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.progressText}>{visibleBusyStepLabel}</Text>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {horseImportErrorMessage ? <Text style={styles.errorText}>{horseImportErrorMessage}</Text> : null}

        {pendingRestorePreview ? (
          <View style={styles.previewCard}>
            <Text style={styles.sectionTitle}>Ready to restore</Text>
            <Text style={styles.previewBody}>
              {pendingRestorePreview.sourceName}: {formatDateTime(pendingRestorePreview.createdAt)} | {pendingRestorePreview.mareCount} mares | {pendingRestorePreview.dailyLogCount} daily logs | onboarding {pendingRestorePreview.onboardingComplete ? 'complete' : 'incomplete'}
            </Text>
            <View style={styles.previewActions}>
              <PrimaryButton label="Restore This Backup" onPress={handleConfirmPreparedRestore} disabled={isAnyBusy} />
              <SecondaryButton label="Cancel" onPress={clearPendingRestore} disabled={isAnyBusy} />
            </View>
          </View>
        ) : null}

        {pendingImport ? (
          <HorseImportPreviewCard
            pendingImport={pendingImport}
            isBusy={isAnyBusy}
            onSelectCreateNew={selectCreateNewTarget}
            onSelectExisting={selectExistingTarget}
            onConfirm={handleConfirmHorseImport}
            onCancel={clearPendingImport}
          />
        ) : null}

        {horseImportSummary ? (
          <HorseImportSummaryCard
            summary={horseImportSummary}
            onClear={clearFinalSummary}
          />
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
                  disabled={isAnyBusy}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

type HorseImportPreviewCardProps = {
  readonly pendingImport: PendingHorseImportPreview;
  readonly isBusy: boolean;
  readonly onSelectCreateNew: () => void;
  readonly onSelectExisting: (destinationHorseId: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

function HorseImportPreviewCard({
  pendingImport,
  isBusy,
  onSelectCreateNew,
  onSelectExisting,
  onConfirm,
  onCancel,
}: HorseImportPreviewCardProps): JSX.Element {
  const match = pendingImport.match;
  const fuzzySuggestions = match.fuzzySuggestions;

  return (
    <View style={styles.importPreviewCard}>
      <Text style={styles.sectionTitle}>Ready to import horse</Text>
      <Text style={styles.importTitle}>
        {pendingImport.preview.sourceHorse.name} ({formatHorseType(pendingImport.preview.sourceHorse.type)})
      </Text>
      <Text style={styles.importBody}>
        {pendingImport.sourceName} | BreedWise {pendingImport.preview.appVersion}
      </Text>
      <Text style={styles.noOverwriteText}>Importing never overwrites existing data.</Text>
      <Text style={styles.importBody}>
        {pendingImport.preview.totalRowCount} rows | {formatNonZeroCounts(pendingImport.preview.tableCounts)}
      </Text>
      <Text style={styles.importBody}>
        Estimated conflicts: {pendingImport.preview.estimatedConflictTotal}
      </Text>
      <Text style={styles.importBody}>Safety snapshot will be created before import.</Text>

      {pendingImport.preview.redactionNotices.map((notice) => (
        <Text key={notice.code} style={styles.importNotice}>
          {formatRedactionNotice(notice.code)}
        </Text>
      ))}

      <View style={styles.targetBox}>
        <Text style={styles.targetTitle}>{formatMatchState(pendingImport)}</Text>
        {match.state === 'ambiguous'
          ? match.candidates.map((candidate) => (
              <SecondaryButton
                key={candidate.id}
                label={`Use ${candidate.name}`}
                onPress={() => onSelectExisting(candidate.id)}
                disabled={isBusy}
              />
            ))
          : null}
        {fuzzySuggestions.length > 0 ? (
          <>
            <Text style={styles.targetTitle}>Suggested matches</Text>
            {fuzzySuggestions.map((suggestion) => (
              <SecondaryButton
                key={suggestion.horse.id}
                label={`Use ${suggestion.horse.name}`}
                onPress={() => onSelectExisting(suggestion.horse.id)}
                disabled={isBusy}
              />
            ))}
          </>
        ) : null}
        <SecondaryButton label="Create New Horse" onPress={onSelectCreateNew} disabled={isBusy} />
      </View>

      <View style={styles.previewActions}>
        <PrimaryButton
          label="Confirm Import"
          onPress={onConfirm}
          disabled={isBusy || pendingImport.selectedTarget == null}
        />
        <SecondaryButton label="Cancel" onPress={onCancel} disabled={isBusy} />
      </View>
    </View>
  );
}

type HorseImportSummaryCardProps = {
  readonly summary: HorseImportSummary;
  readonly onClear: () => void;
};

function HorseImportSummaryCard({ summary, onClear }: HorseImportSummaryCardProps): JSX.Element {
  const detailRows = summary.rowResults.filter(shouldShowRowDetail);

  return (
    <View style={styles.importSummaryCard}>
      <Text style={styles.sectionTitle}>Horse import summary</Text>
      <Text style={styles.importBody}>{formatImportSummaryCounts(summary)}</Text>
      {detailRows.length > 0 ? (
        <View style={styles.summaryDetails}>
          {detailRows.map((row) => (
            <Text key={`${row.table}-${row.sourceId}-${row.outcome}`} style={styles.importNotice}>
              {formatRowResult(row)}
            </Text>
          ))}
        </View>
      ) : null}
      <SecondaryButton label="Clear Summary" onPress={onClear} />
    </View>
  );
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  return date.toLocaleString();
}

function formatHorseType(type: 'mare' | 'stallion'): string {
  return type === 'mare' ? 'mare' : 'stallion';
}

function formatRedactionNotice(code: string): string {
  switch (code) {
    case 'context_stallions_redacted':
      return 'Context stallion details were redacted before export.';
    case 'dose_recipient_shipping_redacted':
      return 'Dose recipient and shipping details were redacted before export.';
    default:
      return 'Some source details were redacted before export.';
  }
}

function formatMatchState(pendingImport: PendingHorseImportPreview): string {
  const selectedTarget = pendingImport.selectedTarget;
  if (selectedTarget?.kind === 'create_new') {
    return 'Selected target: create a new horse.';
  }
  if (selectedTarget?.kind === 'confirmed_match') {
    return `Selected target: existing horse ${selectedTarget.destinationHorseId}.`;
  }

  if (pendingImport.match.state === 'ambiguous') {
    return 'Choose an existing horse or create a new record.';
  }

  return 'Choose how to import this horse package.';
}

function formatNonZeroCounts(counts: Record<string, number>): string {
  const visibleCounts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([tableName, count]) => `${formatTableName(tableName)} ${count}`);

  if (visibleCounts.length === 0) {
    return 'no row categories';
  }

  return visibleCounts.slice(0, 5).join(' | ');
}

function formatImportSummaryAlert(summary: HorseImportSummary): string {
  return `${formatImportSummaryCounts(summary)}\n\nReview the on-screen summary for skipped or conflicting rows.`;
}

function formatImportSummaryCounts(summary: HorseImportSummary): string {
  return [
    `Inserted ${summary.totalCounts.inserted}`,
    `Already present ${summary.totalCounts.already_present}`,
    `Skipped ${summary.totalCounts.skipped}`,
    `Conflicts ${summary.totalCounts.conflict}`,
  ].join(' | ');
}

function shouldShowRowDetail(row: HorseImportRowResult): boolean {
  return row.outcome === 'skipped' || row.outcome === 'conflict';
}

function formatRowResult(row: HorseImportRowResult): string {
  const reason = row.message ?? row.reason ?? row.outcome;
  return `${formatTableName(row.table)} ${row.sourceId}: ${reason}`;
}

function formatTableName(tableName: string): string {
  return tableName.replace(/_/g, ' ');
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
  horseImportCard: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  horseImportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  horseImportTitle: {
    ...typography.titleMedium,
    color: colors.onSecondaryContainer,
  },
  horseImportBody: {
    ...typography.bodySmall,
    color: colors.onSecondaryContainer,
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
  importPreviewCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  importSummaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.level1,
  },
  importTitle: {
    ...typography.titleSmall,
    color: colors.onPrimaryContainer,
  },
  importBody: {
    ...typography.bodySmall,
    color: colors.onPrimaryContainer,
  },
  noOverwriteText: {
    ...typography.titleSmall,
    color: colors.onPrimaryContainer,
  },
  importNotice: {
    ...typography.bodySmall,
    color: colors.onSurface,
  },
  targetBox: {
    gap: spacing.sm,
  },
  targetTitle: {
    ...typography.labelMedium,
    color: colors.onPrimaryContainer,
  },
  summaryDetails: {
    gap: spacing.sm,
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
