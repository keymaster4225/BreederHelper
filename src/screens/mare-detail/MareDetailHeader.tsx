import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { IconButton } from '@/components/Buttons';
import { Mare } from '@/models/types';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type MareDetailHeaderProps = {
  readonly mare: Mare;
  readonly age: number | null;
  readonly onCalendarPress: () => void;
};

export function MareDetailHeader({ mare, age, onCalendarPress }: MareDetailHeaderProps): JSX.Element {
  return (
    <View style={styles.headerCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.headerName}>{mare.name}</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon={<MaterialCommunityIcons name="calendar-month" size={20} color={colors.onSurface} />}
            onPress={onCalendarPress}
            accessibilityLabel="View Calendar"
          />
        </View>
      </View>
      <Text style={styles.headerLine}>{mare.breed}</Text>
      <Text style={styles.headerLine}>Gestation {mare.gestationLengthDays} days</Text>
      {age !== null ? <Text style={styles.headerLine}>Age {age}</Text> : null}
      {mare.registrationNumber ? <Text style={styles.headerLine}>Reg #: {mare.registrationNumber}</Text> : null}
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
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerLine: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
});
