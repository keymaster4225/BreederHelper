import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getOnboardingComplete,
  setOnboardingComplete,
  setOnboardingCompleteValue,
} from './onboarding';

const mockGetItem = AsyncStorage.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = AsyncStorage.setItem as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getOnboardingComplete', () => {
  it('returns false when key is null', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getOnboardingComplete()).toBe(false);
  });

  it('returns true when key is "true"', async () => {
    mockGetItem.mockResolvedValue('true');
    expect(await getOnboardingComplete()).toBe(true);
  });
});

describe('setOnboardingComplete', () => {
  it('writes "true" to AsyncStorage', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setOnboardingComplete();
    expect(mockSetItem).toHaveBeenCalledWith('onboarding_complete', 'true');
  });
});

describe('setOnboardingCompleteValue', () => {
  it('writes "true" when true is provided', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setOnboardingCompleteValue(true);
    expect(mockSetItem).toHaveBeenCalledWith('onboarding_complete', 'true');
  });

  it('writes "false" when false is provided', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setOnboardingCompleteValue(false);
    expect(mockSetItem).toHaveBeenCalledWith('onboarding_complete', 'false');
  });
});
