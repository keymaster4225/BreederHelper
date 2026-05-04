import { fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';

import { ProfilePhotoAvatar } from './ProfilePhoto';

describe('ProfilePhotoAvatar', () => {
  it('renders initials as a non-interactive fallback when no photo exists', () => {
    const screen = render(<ProfilePhotoAvatar name="Nova Star" uri={null} size={72} />);

    expect(screen.getByText('NS')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens an existing profile photo when tapped', () => {
    const onPress = jest.fn();
    const screen = render(
      <ProfilePhotoAvatar
        name="Nova"
        uri="file:///photo-assets/asset-1/thumbnail.jpg"
        size={72}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByLabelText('Nova profile photo'));

    expect(onPress).toHaveBeenCalled();
  });

  it('falls back to tappable initials when an interactive thumbnail cannot render', () => {
    const onPress = jest.fn();
    const screen = render(
      <ProfilePhotoAvatar
        name="Missing Photo"
        uri="file:///photo-assets/missing/thumbnail.jpg"
        size={72}
        onPress={onPress}
      />,
    );

    fireEvent(screen.UNSAFE_getByType(Image), 'error');
    fireEvent.press(screen.getByLabelText('Missing Photo profile photo'));

    expect(screen.getByText('MP')).toBeTruthy();
    expect(onPress).toHaveBeenCalled();
  });
});
