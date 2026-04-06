import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { borderRadius, colors, spacing, typography } from '@/theme';

export function WelcomeScreen(): JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View pointerEvents="none" style={styles.background}>
        <View style={[styles.orb, styles.orbPrimary]} />
        <View style={[styles.orb, styles.orbSecondary]} />
        <View style={styles.horizon} />
      </View>
      <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.crest}>
          <View style={styles.crestInner}>
            <MaterialCommunityIcons name="horse-variant-fast" size={70} color={colors.onPrimaryContainer} />
          </View>
        </View>
        <Text style={styles.title}>BreedWise</Text>
        <Text style={styles.subtitle}>Mare and stallion records, all in one place.</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: borderRadius.full,
  },
  orbPrimary: {
    width: 260,
    height: 260,
    top: -40,
    right: -40,
    backgroundColor: colors.primaryContainer,
    opacity: 0.9,
  },
  orbSecondary: {
    width: 220,
    height: 220,
    left: -70,
    bottom: 120,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.72,
  },
  horizon: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -40,
    height: 220,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: colors.surfaceVariant,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  crest: {
    width: 168,
    height: 168,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
  crestInner: {
    width: 132,
    height: 132,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.onPrimary,
  },
  title: {
    ...typography.headlineLarge,
    color: colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
  },
});
