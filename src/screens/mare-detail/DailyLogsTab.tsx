import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PrimaryButton } from '../../components/Buttons';
import { DailyLogThumbnailStrip } from '../../components/DailyLogPhotos';
import { StatusBadge } from '../../components/StatusBadge';
import { CardRow, EditIconButton, ScoreBadge, cardStyles } from '../../components/RecordCardParts';
import type { DailyLog } from '../../models/types';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, spacing, typography } from '../../theme';
import { buildOvaryDetailLines, buildUterusSummary, type DailyLogDetailLine } from '../../utils/dailyLogDisplay';
import { compareDailyLogsDesc, formatDailyLogTime } from '../../utils/dailyLogTime';
import { useClockDisplayMode } from '@/hooks/useClockPreference';

type Props = {
  mareId: string;
  dailyLogs: readonly DailyLog[];
  attachmentPhotosByDailyLogId?: Record<string, { id: string; thumbnailUri: string; masterUri: string }[]>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

type DailyLogGroup = {
  date: string;
  logs: DailyLog[];
};

function groupDailyLogsByDate(dailyLogs: readonly DailyLog[]): DailyLogGroup[] {
  const groups: DailyLogGroup[] = [];

  for (const log of [...dailyLogs].sort(compareDailyLogsDesc)) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.date === log.date) {
      currentGroup.logs.push(log);
    } else {
      groups.push({
        date: log.date,
        logs: [log],
      });
    }
  }

  return groups;
}

function OvaryDisclosure({
  title,
  details,
}: {
  title: string;
  details: readonly DailyLogDetailLine[];
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const canExpand = details.length > 0;

  if (!canExpand) {
    return (
      <View style={[styles.ovaryDisclosure, styles.ovaryDisclosureEmpty]}>
        <Text style={styles.ovaryTitle}>{title}</Text>
      </View>
    );
  }

  return (
    <View style={styles.ovaryDisclosure}>
      <Pressable
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${title} details`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.ovaryDisclosureHeader, pressed && styles.ovaryDisclosurePressed]}
      >
        <View style={styles.ovaryDisclosureText}>
          <Text style={styles.ovaryTitle}>{title}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'minus-circle-outline' : 'plus-circle-outline'}
          size={20}
          color={colors.onSurfaceVariant}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.ovaryDetails}>
          {details.map((detail) => (
            <View key={`${detail.label}:${detail.value}`} style={styles.ovaryDetailRow}>
              <Text style={styles.ovaryDetailLabel}>{detail.label}</Text>
              <Text style={styles.ovaryDetailValue}>{detail.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function DailyLogsTab({
  mareId,
  dailyLogs,
  attachmentPhotosByDailyLogId = {},
  navigation,
}: Props): JSX.Element {
  const groupedLogs = groupDailyLogsByDate(dailyLogs);
  const clockDisplayMode = useClockDisplayMode();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton label="Add Daily Log" onPress={() => navigation.navigate('DailyLogForm', { mareId })} />
        {dailyLogs.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No daily logs yet.</Text>
          </View>
        ) : null}
        {groupedLogs.map((group) => (
          <View key={group.date} style={styles.group}>
            <Text style={styles.groupHeader}>{group.date}</Text>
            {group.logs.map((log) => {
              const rightOvaryDetails = buildOvaryDetailLines(log, 'right');
              const leftOvaryDetails = buildOvaryDetailLines(log, 'left');
              const uterusSummary = buildUterusSummary(log);
              const photos = attachmentPhotosByDailyLogId[log.id] ?? [];

              return (
                <View key={log.id} style={cardStyles.card}>
                  <View style={cardStyles.cardHeader}>
                    <Text style={cardStyles.cardTitle}>{formatDailyLogTime(log.time, clockDisplayMode)}</Text>
                    <EditIconButton onPress={() => navigation.navigate('DailyLogForm', { mareId, logId: log.id })} />
                  </View>
                  <View style={cardStyles.cardRow}>
                    <Text style={cardStyles.cardLabel}>Teasing</Text>
                    <ScoreBadge score={log.teasingScore} />
                  </View>
                  <View style={cardStyles.cardRow}>
                    <Text style={cardStyles.cardLabel}>Edema</Text>
                    <ScoreBadge score={log.edema} />
                  </View>
                  {log.ovulationDetected ? (
                    <View style={cardStyles.cardRow}>
                      <Text style={cardStyles.cardLabel}>Ovulation</Text>
                      <StatusBadge label="Detected" backgroundColor={colors.positive} textColor="#FFFFFF" />
                    </View>
                  ) : null}
                  <OvaryDisclosure title="Right ovary" details={rightOvaryDetails} />
                  <OvaryDisclosure title="Left ovary" details={leftOvaryDetails} />
                  {uterusSummary ? <CardRow label="Uterus" value={uterusSummary} /> : null}
                  <DailyLogThumbnailStrip
                    photos={photos}
                    onPressPhoto={(index) => {
                      navigation.navigate('PhotoViewer', {
                        photos: photos.map((photo) => ({
                          uri: photo.masterUri,
                          title: `${log.date} photo`,
                        })),
                        initialIndex: index,
                      });
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeader: {
    color: colors.onSurfaceVariant,
  },
  ovaryDisclosure: {
    borderColor: colors.outlineVariant,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  ovaryDisclosureEmpty: {
    minHeight: 36,
    justifyContent: 'center',
  },
  ovaryDisclosureHeader: {
    alignItems: 'center',
    columnGap: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  ovaryDisclosurePressed: {
    opacity: 0.72,
  },
  ovaryDisclosureText: {
    flex: 1,
    gap: 1,
  },
  ovaryTitle: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
  ovaryDetails: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  ovaryDetailRow: {
    alignItems: 'flex-start',
    columnGap: spacing.sm,
    flexDirection: 'row',
  },
  ovaryDetailLabel: {
    color: colors.onSurfaceVariant,
    minWidth: 76,
    ...typography.labelSmall,
  },
  ovaryDetailValue: {
    color: colors.onSurface,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
