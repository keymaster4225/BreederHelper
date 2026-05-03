import { fireEvent, render } from '@testing-library/react-native';

import { PhotoViewerScreen } from './PhotoViewerScreen';

function createNavigation() {
  return {
    goBack: jest.fn(),
  };
}

it('moves between photos and closes the viewer', () => {
  const navigation = createNavigation();
  const screen = render(
    <PhotoViewerScreen
      navigation={navigation as never}
      route={{
        key: 'PhotoViewer',
        name: 'PhotoViewer',
        params: {
          photos: [
            { uri: 'file:///one.jpg', title: 'One' },
            { uri: 'file:///two.jpg', title: 'Two' },
          ],
          initialIndex: 0,
        },
      } as never}
    />,
  );

  expect(screen.getByText('One')).toBeTruthy();
  expect(screen.getByText('1/2')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Next photo'));

  expect(screen.getByText('Two')).toBeTruthy();
  expect(screen.getByText('2/2')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Close photo viewer'));

  expect(navigation.goBack).toHaveBeenCalled();
});

it('shows a missing-file state when image loading fails', () => {
  const screen = render(
    <PhotoViewerScreen
      navigation={createNavigation() as never}
      route={{
        key: 'PhotoViewer',
        name: 'PhotoViewer',
        params: { uri: 'file:///missing.jpg', title: 'Missing' },
      } as never}
    />,
  );

  fireEvent(screen.getByLabelText('Missing'), 'error');

  expect(screen.getByText('Photo file not found.')).toBeTruthy();
});
