import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { SecondaryButton } from '@/components/Buttons';
import { borderRadius, colors, spacing, typography } from '@/theme';

type ProfilePhotoAvatarProps = {
  readonly name: string;
  readonly uri: string | null;
  readonly size: 56 | 72;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
};

type ProfilePhotoPickerProps = {
  readonly name: string;
  readonly uri: string | null;
  readonly isProcessing: boolean;
  readonly error?: string | null;
  readonly onTakePhoto: () => void;
  readonly onChoosePhoto: () => void;
  readonly onRemovePhoto: () => void;
};

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function ProfilePhotoAvatar({
  name,
  uri,
  size,
  onPress,
  accessibilityLabel,
}: ProfilePhotoAvatarProps): JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => initialsForName(name), [name]);
  const showImage = Boolean(uri) && !imageFailed;
  const avatarStyle = useMemo(
    () => [
      styles.avatar,
      {
        borderRadius: size / 2,
        height: size,
        width: size,
      },
    ],
    [size],
  );

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  const content = showImage ? (
    <Image
      source={{ uri: uri! }}
      style={[styles.avatarImage, { borderRadius: size / 2 }]}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <Text style={[styles.initials, size === 72 ? styles.initialsLarge : null]}>
      {initials}
    </Text>
  );

  if (showImage && onPress) {
    return (
      <Pressable
        style={({ pressed }) => [avatarStyle, pressed && styles.avatarPressed]}
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel ?? `${name} profile photo`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={avatarStyle}
      accessibilityRole="image"
      accessibilityLabel={showImage ? accessibilityLabel ?? `${name} profile photo` : `${name} initials`}
    >
      {content}
    </View>
  );
}

export function ProfilePhotoPicker({
  name,
  uri,
  isProcessing,
  error,
  onTakePhoto,
  onChoosePhoto,
  onRemovePhoto,
}: ProfilePhotoPickerProps): JSX.Element {
  return (
    <View style={styles.picker}>
      <ProfilePhotoAvatar name={name} uri={uri} size={56} />
      <View style={styles.pickerActions}>
        <View style={styles.buttonRow}>
          <SecondaryButton
            label={isProcessing ? 'Preparing...' : 'Camera'}
            onPress={onTakePhoto}
            disabled={isProcessing}
          />
          <SecondaryButton
            label="Library"
            onPress={onChoosePhoto}
            disabled={isProcessing}
          />
          {uri ? (
            <Pressable
              style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
              onPress={onRemovePhoto}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel="Remove profile photo"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.tertiaryContainer,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarPressed: {
    opacity: 0.8,
  },
  initials: {
    color: colors.onTertiaryContainer,
    ...typography.titleMedium,
  },
  initialsLarge: {
    ...typography.titleLarge,
  },
  picker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  pickerActions: {
    flex: 1,
    gap: spacing.xs,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  removeButton: {
    alignItems: 'center',
    borderColor: colors.errorContainer,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  removeButtonPressed: {
    backgroundColor: colors.errorContainer,
  },
  errorText: {
    color: colors.error,
    ...typography.bodySmall,
  },
});
