import Constants from 'expo-constants';

type ExpoExtra = {
  readonly buildProfile?: string | null;
};

export function getBuildProfile(): string | null {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  return extra?.buildProfile ?? null;
}

export function isPreviewBuild(): boolean {
  return getBuildProfile() === 'preview';
}

export function canSeedPreviewData(): boolean {
  return __DEV__ || isPreviewBuild();
}
