import { act, renderHook } from '@testing-library/react-native';

const mockProfilePhoto = {
  enabled: true,
  ownerId: 'new-mare-id',
  photoUri: 'file:///draft.jpg',
  existingPhoto: null,
  isProcessing: false,
  error: null,
  hasStagedChange: true,
  takePhoto: jest.fn(),
  choosePhoto: jest.fn(),
  removePhoto: jest.fn(),
  prepareForSave: jest.fn(),
  markSaveCommitted: jest.fn(),
};

jest.mock('./useProfilePhotoDraft', () => ({
  useProfilePhotoDraft: jest.fn(() => mockProfilePhoto),
}));

jest.mock('@/storage/repositories', () => ({
  clearProfilePhotoInTransaction: jest.fn(),
  createMare: jest.fn(),
  getMareById: jest.fn(),
  setProfilePhotoInTransaction: jest.fn(),
  softDeleteMare: jest.fn(),
  updateMare: jest.fn(),
}));

const mockDb = {
  withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
    await callback();
  }),
};

jest.mock('@/storage/db', () => ({
  getDb: jest.fn(async () => mockDb),
}));

jest.mock('@/utils/id', () => ({
  newId: jest.fn(() => 'new-mare-id'),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  createMare: jest.Mock;
  setProfilePhotoInTransaction: jest.Mock;
};

import { useEditMareForm } from './useEditMareForm';

describe('useEditMareForm profile photo persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.createMare.mockResolvedValue(undefined);
    repositories.setProfilePhotoInTransaction.mockResolvedValue(undefined);
    mockProfilePhoto.prepareForSave.mockResolvedValue({
      kind: 'set',
      attachmentId: 'attachment-1',
      asset: {
        id: 'asset-1',
        masterRelativePath: 'photo-assets/asset-1/master.jpg',
        thumbnailRelativePath: 'photo-assets/asset-1/thumbnail.jpg',
        masterMimeType: 'image/jpeg',
        thumbnailMimeType: 'image/jpeg',
        width: 1200,
        height: 900,
        fileSizeBytes: 1234,
        sourceKind: 'library',
        createdAt: '2026-05-03T12:00:00.000Z',
        updatedAt: '2026-05-03T12:00:00.000Z',
      },
    });
  });

  it('creates a new mare and profile photo in the same transaction', async () => {
    const onGoBack = jest.fn();
    const { result } = renderHook(() =>
      useEditMareForm({
        onGoBack,
        onDeleted: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setName('Nova');
      result.current.setBreed('Warmblood');
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(repositories.createMare).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-mare-id', name: 'Nova' }),
      mockDb,
    );
    expect(repositories.setProfilePhotoInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentId: 'attachment-1',
        ownerType: 'mare',
        ownerId: 'new-mare-id',
      }),
      mockDb,
    );
    expect(mockProfilePhoto.markSaveCommitted).toHaveBeenCalled();
    expect(onGoBack).toHaveBeenCalled();
  });

  it('stays on the form when profile photo metadata persistence fails', async () => {
    repositories.setProfilePhotoInTransaction.mockRejectedValueOnce(new Error('photo failed'));
    const onGoBack = jest.fn();
    const { result } = renderHook(() =>
      useEditMareForm({
        onGoBack,
        onDeleted: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setName('Nova');
      result.current.setBreed('Warmblood');
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(mockProfilePhoto.markSaveCommitted).not.toHaveBeenCalled();
    expect(onGoBack).not.toHaveBeenCalled();
  });
});
