import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { SecondaryButton } from '@/components/Buttons';
import type { PhotoDraftItem } from '@/hooks/usePhotoDrafts';
import { borderRadius, colors, spacing, typography } from '@/theme';

type PhotoDraftsSectionProps = {
  readonly photos: readonly PhotoDraftItem[];
  readonly remainingSlots: number;
  readonly isProcessing: boolean;
  readonly onTakePhoto: () => void;
  readonly onChoosePhotos: () => void;
  readonly onRemovePhoto: (clientId: string) => void;
  readonly onMovePhoto: (clientId: string, direction: 'left' | 'right') => void;
};

type ThumbnailStripProps = {
  readonly photos: readonly {
    readonly id: string;
    readonly thumbnailUri: string;
    readonly masterUri: string;
  }[];
  readonly onPressPhoto?: (index: number) => void;
};

export function PhotoDraftsSection({
  photos,
  remainingSlots,
  isProcessing,
  onTakePhoto,
  onChoosePhotos,
  onRemovePhoto,
  onMovePhoto,
}: PhotoDraftsSectionProps): JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Photos</Text>
        <Text style={styles.count}>{`${photos.length}/12`}</Text>
      </View>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.draftList}>
          {photos.map((photo, index) => (
            <View key={photo.clientId} style={styles.draftItem}>
              <Image source={{ uri: photo.thumbnailUri }} style={styles.draftImage} />
              <View style={styles.draftControls}>
                <Pressable
                  accessibilityLabel="Move photo left"
                  accessibilityRole="button"
                  disabled={index === 0}
                  onPress={() => onMovePhoto(photo.clientId, 'left')}
                  style={({ pressed }) => [
                    styles.iconButton,
                    index === 0 && styles.iconButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={18} color={colors.onSurface} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Remove photo"
                  accessibilityRole="button"
                  onPress={() => onRemovePhoto(photo.clientId)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Move photo right"
                  accessibilityRole="button"
                  disabled={index === photos.length - 1}
                  onPress={() => onMovePhoto(photo.clientId, 'right')}
                  style={({ pressed }) => [
                    styles.iconButton,
                    index === photos.length - 1 && styles.iconButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.onSurface} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>No photos added.</Text>
      )}
      <View style={styles.actions}>
        <SecondaryButton
          label={isProcessing ? 'Preparing...' : 'Camera'}
          onPress={onTakePhoto}
          disabled={isProcessing || remainingSlots === 0}
        />
        <SecondaryButton
          label="Library"
          onPress={onChoosePhotos}
          disabled={isProcessing || remainingSlots === 0}
        />
      </View>
    </View>
  );
}

export function DailyLogThumbnailStrip({ photos, onPressPhoto }: ThumbnailStripProps): JSX.Element | null {
  if (photos.length === 0) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailList}>
      {photos.map((photo, index) => (
        <Pressable
          key={photo.id}
          accessibilityLabel={`Open daily log photo ${index + 1}`}
          accessibilityRole="imagebutton"
          onPress={() => onPressPhoto?.(index)}
          style={({ pressed }) => [styles.thumbnailButton, pressed && styles.pressed]}
        >
          <Image source={{ uri: photo.thumbnailUri }} style={styles.thumbnail} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  count: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  draftList: {
    columnGap: spacing.sm,
  },
  draftItem: {
    gap: spacing.xs,
    width: 104,
  },
  draftImage: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    width: 104,
  },
  draftControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  iconButtonDisabled: {
    opacity: 0.32,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbnailList: {
    columnGap: spacing.xs,
    paddingTop: spacing.xs,
  },
  thumbnailButton: {
    borderRadius: borderRadius.md,
  },
  thumbnail: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    height: 56,
    width: 56,
  },
  pressed: {
    opacity: 0.72,
  },
});
