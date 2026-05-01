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

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockAsyncStorage = {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  };

  return {
    ...mockAsyncStorage,
    default: mockAsyncStorage,
  };
});

jest.mock('expo-localization', () => ({
  useCalendars: () => [{ uses24hourClock: false }],
  getCalendars: () => [{ uses24hourClock: false }],
}));

jest.mock('expo-font', () => ({
  isLoaded: () => true,
  loadAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-documents/',
  cacheDirectory: 'file:///mock-cache/',
  Directory: jest.fn().mockImplementation((...parts: readonly string[]) => ({
    uri: parts.join('/'),
    exists: true,
    create: jest.fn(),
    createDirectory: jest.fn(),
    createFile: jest.fn(),
    delete: jest.fn(),
    info: jest.fn(() => ({ exists: true })),
    list: jest.fn(() => []),
  })),
  File: jest.fn().mockImplementation((...parts: readonly string[]) => ({
    uri: parts.join('/'),
    exists: true,
    size: 0,
    bytes: jest.fn().mockResolvedValue(new Uint8Array()),
    bytesSync: jest.fn(() => new Uint8Array()),
    write: jest.fn(),
    open: jest.fn(() => ({
      close: jest.fn(),
      readBytes: jest.fn(() => new Uint8Array()),
      writeBytes: jest.fn(),
      offset: 0,
      size: 0,
    })),
    create: jest.fn(),
    delete: jest.fn(),
    info: jest.fn(() => ({ exists: true, size: 0 })),
    text: jest.fn().mockResolvedValue(''),
    textSync: jest.fn(() => ''),
  })),
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

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: {
    Images: 'Images',
  },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file:///mock-cache/manipulated.jpg',
    width: 1,
    height: 1,
  }),
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
