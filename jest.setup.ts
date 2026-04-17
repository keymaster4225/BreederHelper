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

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-documents/',
  cacheDirectory: 'file:///mock-cache/',
  Directory: jest.fn(),
  File: jest.fn(),
  Paths: {
    document: 'file:///mock-documents/',
    cache: 'file:///mock-cache/',
  },
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  copyAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-documents/',
  cacheDirectory: 'file:///mock-cache/',
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  copyAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

jest.mock('@/storage/useAppBootstrap', () => ({
  useAppBootstrap: () => ({ isReady: true, error: null, errorReportId: null }),
}));

jest.mock('@/utils/onboarding', () => ({
  getOnboardingComplete: jest.fn().mockResolvedValue(true),
  setOnboardingComplete: jest.fn().mockResolvedValue(undefined),
  setOnboardingCompleteValue: jest.fn().mockResolvedValue(undefined),
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
