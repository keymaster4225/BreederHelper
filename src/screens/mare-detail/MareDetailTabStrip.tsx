import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { borderRadius, colors, spacing, typography } from '@/theme';

type MareDetailTabStripProps = {
  readonly tabs: readonly { label: string }[];
  readonly activeTabIndex: number;
  readonly onTabPress: (index: number) => void;
};

export function MareDetailTabStrip({
  tabs,
  activeTabIndex,
  onTabPress,
}: MareDetailTabStripProps): JSX.Element {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
      {tabs.map((tab, index) => {
        const active = index === activeTabIndex;
        return (
          <Pressable
            key={tab.label}
            style={({ pressed }) => [styles.tabButton, active ? styles.tabButtonActive : null, pressed && !active && styles.tabPressed]}
            onPress={() => onTabPress(index)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabScroll: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabButton: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  tabButtonTextActive: {
    color: colors.onPrimary,
  },
  tabPressed: {
    opacity: 0.7,
  },
});
