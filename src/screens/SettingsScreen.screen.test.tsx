import { fireEvent, render } from '@testing-library/react-native';

import { SettingsScreen } from '@/screens/SettingsScreen';

jest.mock('@/hooks/useClockPreference', () => ({
  useClockPreference: jest.fn(),
}));

const { useClockPreference } = jest.requireMock('@/hooks/useClockPreference') as {
  useClockPreference: jest.Mock;
};

function renderScreen() {
  const navigation = {
    navigate: jest.fn(),
  };
  const setClockPreference = jest.fn();
  useClockPreference.mockReturnValue({
    clockPreference: 'system',
    clockDisplayMode: '24h',
    setClockPreference,
  });
  const route = {
    key: 'Settings',
    name: 'Settings',
    params: undefined,
  };

  return {
    navigation,
    setClockPreference,
    ...render(<SettingsScreen navigation={navigation as never} route={route as never} />),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders the backup row and navigates to data backup', () => {
  const screen = renderScreen();

  expect(screen.getByText('Settings')).toBeTruthy();
  expect(screen.getByText('Data Backup & Restore')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Data Backup & Restore'));
  expect(screen.navigation.navigate).toHaveBeenCalledWith('DataBackup');
});

it('renders clock format choices and persists a selected preference', () => {
  const screen = renderScreen();

  expect(screen.getByText('Clock Format')).toBeTruthy();
  expect(screen.getByText('System Default')).toBeTruthy();
  expect(screen.getByText('12-hour')).toBeTruthy();
  expect(screen.getByText('24-hour')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Use 24-hour clock format'));

  expect(screen.setClockPreference).toHaveBeenCalledWith('24h');
});
