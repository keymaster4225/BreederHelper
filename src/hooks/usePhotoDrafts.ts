import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { isPhotosEnabled } from '@/config/featureFlags';
import type { PhotoAsset, PhotoSourceKind } from '@/models/types';
import { finalizePhotoDraft, resolvePhotoUri } from '@/storage/photoFiles/assets';
import { deletePhotoDraftDirectory } from '@/storage/photoFiles/drafts';
import {
  normalizePhotoToDraft,
  type NormalizedPhotoDraft,
} from '@/storage/photoFiles/normalize';
import {
  DAILY_LOG_PHOTO_LIMIT,
  type PhotoAttachmentWithAsset,
  type ReplaceAttachmentPhotoInput,
} from '@/storage/repositories';
import { newId } from '@/utils/id';

export type PhotoDraftItem = {
  readonly clientId: string;
  readonly thumbnailUri: string;
  readonly masterUri: string;
  readonly sourceKind: PhotoSourceKind;
  readonly kind: 'existing' | 'draft' | 'finalized';
  readonly attachmentId?: string;
  readonly draft?: NormalizedPhotoDraft;
  readonly asset?: PhotoAsset;
};

export type UsePhotoDraftsState = {
  readonly enabled: boolean;
  readonly limit: number;
  readonly items: readonly PhotoDraftItem[];
  readonly remainingSlots: number;
  readonly isProcessing: boolean;
  readonly hydrateExisting: (photos: readonly PhotoAttachmentWithAsset[]) => void;
  readonly choosePhotos: () => Promise<void>;
  readonly takePhoto: () => Promise<void>;
  readonly removePhoto: (clientId: string) => void;
  readonly movePhoto: (clientId: string, direction: 'left' | 'right') => void;
  readonly prepareForSave: () => Promise<readonly ReplaceAttachmentPhotoInput[]>;
};

function toExistingItem(photo: PhotoAttachmentWithAsset): PhotoDraftItem {
  return {
    clientId: photo.id,
    kind: 'existing',
    attachmentId: photo.id,
    thumbnailUri: resolvePhotoUri(photo.asset.thumbnailRelativePath),
    masterUri: resolvePhotoUri(photo.asset.masterRelativePath),
    sourceKind: photo.asset.sourceKind,
  };
}

function pickedAssets(result: ImagePicker.ImagePickerResult): readonly ImagePicker.ImagePickerAsset[] {
  if (result.canceled) {
    return [];
  }

  return result.assets;
}

export function usePhotoDrafts(enabled = isPhotosEnabled()): UsePhotoDraftsState {
  const [items, setItems] = useState<PhotoDraftItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const remainingSlots = useMemo(
    () => Math.max(0, DAILY_LOG_PHOTO_LIMIT - items.length),
    [items.length],
  );

  const hydrateExisting = useCallback((photos: readonly PhotoAttachmentWithAsset[]): void => {
    setItems((current) => {
      for (const item of current) {
        if (item.kind === 'draft' && item.draft) {
          deletePhotoDraftDirectory(item.draft.draftId);
        }
      }

      return photos.map(toExistingItem);
    });
  }, []);

  const appendPickedAssets = useCallback(
    async (
      sourceKind: Extract<PhotoSourceKind, 'camera' | 'library'>,
      assets: readonly ImagePicker.ImagePickerAsset[],
    ): Promise<void> => {
      if (!enabled || assets.length === 0) {
        return;
      }

      const slots = Math.max(0, DAILY_LOG_PHOTO_LIMIT - items.length);
      if (slots === 0) {
        Alert.alert('Photo limit reached', 'Daily logs can have at most 12 photos.');
        return;
      }

      const accepted = assets.slice(0, slots);
      const skipped = assets.length - accepted.length;
      setIsProcessing(true);
      try {
        const nextItems: PhotoDraftItem[] = [];
        for (const asset of accepted) {
          if (!asset.uri) {
            continue;
          }

          const draft = await normalizePhotoToDraft({
            sourceUri: asset.uri,
            sourceKind,
          });
          nextItems.push({
            clientId: newId(),
            kind: 'draft',
            draft,
            thumbnailUri: draft.thumbnailUri,
            masterUri: draft.masterUri,
            sourceKind,
          });
        }

        if (nextItems.length > 0) {
          setItems((current) => [...current, ...nextItems].slice(0, DAILY_LOG_PHOTO_LIMIT));
        }
        if (skipped > 0) {
          Alert.alert(
            'Some photos skipped',
            `${skipped} photo${skipped === 1 ? '' : 's'} skipped because daily logs can have at most 12 photos.`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not prepare selected photos.';
        Alert.alert('Photo failed', message);
      } finally {
        setIsProcessing(false);
      }
    },
    [enabled, items.length],
  );

  const choosePhotos = useCallback(async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library permission is required to add daily log photos.');
      return;
    }

    const slots = Math.max(0, DAILY_LOG_PHOTO_LIMIT - items.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      selectionLimit: slots,
    });

    await appendPickedAssets('library', pickedAssets(result));
  }, [appendPickedAssets, items.length]);

  const takePhoto = useCallback(async (): Promise<void> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to add a daily log photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    await appendPickedAssets('camera', pickedAssets(result).slice(0, 1));
  }, [appendPickedAssets]);

  const removePhoto = useCallback((clientId: string): void => {
    setItems((current) => {
      const removed = current.find((item) => item.clientId === clientId);
      if (removed?.kind === 'draft' && removed.draft) {
        deletePhotoDraftDirectory(removed.draft.draftId);
      }

      return current.filter((item) => item.clientId !== clientId);
    });
  }, []);

  const movePhoto = useCallback((clientId: string, direction: 'left' | 'right'): void => {
    setItems((current) => {
      const index = current.findIndex((item) => item.clientId === clientId);
      const nextIndex = direction === 'left' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item!);
      return next;
    });
  }, []);

  const prepareForSave = useCallback(async (): Promise<readonly ReplaceAttachmentPhotoInput[]> => {
    const prepared: PhotoDraftItem[] = [];
    const photoInputs: ReplaceAttachmentPhotoInput[] = [];

    for (const item of items) {
      if (item.kind === 'existing' && item.attachmentId) {
        prepared.push(item);
        photoInputs.push({ kind: 'existing', attachmentId: item.attachmentId });
        continue;
      }

      const existingAsset = item.kind === 'finalized' ? item.asset : null;
      const asset = existingAsset ?? (item.draft
        ? await finalizePhotoDraft({
            assetId: newId(),
            draft: item.draft,
          })
        : null);

      if (!asset) {
        continue;
      }

      prepared.push({
        ...item,
        kind: 'finalized',
        draft: undefined,
        asset,
        thumbnailUri: resolvePhotoUri(asset.thumbnailRelativePath),
        masterUri: resolvePhotoUri(asset.masterRelativePath),
      });
      photoInputs.push({
        kind: 'new',
        attachmentId: newId(),
        asset,
      });
    }

    setItems(prepared);
    return photoInputs;
  }, [items]);

  return {
    enabled,
    limit: DAILY_LOG_PHOTO_LIMIT,
    items,
    remainingSlots,
    isProcessing,
    hydrateExisting,
    choosePhotos,
    takePhoto,
    removePhoto,
    movePhoto,
    prepareForSave,
  };
}
