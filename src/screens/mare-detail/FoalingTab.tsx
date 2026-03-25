import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { StatusBadge } from '@/components/StatusBadge';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { Foal, FoalingRecord } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatOutcome, getOutcomeColor, formatFoalSex, formatFoalColor, getFoalSexColor } from '@/utils/outcomeDisplay';
import { colors, spacing, typography } from '@/theme';

type Props = {
  mareId: string;
  foalingRecords: readonly FoalingRecord[];
  foalByFoalingRecordId: Readonly<Record<string, Foal>>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function FoalingTab({ mareId, foalingRecords, foalByFoalingRecordId, navigation }: Props): JSX.Element {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton label="Add Foaling Record" onPress={() => navigation.navigate('FoalingRecordForm', { mareId })} />
        {foalingRecords.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No foaling records yet.</Text>
          </View>
        ) : null}
        {foalingRecords.map((record) => {
          const isLiveFoal = record.outcome === 'liveFoal';
          const foal = foalByFoalingRecordId[record.id];

          const cardBody = (
            <>
              <View style={cardStyles.cardRow}>
                <Text style={cardStyles.cardLabel}>Outcome</Text>
                <StatusBadge
                  label={formatOutcome(record.outcome)}
                  backgroundColor={getOutcomeColor(record.outcome)}
                  textColor="#FFFFFF"
                />
              </View>
              {record.foalSex && getFoalSexColor(record.foalSex) ? (
                <View style={cardStyles.cardRow}>
                  <Text style={cardStyles.cardLabel}>Foal sex</Text>
                  <StatusBadge
                    label={formatFoalSex(record.foalSex)}
                    backgroundColor={getFoalSexColor(record.foalSex)!}
                    textColor="#FFFFFF"
                  />
                </View>
              ) : (
                <CardRow label="Foal sex" value={record.foalSex ? formatFoalSex(record.foalSex) : '-'} />
              )}
              {record.complications ? <CardRow label="Complications" value={record.complications} /> : null}
              {isLiveFoal ? (
                foal ? (
                  <View style={styles.foalSummary}>
                    <Text style={styles.foalName}>{foal.name || 'Unnamed foal'}</Text>
                    {(foal.sex || foal.color) ? (
                      <View style={styles.foalDetailRow}>
                        {foal.sex && getFoalSexColor(foal.sex) ? (
                          <StatusBadge
                            label={formatFoalSex(foal.sex)}
                            backgroundColor={getFoalSexColor(foal.sex)!}
                            textColor="#FFFFFF"
                          />
                        ) : foal.sex ? (
                          <Text style={styles.foalDetail}>{formatFoalSex(foal.sex)}</Text>
                        ) : null}
                        {foal.color ? (
                          <Text style={styles.foalDetail}>{formatFoalColor(foal.color)}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.foalHint}>Tap to add foal record</Text>
                )
              ) : null}
            </>
          );

          return (
            <View key={record.id} style={cardStyles.card}>
              <View style={cardStyles.cardHeader}>
                <Text style={cardStyles.cardTitle}>{record.date}</Text>
                <EditIconButton onPress={() => navigation.navigate('FoalingRecordForm', { mareId, foalingRecordId: record.id })} />
              </View>
              {isLiveFoal ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate('FoalForm', {
                      mareId,
                      foalingRecordId: record.id,
                      foalId: foal?.id,
                      defaultSex: record.foalSex,
                    })
                  }
                  style={({ pressed }) => pressed ? { opacity: 0.85 } : undefined}
                >
                  {cardBody}
                </Pressable>
              ) : (
                cardBody
              )}
            </View>
          );
        })}
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
  foalSummary: {
    marginTop: spacing.xs,
    gap: 2,
  },
  foalName: {
    color: colors.onSurface,
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  foalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  foalDetail: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  foalHint: {
    color: colors.primary,
    marginTop: spacing.xs,
    ...typography.bodySmall,
  },
});
