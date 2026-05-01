import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IconButton, PrimaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { useFoalingEventDetail } from '@/hooks/useFoalingEventDetail';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import { FOAL_MILESTONE_KEYS, FOAL_MILESTONE_LABELS } from '@/utils/foalMilestones';
import { formatIggInterpretation, getIggColor, interpretIgg } from '@/utils/igg';
import {
  formatFoalColor,
  formatFoalSex,
  formatOutcome,
  getOutcomeColor,
} from '@/utils/outcomeDisplay';

type Props = NativeStackScreenProps<RootStackParamList, 'FoalingEventDetail'>;

function formatRecordedAt(iso: string | null | undefined): string {
  if (!iso) return '';

  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';

  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function NoteBlock({ title, text }: { title: string; text: string }): JSX.Element {
  return (
    <View style={styles.noteBlock}>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

export function FoalingEventDetailScreen({ navigation, route }: Props): JSX.Element {
  const handledInvalidRouteRef = useRef(false);
  const {
    isLoading,
    error,
    invalidRouteMessage,
    recordMissingAfterPriorLoad,
    record,
    mare,
    foal,
  } = useFoalingEventDetail({ foalingRecordId: route.params.foalingRecordId });

  useEffect(() => {
    if (!record) {
      return;
    }

    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon={'\u270E'}
          accessibilityLabel="Edit foaling record"
          onPress={() => navigation.navigate('FoalingRecordForm', { mareId: record.mareId, foalingRecordId: record.id })}
        />
      ),
    });
  }, [navigation, record]);

  useEffect(() => {
    if (handledInvalidRouteRef.current) {
      return;
    }

    if (recordMissingAfterPriorLoad) {
      handledInvalidRouteRef.current = true;
      navigation.goBack();
      return;
    }

    if (invalidRouteMessage) {
      handledInvalidRouteRef.current = true;
      Alert.alert('Unable to open foaling record', invalidRouteMessage);
      navigation.goBack();
    }
  }, [invalidRouteMessage, navigation, recordMissingAfterPriorLoad]);

  if (isLoading && !record) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (error && !record) {
    return (
      <Screen>
        <Text style={styles.errorText}>{error}</Text>
      </Screen>
    );
  }

  if (!record || !mare) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const mareName = mare.deletedAt ? `${mare.name} (Deleted)` : mare.name;
  const canOpenMare = mare.deletedAt == null;
  const isLiveFoal = record.outcome === 'liveFoal';
  const sortedIggTests = foal ? [...foal.iggTests].sort((a, b) => b.date.localeCompare(a.date)) : [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={cardStyles.card}>
          <Text style={styles.sectionTitle}>Foaling Summary</Text>
          {isLiveFoal && foal ? <CardRow label="Name" value={foal.name || 'Unnamed foal'} /> : null}
          <CardRow label="DOB" value={formatLocalDate(record.date, 'MM-DD-YYYY')} />
          {isLiveFoal && foal?.sex ? (
            <CardRow label="Sex" value={formatFoalSex(foal.sex)} />
          ) : record.foalSex ? (
            <CardRow label="Sex" value={formatFoalSex(record.foalSex)} />
          ) : null}
          {isLiveFoal && foal?.color ? <CardRow label="Color" value={formatFoalColor(foal.color)} /> : null}
          {isLiveFoal && foal?.markings ? <CardRow label="Markings" value={foal.markings} /> : null}
          {isLiveFoal && foal?.birthWeightLbs != null ? <CardRow label="Birth weight" value={`${foal.birthWeightLbs} lb`} /> : null}
          <View style={cardStyles.cardRow}>
            <Text style={cardStyles.cardLabel}>Outcome</Text>
            <StatusBadge label={formatOutcome(record.outcome)} backgroundColor={getOutcomeColor(record.outcome)} textColor="#FFFFFF" />
          </View>
          {canOpenMare ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open mare profile for ${mare.name}`}
              onPress={() => navigation.navigate('MareDetail', { mareId: record.mareId, initialTab: 'foaling' })}
              style={({ pressed }) => [styles.pressableRow, pressed && styles.pressed]}
            >
              <Text style={cardStyles.cardLabel}>Mare</Text>
              <Text style={[cardStyles.cardValue, styles.linkValue]}>{mareName}</Text>
            </Pressable>
          ) : (
            <CardRow label="Mare" value={mareName} />
          )}

          {isLiveFoal && foal ? (
            <>
              <View style={styles.detailSection}>
                <Text style={styles.subsectionTitle}>Milestones</Text>
                {FOAL_MILESTONE_KEYS.map((key) => {
                  const entry = foal.milestones[key];
                  const isDone = entry?.done ?? false;
                  const timeLabel = formatRecordedAt(entry?.recordedAt);
                  return (
                    <View key={key} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{FOAL_MILESTONE_LABELS[key]}</Text>
                      <Text style={[styles.detailValue, isDone ? styles.doneText : styles.pendingText]}>
                        {isDone ? (timeLabel ? `Done ${timeLabel}` : 'Done') : 'Pending'}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.subsectionTitle}>IgG</Text>
                {sortedIggTests.length > 0 ? (
                  sortedIggTests.map((test) => {
                    const interpretation = interpretIgg(test.valueMgDl);
                    return (
                      <View key={`${test.date}-${test.recordedAt}`} style={styles.iggRow}>
                        <Text style={styles.detailLabel}>{formatLocalDate(test.date, 'MM-DD-YYYY')}</Text>
                        <StatusBadge
                          label={`${test.valueMgDl} ${formatIggInterpretation(interpretation)}`}
                          backgroundColor={getIggColor(interpretation)}
                          textColor="#FFFFFF"
                        />
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No IgG tests recorded.</Text>
                )}
              </View>

              {foal.notes ? <NoteBlock title="Foal notes" text={foal.notes} /> : null}
              {record.complications ? <NoteBlock title="Complications" text={record.complications} /> : null}
              {record.notes ? <NoteBlock title="Foaling notes" text={record.notes} /> : null}
              <PrimaryButton
                label="Open Foal Record"
                onPress={() =>
                  navigation.navigate('FoalForm', {
                    mareId: record.mareId,
                    foalingRecordId: record.id,
                    foalId: foal.id,
                    defaultSex: record.foalSex,
                  })
                }
              />
            </>
          ) : null}

          {isLiveFoal && !foal ? (
            <>
              <Text style={styles.emptyText}>No foal record has been added for this live foaling yet.</Text>
              {record.complications ? <NoteBlock title="Complications" text={record.complications} /> : null}
              {record.notes ? <NoteBlock title="Foaling notes" text={record.notes} /> : null}
              <PrimaryButton
                label="Add Foal Record"
                onPress={() =>
                  navigation.navigate('FoalForm', {
                    mareId: record.mareId,
                    foalingRecordId: record.id,
                    foalId: undefined,
                    defaultSex: record.foalSex,
                  })
                }
              />
            </>
          ) : null}

          {!isLiveFoal ? (
            <>
              {record.complications ? <NoteBlock title="Complications" text={record.complications} /> : null}
              {record.notes ? <NoteBlock title="Foaling notes" text={record.notes} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subsectionTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  detailSection: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  detailValue: {
    ...typography.bodySmall,
  },
  doneText: {
    color: colors.onSurface,
  },
  pendingText: {
    color: colors.onSurfaceVariant,
  },
  iggRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noteBlock: {
    gap: 2,
    marginTop: spacing.sm,
  },
  noteTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  noteText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
  },
  pressableRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkValue: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.72,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  errorText: {
    color: colors.error,
  },
});
