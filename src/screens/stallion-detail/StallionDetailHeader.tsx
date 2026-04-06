import { StyleSheet, Text, View } from 'react-native';

import { Stallion } from '@/models/types';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type StallionDetailHeaderProps = {
  readonly stallion: Stallion;
  readonly age: number | null;
};

export function StallionDetailHeader({ stallion, age }: StallionDetailHeaderProps): JSX.Element {
  return (
    <View style={styles.headerCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.headerName}>{stallion.name}</Text>
      </View>
      {stallion.breed ? <Text style={styles.headerLine}>{stallion.breed}</Text> : null}
      {age !== null ? <Text style={styles.headerLine}>Age {age}</Text> : null}
      {stallion.registrationNumber ? <Text style={styles.headerLine}>Reg #: {stallion.registrationNumber}</Text> : null}
      {stallion.sire ? <Text style={styles.headerLine}>Sire: {stallion.sire}</Text> : null}
      {stallion.dam ? <Text style={styles.headerLine}>Dam: {stallion.dam}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...elevation.level2,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerName: {
    ...typography.titleMedium,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
  },
  headerLine: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
});
