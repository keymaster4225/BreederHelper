import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useAppBootstrap } from './src/storage/useAppBootstrap';
import { getOnboardingComplete } from './src/utils/onboarding';

export default function App(): JSX.Element | null {
  const { isReady, error } = useAppBootstrap();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    getOnboardingComplete().then(setOnboardingComplete);
  }, [isReady]);

  if (error) {
    throw error;
  }

  if (!isReady || onboardingComplete === null) {
    return null;
  }

  if (!onboardingComplete) {
    return (
      <SafeAreaProvider>
        <WelcomeScreen onComplete={() => setOnboardingComplete(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
