import { fireEvent, render } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';

import type { PhotoDraftItem } from '@/hooks/usePhotoDrafts';

import { PhotoDraftsSection } from './DailyLogPhotos';

function makePhoto(clientId: string): PhotoDraftItem {
  return {
    clientId,
    kind: 'draft',
    thumbnailUri: `file:///${clientId}/thumbnail.jpg`,
    masterUri: `file:///${clientId}/master.jpg`,
    sourceKind: 'library',
  };
}

describe('PhotoDraftsSection', () => {
  it('renders larger separated draft photo controls', () => {
    const screen = render(
      <PhotoDraftsSection
        photos={[makePhoto('photo-1')]}
        remainingSlots={11}
        isProcessing={false}
        onTakePhoto={jest.fn()}
        onChoosePhotos={jest.fn()}
        onRemovePhoto={jest.fn()}
        onMovePhoto={jest.fn()}
      />,
    );

    const thumbnailStyle = StyleSheet.flatten(screen.UNSAFE_getByType(Image).props.style);
    const deleteButton = screen.getByLabelText('Remove photo');
    const deleteButtonStyle = StyleSheet.flatten(deleteButton.props.style);
    const moveButton = screen.getByLabelText('Move photo left');
    const moveButtonStyle = StyleSheet.flatten(moveButton.props.style);

    expect(thumbnailStyle.width).toBe(128);
    expect(deleteButtonStyle.height).toBe(44);
    expect(deleteButtonStyle.width).toBe(44);
    expect(moveButtonStyle.height).toBe(44);
  });

  it('wires delete and reorder controls to the selected draft photo', () => {
    const onRemovePhoto = jest.fn();
    const onMovePhoto = jest.fn();
    const screen = render(
      <PhotoDraftsSection
        photos={[makePhoto('photo-1'), makePhoto('photo-2')]}
        remainingSlots={10}
        isProcessing={false}
        onTakePhoto={jest.fn()}
        onChoosePhotos={jest.fn()}
        onRemovePhoto={onRemovePhoto}
        onMovePhoto={onMovePhoto}
      />,
    );

    fireEvent.press(screen.getAllByLabelText('Remove photo')[1]);
    fireEvent.press(screen.getAllByLabelText('Move photo left')[1]);
    fireEvent.press(screen.getAllByLabelText('Move photo right')[0]);

    expect(onRemovePhoto).toHaveBeenCalledWith('photo-2');
    expect(onMovePhoto).toHaveBeenCalledWith('photo-2', 'left');
    expect(onMovePhoto).toHaveBeenCalledWith('photo-1', 'right');
  });

  it('marks unavailable edge reorder controls as disabled', () => {
    const screen = render(
      <PhotoDraftsSection
        photos={[makePhoto('photo-1'), makePhoto('photo-2')]}
        remainingSlots={10}
        isProcessing={false}
        onTakePhoto={jest.fn()}
        onChoosePhotos={jest.fn()}
        onRemovePhoto={jest.fn()}
        onMovePhoto={jest.fn()}
      />,
    );

    const leftButtons = screen.getAllByLabelText('Move photo left');
    const rightButtons = screen.getAllByLabelText('Move photo right');

    expect(leftButtons[0].props.accessibilityState.disabled).toBe(true);
    expect(leftButtons[1].props.accessibilityState.disabled).toBe(false);
    expect(rightButtons[0].props.accessibilityState.disabled).toBe(false);
    expect(rightButtons[1].props.accessibilityState.disabled).toBe(true);
  });
});
