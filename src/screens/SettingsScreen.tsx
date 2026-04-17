import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function SettingsScreen({ navigation }: Props): JSX.Element {
  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage backup files and restore local breeding data.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('DataBackup')}
          accessibilityRole="button"
          accessibilityLabel="Data Backup & Restore"
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="database-arrow-up-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Data Backup & Restore</Text>
            <Text style={styles.cardSubtitle}>Create a backup file or replace local data from a backup.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.level1,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
});
