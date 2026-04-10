import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearStartupErrorLog,
  getStartupErrorLog,
  persistStartupError,
} from './startupErrorLog';

const mockGetItem = AsyncStorage.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = AsyncStorage.setItem as ReturnType<typeof vi.fn>;
const mockRemoveItem = AsyncStorage.removeItem as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('persistStartupError', () => {
  it('stores a structured startup error payload', async () => {
    mockSetItem.mockResolvedValue(undefined);

    const id = await persistStartupError(new Error('db failed'));

    expect(id).toMatch(/^\d+$/);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      'startup_error_latest',
      expect.any(String),
    );

    const payload = JSON.parse(mockSetItem.mock.calls[0][1] as string) as {
      id: string;
      name: string;
      message: string;
      timestamp: string;
      stack: string | null;
    };

    expect(payload.id).toBe(id);
    expect(payload.name).toBe('Error');
    expect(payload.message).toBe('db failed');
    expect(typeof payload.timestamp).toBe('string');
  });
});

describe('getStartupErrorLog', () => {
  it('returns parsed data for valid stored JSON', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        id: '123',
        timestamp: '2026-04-10T00:00:00.000Z',
        name: 'Error',
        message: 'failed',
        stack: 'stacktrace',
      }),
    );

    const result = await getStartupErrorLog();

    expect(result).toEqual({
      id: '123',
      timestamp: '2026-04-10T00:00:00.000Z',
      name: 'Error',
      message: 'failed',
      stack: 'stacktrace',
    });
  });

  it('returns null when stored payload is invalid JSON', async () => {
    mockGetItem.mockResolvedValue('not-json');
    expect(await getStartupErrorLog()).toBeNull();
  });
});

describe('clearStartupErrorLog', () => {
  it('removes the stored startup error payload', async () => {
    mockRemoveItem.mockResolvedValue(undefined);

    await clearStartupErrorLog();

    expect(mockRemoveItem).toHaveBeenCalledWith('startup_error_latest');
  });
});
