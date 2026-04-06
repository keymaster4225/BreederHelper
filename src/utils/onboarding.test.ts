import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOnboardingComplete, setOnboardingComplete } from './onboarding';

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
