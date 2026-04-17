import { fireEvent, render } from '@testing-library/react-native';

import { SettingsScreen } from '@/screens/SettingsScreen';

function renderScreen() {
  const navigation = {
    navigate: jest.fn(),
  };
  const route = {
    key: 'Settings',
    name: 'Settings',
    params: undefined,
  };

  return {
    navigation,
    ...render(<SettingsScreen navigation={navigation as never} route={route as never} />),
  };
}

it('renders the backup row and navigates to data backup', () => {
  const screen = renderScreen();

  expect(screen.getByText('Settings')).toBeTruthy();
  expect(screen.getByText('Data Backup & Restore')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Data Backup & Restore'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('DataBackup');
});
