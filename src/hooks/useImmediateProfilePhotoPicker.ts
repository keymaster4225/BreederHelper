import { useCallback, useState } from 'react';
import { Alert, type AlertButton } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import type { PhotoOwnerType } from '@/models/types';
import { finalizePhotoDraft } from '@/storage/photoFiles/assets';
import { deletePhotoDraftDirectory } from '@/storage/photoFiles/drafts';
import { normalizePhotoToDraft, type NormalizedPhotoDraft } from '@/storage/photoFiles/normalize';
import { clearProfilePhoto, setProfilePhoto } from '@/storage/repositories';
import { newId } from '@/utils/id';

type ProfileOwnerType = Extract<PhotoOwnerType, 'mare' | 'stallion'>;
type ProfilePhotoSourceKind = 'camera' | 'library';

type UseImmediateProfilePhotoPickerArgs = {
  readonly ownerType: ProfileOwnerType;
  readonly ownerId: string;
  readonly onSaved: () => Promise<void> | void;
};

type OpenPickerOptions = {
  readonly hasPhoto: boolean;
};

function firstPickedAsset(
  result: ImagePicker.ImagePickerResult,
): ImagePicker.ImagePickerAsset | null {
  if (result.canceled) {
    return null;
  }

  return result.assets[0] ?? null;
}

export function useImmediateProfilePhotoPicker({
  ownerType,
  ownerId,
  onSaved,
}: UseImmediateProfilePhotoPickerArgs): {
  readonly isProcessing: boolean;
  readonly openPicker: (options: OpenPickerOptions) => void;
} {
  const [isProcessing, setIsProcessing] = useState(false);

  const savePickedPhoto = useCallback(
    async (sourceKind: ProfilePhotoSourceKind, sourceUri: string): Promise<void> => {
      let draft: NormalizedPhotoDraft | null = null;
      setIsProcessing(true);

      try {
        draft = await normalizePhotoToDraft({
          draftId: newId(),
          sourceKind,
          sourceUri,
        });
        const asset = await finalizePhotoDraft({
          assetId: newId(),
          draft,
        });
        draft = null;
        await setProfilePhoto({
          attachmentId: newId(),
          ownerType,
          ownerId,
          asset,
        });
        await onSaved();
      } catch (error) {
        if (draft) {
          deletePhotoDraftDirectory(draft.draftId);
        }
        const message = error instanceof Error ? error.message : 'Could not update this profile photo.';
        Alert.alert('Photo failed', message);
      } finally {
        setIsProcessing(false);
      }
    },
    [onSaved, ownerId, ownerType],
  );

  const pickPhoto = useCallback(
    async (sourceKind: ProfilePhotoSourceKind): Promise<void> => {
      const permission =
        sourceKind === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        const message =
          sourceKind === 'camera'
            ? 'Camera permission is required to take a profile photo.'
            : 'Photo library permission is required to choose a profile photo.';
        Alert.alert('Permission needed', message);
        return;
      }

      const result =
        sourceKind === 'camera'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
              selectionLimit: 1,
            });

      const asset = firstPickedAsset(result);
      if (asset?.uri) {
        await savePickedPhoto(sourceKind, asset.uri);
      }
    },
    [savePickedPhoto],
  );

  const removePhoto = useCallback(async (): Promise<void> => {
    setIsProcessing(true);
    try {
      await clearProfilePhoto(ownerType, ownerId);
      await onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove this profile photo.';
      Alert.alert('Photo failed', message);
    } finally {
      setIsProcessing(false);
    }
  }, [onSaved, ownerId, ownerType]);

  const openPicker = useCallback(
    ({ hasPhoto }: OpenPickerOptions): void => {
      if (isProcessing) {
        return;
      }

      const buttons: AlertButton[] = [
        {
          text: 'Camera',
          onPress: () => {
            void pickPhoto('camera');
          },
        },
        {
          text: 'Library',
          onPress: () => {
            void pickPhoto('library');
          },
        },
      ];

      if (hasPhoto) {
        buttons.push({
          text: 'Remove Photo',
          style: 'destructive',
          onPress: () => {
            void removePhoto();
          },
        });
      }

      buttons.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert('Profile Photo', undefined, buttons);
    },
    [isProcessing, pickPhoto, removePhoto],
  );

  return { isProcessing, openPicker };
}
