import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  CLOCK_PREFERENCE_STORAGE_KEY,
  getClockPreference,
  normalizeClockPreference,
  resolveClockDisplayMode,
  setClockPreference,
} from './clockPreferences';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = AsyncStorage.setItem as ReturnType<typeof vi.fn>;

describe('clockPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes missing and invalid values to system default', () => {
    expect(normalizeClockPreference(null)).toBe('system');
    expect(normalizeClockPreference(undefined)).toBe('system');
    expect(normalizeClockPreference('')).toBe('system');
    expect(normalizeClockPreference('military')).toBe('system');
  });

  it('accepts supported preference values', () => {
    expect(normalizeClockPreference('system')).toBe('system');
    expect(normalizeClockPreference('12h')).toBe('12h');
    expect(normalizeClockPreference('24h')).toBe('24h');
  });

  it('loads the stored preference with system as the fallback', async () => {
    mockGetItem.mockResolvedValueOnce('24h');
    await expect(getClockPreference()).resolves.toBe('24h');

    mockGetItem.mockResolvedValueOnce('bad-value');
    await expect(getClockPreference()).resolves.toBe('system');

    expect(mockGetItem).toHaveBeenCalledWith(CLOCK_PREFERENCE_STORAGE_KEY);
  });

  it('persists the selected preference', async () => {
    await setClockPreference('12h');

    expect(mockSetItem).toHaveBeenCalledWith(CLOCK_PREFERENCE_STORAGE_KEY, '12h');
  });

  it('resolves system preference from the device display mode', () => {
    expect(resolveClockDisplayMode('system', '24h')).toBe('24h');
    expect(resolveClockDisplayMode('system', '12h')).toBe('12h');
    expect(resolveClockDisplayMode('12h', '24h')).toBe('12h');
    expect(resolveClockDisplayMode('24h', '12h')).toBe('24h');
  });
});
