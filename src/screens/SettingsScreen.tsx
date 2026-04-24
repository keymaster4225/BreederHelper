import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';
import { ClockPreference } from '@/utils/clockPreferences';
import { useClockPreference } from '@/hooks/useClockPreference';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

const CLOCK_OPTIONS: readonly { label: string; value: ClockPreference; accessibilityLabel: string }[] = [
  { label: 'System Default', value: 'system', accessibilityLabel: 'Use system default clock format' },
  { label: '12-hour', value: '12h', accessibilityLabel: 'Use 12-hour clock format' },
  { label: '24-hour', value: '24h', accessibilityLabel: 'Use 24-hour clock format' },
];

export function SettingsScreen({ navigation }: Props): JSX.Element {
  const { clockPreference, clockDisplayMode, setClockPreference } = useClockPreference();

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage display preferences, backup files, and local breeding data.</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Clock Format</Text>
              <Text style={styles.sectionSubtitle}>
                Current display: {clockDisplayMode === '24h' ? '24-hour' : '12-hour'}
              </Text>
            </View>
          </View>
          <View style={styles.optionGroup}>
            {CLOCK_OPTIONS.map((option) => {
              const active = option.value === clockPreference;
              return (
                <Pressable
                  key={option.value}
                  accessibilityLabel={option.accessibilityLabel}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    void setClockPreference(option.value);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {active ? (
                    <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
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
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionText: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  optionTextActive: {
    color: colors.primary,
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
