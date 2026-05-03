import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { isPhotosEnabled } from '@/config/featureFlags';
import type { PhotoAsset, PhotoOwnerType } from '@/models/types';
import { finalizePhotoDraft, resolvePhotoUri } from '@/storage/photoFiles/assets';
import { deletePhotoDraftDirectory } from '@/storage/photoFiles/drafts';
import {
  normalizePhotoToDraft,
  type NormalizedPhotoDraft,
} from '@/storage/photoFiles/normalize';
import { getProfilePhoto, type PhotoAttachmentWithAsset } from '@/storage/repositories';
import { newId } from '@/utils/id';

type ProfileOwnerType = Extract<PhotoOwnerType, 'mare' | 'stallion'>;

export type ResolvedProfilePhoto = {
  readonly thumbnailUri: string;
  readonly masterUri: string;
};

export type ProfilePhotoSaveAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'clear' }
  | {
      readonly kind: 'set';
      readonly attachmentId: string;
      readonly asset: PhotoAsset;
    };

type UseProfilePhotoDraftArgs = {
  readonly ownerType: ProfileOwnerType;
  readonly ownerId: string;
  readonly enabled?: boolean;
};

export type ProfilePhotoDraftState = {
  readonly enabled: boolean;
  readonly ownerId: string;
  readonly photoUri: string | null;
  readonly existingPhoto: PhotoAttachmentWithAsset | null;
  readonly isProcessing: boolean;
  readonly error: string | null;
  readonly hasStagedChange: boolean;
  readonly takePhoto: () => Promise<void>;
  readonly choosePhoto: () => Promise<void>;
  readonly removePhoto: () => void;
  readonly prepareForSave: () => Promise<ProfilePhotoSaveAction>;
  readonly markSaveCommitted: () => void;
};

function resolveProfilePhoto(photo: PhotoAttachmentWithAsset | null): ResolvedProfilePhoto | null {
  if (!photo) {
    return null;
  }

  return {
    thumbnailUri: resolvePhotoUri(photo.asset.thumbnailRelativePath),
    masterUri: resolvePhotoUri(photo.asset.masterRelativePath),
  };
}

function firstPickedAsset(
  result: ImagePicker.ImagePickerResult,
): ImagePicker.ImagePickerAsset | null {
  if (result.canceled) {
    return null;
  }

  return result.assets[0] ?? null;
}

export function useProfilePhotoDraft({
  ownerType,
  ownerId,
  enabled = isPhotosEnabled(),
}: UseProfilePhotoDraftArgs): ProfilePhotoDraftState {
  const [existingPhoto, setExistingPhoto] = useState<PhotoAttachmentWithAsset | null>(null);
  const [draft, setDraft] = useState<NormalizedPhotoDraft | null>(null);
  const [finalizedAsset, setFinalizedAsset] = useState<PhotoAsset | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    setExistingPhoto(null);
    setDraft((currentDraft) => {
      if (currentDraft) {
        deletePhotoDraftDirectory(currentDraft.draftId);
      }
      return null;
    });
    setFinalizedAsset(null);
    setRemoveExisting(false);
    setError(null);

    if (!enabled) {
      return () => {
        mounted = false;
      };
    }

    void getProfilePhoto(ownerType, ownerId)
      .then((photo) => {
        if (mounted) {
          setExistingPhoto(photo);
        }
      })
      .catch((loadError: unknown) => {
        if (!mounted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load profile photo.';
        setError(message);
      });

    return () => {
      mounted = false;
    };
  }, [enabled, ownerId, ownerType]);

  const existingResolvedPhoto = useMemo(() => resolveProfilePhoto(existingPhoto), [existingPhoto]);

  const photoUri = useMemo(() => {
    if (draft) {
      return draft.thumbnailUri;
    }

    if (finalizedAsset) {
      return resolvePhotoUri(finalizedAsset.thumbnailRelativePath);
    }

    if (removeExisting) {
      return null;
    }

    return existingResolvedPhoto?.thumbnailUri ?? null;
  }, [draft, existingResolvedPhoto?.thumbnailUri, finalizedAsset, removeExisting]);

  const replaceDraft = useCallback((nextDraft: NormalizedPhotoDraft): void => {
    setDraft((currentDraft) => {
      if (currentDraft) {
        deletePhotoDraftDirectory(currentDraft.draftId);
      }
      return nextDraft;
    });
    setFinalizedAsset(null);
    setRemoveExisting(false);
  }, []);

  const stagePickedPhoto = useCallback(
    async (sourceKind: 'camera' | 'library', sourceUri: string): Promise<void> => {
      setIsProcessing(true);
      setError(null);
      try {
        const nextDraft = await normalizePhotoToDraft({
          draftId: newId(),
          sourceKind,
          sourceUri,
        });
        replaceDraft(nextDraft);
      } catch (stageError) {
        const message =
          stageError instanceof Error ? stageError.message : 'Could not prepare this photo.';
        setError(message);
        Alert.alert('Photo failed', message);
      } finally {
        setIsProcessing(false);
      }
    },
    [replaceDraft],
  );

  const choosePhoto = useCallback(async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const message = 'Photo library permission is required to choose a profile photo.';
      setError(message);
      Alert.alert('Permission needed', message);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      selectionLimit: 1,
    });
    const asset = firstPickedAsset(result);
    if (asset?.uri) {
      await stagePickedPhoto('library', asset.uri);
    }
  }, [stagePickedPhoto]);

  const takePhoto = useCallback(async (): Promise<void> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      const message = 'Camera permission is required to take a profile photo.';
      setError(message);
      Alert.alert('Permission needed', message);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    const asset = firstPickedAsset(result);
    if (asset?.uri) {
      await stagePickedPhoto('camera', asset.uri);
    }
  }, [stagePickedPhoto]);

  const removePhoto = useCallback((): void => {
    setDraft((currentDraft) => {
      if (currentDraft) {
        deletePhotoDraftDirectory(currentDraft.draftId);
      }
      return null;
    });
    setFinalizedAsset(null);
    setRemoveExisting(existingPhoto !== null);
    setError(null);
  }, [existingPhoto]);

  const prepareForSave = useCallback(async (): Promise<ProfilePhotoSaveAction> => {
    if (!enabled) {
      return { kind: 'none' };
    }

    if (finalizedAsset) {
      return { kind: 'set', attachmentId: newId(), asset: finalizedAsset };
    }

    if (draft) {
      const asset = await finalizePhotoDraft({
        assetId: newId(),
        draft,
      });
      setDraft(null);
      setFinalizedAsset(asset);
      return { kind: 'set', attachmentId: newId(), asset };
    }

    if (removeExisting && existingPhoto) {
      return { kind: 'clear' };
    }

    return { kind: 'none' };
  }, [draft, enabled, existingPhoto, finalizedAsset, removeExisting]);

  const markSaveCommitted = useCallback((): void => {
    setDraft(null);
    setFinalizedAsset(null);
    setRemoveExisting(false);
  }, []);

  return {
    enabled,
    ownerId,
    photoUri,
    existingPhoto,
    isProcessing,
    error,
    hasStagedChange: draft !== null || finalizedAsset !== null || removeExisting,
    takePhoto,
    choosePhoto,
    removePhoto,
    prepareForSave,
    markSaveCommitted,
  };
}
