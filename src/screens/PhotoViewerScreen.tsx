import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoViewer'>;

export function PhotoViewerScreen({ navigation, route }: Props): JSX.Element {
  const photos = useMemo(() => {
    if ('photos' in route.params) {
      return route.params.photos;
    }

    return [{ uri: route.params.uri, title: route.params.title }];
  }, [route.params]);
  const [index, setIndex] = useState(
    'initialIndex' in route.params
      ? Math.max(0, Math.min(route.params.initialIndex ?? 0, photos.length - 1))
      : 0,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const current = photos[index] ?? photos[0];

  const goToIndex = (nextIndex: number): void => {
    setIndex(Math.max(0, Math.min(nextIndex, photos.length - 1)));
    setIsLoading(true);
    setHasError(false);
  };

  return (
    <Screen>
      <View style={styles.viewer}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Close photo viewer"
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.counter}>{photos.length > 1 ? `${index + 1}/${photos.length}` : ''}</Text>
        </View>
        <View style={styles.imageFrame}>
          {current ? (
            <Image
              source={{ uri: current.uri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={current.title ?? 'Photo'}
              onLoadStart={() => {
                setIsLoading(true);
                setHasError(false);
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          ) : null}
          {isLoading ? <ActivityIndicator color={colors.primary} size="large" style={styles.overlay} /> : null}
          {hasError ? (
            <View style={styles.overlay}>
              <MaterialCommunityIcons name="image-broken-variant" size={32} color={colors.onSurfaceVariant} />
              <Text style={styles.missingText}>Photo file not found.</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityLabel="Previous photo"
            accessibilityRole="button"
            disabled={index === 0}
            onPress={() => goToIndex(index - 1)}
            style={({ pressed }) => [
              styles.navButton,
              index === 0 && styles.navButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.onSurface} />
          </Pressable>
          {current?.title ? <Text style={styles.title}>{current.title}</Text> : <View style={styles.titleSpacer} />}
          <Pressable
            accessibilityLabel="Next photo"
            accessibilityRole="button"
            disabled={index >= photos.length - 1}
            onPress={() => goToIndex(index + 1)}
            style={({ pressed }) => [
              styles.navButton,
              index >= photos.length - 1 && styles.navButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="chevron-right" size={28} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewer: {
    flex: 1,
    gap: spacing.md,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  counter: {
    color: colors.onSurfaceVariant,
    minWidth: 48,
    textAlign: 'right',
    ...typography.labelMedium,
  },
  imageFrame: {
    backgroundColor: colors.inverseSurface,
    borderRadius: 8,
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    alignItems: 'center',
    bottom: 0,
    gap: spacing.sm,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  missingText: {
    color: colors.onSurfaceVariant,
    ...typography.bodyMedium,
  },
  bottomBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navButton: {
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  navButtonDisabled: {
    opacity: 0.32,
  },
  title: {
    color: colors.onSurface,
    flex: 1,
    textAlign: 'center',
    ...typography.titleMedium,
  },
  titleSpacer: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
