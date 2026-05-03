import { Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors, spacing, typography } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoViewer'>;

export function PhotoViewerScreen({ route }: Props): JSX.Element {
  return (
    <Screen>
      <View style={styles.viewer}>
        <Image
          source={{ uri: route.params.uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={route.params.title ?? 'Photo'}
        />
        {route.params.title ? <Text style={styles.title}>{route.params.title}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewer: {
    flex: 1,
    gap: spacing.md,
  },
  image: {
    backgroundColor: colors.inverseSurface,
    borderRadius: 8,
    flex: 1,
    width: '100%',
  },
  title: {
    color: colors.onSurface,
    textAlign: 'center',
    ...typography.titleMedium,
  },
});
