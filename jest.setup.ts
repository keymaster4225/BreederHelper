jest.mock('@expo-google-fonts/lora', () => ({
  Lora_400Regular: 'Lora_400Regular',
  Lora_700Bold: 'Lora_700Bold',
  useFonts: () => [true],
}));

jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  useFonts: () => [true],
}));

jest.mock('react-native-pager-view', () => {
  const mockReact = require('react');
  const { View } = require('react-native');

  return mockReact.forwardRef(({ children, ...props }: any, ref) => {
    mockReact.useImperativeHandle(ref, () => ({
      setPage: jest.fn(),
    }));
    return mockReact.createElement(View, props, children);
  });
});

jest.mock('react-native-calendars', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Calendar: ({ children }: { children?: any }) => mockReact.createElement(View, null, children),
    CalendarList: ({ children }: { children?: any }) => mockReact.createElement(View, null, children),
  };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('expo-font', () => ({
  isLoaded: () => true,
  loadAsync: jest.fn(),
}));

jest.mock('@/storage/useAppBootstrap', () => ({
  useAppBootstrap: () => ({ isReady: true, error: null }),
}));

jest.mock('@/utils/onboarding', () => ({
  getOnboardingComplete: jest.fn().mockResolvedValue(true),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: ({ name }: { name: string }) => {
    const mockReact = require('react');
    const { Text } = require('react-native');
    return mockReact.createElement(Text, null, name);
  },
}));

const consoleError = console.error;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
      return;
    }
    consoleError(...args);
  });
});
