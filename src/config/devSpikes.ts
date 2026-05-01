import Constants from 'expo-constants';

type ExpoExtra = {
  readonly runPhotosArchiveSpike?: boolean;
};

export function shouldRunPhotosArchiveSpike(): boolean {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  return __DEV__ && extra?.runPhotosArchiveSpike === true;
}
