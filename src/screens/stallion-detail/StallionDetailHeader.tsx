import { StyleSheet, Text, View } from 'react-native';

import { ProfilePhotoAvatar } from '@/components/ProfilePhoto';
import { Stallion } from '@/models/types';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type StallionDetailHeaderProps = {
  readonly stallion: Stallion;
  readonly age: number | null;
  readonly profilePhotoUri?: string | null;
  readonly onProfilePhotoPress?: () => void;
};

export function StallionDetailHeader({
  stallion,
  age,
  profilePhotoUri,
  onProfilePhotoPress,
}: StallionDetailHeaderProps): JSX.Element {
  return (
    <View style={styles.headerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          {profilePhotoUri !== undefined ? (
            <ProfilePhotoAvatar
              name={stallion.name}
              uri={profilePhotoUri}
              size={72}
              onPress={onProfilePhotoPress}
              accessibilityLabel={`Change ${stallion.name} profile photo`}
            />
          ) : null}
          <Text style={styles.headerName}>{stallion.name}</Text>
        </View>
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
  },
  headerName: {
    ...typography.titleMedium,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  headerLine: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
});
