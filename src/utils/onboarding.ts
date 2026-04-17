import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_complete';

export async function getOnboardingComplete(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY);
  return val === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await setOnboardingCompleteValue(true);
}

export async function setOnboardingCompleteValue(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
}
