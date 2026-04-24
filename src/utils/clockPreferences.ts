import AsyncStorage from '@react-native-async-storage/async-storage';

export type ClockPreference = 'system' | '12h' | '24h';
export type ClockDisplayMode = '12h' | '24h';

export const CLOCK_PREFERENCE_STORAGE_KEY = 'clock_preference';

export function normalizeClockPreference(value: unknown): ClockPreference {
  return value === '12h' || value === '24h' || value === 'system' ? value : 'system';
}

export async function getClockPreference(): Promise<ClockPreference> {
  const value = await AsyncStorage.getItem(CLOCK_PREFERENCE_STORAGE_KEY);
  return normalizeClockPreference(value);
}

export async function setClockPreference(value: ClockPreference): Promise<void> {
  await AsyncStorage.setItem(CLOCK_PREFERENCE_STORAGE_KEY, value);
}

export function resolveClockDisplayMode(
  preference: ClockPreference,
  systemDisplayMode: ClockDisplayMode,
): ClockDisplayMode {
  return preference === 'system' ? systemDisplayMode : preference;
}
